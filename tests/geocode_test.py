#!/usr/bin/env python3
"""Offline safety checks for Census normalization and search fallback."""
import copy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import sys
from unittest.mock import patch
from types import SimpleNamespace
import urllib.parse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import geocode

ROW = {'address_id': 'TEST', 'street_address': '10635 SHERMAN GROVE AVE',
       'postal_city': 'Mailing City', 'state': 'CA', 'zip': '91040'}


def response(state='CA', city='Los Angeles'):
    return {'result': {'input': {}, 'addressMatches': [{
        'geographies': {
            'States': [{'STUSAB': state}],
            'Counties': [{'NAME': 'Los Angeles County', 'GEOID': '06037'}],
            'Incorporated Places': [{'NAME': city + ' city', 'BASENAME': city, 'GEOID': '0644000'}],
        },
        'coordinates': {'x': -118.307, 'y': 34.26},
        'addressComponents': {'state': state, 'city': 'SUNLAND', 'zip': '91040'},
        'matchedAddress': '10635 SHERMAN GROVE AVE, SUNLAND, CA, 91040',
    }]}}


def normalize(payload):
    return geocode.normalize(ROW, payload, '2026-10-03T20:00:00+00:00',
                             geocode.query_url(ROW), hashlib.sha256(json.dumps(payload).encode()).hexdigest())


class GeographyTests(unittest.TestCase):
    def test_legal_city_is_geography_not_any_postal_city(self):
        result = normalize(response())
        self.assertEqual(result['legal_city'], 'Los Angeles')
        self.assertEqual(result['matched_postal_city'], 'SUNLAND')
        self.assertTrue(result['postal_city_differs'])
        self.assertFalse(result['provenance']['postal_city_is_evidence'])

    def test_wrong_state_is_rejected(self):
        result = normalize(response(state='NY'))
        self.assertEqual(result['status'], 'unresolved')
        self.assertIsNone(result['legal_city'])
        self.assertEqual(result['match_quality'], 'state_mismatch')

    def test_county_only_does_not_become_postal_city(self):
        payload = response()
        del payload['result']['addressMatches'][0]['geographies']['Incorporated Places']
        result = normalize(payload)
        self.assertEqual(result['county'], 'Los Angeles County')
        self.assertIsNone(result['legal_city'])
        self.assertEqual(result['status'], 'unresolved')

    def test_multiple_address_matches_are_not_selected(self):
        payload = response()
        payload['result']['addressMatches'].append(copy.deepcopy(payload['result']['addressMatches'][0]))
        result = normalize(payload)
        self.assertEqual(result['match_quality'], 'ambiguous')
        self.assertIsNone(result['legal_city'])

    def test_zero_matches_remain_unresolved(self):
        result = normalize({'result': {'addressMatches': []}})
        self.assertEqual(result['match_quality'], 'no_match')

    def test_fallback_omits_city_retains_original_street_state_zip(self):
        empty = {'result': {'addressMatches': []}}
        responses = [SimpleNamespace(returncode=0, stdout=json.dumps(x).encode(), stderr=b'')
                     for x in [empty, response()]]
        with tempfile.TemporaryDirectory() as directory, patch.object(geocode, 'CACHE', Path(directory)), patch.object(geocode.subprocess, 'run', side_effect=responses) as curl:
            aid, result = geocode.fetch(ROW)
            self.assertEqual(aid, 'TEST')
            self.assertEqual(result['status'], 'matched')
            urls = [call.args[0][-1] for call in curl.call_args_list]
            first = urllib.parse.parse_qs(urllib.parse.urlparse(urls[0]).query)
            fallback = urllib.parse.parse_qs(urllib.parse.urlparse(urls[1]).query)
            self.assertNotIn('zip', first)
            self.assertNotIn('city', fallback)
            for key, field in [('street', 'street_address'), ('state', 'state'), ('zip', 'zip')]:
                self.assertEqual(fallback[key], [ROW[field]])
            self.assertEqual(result['provenance']['query_strategy'], 'street_zip_state')
            self.assertEqual(len(result['provenance']['attempts']), 2)
            self.assertTrue((Path(directory) / 'TEST.primary.json').exists())

    def test_ambiguous_result_does_not_trigger_fallback(self):
        payload = response()
        payload['result']['addressMatches'].append(copy.deepcopy(payload['result']['addressMatches'][0]))
        reply = SimpleNamespace(returncode=0, stdout=json.dumps(payload).encode(), stderr=b'')
        with tempfile.TemporaryDirectory() as directory, patch.object(geocode, 'CACHE', Path(directory)), patch.object(geocode.subprocess, 'run', return_value=reply) as curl:
            _, result = geocode.fetch(ROW)
            self.assertEqual(curl.call_count, 1)
            self.assertEqual(result['match_quality'], 'ambiguous')

    def test_wrong_state_fallback_does_not_override_supplied_state(self):
        replies = [SimpleNamespace(returncode=0, stdout=json.dumps(p).encode(), stderr=b'')
                   for p in [{'result': {'addressMatches': []}}, response(state='NY')]]
        with tempfile.TemporaryDirectory() as directory, patch.object(geocode, 'CACHE', Path(directory)), patch.object(geocode.subprocess, 'run', side_effect=replies):
            _, result = geocode.fetch(ROW)
            self.assertEqual(result['status'], 'unresolved')
            self.assertIsNone(result['legal_city'])

    def test_new_jersey_legal_county_subdivision_uses_actual_census_keys(self):
        row = {**ROW, 'state': 'NJ', 'postal_city': 'Mailing Name'}
        payload = response(state='NJ', city='Hoboken')
        geography = payload['result']['addressMatches'][0]['geographies']
        del geography['Incorporated Places']
        geography['Counties'] = [{'NAME': 'Hudson County', 'GEOID': '34017'}]
        geography['County Subdivisions'] = [{'BASENAME': 'Hoboken', 'NAME': 'Hoboken city',
            'GEOID': '3401732250', 'COUSUBCC': 'C5', 'FUNCSTAT': 'F'}]
        result = geocode.normalize(row, payload, '2026-10-03T20:00:00+00:00', 'https://example.test', 'test')
        self.assertEqual(result['legal_city'], 'Hoboken')
        self.assertEqual(result['legal_city_layer'], 'County Subdivisions')

    def test_statistical_subdivision_is_not_accepted_as_government(self):
        row = {**ROW, 'state': 'NJ'}
        payload = response(state='NJ')
        geography = payload['result']['addressMatches'][0]['geographies']
        del geography['Incorporated Places']
        geography['County Subdivisions'] = [{'BASENAME': 'Statistical Area', 'GEOID': '3400000000',
                                           'COUSUBCC': 'Z3', 'FUNCSTAT': 'S'}]
        result = geocode.normalize(row, payload, '2026-10-03T20:00:00+00:00', 'https://example.test', 'test')
        self.assertIsNone(result['legal_city'])


if __name__ == '__main__':
    unittest.main()
