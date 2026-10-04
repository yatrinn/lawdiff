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
import re
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
    if len(matches) > 1:
        # An ambiguous address point can still have an unambiguous legal city:
        # require EVERY Census candidate to establish the same official codes.
        # Never filter candidates by the expected city, ZIP, or desired answer.
        candidates = [normalize(row, {'result': {**result, 'addressMatches': [match]}},
                                requested_at, url, raw_sha)
                      for match in matches]
        keys = [_jurisdiction_key(candidate, row['state']) for candidate in candidates]
        record['provenance']['candidate_geographies'] = [
            _candidate_evidence(candidate) for candidate in candidates]
        if all(keys) and len(set(keys)) == 1:
            first = candidates[0]
            for key in ('legal_city', 'legal_city_geoid', 'legal_city_layer', 'county', 'county_geoid', 'postal_city_differs'):
                record[key] = first[key]
            record.update(status='matched', match_quality='multiple_matches_same_legal_jurisdiction',
                          coordinates=None, coordinate_status='not_selected_multiple_address_matches',
                          matched_addresses=[candidate.get('matched_address') for candidate in candidates],
                          reason='Every reported Census address candidate has the same official state, county and legal-municipality codes. No single location was selected.')
            record['provenance']['method'] = 'Consensus of all Census address candidates and their official TIGER legal-geography codes'
            record['provenance']['limitation'] = 'Legal jurisdiction consensus only; the address point remains ambiguous. Postal city and ZIP did not select a candidate.'
            return record
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


def _jurisdiction_key(record, state):
    """Strict official-code identity for consensus, never a municipality-name guess."""
    prefix = {'CA': '06', 'NJ': '34', 'MA': '25'}.get(state)
    county = record.get('county_geoid')
    city = record.get('legal_city_geoid')
    layer = record.get('legal_city_layer')
    if (not prefix or record.get('status') != 'matched' or not record.get('coordinates')
            or not isinstance(county, str) or not re.fullmatch(r'\d{5}', county)
            or not county.startswith(prefix) or not isinstance(city, str)):
        return None
    if layer == 'Incorporated Places':
        if not re.fullmatch(r'\d{7}', city) or not city.startswith(prefix):
            return None
    elif layer == 'County Subdivisions' and state in ('NJ', 'MA'):
        if not re.fullmatch(r'\d{10}', city) or not city.startswith(county):
            return None
    else:
        return None
    return state, county, layer, city


def _candidate_evidence(record):
    return {key: record.get(key) for key in (
        'status', 'matched_address', 'matched_postal_city', 'matched_zip',
        'county', 'county_geoid', 'legal_city', 'legal_city_geoid',
        'legal_city_layer', 'coordinates')}


def normalize_components(row, components):
    """Resolve a slash-separated address only when ALL literal components agree.

    Each component supplies its unmodified street text, original Census payload,
    request URL, retrieval timestamp and raw-response hash. A street suffix or
    number is never invented; the original row remains unchanged in the result.
    """
    original_parts = [part.strip() for part in row['street_address'].split('/')]
    if (len(original_parts) < 2 or len(components) != len(original_parts)
            or [item.get('street_address') for item in components] != original_parts
            or any(not re.match(r'^\d+\s+\S', part) for part in original_parts)):
        raise ValueError('Components must preserve every complete literal slash-separated street address.')
    records = []
    for item in components:
        parsed = urllib.parse.urlparse(item['request_url'])
        query = urllib.parse.parse_qs(parsed.query)
        if (parsed.scheme != 'https' or parsed.netloc != 'geocoding.geo.census.gov'
                or parsed.path != '/geocoder/geographies/address'
                or query.get('street') != [item['street_address']]
                or query.get('state') != [row['state']]
                or not re.fullmatch(r'[a-f0-9]{64}', item['response_sha256'])):
            raise ValueError('Component provenance must identify the exact official Census street/state query.')
        component_row = {**row, 'street_address': item['street_address']}
        records.append(normalize(component_row, item['payload'], item['retrieved_at'],
                                 item['request_url'], item['response_sha256']))
    record = empty_record(row, 'Literal component queries did not establish one shared legal jurisdiction.')
    record['match_quality'] = 'component_jurisdiction_unresolved'
    record['provenance'].update({
        'method': 'Separate literal components of the supplied slash-separated address, then require all official Census legal-geography codes to agree',
        'query_strategy': 'literal_slash_components',
        'limitation': 'No parcel identity or single coordinate is inferred for the compound input. All original street components must agree.',
        'components': [{key: item[key] for key in ('street_address', 'request_url', 'retrieved_at', 'response_sha256')}
                       | {'candidate_geography': _candidate_evidence(candidate)}
                       for item, candidate in zip(components, records)],
    })
    keys = [_jurisdiction_key(candidate, row['state']) for candidate in records]
    if all(keys) and len(set(keys)) == 1:
        for key in ('legal_city', 'legal_city_geoid', 'legal_city_layer', 'county', 'county_geoid', 'postal_city_differs'):
            record[key] = records[0][key]
        record.update(status='matched', match_quality='literal_components_same_legal_jurisdiction',
                      match_count=sum(candidate['match_count'] for candidate in records),
                      coordinates=None, coordinate_status='not_selected_compound_address',
                      matched_addresses=[candidate.get('matched_address') for candidate in records],
                      reason='Every literal street-address component matched the same official Census state, county and legal-municipality codes. The original compound address is unchanged.')
    return record


def ordinal_street(street):
    """Remove only padding zeros from an ordinal street-name token, never house numbers."""
    parts = street.split(maxsplit=1)
    if len(parts) != 2 or not re.fullmatch(r'\d+[A-Za-z]?', parts[0]):
        return street
    name = re.sub(r'(?<!\w)0+(\d+(?:ST|ND|RD|TH))(?!\w)', r'\1', parts[1], flags=re.IGNORECASE)
    return parts[0] + ' ' + name


def normalize_refinement(row, evidence, strategy):
    """Replay exact public response bytes for a narrowly defined address clarification."""
    components = []
    for item in evidence:
        raw = item.get('raw_response_text')
        if not isinstance(raw, str) or hashlib.sha256(raw.encode('utf8')).hexdigest() != item.get('response_sha256'):
            raise ValueError('Refinement response bytes do not match their recorded hash.')
        component = {**item, 'payload': json.loads(raw)}
        parsed = urllib.parse.urlparse(item['request_url'])
        query = urllib.parse.parse_qs(parsed.query)
        if (parsed.scheme != 'https' or parsed.netloc != 'geocoding.geo.census.gov'
                or parsed.path != '/geocoder/geographies/address'
                or query.get('street') != [item['street_address']]
                or query.get('state') != [row['state']]
                or query.get('city') != [row['postal_city']]):
            raise ValueError('Refinement query is not the documented official street/city/state request.')
        supplied = component['payload'].get('result', {}).get('input', {}).get('address', {})
        if (supplied.get('street') != item['street_address'] or supplied.get('state') != row['state']
                or supplied.get('city') != row['postal_city']):
            raise ValueError('Response input does not match its documented clarification query.')
        components.append(component)
    if strategy == 'literal_slash_components':
        record = normalize_components(row, components)
    elif strategy == 'ordinal_padding_only':
        if (len(components) != 1 or ordinal_street(row['street_address']) == row['street_address']
                or components[0]['street_address'] != ordinal_street(row['street_address'])):
            raise ValueError('Only padding-zero removal from the supplied ordinal street name is permitted.')
        item = components[0]
        record = normalize(row, item['payload'], item['retrieved_at'], item['request_url'],
                           item['response_sha256'], {'query_strategy': strategy,
                           'note': 'Query removes only a leading zero from an ordinal street-name token; original address remains unchanged.'})
        # New evidence is embedded below, not mislabelled as an older cached reply.
        record['provenance'].pop('raw_response', None)
    else:
        raise ValueError('Unknown refinement strategy.')
    record['provenance']['query_strategy'] = strategy
    record['provenance']['replay_evidence'] = [{key: item[key] for key in
        ('street_address', 'request_url', 'retrieved_at', 'response_sha256', 'raw_response_text')}
        for item in evidence]
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
        old_provenance = old.get(aid, {}).get('provenance', {})
        if old_provenance.get('replay_evidence'):
            # Original no-match caches must not silently replace a later,
            # byte-verifiable official clarification on an offline replay.
            records[aid] = normalize_refinement(row, old_provenance['replay_evidence'],
                                                old_provenance['query_strategy'])
        elif cached.exists():
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
