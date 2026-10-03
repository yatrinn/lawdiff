# California extraction review

This document accompanies `data/extracted/california.json`. The artifact contains 30 source-grounded rule records extracted by Codex from supplied text. Method: `codex_assisted_extraction`. It is an LLM-assisted extraction snapshot, **not an independently validated legal dataset**, a claimed API batch run, or a certified complete account of California law.

## Validation performed

- All 30 records validate against the supplied `rule_record.schema.json` with the system Python `jsonschema` validator.
- All 30 primary quotations and 80 supplemental evidence quotations occur exactly in the named supplied source text.
- Eight independent execution assertions check the Los Angeles 1978 boundary, the separate exemption uncertainty after adding a certificate date, standard versus small-landlord deposit coverage for a 20-unit property, the organizer's T1 date transition, and expiration of the old LA 3% rate.
- Condition validation requires the extra fact fields agreed with the integrating agent. Primary spans and supplemental spans are separate: a valid primary quote alone does not prove every condition.
- Spanish descriptions are labeled unreviewed machine translations. The English source controls.

## Coverage and limits

The JSON `source_coverage` records every California/state/city source in the manifest, whether captured text exists, which records use it, and material exclusions. Rules cover state rent cap, just cause, standard and small-landlord deposits, deposit return, screening fees, screening restrictions and algorithmic pricing; Los Angeles rent/eviction/deposit protections; San Francisco rent, eviction and algorithmic rules; Berkeley rent/eviction/deposit/fees/screening/algorithmic rules; and San Diego eviction/relocation plus an explicitly unverified draft algorithmic ban.

The extraction is scoped to the supplied residential multifamily sample. Do not advertise it as a general single-family, mobilehome or institutional-housing navigator. Some requirements describe a conditional transaction obligation; they do not assert that an eviction, application, rent increase or deposit collection has occurred.

### Material source problems

| Source | Finding and handling |
|---|---|
| D022 | AB325 contains the enacted prohibition but no explicit January 1 commencement clause. The artifact labels 2026-01-01 as derived from organizer T1, not proved by the main quote. No independently sourced SB763 record is invented. |
| D001 | Berkeley ordinance capture says passed to print and does **not** contain the March 1 effective date described in the participant guide. Status draws on the guide, date remains null, conflict flag warns of unresolved commencement. Do not claim the capture independently establishes final adoption. |
| D039 | Los Angeles motion seeks a report and feasibility study. It does not enact an algorithmic ban. No operative ban is extracted. |
| D042 | 3% is expressly limited to July1,2025–June30,2026. The version ends July1,2026. It is never represented as the October2026 current rate. |
| D041 | Current LA overview describes the annual framework and utility-percentage change but does not give a current annual percentage. No 90%-CPI/1–4% formula is invented from memory. |
| D076 | San Diego draft has blank ordinance number, final-passage date and adoption certificate. Its record is labeled draft/pending with adoption unverified. Publisher D074 must be retrieved before claiming the current real-world status. |
| D078 | The captured SF page is a generic HRC landing page. It gives only a broad sentence about affordable-housing Fair Chance protection. Detailed operative restrictions are not invented. |
| D082–D085 | No text was available during this extraction. No SF interest rate or Santa Ana law was invented from URL/title. These remain acquisition tasks. |
| D005 | Berkeley's page states a 2026 screening figure of $68.96. It is not propagated as a single authoritative statewide dollar figure because the supplied guide flags uncertainty. |
| D043 | Detailed LA relocation table depends on household and eviction circumstances absent from property data. Existing LA eviction records retain the relocation obligation; a dollar amount is not inferred for a particular address. |

## Fact semantics

Unknown is preserved when necessary. The absence of a fact is not evidence that an exemption is false.

- `certificate_age_years`: derive only from an actual supplied certificate date and the query date. A construction year is not an exact occupancy certificate.
- For the fixed LA/SF/Berkeley historical cutoffs, the supplied guide allows initial year screening outside the boundary year. The boundary year still needs an exact certificate date. Property-specific exceptions remain independent.
- `owner_occupied` in the California duplex exemption must mean continuous owner occupancy from the start of the tenancy, and the specified no-ADU/JADU arrangement. Current owner occupancy alone does not prove that exemption.
- `affordable_housing` means the source's qualifying recorded restriction or agreement, not simply a claim that rent is affordable.
- `owner_type=family_trust` means the specific statutory family trust definition. It does not include every trust.
- `la_rso_exempt`, `sf_rent_control_exempt`, `berkeley_ordinance_exempt`, `berkeley_rent_exempt`, `local_just_cause_exempt` and `unit_fair_chance_exempt` require actual exemption review. They are never defaulted to false.
- Berkeley's full-ordinance exemption differs from its rent-cap-only exemption. Many partially covered units still have just-cause and deposit-interest protection.
- `transient_hotel` means California's transient/tourist-hotel occupancy under Civil Code1940(b). It is not interchangeable with San Diego's `tenancy_short_term`, which includes its specified lease-length exclusion.
- A property with more than four rental units rules out the small-landlord deposit exception. The owner name is not needed for that decisive branch.

## A0107 demonstration

The LA 1978 record initially needs an exact certificate date and separate exemption review. Entering a **hypothetical** certificate date before the cutoff resolves the date branch only. The result remains unknown until the independent exemption question is resolved. This prevents the demo from falsely claiming that one fact proves the entire case. Always label user-supplied values and simulations by their actual provenance.

## Priority relations

The fixed SF and Berkeley rates and historical LA3% record reference California Civil Code1947.12(d)(3), which excludes housing subject to valid stricter local rent control. Both local coverage and the relevant date must be established before applying that relationship. No generic rule that all local law overrides state law is used. No blanket local just-cause override is asserted without the statutory prerequisites.

## Remaining legal review

This is not an exhaustive extraction of every procedural subclause. Detailed permitted grounds, tenant notice wording, relocation eligibility, mobilehome carveouts, initial-rent versus continuing-tenancy distinctions, LA replacement units and qualified local just-cause precedence need deeper review for production use. These limits must remain visible in the product and submission methodology.
