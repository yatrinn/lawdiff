#!/usr/bin/env python3
"""Fetch Census TIGER legal geographies, retaining raw responses and provenance.

The postal city is a geocoder search hint, never jurisdiction evidence. Coordinates
are Census address-range interpolation, not independently verified parcel points.
Run: python3 scripts/geocode.py --workers 6
Outputs are written incrementally; --seed-only is an entirely offline operation.
"""
import argparse
import concurrent.futures
import csv
import datetime as dt
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data/geocode-cache'
OUT = ROOT / 'data/geocodes.json'
ENDPOINT = 'https://geocoding.geo.census.gov/geocoder/geographies/address'
DOCS = 'https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html'


def now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')


def query_url(row, strategy='street_city_state'):
    # Some supplied ZIPs are in a different state. ZIP is optional in the Census
    # API, so consistently omit it; retain original fields in the output.
    params = {
        'street': row['street_address'],
        'state': row['state'], 'benchmark': 'Public_AR_Current',
        'vintage': 'Current_Current', 'format': 'json',
    }
    if strategy == 'street_zip_state':
        params['zip'] = row['zip']
    else:
        params['city'] = row['postal_city']
    return ENDPOINT + '?' + urllib.parse.urlencode(params)


def empty_record(row, reason='Not yet geocoded.'):
    return {
        'status': 'unresolved', 'legal_city': None, 'county': None,
        'coordinates': None, 'match_quality': 'unresolved', 'reason': reason,
        'input': {k: row[k] for k in ('street_address', 'postal_city', 'state', 'zip')},
        'provenance': {'provider': 'U.S. Census Bureau', 'documentation_url': DOCS,
                       'postal_city_is_evidence': False},
    }


def normalize(row, payload, requested_at, url, raw_sha, metadata=None):
    record = empty_record(row)
    result = payload.get('result', {})
    matches = result.get('addressMatches', [])
    record['provenance'].update({
        'request_url': url, 'retrieved_at': requested_at,
        'benchmark': result.get('input', {}).get('benchmark'),
        'vintage': result.get('input', {}).get('vintage'),
        'response_sha256': raw_sha,
        'raw_response': 'data/geocode-cache/' + row['address_id'] + '.json',
        'method': 'Census interpolated address coordinate, then official TIGER geographic lookup',
        'limitation': 'Address-range interpolation; not a parcel-survey or independent boundary validation.',
    })
    for key in ('query_strategy', 'attempts', 'request_url_reconstructed', 'note'):
        if metadata and key in metadata:
            record['provenance'][key] = metadata[key]
    record['match_count'] = len(matches)
    if len(matches) != 1:
        record['reason'] = 'No Census address match.' if not matches else 'Multiple Census matches; no jurisdiction selected.'
        record['match_quality'] = 'no_match' if not matches else 'ambiguous'
        return record
    match = matches[0]
    geography = match.get('geographies', {})
    states = geography.get('States', [])
    state_ok = len(states) == 1 and states[0].get('STUSAB') == row['state']
    components = match.get('addressComponents', {})
    if not state_ok or components.get('state') != row['state']:
        record['reason'] = 'Census match state differs from the supplied state or could not be verified.'
        record['match_quality'] = 'state_mismatch'
        return record
    record['matched_address'] = match.get('matchedAddress')
    coords = match.get('coordinates', {})
    if isinstance(coords.get('x'), (int, float)) and isinstance(coords.get('y'), (int, float)):
        record['coordinates'] = {'longitude': coords['x'], 'latitude': coords['y'],
                                 'lon': coords['x'], 'lat': coords['y'],
                                 'x': coords['x'], 'y': coords['y']}
    counties = geography.get('Counties', [])
    if len(counties) == 1:
        record['county'] = counties[0].get('NAME')
        record['county_geoid'] = counties[0].get('GEOID')
    places = geography.get('Incorporated Places', [])
    # Incorporated places are legally defined governments. In NJ/MA, legal
    # county subdivisions can additionally represent active municipalities.
    chosen = places[0] if len(places) == 1 else None
    layer = 'Incorporated Places' if chosen else None
    if chosen is None and not places and row['state'] in ('NJ', 'MA'):
        subdivisions = [g for g in geography.get('County Subdivisions', [])
                        if g.get('FUNCSTAT') in ('A', 'B', 'C', 'F', 'G')
                        and g.get('COUSUBCC', '').startswith('C')]
        if len(subdivisions) == 1:
            chosen, layer = subdivisions[0], 'County Subdivisions'
    record['match_quality'] = 'single_interpolated_address_match'
    record['matched_postal_city'] = components.get('city')
    record['matched_zip'] = components.get('zip')
    record['zip_differs'] = bool(row['zip'] and components.get('zip') != row['zip'])
    record['provenance']['tiger_line'] = match.get('tigerLine')
    if chosen and record['coordinates'] and record['county']:
        record['status'] = 'matched'
        record['legal_city'] = chosen.get('BASENAME') or chosen.get('NAME')
        record['legal_city_geoid'] = chosen.get('GEOID')
        record['legal_city_layer'] = layer
        record['reason'] = 'Legal municipality comes from the Census geography layer, not the postal city.'
        record['postal_city_differs'] = row['postal_city'].casefold() != record['legal_city'].casefold()
    else:
        record['reason'] = 'Address matched, but no unique legal municipality was established; do not assume the postal city.'
    return record


def write_output(records):
    temp = OUT.with_suffix('.tmp')
    temp.write_text(json.dumps(records, indent=2, ensure_ascii=False) + '\n')
    temp.replace(OUT)


def fetch(row):
    address_id = row['address_id']
    strategy = 'street_city_state'
    attempts = []
    while True:
        url, fetched_at = query_url(row, strategy), now()
        response = subprocess.run(['curl', '-fLsS', '--connect-timeout', '8', '--max-time', '25', url],
                                  capture_output=True)
        if response.returncode:
            failed = empty_record(row, 'Public Census request failed: ' + response.stderr.decode(errors='replace').strip()[:250])
            failed['provenance']['attempts'] = attempts + [{'request_url': url, 'query_strategy': strategy, 'retrieved_at': fetched_at, 'error': 'request_failed'}]
            return address_id, failed
        try:
            payload = json.loads(response.stdout)
            if 'result' not in payload:
                raise ValueError('Response has no result field.')
        except (ValueError, TypeError) as exc:
            return address_id, empty_record(row, 'Invalid Census response: ' + str(exc))
        attempts.append({'request_url': url, 'query_strategy': strategy,
                         'retrieved_at': fetched_at,
                         'match_count': len(payload['result'].get('addressMatches', [])),
                         'response_sha256': hashlib.sha256(response.stdout).hexdigest()})
        # A zero-match lookup may be caused by the assessor's mailing city. Try
        # the same supplied street/ZIP/state without a city. Never synthesize a
        # municipality or choose among multiple candidates. normalize() still
        # requires a unique official municipality and verifies the returned state.
        if strategy == 'street_city_state' and payload['result'].get('addressMatches') == [] and row.get('zip'):
            (CACHE / (address_id + '.primary.json')).write_bytes(response.stdout)
            strategy = 'street_zip_state'
            continue
        break
    cache_path = CACHE / (address_id + '.json')
    cache_path.write_bytes(response.stdout)
    metadata = {'request_url': url, 'retrieved_at': fetched_at,
                'query_strategy': strategy, 'attempts': attempts}
    cache_path.with_suffix('.meta.json').write_text(json.dumps(metadata, indent=2))
    return address_id, normalize(row, payload, fetched_at, url, hashlib.sha256(response.stdout).hexdigest(), metadata)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--limit', type=int)
    parser.add_argument('--states', nargs='*')
    parser.add_argument('--only', nargs='*')
    parser.add_argument('--seed-only', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    rows = list(csv.DictReader((ROOT / 'data/starter/data/sample_addresses.csv').open()))
    records = {}
    old = json.loads(OUT.read_text()) if OUT.exists() else {}
    for row in rows:
        aid = row['address_id']
        cached = CACHE / (aid + '.json')
        if cached.exists():
            raw = cached.read_bytes()
            meta_path = cached.with_suffix('.meta.json')
            metadata = json.loads(meta_path.read_text()) if meta_path.exists() else {}
            payload = json.loads(raw)
            stamp = metadata.get('retrieved_at') or dt.datetime.fromtimestamp(cached.stat().st_mtime, dt.timezone.utc).isoformat(timespec='seconds')
            records[aid] = normalize(row, payload, stamp, metadata.get('request_url', query_url(row)), hashlib.sha256(raw).hexdigest(), metadata)
        else:
            records[aid] = old.get(aid) or empty_record(row)
    write_output(records)
    print('Saved initial checkpoint:', sum(r['status'] == 'matched' for r in records.values()), 'matched /', len(rows), flush=True)
    if args.seed_only:
        return
    ordered = sorted(rows, key=lambda r: (r['address_id'] != 'A0107', r['state'] != 'NJ', r['state'] != 'CA', r['address_id']))
    selected = [r for r in ordered if records[r['address_id']]['status'] != 'matched'
                and (not args.states or r['state'] in args.states)
                and (not args.only or r['address_id'] in args.only)]
    if args.limit:
        selected = selected[:args.limit]
    completed = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as pool:
        for aid, record in pool.map(fetch, selected):
            records[aid] = record
            completed += 1
            write_output(records)
            if completed % 10 == 0 or completed == len(selected) or aid == 'A0107':
                print('Processed', completed, '/', len(selected), '— matched', sum(r['status'] == 'matched' for r in records.values()), '/', len(rows), flush=True)
    print('Final checkpoint:', OUT, flush=True)


if __name__ == '__main__':
    main()
