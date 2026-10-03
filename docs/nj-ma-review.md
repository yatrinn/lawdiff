# New Jersey and Massachusetts extraction review

This artifact is source-grounded **Codex-assisted extraction**, not an externally executed model batch and not legal review. It was produced by reading the supplied source text and translating supported requirements into the executable rule format. The integration must retain that provenance. Exact quotation tests demonstrate that the passages exist; they do not certify their interpretation.

## Deliverables

- `data/extracted/nj-ma.json`: 27 schema-valid rule records, four separate findings, and a scan disposition for every New Jersey / Massachusetts source in the supplied manifest.
- Main quotations, additional evidence, date evidence, and municipal-conflict evidence were tested as exact substrings of the corresponding supplied text files.
- Spanish requirements are machine translations, clearly labelled; the English source controls.

## Important classification decisions

1. The New Jersey FAIR Act (D069) is enacted but not effective at the default 2026-10-01 date. The effective date 2027-07-01 follows the primary text: approved July 20, 2026; first day of the twelfth month next following enactment. It is not inferred solely from the challenge key. Municipal preemption is flagged as a possible conflict, not a resolved displacement of local law.
2. The New Jersey application-fee law (D066) was approved January 20, 2026; first day of the fourth following month gives May 1, 2026. The $50 figure is a statutory base subject to future adjustment, not a perpetually fixed amount. One-/two-family dwellings are excluded. The property-level rule describes landlord charges, not charges by an independent real-estate licensee.
3. Massachusetts H.5222 and S.2983 are **pending** in the supplied records. Those captures contain bill titles and histories, not the complete operative bill text. The records describe potential statewide scope and explicitly avoid a claimed current ban or fully known detailed coverage.
4. Massachusetts Chapter 40P §4 is a prohibition on municipal rent control with a narrowly conditioned voluntary exception. It is stored as a separate `no_rule` finding, never as an applicable numerical rent cap. Boston H.3744 is a past-session petition with a study-order history, also not an enacted cap.
5. T5's failed-ballot event is a supplied challenge fixture. The Chapter 40P text does not prove the separate litigation outcome. No fabricated failed-ballot rule or positive cap is emitted from that source.
6. Massachusetts, Boston and Cambridge notice/retaliation requirements are classified in the available `just_cause_eviction` category but carry `rule_kind` and explicit prose saying they are **not a general just-cause regime**. A notice duty does not establish a restriction requiring substantive good cause.
7. Boston's Fair Chance tenant-selection and credit-score policy applies to specified DND/BPDA assisted or inclusionary housing, not all Boston addresses. Its assistance fact remains unknown until supported.
8. Jersey City's supplied official page establishes rent-control administration and a one-to-four-unit exemption but does not state the full formula or all exceptions. A `source_gap` finding is recorded; no local cap formula is invented.

## Coverage facts that must remain unknown unless supplied

The engine must support the following boolean fields in addition to existing owner/unit facts:

- `boston_policy_covered`: specified DND funding/land or BPDA inclusionary housing.
- `ma_short_vacation_tenancy`: vacation/recreational tenancy of 100 days or less.
- `institutional_housing_exemption`: the hospital/nursing/health or qualifying short-term treatment exception applicable to the local notification ordinance.
- `transient_housing`: transient/short-term occupancy relevant to the specific rule.
- `nj_disabled_family_trust`: New Jersey trust-unit exception for the permanently resident developmentally disabled family member.
- `written_lease` and `tenancy_at_will`: tenure facts for the separate Massachusetts notice rules.

A residential assessor classification does not establish these tenancy or ownership facts. The same is true of Boston assisted-housing status. The initial address output can therefore legitimately include unresolved coverage. Do not silently default these facts to false in order to improve apparent coverage.

The New Jersey deposit opt-in field means a qualifying written opt-in has become effective after the prescribed 30 days; a merely expressed wish is not enough. `units` denotes the relevant dwelling count; property records that aggregate or omit this count require care.

## What has and has not been validated

- All 27 records pass the supplied `rule_record.schema.json`.
- Exact main/supplementary quotations and source IDs are verified locally.
- Schema unconditional coverage is `{ "all": [] }`; a bare boolean is accepted by the initial engine but rejected by the organizer schema.
- Engine pack validation passed after adding the seven approved fact fields in memory for the check. No engine file was changed by this agent. Nineteen targeted behavior checks passed: effective-date boundaries, owner/unit exceptions, opt-in, pending proposals and missing facts. The integration must persist the approved fact fields.
- No statistical extraction-accuracy claim is made. No external legal review or official hidden-score run occurred.
- Dates are left null when the captured source does not establish a precise historical effective date. The parent engine should retain unknown status for unsupported historical queries.
- Original link-only captures remain distinguishable from supplemental sources. The two local algorithmic bans are now supported by supplemental official text as described below; Hoboken/Newark rent formulas and full Jersey City rent-control conditions still need further source capture.

## Source scan

| Source | Disposition | Notes |
|---|---|---|
| D010 | extracted | Extracted limited DND/BPDA-assisted Fair Chance policy and credit-score restriction; scope depends on unavailable assistance status. |
| D011 | reviewed_no_additional_rule | Prior193rd-session Boston petition; study order, no enacted rentcap. Separate finding only. |
| D012 | extracted | Local official guidance: rental-assistance discrimination. Not treated as complete exemption text. |
| D013 | reviewed_no_additional_rule | Current HSNA delivery/city-notification process corroborates D014; no duplicate rule. |
| D014 | extracted | HSNA effective date and exceptions; classified as notice protection, not general justcause. |
| D029 | extracted | Cambridge protected screening and owner-occupiedtwo-family exception. |
| D030 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D031 | extracted | Cambridge notice guide with medical/short-term exceptions, not eviction prohibition. |
| D032 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D033 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D034 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D035 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D036 | reviewed_no_additional_rule | Establishes existence of rentcontrol and1–4unit exemption; missing formula/fullconditions so gapfindingonly. |
| D037 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D045 | extracted | Pending H.5222 status only; operative bill text not included. |
| D046 | extracted | Pending S.2983 status only; operative bill text not included. |
| D047 | reviewed_no_additional_rule | Duplicates S.2983 displayed history; supports pendingstatus, no newrule. |
| D048 | reviewed_no_additional_rule | General municipal rentcontrol prohibition with narrow voluntary exception; separate no-activecapfinding. |
| D049 | extracted | Extracted directpublic-assistance/rental-subsidy protection (§4(10)). Broaderclassspecific exceptionsrequiredefinition/sourcecoverage; notassumed. |
| D050 | extracted | Written-lease nonpayment notice/cure; notgeneraljustcause. |
| D051 | extracted | Tenancy-at-will notice/cure; depends on tenancytype. |
| D052 | extracted | Deposit cap/account/interest/return and exhaustive upfrontpaymentlist. Vacation/recreational<=100dayexceptionrequiresunknownfact. |
| D053 | extracted | Anti-retaliationprotection andsix-monthpresumption; notgeneraljustcause. |
| D054 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D055 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D056 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D057 | extracted | Engaging-party brokerfee rule fromAugust1,2025. |
| D058 | extracted | Nonpaymentnoticeinformationform requirement, notjustcause. |
| D059 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D060 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D061 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D062 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D063 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D064 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D065 | extracted | FairChancebefore/afterconditionaloffer with owner-occupied<=4unitexception. |
| D066 | extracted | $50baseapplicationfeecap, one/twofamily andindependentlicenseeexclusions, CPIprovisions, calculatedMay1,2026effectivedate. |
| D067 | extracted | OfficialDCAguide:deposit,goodcause,rentincreaseprocedures. Pageitselfnotusedtoinventmissinglocalformulas. |
| D068 | extracted | Lawfulsourceofincome andLADpropertyexemptions. Guide2015; notclaimedrecentstatutoryconsolidation. |
| D069 | extracted | Enacted FAIRAct, computedJuly1,2027effective, expressmunicipalconflictclause. Noassumedpreemption. |
| D070 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D071 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |
| D072 | unavailable | Text not supplied; no legal obligation fabricated from URL/title alone. |

## Supplemental local algorithmic bans

Three public legal-text excerpts were captured through the web tool and stored in `data/supplemental/nj-sources.json`:

- **S001:** Hoboken's published municipal code, Chapter 158 Article II §158-2. The capture includes adoption information, operative restriction, definitions and enforcement text.
- **S002:** Jersey City Ordinance 25-076, linked from item 4.3 of the official July 16, 2025 council minutes. This amendment adds “or otherwise utilize” to the coordinating-service prohibition.
- **S003:** Jersey City Ordinance 25-057, providing the original definitions and exclusions retained by the amendment.

These are explicitly labelled `source_capture: web_tool_text`, with selected-excerpt scope. The text digest identifies this capture, **not** the bytes of the original HTML or PDF. They do not silently replace any of the original 87 starter records.

`HOB-ALG-01` and `JC-ALG-01` are source-validated rule records. The whole NJ/MA artifact now has 27 schema-valid rules. Supplementary definitions and the operative primary quotes also pass the application's current source validator. Targeted checks distinguish Hoboken, Jersey City and Newark and flag potential FAIR Act conflicts after its effective date.

For these two rules, `{all:[]}` expresses portfolio-level applicability within the challenge's supplied residential-apartment dataset. All supplied New Jersey records use assessor class 4C, and the participant guide identifies the residential multifamily sample. It does **not** certify primary-residence occupancy for an arbitrary imported property and does not determine whether an owner is actually using prohibited software. Medical, institutional and temporary accommodation lie outside this scope. These restrictions are recorded in each rule's `coverage_scope`, `scope_assumptions` and `exemptions`.

Adoption and mayoral approval dates are recorded separately. The captured texts do not establish an exact commencement day, so `effective_date` remains null rather than converting adoption into a fabricated effective date. The app's historical-date uncertainty handling must remain in place.

FAIR Act §6(b) supplies the text supporting a possible municipal conflict. `possible_conflicts` links both local rules and the state rule. No automatic supersession, repeal or legally settled preemption is asserted.
