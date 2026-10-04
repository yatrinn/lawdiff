# Census geography: evidence and conservative refinements

`data/geocodes.json` stores one geography record per unchanged supplied address. The legal municipality comes from U.S. Census Bureau geographic layers, never from the sample's postal-city label or ZIP alone. The Census documentation is recorded with each result: <https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html>.

## Recorded checkpoint: 4 October 2026

The finalisation pass established legal cities for 16 previously unresolved records, increasing the recorded legal-city total from 475 to 491 out of 500. All previously matched records and all 500 original address inputs were preserved. This measures geographic resolution, not legal-rule applicability or parcel-level accuracy.

| Evidence class | Records | Treatment |
|---|---|---|
| Every Census match has the same official state, county and municipality codes | A0094, A0103, A0156, A0279, A0291, A0400, A0403, A0428, A0488 | Municipality and county accepted; no single coordinate selected. |
| Every literal component of the supplied compound address matches the same official codes | A0168 | `600 JACKSON` and `601 HARRISON` both match Hoboken, Hudson County, NJ. Original `600 JACKSON/601 HARRISON` preserved; no parcel identity or single coordinate inferred. |
| Leading padding zero removed only from an ordinal street-name token | A0115, A0229, A0328, A0357, A0364, A0484 | The official queries used `5TH`, `3RD`, `8TH` or `7TH` instead of `05TH`, `03RD`, `08TH` or `07TH`. Each returned a single San Francisco legal-city match. House numbers and original inputs are unchanged. |

Ten new records therefore have a resolved legal jurisdiction and an explicitly unselected coordinate. The other six have Census address-range interpolations. None is claimed to be an independently surveyed parcel point.

## What the consensus checks require

For a multi-match response, **every returned candidate** must independently establish the supplied state, a county and a legal municipality. Their official state/county/municipality GEOIDs and geography layer must agree exactly. Names, postal labels and desired results do not break ties. Missing or conflicting geography evidence rejects consensus; candidates are never discarded to make the answer agree.

County and municipality GEOIDs must have the expected state prefix and structure. Incorporated Places are the normal legal-municipality layer. Active legal County Subdivisions are additionally supported in New Jersey and Massachusetts. Statistical subdivisions are not treated as municipal governments.

`match_quality: "multiple_matches_same_legal_jurisdiction"` distinguishes this result from a unique address match. Candidate addresses, coordinates and geographic codes remain in `provenance.candidate_geographies`. The top-level `coordinates` is null, and `coordinate_status` explains why. This can establish municipal jurisdiction without pretending that one of several possible address points was selected.

## Narrow address clarifications

`normalize_refinement` accepts only two documented strategies:

- `literal_slash_components`: query each complete literal number-and-street component already present in the supplied slash-separated address. Every component must agree on official jurisdiction. No missing number or street suffix is invented.
- `ordinal_padding_only`: remove a leading padding zero from a numeric ordinal street-name token, such as `05TH` → `5TH`. House numbers are untouched. Other address edits are rejected.

For these new queries, the record embeds the exact public Census JSON text in `provenance.replay_evidence`, along with the request URL, retrieval time and SHA-256. Replay verifies the exact bytes and requires both the URL and the response's echoed street/city/state input to match the documented clarification. The unchanged original sample address remains in `input`.

The ordinary `data/geocode-cache/` retains original Census responses locally. New embedded refinement evidence takes precedence over an older no-match cache during replay, preventing a later offline run from silently discarding the documented clarification. Invalid evidence hashes or mismatched request inputs fail validation.

## Remaining gaps

The checkpoint leaves A0009, A0098, A0128, A0295, A0346, A0352, A0376, A0380 and A0384 unresolved. Several supplied addresses lack house numbers; the fractional/range input A0009 yields different official municipalities; A0352 has conflicting municipal results. A0384 has no recorded Census match. Postal labels, ZIPs, sample-dataset titles and expected evaluation totals do not resolve these gaps.

## Reproduction and checks

Run the offline safety tests:

```sh
python3 -m unittest discover -s tests -p '*_test.py'
```

`python3 scripts/geocode.py --seed-only` replays existing local Census caches and byte-verified embedded refinements without network requests, and writes the geography artifact. It does not regenerate the public source catalog. Preserve the existing `data/geocodes.json`, which contains the embedded clarification receipts, when reproducing the refinement results.

A normal `scripts/geocode.py` run may request unresolved addresses from Census and write incremental checkpoints. It tries the original street/city/state first; after a zero match it may use the original street/ZIP/state without a city. Returned official geographic layers, not the search hint, still establish jurisdiction. Multiple-match responses do not trigger a search for a preferred candidate.

The application catalog, submission exports and rendered media must be rebuilt separately by the integration owner after accepting the geography artifact. This finalisation pass did not rewrite those generated outputs.
