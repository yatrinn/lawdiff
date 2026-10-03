# Census geography acquisition

Run `python3 scripts/geocode.py --workers 6` from the project directory. This
requires network access to `geocoding.geo.census.gov`. Each completed response is
cached under `data/geocode-cache/`; `data/geocodes.json` is atomically rewritten
after every completed record. Existing successful matches are reused. Use
`--seed-only` to rebuild the index from cached responses without network access.

The CSV's postal city is a **search hint**, never the evidence for municipal
jurisdiction. Supplied ZIP codes are retained, but consistently omitted from the
request because the sample includes ZIPs in a different state. The Census API
explicitly supports street + city + state without ZIP. The returned state's
official abbreviation must match the input state.

Only when that primary request returns **zero matches**, a second request uses
the same original street, state and ZIP, omitting the city. This allows an
assessor's broad mailing-city label to differ from the USPS place name without
inventing an alternate city. Both attempts and the first empty raw response are
retained. Multiple matches, network failures and wrong-state matches do not
trigger additional candidate selection; wrong-state fallback results are rejected.
Run `python3 tests/geocode_test.py` for the offline normalization/fallback tests.

The coordinate is interpolated along a Census address range. The legal city is
read from Census's **Incorporated Places** geography at that point. Where this
layer is absent, the script can use a uniquely identified, active legal county
subdivision for NJ/MA. County, city GEOID, geographic layer, returned standardized
address, raw response hash, request, benchmark, vintage, and acquisition time are
retained. Raw responses allow independent verification.

No match, multiple matches, wrong-state matches, request errors, and an absent
unique municipal geography stay explicitly unresolved. An unresolved legal city
does not become the postal city. A missing incorporated-place layer does not, by
itself, justify asserting a specific city's absence or an unincorporated status.

These are reproducible Census matches, **not parcel surveys or judicially
confirmed boundaries**. Address interpolation can place a point imperfectly near
a border. A production service must independently verify boundary cases against
parcel-level coordinates and authoritative current municipal boundaries. Historical
queries must also account for historical boundaries; this capture uses the
specified current geography snapshot.

Source documentation:
https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html

The first cached sample, A0002, was imported unchanged from an existing successful
Census probe. Its `.meta.json` flags that the equivalent request URL was
reconstructed from the input printed in the Census response.
