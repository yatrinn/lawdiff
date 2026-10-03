# LawDiff source compiler

`scripts/compile.mjs` is a reproducible extraction entry point using the Anthropic Messages API through Node's native `fetch`. It reads the local source catalog, asks the configured model for structured candidates, validates those candidates and saves a **separate** review artifact. It never replaces the public/reviewed rule pack.

**Execution status:** the CLI, dry run and local synthetic validation checks have been exercised. No API key was provided and **no live external extraction run has been performed**. The existing Codex-assisted extraction pack has separate provenance; it must not be relabelled as this pipeline's output.

## Start without credentials or spending

Requires Node 22 or later, the prepared source catalog and the supplied organizer schema.

```sh
node scripts/compile.mjs --help
node scripts/compile.mjs --dry-run --source D069 --limit 1
node scripts/compile.mjs --dry-run --limit 87
```

The dry run makes no network request and writes no files. It reports selected sources, missing or oversized text, input/output token reservations, and whether model prices were explicitly configured. With no prices, cost estimates remain null. A dry run is not evidence that extraction succeeded.

## Configure a real run

1. Verify the selected model is available to the account. The default identifier is `claude-sonnet-4-6`; availability has not been tested here. Override it with `ANTHROPIC_MODEL` or `--model`.
2. Verify the model's current input and output prices in the provider account/documentation. Supply **both** numerical USD-per-million rates on the command line. There is deliberately no hard-coded price table or guessed fallback.
3. Configure `ANTHROPIC_API_KEY` securely in the process environment. Do not put a key in the command line, public repository, screenshots, source catalog or chat. This script does not read `.env` files automatically.
4. Confirm `data/cache/` is ignored by Git. A real run refuses to start without that entry.
5. Set a provider-side spending cap appropriate to the project. The local reservation system is an additional control, not a guarantee about provider billing or other processes.

The following uses environment placeholders that the operator must set to the verified rates and an authorized budget; it intentionally contains **no claimed current prices**:

```sh
node scripts/compile.mjs \
  --source D069 \
  --limit 1 \
  --budget-usd "$LAWDIFF_COMPILER_BUDGET_USD" \
  --input-price-usd-per-million "$LAWDIFF_INPUT_USD_PER_MILLION" \
  --output-price-usd-per-million "$LAWDIFF_OUTPUT_USD_PER_MILLION"
```

Run one source first. Review the result and cost log before explicitly increasing `--limit` and `--max-requests`. The defaults are five selected sources, ten new API requests, and at most 8,000 output tokens per request. Output tokens can be configured between 512 and 16,000; request count can be configured up to 100.

An explicit source list may be repeated or comma-separated. The limit still applies to that list:

```sh
node scripts/compile.mjs --dry-run --source D065,D066,D069 --limit 3
```

## Input and output

Inputs:

- `public/data/catalog.json`: source ID, jurisdiction, source URL, retrieval time, snapshot date and captured source text.
- `data/starter/schema/rule_record.schema.json`: organizer rule record format.
- `public/engine.mjs`: supported facts and the shared executable rule validator.

Outputs after a real run:

- `artifacts/compiler-pack.json`: version 1 candidate pack containing `rules`, unresolved `review` items, separate `no_rule_findings` and detailed run provenance.
- `data/cache/compile/<hash>.json`: validated provider extraction cached by compiler version, exact request, source text hash, model, prompt, token cap and schema.
- `data/cache/compile/spend-ledger.json`: cumulative estimated spending and conservative reservations.
- `data/cache/compile/runs/<run-id>.json`: source outcomes, request counts, cost estimates and model provenance.

`artifacts/compiler-pack.json` is the latest compiler candidate artifact and can be overwritten by the next compiler run. `public/data/rule-pack.json`, the Codex-assisted extraction artifacts and submission files are never changed by this script. Promotion into the reviewed pack is a separate, deliberate integration step.

## Extraction and validation

Each captured source is handled as a complete document. A document larger than 220,000 UTF-8 bytes is held for explicit segmentation/review rather than silently truncated. A source with no captured text becomes a review item; a URL or title is never substituted for the law.

The prompt identifies source content as untrusted data. The model receives no API key, no command execution, no browser and no write-capable tool. Its single forced client tool only emits JSON extraction data. Apparent instructions inside source documents must not be followed.

The output validator checks:

- The tool envelope and organizer schema, including required fields, allowed enum values and permitted types.
- An executable condition AST with an explicit whitelist of fact fields and operators, bounded nesting and no ambiguous mixed operators.
- Source ID, URL, jurisdiction, jurisdiction level and stable source-prefixed rule IDs.
- Every rule, review and no-rule quotation as an exact substring of the supplied source.
- Complete, valid calendar dates or null; unresolved dates must remain review matters.
- Output lengths, rule counts, duplicate identifiers and unsupported cross-source references.
- The shared `validateRulePack` function used by the application.

Unconditional coverage is `{ "all": [] }`, not a bare boolean; the organizer schema requires an object, string or null and this compiler only accepts executable objects.

The system prompt requires definitions and exceptions to be considered across the document. If essential coverage cannot be represented in the current fact vocabulary, the model must emit a review issue rather than silently broadening coverage. Pending proposals, failed bills, narrow assisted-housing policies and ordinary notice requirements must retain those distinctions. No-rule findings are separate from applicable rules. Numerical confidence is null because no calibration has been performed.

A validated output means **structure and source presence checked**, not legally correct or legally reviewed. The compiler cannot prove a quotation supports the interpretation merely by finding the quoted words. Difficult interpretations, cross-source precedence and missing facts require explicit follow-up review.

Optional Spanish requirements are machine translations. The English source remains authoritative.

## Cost controls and recovery

A live run requires all of these: API key, explicit total budget, explicit input rate and explicit output rate. The model returned by the provider must exactly match the explicitly priced model ID; otherwise the run stops for review. This may require using a resolved model ID rather than an alias.

The cost guard reserves an intentionally conservative input count based on UTF-8 request bytes plus 8,192 tokens of system/tool overhead, together with the full configured output-token cap. It persists that reservation **before** sending each request. It does not claim this is an exact tokenizer count or an absolute upper bound guaranteed by the provider.

The budget is **cumulative across the local compiler ledger**, including previous runs and unresolved reservations. Restarting does not reset it. Cached, revalidated extractions incur no new API request.

Successful responses record provider input/output usage and calculate estimated billed cost at the operator-supplied rates. Unexpected provider cache pricing, missing usage, a different response model, or usage exceeding the reservation stops the run. This tool does not independently verify taxes, negotiated rates, special pricing tiers or provider-wide spend.

There are no automatic retries. Timeouts, HTTP errors, partial outputs, malformed JSON and failed validation stop processing, retain an appropriate reservation and appear in the review log. A timed-out request may still be billed. Do not retry it blindly.

An exclusive lock prevents simultaneous local compiler runs from racing the budget ledger. A crash can leave `data/cache/compile/compiler.lock`. Before manually removing a stale lock, inspect the corresponding reservation and provider usage. Never delete the ledger merely to evade the budget ceiling.

API keys, authorization headers, raw remote error bodies and `.env` contents are never logged. A sanitized error contains only a bounded local explanation or HTTP status. Source texts are public challenge materials, but private caches should still remain outside Git.

Exit code `0` means the selected work completed, potentially with explicit review issues. Exit code `2` denotes a stopped/partial run, such as a budget/request cap or failed request. Exit code `1` denotes invalid configuration or another unrecovered startup error. Always inspect the artifact's status and source coverage, not only the exit code.

## Local verification performed

- Help and dry-run selection on D069 and the full catalog.
- Twenty-two synthetic checks for arguments, schema, condition AST, source identity, invented quotations, invalid dates, unsupported precedence, missing quote provenance and reservations.
- No network request or external model call in these checks.

The synthetic inputs are unit checks, not a legal ground-truth dataset or an extraction-accuracy benchmark.

## API references

- [Anthropic Messages API](https://platform.claude.com/docs/en/api/messages)
- [Client tools and forced structured tool output](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
- [Provider pricing](https://platform.claude.com/docs/en/about-claude/pricing) — verify the exact account/model rates before a real run.
