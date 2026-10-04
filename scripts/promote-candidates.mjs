#!/usr/bin/env node
/** Explicit offline selection of unchanged automatic candidates. Does not assemble or modify the workspace pack. */
import { readFile, writeFile, mkdir, rename, unlink, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { aggregate, SUPPORTED_COMPILER_VERSIONS } from './aggregate-corpus.mjs';
import { validateRulePack } from '../public/engine.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = 'lawdiff-explicit-candidate-selection/1.0.0';
const SELECTION = 'data/extracted/automatic-selection.json';
const OUTPUT = 'data/extracted/automatic-reviewed.json';
const HASH = /^[a-f0-9]{64}$/;
const COMPLETED = new Set(['completed_machine_validation', 'completed_with_review_items']);
const sha = value => createHash('sha256').update(value).digest('hex');
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const artifactPath = value => typeof value === 'string' && /^artifacts\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(value) && !value.includes('..');
const fail = message => { throw Error(message); };
const HELP = `LawDiff · explicitly select unchanged automatic candidates

Usage: node scripts/promote-candidates.mjs --selection ${SELECTION} [--dry-run]
  --selection PATH  Required, exact manifest path shown above
  --dry-run         Validate the selection and report counts without writing
  --help            Show help without reading files

Manifest: {"version":1,"selections":[{"artifact":"artifacts/source.json",
"source_doc_id":"D001","rule_ids":["d001-rule"],"reason":"Documented selection reason",
"artifact_sha256":"optional SHA-256 pin for the reviewed file bytes"}]}

Only completed trusted compiler 1.2.1/1.3.0 runs are eligible. One artifact per
source, explicit rule IDs, no rule edits, no automatic choice between sources.
Writes only ${OUTPUT}. It never assembles the public pack, exports addresses,
contacts a model, changes the manifest, or asserts independent legal review.
`;

export function parseArgs(argv) {
  const options = { selection: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help') { options.help = true; continue; }
    if (flag === '--dry-run') { options.dryRun = true; continue; }
    if (flag !== '--selection' || options.selection !== null) fail('Use one explicit --selection and optional --dry-run.');
    if (argv[++i] !== SELECTION) fail(`Selection path must be ${SELECTION}.`);
    options.selection = SELECTION;
  }
  if (!options.help && options.selection !== SELECTION) fail('An explicit selection manifest is required; nothing is selected by default.');
  return options;
}

export function validateSelection(value) {
  if (!object(value) || value.version !== 1 || Object.keys(value).some(key => !['version', 'selections'].includes(key)) || !Array.isArray(value.selections) || !value.selections.length || value.selections.length > 500) fail('Expected version 1 manifest with one to 500 explicit selections.');
  const sources = new Set(), allRuleIds = new Set();
  for (const entry of value.selections) {
    if (!object(entry) || Object.keys(entry).some(key => !['artifact', 'source_doc_id', 'rule_ids', 'reason', 'artifact_sha256'].includes(key)) || !artifactPath(entry.artifact) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(entry.source_doc_id || '') || !Array.isArray(entry.rule_ids) || !entry.rule_ids.length || entry.rule_ids.length > 40 || typeof entry.reason !== 'string' || entry.reason.trim().length < 10 || entry.reason.length > 4000) fail('Invalid selection entry, rule list or documented reason.');
    if (entry.artifact_sha256 !== undefined && !HASH.test(entry.artifact_sha256)) fail('Invalid pinned artifact hash.');
    if (sources.has(entry.source_doc_id)) fail('One explicit artifact/selection per source is required; differing source sets cannot be merged.');
    sources.add(entry.source_doc_id);
    for (const id of entry.rule_ids) {
      if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,120}$/.test(id) || allRuleIds.has(id)) fail('Rule IDs must be valid, explicit and globally unique.');
      allRuleIds.add(id);
    }
  }
  return value;
}

/** Pure validation/selection. Input hashes identify the exact file bytes read by main(). */
export function promoteSelection(catalog, selection, inputs, { selectionHash, catalogFileHash, generatedAt = new Date().toISOString() } = {}) {
  validateSelection(selection);
  if (!HASH.test(selectionHash || '') || !HASH.test(catalogFileHash || '') || !Number.isFinite(Date.parse(generatedAt))) fail('Actual manifest/catalog hashes and a valid generation time are required.');
  const requested = new Set(selection.selections.map(entry => entry.artifact)), byPath = new Map();
  for (const input of inputs) {
    if (!object(input) || !requested.has(input.path) || byPath.has(input.path) || !HASH.test(input.file_sha256 || '')) fail('Missing, duplicate, unselected or unhashed input artifact.');
    const run = input.pack?.provenance;
    if (!object(run) || !SUPPORTED_COMPILER_VERSIONS.includes(run.compiler_version) || !COMPLETED.has(run.status) || Object.hasOwn(run, 'trust_status') || Object.hasOwn(run, 'failure_code')) fail('Only a completed trusted automatic run may supply selected rules.');
    // Each artifact is validated independently. The manifest, never a heuristic,
    // chooses exactly one artifact for each source; no candidate sets are merged.
    const checked = aggregate(catalog, [input], { generatedAt, catalogFileHash });
    byPath.set(input.path, { input, checked });
  }
  if (byPath.size !== requested.size) fail('Not every explicitly selected artifact was supplied.');
  const rules = [], review = [], noRuleFindings = [], audit = [];
  for (const entry of selection.selections) {
    const { input, checked } = byPath.get(entry.artifact), run = input.pack.provenance;
    if (entry.artifact_sha256 !== undefined && entry.artifact_sha256 !== input.file_sha256) fail(`Pinned artifact changed: ${entry.artifact}`);
    const coverage = checked.coverage.sources.find(source => source.source_doc_id === entry.source_doc_id);
    const attempt = checked.coverage.attempts.find(item => item.attempt_id === coverage?.selected_attempt_id);
    if (coverage?.status !== 'processed' || !attempt || attempt.validation_status !== 'processed') fail(`Selected source did not pass completed-run validation: ${entry.source_doc_id}`);
    const sourceRules = input.pack.rules.filter(rule => rule.source_doc_id === entry.source_doc_id);
    const sourceReview = checked.candidates.review.filter(item => item.source_doc_id === entry.source_doc_id);
    const sourceFindings = checked.candidates.no_rule_findings.filter(item => item.source_doc_id === entry.source_doc_id);
    const selectedRules = entry.rule_ids.map(id => {
      const rule = sourceRules.find(item => item.team_rule_id === id);
      if (!rule) fail(`Selected rule is absent from the selected source artifact: ${id}`);
      if (rule.extraction_method !== 'codex_cli_structured_extraction') fail(`Selected rule lacks automatic Codex extraction provenance: ${id}`);
      return structuredClone(rule); // No metadata, condition, citation or requirement is rewritten.
    });
    rules.push(...selectedRules); review.push(...structuredClone(sourceReview)); noRuleFindings.push(...structuredClone(sourceFindings));
    audit.push({ artifact: entry.artifact, artifact_sha256: input.file_sha256,
      artifact_hash_pinned_in_selection: entry.artifact_sha256 !== undefined,
      source_doc_id: entry.source_doc_id, selection_reason: entry.reason,
      selected_rule_ids: [...entry.rule_ids], omitted_rule_ids: sourceRules.filter(rule => !entry.rule_ids.includes(rule.team_rule_id)).map(rule => rule.team_rule_id),
      run_id: run.run_id, compiler_version: run.compiler_version, model: run.model, cli_version: run.cli_version,
      run_started_at: run.started_at, run_finished_at: run.finished_at,
      source_attempt: structuredClone(attempt),
      rules: selectedRules.map(rule => ({ team_rule_id: rule.team_rule_id, rule_sha256: sha(JSON.stringify(rule)),
        extraction_method: rule.extraction_method, review_status: rule.review_status ?? null,
        execution_review_pending: rule.execution_review_pending === true,
        independent_legal_review: false })),
      source_review_flags: { source_review_item_count: sourceReview.length,
        rejected_review_quote_count: sourceReview.filter(item => item.issue_code === 'unverified_review_quote').length,
        unresolved_review_items_preserved: sourceReview.length > 0, independent_legal_review: false },
    });
  }
  validateRulePack({ version: 1, rules }, catalog.sources);
  return { version: 1, generated_at: generatedAt, method: 'explicit_selection_of_automatic_candidates',
    interpretation_review: 'Explicit candidate selection only; not independent legal validation.',
    provenance: { selector_version: VERSION, selection_path: SELECTION, selection_file_sha256: selectionHash,
      catalog_file_sha256: catalogFileHash, as_of: catalog.snapshot,
      input_files: [...byPath.values()].map(({ input }) => ({ artifact: input.path, artifact_sha256: input.file_sha256, run_id: input.pack.provenance.run_id, compiler_version: input.pack.provenance.compiler_version })),
      source_count: selection.selections.length, selected_rule_count: rules.length,
      execution_review_count: rules.filter(rule => rule.execution_review_pending === true).length,
      no_model_calls: true, mainpack_modified: false, independent_legal_review: false,
      hash_method: 'Artifact, manifest and catalog hashes cover actual input-file bytes. Rule hashes cover UTF-8 JSON.stringify(rule) with its original parsed property order; selected rule objects are unchanged.',
      limitations: ['Selection reasons are supplied explicitly by the operator; this script does not perform or certify legal review.',
        'Only the named rules are selected, from one named artifact per source. Unselected candidates and alternative runs are not silently merged.',
        'Source-level review items and no-rule findings remain separate from selected rules; their presence does not mean that every selected rule is executable or that every source issue was resolved.',
        'Coverage prose awaiting execution review stays non-executable. Missing facts and uncertain legal interpretation are not resolved by selection.',
        'This intermediate file does not replace or modify the public rule pack or submission exports. Downstream assembly must preserve the recorded rule hashes and origin.',
        'No private CLI logs, prompts, raw responses, model credentials or source bodies are included.'] },
    rules, review, no_rule_findings: noRuleFindings, audit };
}

async function readLocalJSON(path, expectedDirectory) {
  const full = join(ROOT, path), actual = await realpath(full), allowed = await realpath(join(ROOT, expectedDirectory));
  if (dirname(actual) !== allowed) fail('Selected file resolves outside its allowed directory.');
  const bytes = await readFile(full);
  if (bytes.length > 32_000_000) fail('Selected file exceeds the local size limit.');
  return { value: JSON.parse(bytes.toString('utf8')), hash: sha(bytes) };
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv); if (options.help) { console.log(HELP); return; }
  const manifest = await readLocalJSON(SELECTION, 'data/extracted'); validateSelection(manifest.value);
  const catalogBytes = await readFile(join(ROOT, 'public/data/catalog.json'));
  const inputs = [];
  for (const path of new Set(manifest.value.selections.map(entry => entry.artifact))) {
    const artifact = await readLocalJSON(path, 'artifacts'); inputs.push({ path, file_sha256: artifact.hash, pack: artifact.value });
  }
  const result = promoteSelection(JSON.parse(catalogBytes.toString('utf8')), manifest.value, inputs,
    { selectionHash: manifest.hash, catalogFileHash: sha(catalogBytes) });
  if (!options.dryRun) {
    const full = join(ROOT, OUTPUT); await mkdir(dirname(full), { recursive: true });
    const temp = `${full}.${randomUUID()}.tmp`;
    await writeFile(temp, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    try { await rename(temp, full); } catch (error) { await unlink(temp).catch(() => {}); throw error; }
  }
  console.log(JSON.stringify({ mode: options.dryRun ? 'dry_run' : 'written', selected_sources: result.provenance.source_count,
    selected_rules: result.rules.length, execution_review_count: result.provenance.execution_review_count,
    output: options.dryRun ? null : OUTPUT, model_called: false, mainpack_modified: false, independent_legal_review: false }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`Candidate selection stopped: ${error.message}`); process.exitCode = 1; });
