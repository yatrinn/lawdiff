#!/usr/bin/env node
/** Archive only explicitly referenced public compiler outputs, preserving their bytes. */
import { readFile, writeFile, mkdir, rename, lstat, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateSelection } from './promote-candidates.mjs';
import { SUPPORTED_COMPILER_VERSIONS } from './aggregate-corpus.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COVERAGE = 'public/data/corpus-coverage.json';
export const SELECTION = 'data/extracted/automatic-selection.json';
export const ARCHIVE = 'data/extracted/recorded-runs';
export const MANIFEST = `${ARCHIVE}/manifest.json`;
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const HASH = /^[a-f0-9]{64}$/;
const FINISHED = new Set(['completed_machine_validation', 'completed_with_review_items', 'partial_request_limit', 'stopped_requires_review']);
const COMPLETE = new Set(['completed_machine_validation', 'completed_with_review_items']);
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
const fail = message => { throw Error(message); };
export const artifactPath = x => typeof x === 'string' && /^artifacts\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(x) && !x.includes('..') && basename(x) !== 'manifest.json';
const keys = (value, allowed, label) => { if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(`Unexpected public ${label} fields; no private payloads may be archived.`); };

export function parseArgs(argv) {
  if (argv.some(x => !['--help', '--dry-run'].includes(x)) || new Set(argv).size !== argv.length) fail('Only --help and --dry-run are supported. Input and output paths are fixed.');
  return { help: argv.includes('--help'), dryRun: argv.includes('--dry-run') };
}

/** No directory scan: the two published manifests are the sole input allowlist. */
export function collectReferences(coverage, selection) {
  if (coverage?.version !== 1 || !Array.isArray(coverage.input_files) || !coverage.input_files.length) fail('Missing published corpus input list.');
  validateSelection(selection);
  const files = new Map();
  const add = (path, hash, runId, origin) => {
    if (!artifactPath(path) || !HASH.test(hash || '')) fail('Unsafe or unpinned artifact reference.');
    const old = files.get(path);
    if (old && (old.sha256 !== hash || (runId && old.run_id && old.run_id !== runId))) fail(`Conflicting artifact pins: ${path}`);
    if (old) { if (!old.referenced_by.includes(origin)) old.referenced_by.push(origin); if (runId) old.run_id = runId; }
    else files.set(path, { artifact_path: path, archive_path: `${ARCHIVE}/${basename(path)}`, sha256: hash, run_id: runId || null, referenced_by: [origin] });
  };
  for (const input of coverage.input_files) {
    if (typeof input.run_id !== 'string' || !input.run_id) fail('Corpus input is missing its run ID.');
    add(input.path, input.file_sha256, input.run_id, 'corpus_coverage');
  }
  for (const entry of selection.selections) add(entry.artifact, entry.artifact_sha256, null, 'automatic_selection');
  if (files.size > 500) fail('Archive input limit exceeded.');
  return [...files.values()].sort((a, b) => a.artifact_path.localeCompare(b.artifact_path));
}

/** Reject raw transports, prompts and unexpected private fields instead of sanitizing/re-writing bytes. */
export function validatePublicRun(pack, path, selected = false) {
  keys(pack, ['version', 'provenance', 'rules', 'review', 'no_rule_findings'], 'package');
  const p = pack.provenance;
  keys(p, ['run_id', 'compiler_version', 'started_at', 'model', 'cli_version', 'as_of', 'requests_sent', 'model_turns_completed', 'cache_hits', 'sources', 'status', 'continue_on_source_error', 'output', 'lock_scope', 'scope', 'limitations', 'finished_at', 'duration_ms', 'accepted_rule_count', 'review_issue_count', 'rejected_review_quote_count', 'no_rule_finding_count', 'not_legal_review', 'failure_code', 'trust_status'], 'run');
  if (pack.version !== 1 || !SUPPORTED_COMPILER_VERSIONS.includes(p.compiler_version) || !FINISHED.has(p.status) || !Number.isFinite(Date.parse(p.finished_at)) || !Number.isFinite(Date.parse(p.started_at)) || Date.parse(p.finished_at) < Date.parse(p.started_at) || typeof p.run_id !== 'string' || !p.run_id || p.output !== path || !Array.isArray(p.sources) || ![pack.rules, pack.review, pack.no_rule_findings].every(Array.isArray)) fail(`Unfinished or unsupported public compiler output: ${path}`);
  if (selected && (!COMPLETE.has(p.status) || p.trust_status || p.failure_code)) fail('A selected artifact must be a completed trusted run.');
  if (p.accepted_rule_count !== pack.rules.length || p.review_issue_count !== pack.review.length || p.no_rule_finding_count !== pack.no_rule_findings.length) fail('Public run counts do not reconcile.');
  for (const s of p.sources) {
    keys(s, ['source_doc_id', 'source_sha256', 'prompt_sha256', 'response_sha256', 'schema_sha256', 'model', 'cli_version', 'status', 'accepted_rules', 'review_issues', 'no_rule_findings', 'rejected_review_quote_count', 'started_at', 'finished_at', 'duration_ms', 'model_called_this_run', 'exit_code', 'transport_sha256', 'usage', 'failure_code', 'source_error_continued', 'original_run_id'], 'source audit');
    if (s.usage !== undefined) keys(s.usage, ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens'], 'usage');
  }
  const ruleFields = ['team_rule_id', 'jurisdiction', 'level', 'category', 'status', 'title', 'requirement', 'key_value', 'coverage_conditions', 'exemptions', 'overrides', 'interaction', 'effective_date', 'end_date', 'citation', 'source_url', 'quoted_span', 'source_doc_id', 'confidence', 'conflict_flag', 'conflict_note', 'execution_review_pending', 'requirement_es', 'retrieved_at', 'extraction_method', 'review_status', 'translation_note'];
  for (const rule of pack.rules) keys(rule, ruleFields, 'rule');
  for (const item of pack.review) keys(item, ['source_doc_id', 'source_url', 'retrieved_at', 'issue', 'quoted_span', 'rejected_quote_sha256', 'original_review_index', 'unverified_model_issue', 'quote_verification', 'issue_code'], 'review');
  for (const item of pack.no_rule_findings) keys(item, ['source_doc_id', 'source_url', 'retrieved_at', 'category', 'finding', 'quoted_span'], 'finding');
  return pack;
}

/** Reject symlinks on every path component; archive/restore cannot follow them into caches. */
export async function safePath(root, relative) {
  if (typeof relative !== 'string' || relative.startsWith('/') || relative.split('/').some(x => !x || x === '.' || x === '..')) fail('Unsafe local path.');
  let path = await realpath(root);
  for (const component of relative.split('/')) {
    path = join(path, component);
    try { if ((await lstat(path)).isSymbolicLink()) fail(`Symlinks are not allowed: ${relative}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return path;
}
export async function readBytes(root, relative) {
  const path = await safePath(root, relative), stat = await lstat(path);
  if (!stat.isFile() || stat.size > 32_000_000) fail(`Not a bounded regular file: ${relative}`);
  return readFile(path);
}
export async function identicalOrMissing(root, relative, bytes) {
  try { if (!(await readBytes(root, relative)).equals(bytes)) fail(`Existing file differs; refusing overwrite: ${relative}`); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function atomicWrite(root, relative, bytes) {
  const path = await safePath(root, relative); await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`; await writeFile(temp, bytes, { flag: 'wx', mode: 0o644 }); await rename(temp, path);
}

export async function archiveExtraction({ root = ROOT, dryRun = false } = {}) {
  const coverageBytes = await readBytes(root, COVERAGE), selectionBytes = await readBytes(root, SELECTION);
  const files = collectReferences(JSON.parse(coverageBytes), JSON.parse(selectionBytes));
  const planned = [];
  for (const ref of files) {
    const bytes = await readBytes(root, ref.artifact_path);
    if (sha(bytes) !== ref.sha256) fail(`Published artifact pin does not match: ${ref.artifact_path}`);
    const pack = validatePublicRun(JSON.parse(bytes), ref.artifact_path, ref.referenced_by.includes('automatic_selection'));
    if (ref.run_id && ref.run_id !== pack.provenance.run_id) fail('Published run ID does not match artifact.');
    planned.push({ bytes, exists: await identicalOrMissing(root, ref.archive_path, bytes), entry: { ...ref, run_id: pack.provenance.run_id, byte_length: bytes.length, compiler_version: pack.provenance.compiler_version, status: pack.provenance.status } });
  }
  const manifest = { version: 1, format: 'lawdiff-recorded-runs/1.0.0', generated_at: new Date().toISOString(),
    inputs: [{ path: COVERAGE, sha256: sha(coverageBytes) }, { path: SELECTION, sha256: sha(selectionBytes) }],
    files: planned.map(p => p.entry), no_model_calls: true,
    note: 'Exact original bytes of explicitly referenced public terminal compiler artifacts. Stopped runs preserve failed/unprocessed audit outcomes; archival is not acceptance or legal review.' };
  if (!dryRun) {
    // Preflight every source and existing destination before writing anything.
    for (const item of planned) if (!item.exists) { const path = await safePath(root, item.entry.archive_path); await mkdir(dirname(path), { recursive: true }); await writeFile(path, item.bytes, { flag: 'wx', mode: 0o644 }); }
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    await atomicWrite(root, MANIFEST, manifestBytes);
    await atomicWrite(root, `${MANIFEST}.sha256`, `${sha(manifestBytes)}\n`);
  }
  return { mode: dryRun ? 'dry_run' : 'archived', file_count: files.length, manifest: MANIFEST, no_model_calls: true };
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) { console.log(`Archive referenced public extraction outputs\nUsage: node scripts/archive-extraction.mjs [--dry-run]\nReads only ${COVERAGE}.input_files and pinned ${SELECTION} selections.\nCopies original JSON bytes to ${ARCHIVE}; never reads caches or calls a model.\nOnly terminal public compiler artifacts are allowed; stopped runs retain their actual status.`); return; }
  console.log(JSON.stringify(await archiveExtraction(options), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`Extraction archival stopped: ${error.message}`); process.exitCode = 1; });
