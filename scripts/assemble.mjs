#!/usr/bin/env node
/** Assemble only an explicit, reproducible selection of automatic candidates. */
import { readFile, writeFile, rename, unlink, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promoteSelection, validateSelection } from './promote-candidates.mjs';
import { sha256, validateAssembledPack, validatePromotionAudit } from './validate-artifacts.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = 'data/extracted/automatic-reviewed.json';
const SELECTION = 'data/extracted/automatic-selection.json';
const OUTPUT = 'public/data/rule-pack.json';
const decode = bytes => JSON.parse(Buffer.from(bytes).toString('utf8'));

/** Pure assembly. Original artifact bytes, not caller-supplied hashes, bind the selection. */
export function assembleReviewed({ catalogBytes, reviewedBytes, selectionBytes, artifacts }, { assembledAt = new Date().toISOString() } = {}) {
  const catalog = decode(catalogBytes), reviewed = decode(reviewedBytes), selection = decode(selectionBytes);
  validateSelection(selection);
  validatePromotionAudit(reviewed, catalog, sha256(catalogBytes));
  if (!Array.isArray(artifacts)) throw Error('Explicit original artifact bytes are required for assembly.');
  const inputs = artifacts.map(({ path, bytes }) => ({ path, file_sha256: sha256(bytes), pack: decode(bytes) }));
  const reproduced = promoteSelection(catalog, selection, inputs, {
    catalogFileHash: sha256(catalogBytes), selectionHash: sha256(selectionBytes), generatedAt: reviewed.generated_at,
  });
  if (JSON.stringify(reproduced) !== JSON.stringify(reviewed)) throw Error('Automatic-reviewed content does not reproduce from the explicit manifest and original artifact bytes.');
  const pack = structuredClone(reviewed);
  pack.assembly = {
    assembler_version: 'lawdiff-automatic-assembly/1.0.0', assembled_at: assembledAt,
    source_path: INPUT, source_file_sha256: sha256(reviewedBytes), source_content_sha256: sha256(JSON.stringify(reviewed)),
    catalog_file_sha256: sha256(catalogBytes), selection_file_sha256: sha256(selectionBytes),
    original_artifacts_revalidated: true, rules_modified: false, independent_legal_review: false,
  };
  validateAssembledPack(pack, catalog, sha256(catalogBytes));
  return pack;
}

async function confinedRead(relativePath, directory) {
  const path = join(ROOT, relativePath), actual = await realpath(path), allowed = await realpath(join(ROOT, directory));
  if (dirname(actual) !== allowed) throw Error('Assembly input resolves outside its allowed directory.');
  const bytes = await readFile(path);
  if (bytes.length > 32_000_000) throw Error('Assembly input exceeds the local size limit.');
  return bytes;
}

export async function main(argv = process.argv.slice(2)) {
  if (argv.some(flag => !['--dry-run', '--help'].includes(flag)) || new Set(argv).size !== argv.length) throw Error('Use only --dry-run or --help; no fallback inputs are supported.');
  if (argv.includes('--help')) {
    console.log(`Usage: node scripts/assemble.mjs [--dry-run]\nReads only ${INPUT} plus its explicit selection manifest and named original artifacts.\nReproduces promotion, preserves every selected rule and audit, and atomically writes ${OUTPUT}.\nNo assisted-pack fallback, injected rules, model calls or legal certification.`);
    return;
  }
  const catalogBytes = await confinedRead('public/data/catalog.json', 'public/data');
  const reviewedBytes = await confinedRead(INPUT, 'data/extracted');
  const selectionBytes = await confinedRead(SELECTION, 'data/extracted');
  const selection = validateSelection(decode(selectionBytes)), artifacts = [];
  for (const path of new Set(selection.selections.map(entry => entry.artifact))) artifacts.push({ path, bytes: await confinedRead(path, 'artifacts') });
  const pack = assembleReviewed({ catalogBytes, reviewedBytes, selectionBytes, artifacts });
  if (!argv.includes('--dry-run')) {
    const target = join(ROOT, OUTPUT), temporary = `${target}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(pack, null, 2)}\n`, { flag: 'wx' });
    try { await rename(temporary, target); } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  }
  console.log(JSON.stringify({ mode: argv.includes('--dry-run') ? 'dry_run' : 'written', selected_sources: pack.audit.length, rules: pack.rules.length,
    execution_review_count: pack.provenance.execution_review_count, unchanged_rule_objects: true, independent_legal_review: false,
    output: argv.includes('--dry-run') ? null : OUTPUT }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`Automatic assembly stopped: ${error.message}`); process.exitCode = 1; });
