# Automatic extraction and reproducible selection

LawDiff's current extraction path uses `scripts/compile-codex.mjs` (`lawdiff-codex-cli-compiler/1.3.2`). It sends captured legal text to an authenticated Codex CLI, validates structured candidates and records their provenance. The application pack is built from an **explicit selection of those unchanged automatic candidates**. Candidate generation, selection and deterministic address evaluation are separate, auditable stages.

The source of truth for the shipped selection is `data/extracted/automatic-selection.json`, its generated `automatic-reviewed.json`, and `public/data/rule-pack.json`. Do not infer current counts from this document. Read the recorded run audits, `public/data/corpus-coverage.json` and `public/data/validation.json`. There is no fallback to the earlier California/NJ/MA assisted packs and no injected organizer-only O001 rule in assembly.

## Current semantic contract

Version 1.3.0 extracts **address-level normative scope**, separately from evidence of an actual violation. An `applies` result means the in-force rule covers an address under the available facts. It does not establish that a particular landlord used prohibited software, collected a fee, violated the law or complied with it.

- `coverage_conditions` preserves material property, owner, tenancy and program eligibility, including exceptions. Missing sample values remain unknown. Dataset membership and a mailing city do not prove occupancy, owner qualifications or legal jurisdiction.
- `requirement` identifies the legal addressee and the conditional duty. Definitions and exclusions concerning a regulated service, product or conduct stay in the requirement and exemptions. A provider-only duty must not be attributed to a resident or landlord.
- A complete executable condition tree can still depend on unknown input facts. That is different from a rule whose scope cannot yet be represented by the supported vocabulary.
- Source-backed scope that cannot be represented completely is preserved as 20–10,000 characters of coverage prose with `execution_review_pending: true`. It is non-executable. An executable object must omit that flag or set it to false. User-entered property facts cannot resolve this interpretation-review state.
- `{ "all": [] }` is allowed only when no further material address-level condition is required after jurisdiction and date. It must not conceal an exception. Missing operative text or status evidence still requires a review issue, not an invented rule.

Jurisdiction, legal status and date remain independent gates. Pending, future and failed measures do not become active merely because coverage text exists. All six organizer categories are considered. Precise effective dates require source support; approval or publication dates are not silently substituted. Source-supported penalties must retain their triggers, limits, standing and proposed/enacted status. Generated conflict flags are false, conflict notes are null/absent, and override lists are empty; unverified cross-source interactions remain review items.

## Inspect or run selected sources

Requires Node.js 22+, the captured catalog and organizer schema, and a compatible authenticated Codex CLI. Help and dry run make no model calls or writes:

```sh
node scripts/compile-codex.mjs --help
node scripts/compile-codex.mjs --dry-run --source D069 --limit 1
```

A new extraction can consume account usage. This example deliberately writes a separate artifact:

```sh
node scripts/compile-codex.mjs \
  --source D069 \
  --limit 1 \
  --max-requests 1 \
  --model gpt-6-astra \
  --timeout-seconds 1800 \
  --output artifacts/new-D069.json
```

The default executable is the bundled macOS path shown by `--help`. On another installation, pass `--codex-bin codex` or the explicit executable path. The wrapper uses the existing login; it does not install a CLI or change authentication. A working login on the original development machine is not evidence of availability on another account.

| Option or bound | Current behavior |
|---|---|
| `--limit` | Default 1; maximum 500 selected sources. Also limits an explicit source list. |
| `--max-requests` | Default 1; maximum 100 new invocations. Revalidated cache hits are not new calls. |
| `--timeout-seconds` | Default 300; configurable from 1 to **1800 seconds per invocation**. |
| `--source` | Repeat the flag or use comma-separated IDs; set a sufficient limit. |
| `--output` | Default `artifacts/codex-compiler-pack.json`; only a flat `artifacts/<basename>.json` path is accepted. No traversal. |
| `--continue-on-source-error` | Off by default; only a safe completed tool-free turn with a source-local JSON/schema validation error may continue to the next source. No retry. |
| Captured source / CLI stdout | Maximum 220,000 UTF-8 source bytes / 2,000,000 stdout bytes. Oversized sources require explicit context-preserving segmentation. |

A CLI failure, timeout, unexpected tool/event, untrusted transport or invalid cache provenance always stops the run. An untrusted event withholds all candidates from that invocation. Source-local continuation records the failure and can finish as `completed_with_review_items`; it does not disguise a failed source as processed. Read per-source outcomes and `provenance.status`, not only the process exit code. Exit 0 allows review-only/zero-rule completion; exit 2 denotes a stopped or partial run; exit 1 denotes an unrecovered startup/configuration failure.

Each output basename has an exclusive `data/cache/compile-codex/compiler-<basename>.lock`. Separate outputs can be used for deliberately disjoint source lists; the operator must ensure they do not overlap. A legacy `compiler.lock` blocks new runs. Do not remove a lock while its process is active. Requests and timeouts bound execution, not dollar spending.

## Evidence validation and review-quote quarantine

The Codex wrapper reuses the source schema, prompt contract and validator in `scripts/compile.mjs`, then applies `validateRulePack` from the same engine used by the app and exports. Accepted records receive `extraction_method: "codex_cli_structured_extraction"` and `review_status: "machine_validated_not_legally_reviewed"`.

Rule quotations and `no_rule_findings[].quoted_span` must be exact captured-source spans. A mismatch rejects the source result. Source identity, jurisdiction, dates, schema, supported condition fields and duplicate IDs also remain strict. Finding a quotation proves correspondence to captured text, not that its interpretation is legally correct.

A malformed quotation in an otherwise schema-valid **review comment** is handled differently: the quotation is discarded rather than repaired, `quoted_span` becomes null, and the unresolved model issue is retained separately with:

- `issue_code: "unverified_review_quote"` and `quote_verification: "rejected_not_exact"`;
- `rejected_quote_sha256` and the zero-based `original_review_index`;
- `unverified_model_issue`, explicitly identified as unverified rather than source evidence.

Source and run audits count rejected review quotations. They are never included in verified-quotation counts. Valid rules from the same response can survive this quarantine. The untouched model response remains in the private cache. Coverage-review workflow notes also use a null quote rather than appropriating a legal passage as evidence for an internal process.

`rules`, unresolved `review` items and `no_rule_findings` stay separate. Zero candidates can be a valid review-only result. It is not proof that no relevant law exists. Prose-backed candidates can count as extracted records while remaining non-executable.

## Text-only transport, caches and audit

The complete source and metadata are untrusted evidence supplied through stdin. Embedded instructions, links, apparent roles and code are not commands. Child invocations use `exec --ephemeral --sandbox read-only --json`, with shell, apps and web search disabled by invocation configuration. No approval or sandbox bypass is used.

A strict JSONL allowlist accepts expected thread/turn events and reasoning/final-message items. Unexpected command, MCP, browsing, file-change, delegation or other events trigger termination. Acceptance requires one completed tool-free turn, one final bare JSON object, reported usage and a successful process exit. This is detection and rejection of unexpected events, not proof that a future CLI could never attempt a tool.

Private `data/cache/compile-codex/` contains caches and run logs; `data/cache/codex-runtime/` holds isolated CLI runtime state. Both remain outside Git. Raw transports, stderr, prompts and credentials are not published. The public artifact records model/CLI/compiler versions, source/prompt/schema/response/transport hashes, start/end times, usage and outcomes.

Cache keys bind the compiler and CLI versions, exact requested model, source, prompt and schema. A `cache_hit_revalidated` preserves original-run provenance and is rechecked against the event guard and current validator. It does not count as a new invocation. Invalid cache evidence stops processing rather than silently triggering another model call. Usage is reported token metadata, not a monetary bill. Hashes identify artifacts; they are not signatures or legal certification.

## From candidates to the running application

1. **Review and record the choice.** `data/extracted/automatic-selection.json` names one artifact per source, its SHA-256, explicit rule IDs and a reason. Review here is an explicit operator/AI-assisted selection, not independent human legal review. Different sources may share a multi-source artifact.
2. **Promote unchanged records.** `scripts/promote-candidates.mjs --selection data/extracted/automatic-selection.json` validates completed trusted compiler 1.2.1/1.3.0/1.3.1/1.3.2 runs, source hashes, exact quotations and source audit metadata. It writes only `data/extracted/automatic-reviewed.json`. Selected rule objects are unchanged; source review items and no-rule findings remain separate. The audit records selected/omitted IDs and each rule's hash.
3. **Assemble with original evidence.** `scripts/assemble.mjs` reproduces the selection from the manifest and the exact original artifact bytes. It rejects any discrepancy, then copies the reviewed content into `public/data/rule-pack.json` with an assembly receipt. No old assisted-pack fallback and no injected rule are permitted.
4. **Aggregate corpus coverage.** `scripts/aggregate-corpus.mjs` processes only explicit `--input artifacts/<basename>.json` files. All recorded attempts, including failures and unprocessed entries, remain visible. Without `--selection`, differing completed candidate sets for one source are withheld. With the pinned selection manifest, the named validated completed attempt is selected and its reason/hash/run are recorded under `source_selection`; there is no implicit newest-version preference.
5. **Use one engine.** The loaded pack drives the app, original-sample address exports and change cases through the shared engine. Build verifies promotion hashes, the assembled intermediate, corpus catalog/source/candidate hashes, matching manifest decisions and exact identity of selected app records within the reported corpus candidates.

The corpus keeps the **full** candidate set from a selected source. The manifest's `rule_ids` are the narrower app selection; they do not remove omitted candidates or historical attempts from the corpus report. Processed-source counts describe completed structural/source checks, not exhaustive interpretation or accuracy.

## Reproduce the recorded pipeline from a clean clone

Install Node.js 22+ and the repository dependencies first (`npm ci` may download packages). The following steps restore recorded public artifacts and do not call a model or require private CLI caches. A frozen release must include `data/extracted/recorded-runs/manifest.json`, its `.sha256` sidecar, the archived run files, the published corpus receipt and the pinned selection manifest. If one is absent or altered, restoration fails rather than inventing evidence.

```sh
npm ci
node scripts/restore-extraction.mjs --dry-run
node scripts/restore-extraction.mjs
node scripts/promote-candidates.mjs --selection data/extracted/automatic-selection.json --dry-run
node scripts/promote-candidates.mjs --selection data/extracted/automatic-selection.json
node scripts/assemble.mjs --dry-run
node scripts/assemble.mjs
```

Restore checks the archive manifest checksum, published coverage/selection byte hashes, every original artifact checksum and its terminal status. An existing different `artifacts/` file is refused, not overwritten. The archive is assembled by `scripts/archive-extraction.mjs` from those explicit references only; it never archives private caches.

Re-aggregate using the **published, hash-pinned input list**, not a glob over whatever happens to be in `artifacts/`:

```sh
node --input-type=module <<'NODE'
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = JSON.parse(await readFile('public/data/corpus-coverage.json', 'utf8'));
const args = [];
for (const input of receipt.input_files) {
  if (!/^artifacts\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(input.path) || input.path.includes('..'))
    throw Error('Unsafe recorded input path.');
  if (sha(await readFile(input.path)) !== input.file_sha256)
    throw Error(`Recorded input changed: ${input.path}`);
  args.push('--input', input.path);
}
const result = spawnSync(process.execPath, [
  'scripts/aggregate-corpus.mjs', ...args,
  '--selection', 'data/extracted/automatic-selection.json',
], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) throw Error('Corpus aggregation did not complete.');
NODE
cp artifacts/corpus-coverage.json public/data/corpus-coverage.json
cp artifacts/corpus-candidates.json public/data/corpus-candidates.json
node scripts/export.mjs
npm test
python3 -m unittest discover -s tests -p '*_test.py'
npm run build
```

The export reads the original sample, not browser-only property overrides. `scripts/build.mjs` checks the shared snapshot gate before rewriting validation output or `dist/`. A mismatch is a reason to inspect and rebuild the relevant upstream artifact, not to edit a hash to force acceptance.

Re-promotion, assembly and aggregation record new timestamps and aggregation IDs; complete output files are therefore not promised to be byte-identical to the published snapshot. Original archived run bytes and selected rule objects remain hash-verifiable. Restore targets the original published receipt on a clean checkout. If publishing a newly generated snapshot, re-create the archive manifest against that new receipt after validation; an old archive manifest intentionally refuses a different published receipt.

## Historical two-source checkpoint

`public/data/extraction-run.json` and `public/data/extraction-candidates.json` preserve the historical `lawdiff-codex-cli-compiler/1.1.0` run `2026-10-03T23-45-24-846Z-65c22251`: D069 produced zero candidates and five review items; D066 produced one candidate and zero review items. Two model requests completed in 180.747 seconds using the model and CLI version recorded there.

That receipt measures only those two calls. It excludes exploratory and later corpus runs, is not a full-corpus benchmark, and does not describe the current selection. Early assisted development packs and the historical actor/conduct vocabulary differ from the current 1.3.0 address-scope contract. Their provenance is retained rather than retroactively relabelled. `scripts/publish-extraction.mjs` publishes that kind of separate demonstration receipt; it is not the promotion or assembly command.

Tests cover transport rejection, source semantics, prose flags, quotation quarantine, provenance, explicit selection, unchanged assembly and corpus integrity. Current test totals belong in the actual test output and release artifacts, not in an unmaintained number here. Neither passing tests nor source processing is a legal accuracy score.

See [the shared validator and separate Anthropic path](compiler.md) for the other transport and its cost controls.

## Operative dates and sunsets (1.3.1)

Compiler 1.3.1 adds an optional, source-supported `end_date` and distinguishes a delayed operative date from an amendment’s earlier effective date. The start used by the evaluator is when the substantive rule operates; the end is exclusive. The source review must still verify both. Earlier recorded 1.2.1/1.3.0 runs keep their original hashes and schema; they are not relabelled or rewritten.

## Source jurisdiction boundary (1.3.2)

Compiler 1.3.2 explicitly instructs both transports to keep extracted records within the source manifest jurisdiction. A city guidance page may quote statewide law; that material goes to review for extraction from the appropriate state source, rather than being emitted with a different jurisdiction or mislabelled as a city ordinance. Local duties may still preserve incorporated state definitions or procedures. The strict jurisdiction validator is unchanged. The new prompt/version hash requires a fresh run; previously rejected output is never repaired or relabelled as a successful extraction.
