import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregate } from '../scripts/aggregate-corpus.mjs';
import { promoteSelection } from '../scripts/promote-candidates.mjs';
import { assembleReviewed } from '../scripts/assemble.mjs';
import { sha256, validateCorpusSnapshot, validatePromotionAudit, validateBuildSnapshot } from '../scripts/validate-artifacts.mjs';

// Isolated in-memory fixtures only. Nothing here is written to public or production data.
const bytes = value => Buffer.from(JSON.stringify(value));
function fixture() {
  const quote = 'Synthetic test source: residential landlords must return the security deposit within the stated statutory period.';
  const catalog = { snapshot: '2026-10-01', sources: [
    { doc_id: 'X001', jurisdictions: 'CA', url: 'https://example.test/fixture', text: quote },
    { doc_id: 'X002', jurisdictions: 'CA', url: 'https://example.test/not-processed', text: 'Captured fixture without an extraction attempt.' },
    { doc_id: 'X003', jurisdictions: 'CA', url: 'https://example.test/missing', text: null },
  ] };
  const rules = ['return', 'retention'].map(suffix => ({ team_rule_id: `x001-${suffix}`, jurisdiction: 'CA', level: 'state', category: 'security_deposits', status: 'in_force', title: 'Synthetic test rule', requirement: quote, citation: 'Fixture §1', source_url: catalog.sources[0].url, quoted_span: quote, source_doc_id: 'X001', effective_date: '2026-01-01', coverage_conditions: { all: [] }, overrides: [], conflict_flag: false, conflict_note: null, extraction_method: 'codex_cli_structured_extraction', review_status: 'machine_validated_not_legally_reviewed' }));
  const original = { version: 1, rules, review: [{ source_doc_id: 'X001', source_url: catalog.sources[0].url, issue: 'Interpretation remains subject to separate review.', quoted_span: null }], no_rule_findings: [],
    provenance: { run_id: 'test-run', compiler_version: 'lawdiff-codex-cli-compiler/1.3.0', status: 'completed_with_review_items', as_of: catalog.snapshot, model: 'fixture-model', cli_version: 'fixture-cli', started_at: '2026-10-04T01:00:00Z', finished_at: '2026-10-04T01:01:00Z', requests_sent: 1, model_turns_completed: 1, cache_hits: 0, accepted_rule_count: 2, review_issue_count: 1, rejected_review_quote_count: 0, no_rule_finding_count: 0,
      sources: [{ source_doc_id: 'X001', source_sha256: sha256(quote), prompt_sha256: sha256('prompt'), schema_sha256: sha256('schema'), response_sha256: sha256('response'), transport_sha256: sha256('transport'), status: 'validated_candidates', model: 'fixture-model', cli_version: 'fixture-cli', started_at: '2026-10-04T01:00:00Z', finished_at: '2026-10-04T01:01:00Z', model_called_this_run: true, exit_code: 0, usage: { input_tokens: 10, output_tokens: 20 }, accepted_rules: 2, review_issues: 1, rejected_review_quote_count: 0, no_rule_findings: 0 }] } };
  const artifacts = [{ path: 'artifacts/fixture.json', bytes: bytes(original) }], input = { path: artifacts[0].path, file_sha256: sha256(artifacts[0].bytes), pack: original };
  const selection = { version: 1, selections: [{ artifact: input.path, artifact_sha256: input.file_sha256, source_doc_id: 'X001', rule_ids: ['x001-return'], reason: 'Explicit test selection omits the second candidate.' }] };
  const catalogBytes = bytes(catalog), selectionBytes = bytes(selection);
  const reviewed = promoteSelection(catalog, selection, [input], { selectionHash: sha256(selectionBytes), catalogFileHash: sha256(catalogBytes), generatedAt: '2026-10-04T02:00:00Z' });
  const reviewedBytes = bytes(reviewed), assemblyInputs = { catalogBytes, selectionBytes, reviewedBytes, artifacts };
  const pack = assembleReviewed(assemblyInputs, { assembledAt: '2026-10-04T02:01:00Z' });
  const { coverage, candidates } = aggregate(catalog, [input], { catalogFileHash: sha256(catalogBytes), generatedAt: '2026-10-04T02:02:00Z', aggregationId: 'test-aggregation' });
  const snapshot = { catalogBytes, selectionBytes, reviewedBytes, packBytes: bytes(pack), coverageBytes: bytes(coverage), candidatesBytes: bytes(candidates) };
  return { catalog, original, reviewed, pack, artifacts, assemblyInputs, coverage, candidates, snapshot };
}

test('automatic assembly preserves the explicit subset, every rule byte and source review without injected rules', () => {
  const f = fixture(), checked = validateBuildSnapshot(f.snapshot);
  assert.deepEqual(f.pack.rules, [f.original.rules[0]]);
  assert.deepEqual(f.pack.audit, f.reviewed.audit);
  assert.deepEqual(f.pack.review, f.reviewed.review);
  assert.deepEqual(f.pack.audit[0].omitted_rule_ids, ['x001-retention']);
  assert.equal(f.pack.assembly.source_file_sha256, sha256(f.snapshot.reviewedBytes));
  assert.equal(f.pack.assembly.rules_modified, false);
  assert.equal(f.pack.assembly.independent_legal_review, false);
  assert.equal(checked.coverage.stats.accepted_rule_count, 2); // Independent full-source corpus, selected app subset = 1.
  assert.equal(checked.pack.rules.length, 1);
  assert.equal(checked.file_sha256['rule-pack'], sha256(f.snapshot.packBytes));
});

test('assembly rejects changed original bytes, manifest bytes and assisted fallback packs', () => {
  const f = fixture();
  const changed = structuredClone(f.assemblyInputs);
  changed.artifacts[0].bytes = Buffer.concat([Buffer.from(changed.artifacts[0].bytes), Buffer.from(' ')]);
  assert.throws(() => assembleReviewed(changed), /Pinned artifact changed/);
  assert.throws(() => assembleReviewed({ ...f.assemblyInputs, selectionBytes: Buffer.concat([f.snapshot.selectionBytes, Buffer.from(' ')]) }), /does not reproduce/);
  const assisted = structuredClone(f.reviewed); assisted.method = 'codex_assisted_extraction';
  assert.throws(() => assembleReviewed({ ...f.assemblyInputs, reviewedBytes: bytes(assisted) }), /not a fallback/);
  assert.throws(() => assembleReviewed({ ...f.assemblyInputs, artifacts: [] }), /Not every explicitly/);
});

test('valid-looking edits and lost source reviews cannot bypass the selection audit', () => {
  const f = fixture(), edited = structuredClone(f.reviewed);
  edited.rules[0].requirement = 'A different statement that still passes the generic rule schema.';
  assert.throws(() => validatePromotionAudit(edited, f.catalog, sha256(f.snapshot.catalogBytes)), /Promoted rule changed/);
  edited.audit[0].rules[0].rule_sha256 = sha256(JSON.stringify(edited.rules[0]));
  assert.throws(() => assembleReviewed({ ...f.assemblyInputs, reviewedBytes: bytes(edited) }), /does not reproduce/);
  const noReviews = structuredClone(f.reviewed); noReviews.review = [];
  assert.throws(() => validatePromotionAudit(noReviews, f.catalog, sha256(f.snapshot.catalogBytes)), /reviews\/findings/);
  for (const change of [{ usage: {} }, { exit_code: null }, { response_sha256: null }, { failure_code: 'cli_timeout' }]) {
    const invalid = structuredClone(f.reviewed); Object.assign(invalid.audit[0].source_attempt, change);
    assert.throws(() => validatePromotionAudit(invalid, f.catalog, sha256(f.snapshot.catalogBytes)));
  }
});

test('corpus gate validates the catalog bytes, source hashes and candidate-set fingerprint', () => {
  const f = fixture(); assert.equal(validateCorpusSnapshot(f.snapshot).coverage.stats.processed, 1);
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, catalogBytes: Buffer.concat([f.snapshot.catalogBytes, Buffer.from(' ')]) }), /catalog-file hash/);
  const wrongSource = structuredClone(f.coverage); wrongSource.sources[0].catalog_text_sha256 = 'f'.repeat(64);
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, coverageBytes: bytes(wrongSource) }), /source hash/);
  const changed = structuredClone(f.candidates); changed.rules[0].requirement += ' Changed.';
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, candidatesBytes: bytes(changed) }), /candidate-set hash/);
  const wrongAttempt = structuredClone(f.coverage); wrongAttempt.sources[0].selected_attempt_id = 'other-run:X001';
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, coverageBytes: bytes(wrongAttempt) }), /selected run/);
});

test('corpus gate rejects lost reviews, modified receipts and false completion counters', () => {
  const f = fixture(), lostReview = structuredClone(f.candidates); lostReview.review = [];
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, candidatesBytes: bytes(lostReview) }), /result counts/);
  const wrongPair = structuredClone(f.candidates); wrongPair.provenance.aggregation_id = 'different-aggregation';
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, candidatesBytes: bytes(wrongPair) }), /receipt mismatch/);
  const falseCompletion = structuredClone(f.coverage); falseCompletion.runs[0].model_turns_completed = 0;
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, coverageBytes: bytes(falseCompletion) }), /exceed run counters/);
});

test('build gate binds the selected intermediate and public pack before any output work', () => {
  const f = fixture();
  assert.throws(() => validateBuildSnapshot({ ...f.snapshot, reviewedBytes: Buffer.concat([f.snapshot.reviewedBytes, Buffer.from(' ')]) }), /changed after assembly/);
  assert.throws(() => validateBuildSnapshot({ ...f.snapshot, selectionBytes: Buffer.concat([f.snapshot.selectionBytes, Buffer.from(' ')]) }), /changed after assembly/);
  const altered = structuredClone(f.pack); altered.interpretation_review = 'Legal correctness certified.';
  assert.throws(() => validateBuildSnapshot({ ...f.snapshot, packBytes: bytes(altered) }), /differs from the recorded/);
});

function variantInputs(f) {
  const old = structuredClone(f.original); old.provenance.run_id = 'older-test-run'; old.provenance.compiler_version = 'lawdiff-codex-cli-compiler/1.2.1'; old.rules[0].requirement += ' Earlier interpretation.';
  return [{ path: 'artifacts/older.json', file_sha256: sha256(bytes(old)), pack: old },
    { path: f.artifacts[0].path, file_sha256: sha256(f.artifacts[0].bytes), pack: f.original }];
}
function choose(f, inputs, manifest = JSON.parse(f.snapshot.selectionBytes)) {
  return aggregate(f.catalog, inputs, { catalogFileHash: sha256(f.snapshot.catalogBytes), generatedAt: '2026-10-04T02:02:00Z', selection: manifest, selectionHash: sha256(bytes(manifest)) });
}

test('an explicit hash-pinned source/run choice resolves versions while retaining full candidates and all attempts', () => {
  const f = fixture(), inputs = variantInputs(f);
  assert.equal(aggregate(f.catalog, inputs).coverage.sources[0].status, 'rejected');
  const selected = choose(f, inputs);
  assert.deepEqual(selected.candidates.rules, f.original.rules);
  assert.equal(selected.candidates.rules.length, 2); // The one app_rule_id never filters corpus candidates.
  assert.equal(selected.coverage.attempts.length, 2);
  assert.equal(selected.coverage.sources[0].selected_attempt_id, 'test-run:X001');
  assert.deepEqual(selected.coverage.source_selection.decisions[0].app_rule_ids, ['x001-return']);
  const snapshot = { ...f.snapshot, coverageBytes: bytes(selected.coverage), candidatesBytes: bytes(selected.candidates) };
  assert.equal(validateBuildSnapshot(snapshot).pack.rules.length, 1);
  const earlier = JSON.parse(f.snapshot.selectionBytes); earlier.selections[0].artifact = inputs[0].path; earlier.selections[0].artifact_sha256 = inputs[0].file_sha256;
  const alternate = choose(f, inputs, earlier);
  assert.deepEqual(alternate.candidates.rules, inputs[0].pack.rules); // Explicit choice, never newest-version preference.
  assert.equal(validateCorpusSnapshot({ ...f.snapshot, coverageBytes: bytes(alternate.coverage), candidatesBytes: bytes(alternate.candidates) }).coverage.sources[0].status, 'processed');
});

test('source choices reject absent/hash-changed/failed attempts and invalid app IDs without fallback', () => {
  const f = fixture(), inputs = variantInputs(f);
  for (const patch of [{ artifact_sha256: 'f'.repeat(64) }, { artifact_sha256: undefined }, { artifact: 'artifacts/missing.json' }, { artifact: 'artifacts/../private.json' }, { source_doc_id: 'X002' }, { rule_ids: ['x001-absent'] }]) {
    const manifest = JSON.parse(f.snapshot.selectionBytes); Object.assign(manifest.selections[0], patch);
    assert.throws(() => choose(f, inputs, manifest));
  }
  const duplicate = JSON.parse(f.snapshot.selectionBytes); duplicate.selections.push(structuredClone(duplicate.selections[0]));
  assert.throws(() => choose(f, inputs, duplicate), /one explicit/);
  for (const status of ['partial_request_limit', 'stopped_requires_review']) {
    const altered = structuredClone(inputs); altered[1].pack.provenance.status = status;
    assert.throws(() => choose(f, altered), /fully completed trusted/);
  }
  const rejected = structuredClone(inputs); rejected[1].pack.provenance.sources[0].response_sha256 = null;
  assert.throws(() => choose(f, rejected), /did not pass validation/);
});

test('the build gate rejects forged decisions and corpus/app selections from different original runs', () => {
  const f = fixture(), inputs = variantInputs(f), selected = choose(f, inputs);
  const noDecision = structuredClone(selected); noDecision.coverage.source_selection = null; noDecision.candidates.provenance.source_selection = null;
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, coverageBytes: bytes(noDecision.coverage), candidatesBytes: bytes(noDecision.candidates) }), /require an explicit/);
  const forged = structuredClone(selected); forged.coverage.source_selection.decisions[0].artifact_sha256 = 'f'.repeat(64); forged.candidates.provenance.source_selection = structuredClone(forged.coverage.source_selection);
  assert.throws(() => validateCorpusSnapshot({ ...f.snapshot, coverageBytes: bytes(forged.coverage), candidatesBytes: bytes(forged.candidates) }), /not a validated/);
  const wrongSource = JSON.parse(f.snapshot.selectionBytes); wrongSource.selections[0].artifact = inputs[0].path; wrongSource.selections[0].artifact_sha256 = inputs[0].file_sha256;
  const alternate = choose(f, inputs, wrongSource);
  assert.throws(() => validateBuildSnapshot({ ...f.snapshot, coverageBytes: bytes(alternate.coverage), candidatesBytes: bytes(alternate.candidates) }), /manifest does not match/);
});
