# Shared source compiler and Anthropic transport

`scripts/compile.mjs` contains the shared extraction schema, semantic prompt and validator (`lawdiff-source-compiler/1.3.0`). It also provides a separate Anthropic Messages API transport. The current recorded automatic pipeline uses the Codex CLI transport documented in [codex-extraction.md](codex-extraction.md); that wrapper reuses these validation components and records its own method and run provenance.

No live Anthropic extraction receipt is claimed for the shipped pipeline. Help, dry-run and isolated validator checks exercise this implementation without proving provider availability or extraction accuracy. A Codex-generated rule must not be relabelled `anthropic_messages_api`, or vice versa.

## Shared 1.3.0 extraction contract

The compiler reads one complete captured document and considers the six organizer categories: algorithmic pricing restrictions, rent increase limits, just-cause termination, security deposits, application fees and screening/reporting restrictions. The exact category identifiers are defined by the organizer schema and shared engine. Missing captured text is a review outcome; a URL, title or bill-status page cannot substitute for missing operative legal text. Sources over 220,000 UTF-8 bytes require explicit context-preserving segmentation rather than silent truncation.

Version 1.3.0 separates **whether a rule covers an address** from **whether someone has violated it**. Material property, owner, tenancy and program conditions belong in `coverage_conditions`; missing values stay unknown. Rules must preserve primary-residence/institutional exclusions, unit or certificate cutoffs, ownership/occupancy qualifications and required exemption notices whenever the source makes them material.

The requirement identifies the actual legal addressee and retains conditional duties, conduct definitions and product/service exclusions. A prohibition of a specifically defined pricing service is not a ban on all software. The dataset does not prove actual software use, payment collection, prohibited conduct or absence of an exemption. An `applies` result is a normative scope finding, not a finding of noncompliance.

| Coverage representation | Contract and runtime consequence |
|---|---|
| Complete object/AST | Supported fact names and operators only; `execution_review_pending` absent or false. Missing input facts can produce `unknown`; they do not make the AST incomplete. |
| Source-backed prose | 20–10,000 characters and `execution_review_pending: true`. Preserves legally supported scope that cannot yet be fully represented; not executable. Property overrides cannot resolve this review state. |
| `{ "all": [] }` | Only genuinely unconditional address-level scope after jurisdiction/date. It cannot hide an essential condition or exception. |
| Null/unsupported coverage | Although the organizer's generic schema permits null, the extraction pipeline requires a complete AST or explicitly flagged prose. It must not guess an executable scope. |

The engine still checks jurisdiction, status and date. Pending proposals are not active law; failed proposals do not create active caps. Supported status values are `in_force`, `not_yet_effective`, `pending` and `failed`. Precise effective dates require evidence; an adoption date is not an automatic substitute. A missing date can remain null with review, while missing evidence of the operative rule/status must not generate an invented rule.

Requirements should be one or two precise sentences, with detailed qualifications in exemptions. When sanctions are supported, retain their triggering acts, limits, plaintiff standing, per-violation counting and draft/enacted status. The exact quoted passage must support what is asserted; separately located or unsupported details remain review items. No remedy is supplied from general knowledge.

The compiler does not establish cross-source precedence. `overrides` is empty, `conflict_flag` is false/absent and `conflict_note` is null/absent. Different dates or special cases are not automatically conflicts. Confidence is null because it is not calibrated. Spanish requirements, where present, are labelled machine translations; the English source controls.

## What validation proves

The output has separate `rules`, `review` and `no_rule_findings` arrays. The validator checks the organizer record schema and stricter response schema, source-prefixed unique IDs, exact source identity/URL/jurisdiction, supported condition structure, real dates, bounded output, and the application's `validateRulePack`.

Active candidate quotations and no-rule findings require exact source spans. Their mismatch rejects the source. Source-backed prose receives an internal execution-review note with a null quote. A schema-valid review comment with a nonmatching quotation is quarantined without destroying other valid rules:

- Its `quoted_span` becomes null; the rejected quotation is neither repaired nor replaced.
- `issue_code: "unverified_review_quote"` and `quote_verification: "rejected_not_exact"` make the rejection explicit.
- `rejected_quote_sha256` and zero-based `original_review_index` preserve the rejected quote's audit identity.
- The original issue survives separately as `unverified_model_issue`, not source-verified evidence. The unchanged raw response remains private.

Rejected review quotes are counted separately at source/run level and cannot count as verified evidence. Rule/no-rule quote checks, schema, identity and calendar validation remain strict. Review-only and zero-rule outcomes are possible; they do not establish absence of all relevant law. Exact text correspondence does not certify the interpretation or completeness of the extracted exceptions.

## Inspect the Anthropic path without spending

Requires Node.js 22+, `public/data/catalog.json`, `data/schema/rule_record.schema.json` and the shared engine.

```sh
node scripts/compile.mjs --help
node scripts/compile.mjs --dry-run --source D069 --limit 1
node scripts/compile.mjs --dry-run --source D065,D066,D069 --limit 3
```

A dry run reports source selection, missing/oversized captures and conservative token/cost reservations. It does not call a provider or write extraction artifacts. Without explicitly configured prices, cost estimates are null. The limit applies even to an explicit repeated or comma-separated source list.

## Optional live Anthropic execution

Use the provider account to verify model availability and current input/output rates before a run. The implementation's default model is `claude-sonnet-4-6`; override it through `ANTHROPIC_MODEL` or `--model`. This document makes no current availability or price claim.

Configure `ANTHROPIC_API_KEY` in the process environment. The compiler does not load `.env` automatically. Do not commit a key or put it in the command line, screenshots or chat. Live execution also requires an explicit cumulative local budget and both operator-verified rates:

```sh
node scripts/compile.mjs \
  --source D069 \
  --limit 1 \
  --budget-usd "$LAWDIFF_COMPILER_BUDGET_USD" \
  --input-price-usd-per-million "$LAWDIFF_INPUT_USD_PER_MILLION" \
  --output-price-usd-per-million "$LAWDIFF_OUTPUT_USD_PER_MILLION"
```

Defaults are five selected sources, ten new API requests and at most 8,000 output tokens per request. Configurable output tokens range from 512 to 16,000; request count is capped at 100. The Anthropic HTTP request timeout is 90 seconds. The separate Codex wrapper's `--timeout-seconds` defaults to 300 and permits up to **1800 seconds**; that flag and its optional safe-source-error continuation are not Anthropic transport options.

Source content is untrusted data. The Anthropic request supplies one forced client tool, `submit_extraction`, which returns structured data only; the application does not execute commands or follow source instructions. The Codex wrapper instead requires a bare JSON final message and enforces its event allowlist.

## Anthropic output, costs and recovery

| Location | Role |
|---|---|
| `artifacts/compiler-pack.json` | Latest separate candidate/review/no-rule output and run audit; a later run may replace it. |
| `data/cache/compile/<hash>.json` | Private cached response keyed by compiler version, model, request/source/schema and token cap. Revalidated on use. |
| `data/cache/compile/spend-ledger.json` | Cumulative estimates and unresolved reservations across local runs. |
| `data/cache/compile/runs/<run-id>.json` | Local run outcomes, source audits, usage and estimates. |
| `data/cache/compile/compiler.lock` | Exclusive lock protecting the shared local budget ledger. |

Live execution refuses to start unless `data/cache/` is ignored by Git. It reserves UTF-8 request bytes plus 8,192 tokens of overhead and the full output cap before dispatch. This is conservative accounting, not an exact tokenizer or provider-guaranteed bound. Restarting does not reset the cumulative ledger. Revalidated cache hits make no new API request.

A successful response records provider input/output usage and estimated cost at the operator-supplied rates. A different response model, unsupported cache pricing, missing usage, unexpected usage or excess reservations stops processing for review. Provider-wide limits remain separate from this local ledger. No tax, negotiated pricing or unrelated process spending is inferred.

There are no automatic retries. The Anthropic transport stops on timeouts, HTTP errors, invalid responses and validation failures, retaining appropriate reservations. A timeout can still incur provider charges. Inspect usage and the previous process before removing a stale lock; do not erase a ledger to bypass its ceiling. Raw remote errors, authorization headers and environment contents are not published.

Exit 0 means the selected work completed, possibly with review items; exit 2 is partial/stopped; exit 1 is an unrecovered startup/configuration error. Check per-source audit and run status as well. Successful Anthropic records are labelled `anthropic_messages_api`. This transport does not modify the application pack, selection manifest or submission exports.

## Published selection and reproducibility

The current promotion pipeline accepts completed trusted **Codex** compiler 1.2.1/1.3.0 artifacts. It does not silently accept an Anthropic package or rewrite its origin. For the shipped Codex workflow:

1. Restore the original public run bytes using `scripts/restore-extraction.mjs` and the checksum-pinned manifest in `data/extracted/recorded-runs/`.
2. Run `scripts/promote-candidates.mjs --selection data/extracted/automatic-selection.json`; explicit source/artifact/hash/rule-ID choices produce `automatic-reviewed.json` without changing records.
3. Run `scripts/assemble.mjs`; it reproduces that selection against original artifact bytes and preserves audit/provenance in the public pack. There is no assisted-pack fallback or injected O001 record.
4. Run the aggregator with the published pinned input list and `--selection data/extracted/automatic-selection.json`. That explicitly selects a completed source/run when candidate versions differ, retains all attempts, and reports the full unchanged source candidate set. The manifest's rule IDs still define only the narrower app selection.
5. Export the original address sample, run checks and build. `scripts/validate-artifacts.mjs` verifies the corpus receipt, selected source hashes, candidate fingerprints and unchanged app records before the build writes output.

The [complete clean-clone reproduction commands](codex-extraction.md#reproduce-the-recorded-pipeline-from-a-clean-clone) use no model calls after dependencies are installed. Rebuilding timestamps is not a claim of byte-identical new model output. The recorded artifacts, rather than rerunning a probabilistic model, establish the published extraction provenance.

Current counts belong to the selection manifest, rule pack, corpus coverage and validation receipt. The historical two-source 1.1.0 receipt is explicitly documented separately; it does not substitute for the current main selection. Selection reasons and AI-assisted review are not independent human legal review. Passing tests, exact quotation checks and processed-source counts are not a measured legal accuracy score.

## Operative dates and sunsets (1.3.1)

Compiler 1.3.1 adds an optional, source-supported `end_date` and distinguishes a delayed operative date from an amendment’s earlier effective date. The start used by the evaluator is when the substantive rule operates; the end is exclusive. The source review must still verify both. Earlier recorded 1.2.1/1.3.0 runs keep their original hashes and schema; they are not relabelled or rewritten.

## Source jurisdiction boundary (1.3.2)

The shared prompt now explicitly separates a source’s own jurisdiction from independently governed law discussed on that page. Cross-jurisdiction duties belong in review for the appropriate source; they are not silently relabelled as local rules. Incorporated definitions or procedures may qualify a genuine local duty. This strengthens the prompt while preserving the existing exact-jurisdiction validator, and the version hash requires a new extraction.
