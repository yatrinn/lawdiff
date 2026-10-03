# Codex CLI extraction

`scripts/compile-codex.mjs` reads captured source text, asks an authenticated Codex CLI for a structured extraction, validates the response, and writes a **separate candidate artifact**. It reuses `makeRequest`, `toolSchema` and `validateExtraction` from the [API compiler](compiler.md), followed by the application's shared rule-pack validator. It never promotes its output into the public rules or rewrites reviewed extraction files.

This path uses the existing Codex authentication configured on the operator's machine. A working ChatGPT-authenticated CLI was demonstrated in this environment. That observation does not establish availability on another account or machine. No API key needs to be pasted into chat, placed in a command, committed, or included in a screenshot. The separate Anthropic compiler remains a different execution path with its own authentication and provenance.

## Run one source

Use Node.js 22 or later, a compatible authenticated Codex CLI, `public/data/catalog.json`, `data/schema/rule_record.schema.json`, and the current `public/engine.mjs`.

Start with the commands that do not launch Codex, contact a model, or write artifacts:

```sh
node scripts/compile-codex.mjs --help
node scripts/compile-codex.mjs --dry-run --source D069
```

The dry run displays source, prompt and response-schema hashes, selection limits and the requested model. It is planning evidence, not an extraction result.

An actual invocation uses the current login and may consume account usage:

```sh
node scripts/compile-codex.mjs \
  --source D069 \
  --limit 1 \
  --max-requests 1 \
  --model gpt-6-astra \
  --timeout-seconds 300
```

The default binary in this macOS environment is `/Applications/ChatGPT.app/Contents/Resources/codex`. On another installation, select the executable explicitly:

```sh
node scripts/compile-codex.mjs \
  --codex-bin codex \
  --source D069 \
  --limit 1 \
  --max-requests 1
```

The wrapper does not download a CLI, change authentication or bypass an access failure. Check the selected binary's version and normal authentication locally if startup fails; do not share credentials in chat.

Source IDs may be repeated or comma-separated. **The source limit still applies**: listing two IDs without raising the default limit selects only one.

```sh
node scripts/compile-codex.mjs \
  --source D069,D066 \
  --limit 2 \
  --max-requests 2 \
  --timeout-seconds 600
```

| Control | Default | Accepted range or behavior |
|---|---:|---|
| Selected sources, `--limit` | 1 | 1–500 |
| New CLI model invocations, `--max-requests` | 1 | 1–100; revalidated local cache hits do not count as new model calls |
| Per-invocation timeout, `--timeout-seconds` | 300 seconds | 1–600 seconds |
| Model, `--model` | `gpt-6-astra` | Explicit identifier; no model substitution |
| Captured source size | — | At most 220,000 UTF-8 bytes; larger sources require explicit context-preserving segmentation |
| CLI stdout size | — | At most 2,000,000 bytes |

There is no automatic retry. A timeout or failed validation is a review outcome, not permission to silently repeat an expensive or ambiguous call. Request and time limits are operational bounds; they are not a monetary spending ceiling.

## Text-only processing and event guard

The complete source, metadata, allowed facts, extraction instructions and JSON response schema are passed through stdin. Source text and metadata are explicitly treated as untrusted evidence. Embedded instructions, URLs, apparent role changes and code are not commands for the extractor.

Each child runs with `exec --ephemeral --sandbox read-only --json`. Per-invocation configuration disables the shell tool, apps and web search. The CLI's SQLite runtime directory is redirected to the ignored local `data/cache/codex-runtime/` directory. This changes neither global configuration nor the existing policy rules. The wrapper does not use `--ignore-rules`, approval bypasses or a sandbox bypass.

The wrapper consumes JSONL while the child runs. Only the expected thread/turn events and reasoning or agent-message items are accepted. Command execution, MCP calls, browsing, file changes, delegation and unknown item/event types are rejected. Detection triggers immediate process-group termination, with a forced termination fallback. A detected tool or untrusted event withholds candidate rules from the entire invocation. Event inspection is a detection-and-abort control, not a claim that every possible external tool was unavailable before the event arrived.

Acceptance requires one completed turn, exactly one completed final agent message containing a bare JSON object, valid usage counts and successful local validation. Markdown fences, text surrounding the JSON, incomplete turns and unexpected events do not become candidate rules. Raw CLI stderr can contain internal plugin paths or service URLs; it stays in private logs and must not be published.

## What gets validated

The same extraction validator used by the API path checks the organizer schema, exact source ID/URL and jurisdiction, stable source-prefixed identifiers, real dates or explicit null dates, and a restricted executable condition tree. The application's `validateRulePack` checks the prepared candidates again.

Rule quotations, quoted review issues and no-rule findings must occur exactly in the captured source. Allowed condition operators and fact names come from the current engine; unsupported facts belong in review. Unconditional scope is `{ "all": [] }`, which must not conceal an essential missing condition. Precise commencement dates require source support; adoption or publication dates must not be silently substituted.

The prompt asks for source-supported penalties and remedies when present, preserving their triggers, limits, plaintiff scope and proposed/enacted status. The operative summary and any sanction must be supported by the exact quoted passage; separately located or unsupported details can remain quoted review items. No sanction is filled in from general legal knowledge.

An accepted rule receives `extraction_method: "codex_cli_structured_extraction"` **after** validation. This label is distinct from the shipped `codex_assisted_extraction` records and from `anthropic_messages_api`. A live invocation does not retroactively change the provenance of earlier manually reviewed candidates.

These checks establish structure, source identity and quotation presence. They do not certify legal interpretation, prove that every exception was extracted, or measure legal accuracy. Spanish summaries remain machine translations.

## Zero rules can be a valid outcome

The response has three separate collections: `rules`, unresolved `review` items and `no_rule_findings`. A source can produce zero rules with useful review items when its essential scope cannot be represented using the supplied facts, the text lacks an effective date, or the source is insufficient for the proposed rule. That is a completed conservative extraction, not automatically a transport failure.

Inspect each review item before expanding the vocabulary. Add a fact only when it has a clear, source-supported meaning, preserve unknown values, and test its behavior. Do not respond to abstention by making a conditional law unconditionally applicable. A new fact changes the prompt hash and causes a different cache key even if the source text is unchanged.

Exit code `0` permits completion with review items and zero accepted rules. Exit code `2` denotes a stopped or partial invocation; exit code `1` denotes an unrecovered configuration/startup failure. Always read `provenance.status` and per-source outcomes, not just the exit code or candidate count.

## Artifacts, audit and cache

| Location | Contents and handling |
|---|---|
| `artifacts/codex-compiler-pack.json` | Candidate rules, review items, no-rule findings and public-suitable audit metadata for the latest selected invocation. The next run can replace this file. It is not the full reviewed corpus. |
| `data/cache/compile-codex/<hash>.json` | Private cache of a completed CLI turn, its JSONL, hashes and original timing. Only validated results are cached. |
| `data/cache/compile-codex/runs/` | Private CLI version output, stdout/stderr, process outcomes and audit records. Do not publish raw files. |
| `data/cache/compile-codex/compiler.lock` | Exclusive local-run lock. Inspect a stale lock and the previous process before removing it. |
| `data/cache/codex-runtime/` | Local CLI runtime state, separate from public artifacts. |

`data/cache/` must be ignored by Git before a live run starts. Files are written with private permissions; no environment dump is created. The wrapper logs compact status messages and fixed failure codes to the console rather than raw remote errors.

A cache key binds compiler version, requested model, CLI version, source-text hash, full stdin-prompt hash and response-schema hash. A hit is labeled `cache_hit_revalidated` and retains the original run and timing. The stored event stream is checked again for forbidden events and completion; response and transport hashes are verified, and the current source/schema validator runs again. A cache hit is never counted as a new model invocation. Invalid cache provenance stops processing for review instead of silently regenerating the entry.

For any published execution claim, retain these audit values:

- Compiler version and CLI version; requested model and source ID.
- Source, full prompt, response schema, final response and JSONL transport SHA-256 hashes.
- Start/end timestamps, duration, response outcome and whether the result was a live call or a revalidated local cache hit.
- CLI-reported usage, accepted rule count and review-item count.

Record the code revision as well. If the working tree has uncommitted changes, preserve the corresponding exact code hashes rather than claiming an unchanged commit produced the output:

```sh
git rev-parse HEAD
shasum -a 256 scripts/compile-codex.mjs scripts/compile.mjs \
  public/engine.mjs data/schema/rule_record.schema.json
```

Do not edit the prompt, schema or fact vocabulary during a measured batch. Hashes support identifying the input and implementation; they are not signatures, legal certificates or a guarantee that a fresh model invocation will produce identical wording.

Usage fields are copied from the CLI's completed-turn event, including supported cache/reasoning counts when present. They are not converted into dollars. The wrapper makes no assertion that the run was free, that account billing follows API token prices, or that no other development costs were incurred. The deterministic application runtime separately makes no model calls.

## Recorded checkpoint: first measured batch

At the checkpoint before review of the second batch, the first live invocation over D069, D066 and D001 completed with **zero accepted rules and eleven review items**:

| Source | Accepted rules | Review items |
|---|---:|---:|
| D069 | 0 | 5 |
| D066 | 0 | 3 |
| D001 | 0 | 3 |

The review identified limits in the precision of the available facts. Six specific fields were subsequently added to the engine: `primary_residence`, `inpatient_medical_care`, `licensed_long_term_care`, `detention_or_correctional_facility`, `fee_charger_is_landlord`, and `fee_charger_nj_real_estate_licensee`. These are vocabulary additions; no missing sample value is inferred from their existence.

A second exploratory batch returned two structured candidates. Source review identified a missing positive actor-role condition in the fee candidate. The additional `fee_charger_is_landlord_agent` fact and a generic actor-membership instruction addressed that issue; the public 58-record pack was not replaced.

## Published recorded run

The completed **lawdiff-codex-cli-compiler/1.1.0** run `2026-10-03T23-45-24-846Z-65c22251` is published in `public/data/extraction-run.json`, with its unmodified candidate output in `public/data/extraction-candidates.json`.

| Source | Structured candidates | Review items | Outcome |
|---|---:|---:|---|
| D069 | 0 | 5 | Full actor/conduct exclusions exceed this bounded vocabulary; retained for review |
| D066 | 1 | 0 | Application-fee candidate with explicit actor and license conditions |

Two actual model requests completed using **gpt-6-astra**, **codex-cli 0.153.4**, in **180.747 seconds** wall time. This is a selected demonstration on two sources, not a full-corpus extraction benchmark. Earlier exploratory calls are excluded from that duration and request count. None of these runs is an independent legal review.

The final D066 candidate preserves the known actor restriction, property-size exception, license exception, 2026-05-01 effective date, annual positive-CPI mechanism, and qualified penalty tiers. Source and structural validation passed. Missing actor and property facts remain unknown in the shared engine. The five D069 review findings remain visible rather than being counted as extracted executable rules.

The demo and technical video contain labelled diagrams built from this real receipt, not a simulated live model console. The application's Integrity page links the same candidate artifact. Reproduce a run with the command above; after deliberate review, `node scripts/publish-extraction.mjs` publishes only a separate completed-run receipt and candidates. It does not promote them into the public rule pack.


## Verification performed

Thirty-seven additional, isolated compiler checks passed for argument limits, source inclusion, prompt/schema generation, JSON-only parsing, usage fields, rejected command/MCP/web/file/delegation events, incomplete turns, malformed responses, immediate process termination and timeouts. These fixtures made no live model calls, saved no extraction artifact and were not added to the npm test count.

Separately, the main project checkpoint has **45 JavaScript tests and 10 Python geography tests**, including the added fact-behavior regression. These counts are internal engineering checks, not an organizer score, legal ground-truth benchmark or measured extraction accuracy.

## References

- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [Separate Anthropic source compiler](compiler.md)
