/** Publish a completed candidate-run receipt; never promote candidates to public rules. */
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRulePack} from '../public/engine.mjs';
const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const pack = await read('artifacts/codex-compiler-pack.json');
const catalog = await read('public/data/catalog.json');
validateRulePack(pack, catalog.sources);
const audit = structuredClone(pack.provenance);
if (!['completed_machine_validation', 'completed_with_review_items'].includes(audit.status) ||
    !audit.requests_sent || audit.accepted_rule_count !== pack.rules.length || !pack.rules.length)
  throw Error('Publication requires a completed, actual model run with checked candidates.');
const hash = text => createHash('sha256').update(text).digest('hex');
for (const source of audit.sources) {
  const text = catalog.sources.find(s => s.doc_id === source.source_doc_id)?.text;
  if (!text || hash(text) !== source.source_sha256 || source.status !== 'validated_candidates')
    throw Error('Source text or recorded outcome changed; publication stopped.');
}
for (const item of [...pack.review, ...pack.no_rule_findings]) {
  if (item.quoted_span !== null && !catalog.sources.find(s => s.doc_id === item.source_doc_id)?.text?.includes(item.quoted_span))
    throw Error('Review evidence no longer matches the source.');
}
audit.duration_seconds = audit.duration_ms / 1000;
audit.candidate_pack_url = './data/extraction-candidates.json';
audit.code_sha256 = {};
for (const path of ['scripts/compile-codex.mjs', 'scripts/compile.mjs', 'public/engine.mjs', 'data/schema/rule_record.schema.json'])
  audit.code_sha256[path] = hash(await readFile(new URL(path, root)));
audit.record_role = 'separate_pipeline_test';
audit.current_selection_url = './data/rule-pack.json';
audit.current_corpus_receipt_url = './data/corpus-coverage.json';
audit.publication_note = 'This separate pipeline test does not describe the current selected rule pack. See current_selection_url for selected automatic records and current_corpus_receipt_url for all source statuses. Source matches and structural checks are not legal interpretation approval.';
await writeFile(new URL('public/data/extraction-candidates.json', root), JSON.stringify(pack, null, 2));
await writeFile(new URL('public/data/extraction-run.json', root), JSON.stringify(audit, null, 2));
console.log(`Published ${pack.rules.length} separate candidates and ${pack.review.length} review items; public rule pack unchanged.`);
