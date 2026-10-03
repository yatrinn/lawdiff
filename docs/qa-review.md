# Bounded independent review

Reviewed 2026-10-03: rule engine, browser import path, exporter, published catalog and 58-rule pack, and extraction compiler. This is a targeted code and fixture review, not legal review or exhaustive security certification. No live external extraction API request was made.

## Confirmed defects and disposition

1. **Fixed by parent: import allowed a source to be assigned to the wrong jurisdiction.** A genuine NJ FAIR Act quote could be imported with `jurisdiction: "CA"`. Quote matching alone did not catch this semantic mismatch. The engine now rejects source/jurisdiction disagreement and preserves explicitly listed organizer multi-state fixtures (O001). Regression tests cover the reproduced exploit and the valid fixture.
2. **Fixed by parent: mixed condition nodes silently dropped conditions.** `{all: [], field: "units", op: "lt", value: 0}` evaluated unconditionally true because the evaluator chose the group. Import validation now rejects mixed groups/leaves, multiple groups, and extra leaf properties, including nested nodes. Regression tests preserve this behavior.
3. **Reported UI provenance issue:** the source viewer labelled every capture “The original record” while omitting `source_capture` and `capture_scope`. S001–S003 contain selected official municipal passages captured through the web tool, not the entire original document. The catalog correctly labels this; the viewer should expose the same distinction and distinguish captured-text hashes from downloaded-file hashes. Parent owns the viewer fix.

## Verified behavior and limits

- Missing facts remain unknown unless a decisive known condition settles the result. Excluded selected rules remain visible in the evidence panel after an input change.
- Pending proposals do not become active solely because the query date advances. Failed proposals remain inactive. Future enacted rules retain their effective date boundary.
- NJ FAIR/local ordinance interactions become possible conflicts only when both rule records apply. No automatic preemption conclusion is manufactured.
- The exporter is driven by source-supported rule evaluation, and the explicitly negative Massachusetts organizer fixture remains separate from positive rent caps. Snapshot cases returned affected counts of T1 250, T2 88, T3 140, T4 110, T5 0; these are observations of this build, not claims of official judging accuracy.
- Source text is HTML-escaped; original-source links accept only HTTP(S). No executable document instructions are intentionally passed to a browser evaluator.
- The compiler marks source text as untrusted data, uses a forced structured extraction tool with no execution capability, requires exact source identity and quoted spans, rejects mixed condition trees, and requires null confidence rather than accepting invented numerical certainty. It writes a separate candidate artifact, never silently replaces the reviewed pack, and requires explicit model price and budget configuration for a live request.
- Structural validation cannot establish that a legally plausible date, interpretation, or selected quote is substantively correct. Source review is still required; the import banner must not imply legal verification.

Regression file: `tests/import.test.mjs`. No engine, exporter, application, or published data files were edited during this review.
