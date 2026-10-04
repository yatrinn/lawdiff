#!/usr/bin/env node
/** Restore only hash-pinned public recordings. No model or network access. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, COVERAGE, SELECTION, MANIFEST, sha, parseArgs, collectReferences, validatePublicRun, safePath, readBytes, identicalOrMissing } from './archive-extraction.mjs';

export async function restoreExtraction({ root = ROOT, dryRun = false } = {}) {
  const manifestBytes = await readBytes(root, MANIFEST), pin = (await readBytes(root, `${MANIFEST}.sha256`)).toString('utf8').trim();
  if (!/^[a-f0-9]{64}$/.test(pin) || sha(manifestBytes) !== pin) throw Error('Recorded manifest checksum mismatch.');
  const manifest = JSON.parse(manifestBytes);
  if (manifest.version !== 1 || manifest.format !== 'lawdiff-recorded-runs/1.0.0' || !Array.isArray(manifest.files) || !Array.isArray(manifest.inputs) || manifest.inputs.length !== 2) throw Error('Unsupported recorded manifest.');
  const inputBytes = new Map();
  for (const path of [COVERAGE, SELECTION]) {
    const matches = manifest.inputs.filter(item => item.path === path), bytes = await readBytes(root, path);
    if (matches.length !== 1 || matches[0].sha256 !== sha(bytes)) throw Error(`Published input differs from recording: ${path}`);
    inputBytes.set(path, bytes);
  }
  const refs = collectReferences(JSON.parse(inputBytes.get(COVERAGE)), JSON.parse(inputBytes.get(SELECTION)));
  if (refs.length !== manifest.files.length) throw Error('Recorded file list does not match published references.');
  const planned = [], seen = new Set();
  for (const entry of manifest.files) {
    const ref = refs.find(item => item.artifact_path === entry.artifact_path);
    if (!ref || seen.has(entry.artifact_path) || entry.archive_path !== ref.archive_path || entry.sha256 !== ref.sha256) throw Error('Unreferenced, duplicate or differently pinned recording.');
    seen.add(entry.artifact_path);
    const bytes = await readBytes(root, entry.archive_path);
    if (bytes.length !== entry.byte_length || sha(bytes) !== entry.sha256) throw Error(`Recorded artifact checksum mismatch: ${entry.archive_path}`);
    const pack = validatePublicRun(JSON.parse(bytes), ref.artifact_path, ref.referenced_by.includes('automatic_selection'));
    if (pack.provenance.run_id !== entry.run_id || (ref.run_id && ref.run_id !== entry.run_id) || pack.provenance.status !== entry.status || pack.provenance.compiler_version !== entry.compiler_version) throw Error('Recorded artifact audit metadata mismatch.');
    planned.push({ ref, bytes, exists: await identicalOrMissing(root, ref.artifact_path, bytes) });
  }
  if (!dryRun) for (const item of planned) if (!item.exists) {
    const path = await safePath(root, item.ref.artifact_path); await mkdir(dirname(path), { recursive: true }); await writeFile(path, item.bytes, { flag: 'wx', mode: 0o600 });
  }
  return { mode: dryRun ? 'dry_run' : 'restored', file_count: planned.length, already_present: planned.filter(item => item.exists).length, no_model_calls: true };
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) { console.log(`Restore recorded extraction artifacts\nUsage: node scripts/restore-extraction.mjs [--dry-run]\nVerifies manifest checksum, published input hashes and original file bytes before writing.\nExisting differing files are refused. No model calls, private caches or network access.`); return; }
  console.log(JSON.stringify(await restoreExtraction(options), null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`Extraction restore stopped: ${error.message}`); process.exitCode = 1; });
