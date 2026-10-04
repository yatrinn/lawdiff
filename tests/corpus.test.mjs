import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { checkedCorpusCoverage } from '../public/corpus.mjs';
import { aggregate } from '../scripts/aggregate-corpus.mjs';

// Synthetic IDs keep these checks independent of changing extraction artifacts.
const catalog = { sources: Array.from({ length: 106 }, (_, index) => ({
  doc_id: `X${String(index + 1).padStart(3, '0')}`,
})) };
function receipt() {
  const sources = catalog.sources.map(({ doc_id }, index) => ({
    source_doc_id: doc_id,
    status: ['processed', 'missing_text', 'rejected'][index] || 'unprocessed',
    accepted_rule_count: index === 0 ? 2 : 0,
    execution_review_count: index === 0 ? 1 : 0,
    rejected_review_quotes: index === 0 ? 1 : 0,
    no_rule_finding_count: index === 0 ? 1 : 0,
  }));
  return {
    version: 1, not_legal_review: true, generated_at: '2026-10-04T04:00:00Z', sources,
    stats: { catalog_source_count: 106, processed: 1, missing_text: 1,
      rejected: 1, unprocessed: 103, accepted_rule_count: 2,
      execution_review_count: 1, rejected_review_quotes: 1, no_rule_finding_count: 1 },
  };
}

test('corpus receipt accepts every catalog ID once with reconciled counts', () => {
  const value = receipt();
  assert.strictEqual(checkedCorpusCoverage(value, catalog), value);
  assert.equal(value.sources.length, 106);
  assert.equal(value.stats.processed + value.stats.missing_text + value.stats.rejected + value.stats.unprocessed, 106);
});

test('corpus receipt rejects duplicate, missing and unknown source IDs', () => {
  const duplicate = receipt(); duplicate.sources[1].source_doc_id = duplicate.sources[0].source_doc_id;
  assert.throws(() => checkedCorpusCoverage(duplicate, catalog), /does not cover this catalog/);
  const missing = receipt(); missing.sources.pop();
  assert.throws(() => checkedCorpusCoverage(missing, catalog), /does not cover this catalog/);
  const unknown = receipt(); unknown.sources[1].source_doc_id = 'X999';
  assert.throws(() => checkedCorpusCoverage(unknown, catalog), /Unknown corpus source/);
});

test('corpus receipt rejects forged status totals, output totals and catalog size', () => {
  for (const field of Object.keys(receipt().stats)) {
    const value = receipt(); value.stats[field]++;
    assert.throws(() => checkedCorpusCoverage(value, catalog), /do not reconcile|does not cover this catalog/, field);
  }
  const invalidCount = receipt(); invalidCount.sources[0].accepted_rule_count = 1.5;
  assert.throws(() => checkedCorpusCoverage(invalidCount, catalog), /Invalid source count/);
});

test('unprocessed, missing and rejected sources cannot claim accepted output even when totals match', () => {
  for (const status of ['unprocessed', 'missing_text', 'rejected']) {
    for (const field of ['accepted_rule_count', 'no_rule_finding_count']) {
      const value = receipt(), source = value.sources.find(row => row.status === status);
      source[field] = 1; value.stats[field]++;
      assert.throws(() => checkedCorpusCoverage(value, catalog), /cannot claim accepted output/, `${status}: ${field}`);
    }
  }
  const impossibleReviewCount = receipt();
  impossibleReviewCount.sources[0].execution_review_count = 3;
  impossibleReviewCount.stats.execution_review_count = 3;
  assert.throws(() => checkedCorpusCoverage(impossibleReviewCount, catalog), /cannot claim accepted output/);
});

test('aggregation requires completed CLI provenance; a relabeled timeout is not a processed source', () => {
  const hash = value => createHash('sha256').update(value).digest('hex');
  const source = { doc_id: 'X001', jurisdictions: 'CA', url: 'https://example.test/X001', text: 'Synthetic source text for a provenance-only regression fixture.' };
  const fixtureCatalog = { snapshot: '2026-10-01', sources: [source] };
  const completed = {
    version: 1, rules: [], review: [], no_rule_findings: [],
    provenance: {
      run_id: 'fixture-run', compiler_version: 'lawdiff-codex-cli-compiler/1.2.1',
      status: 'completed_machine_validation', as_of: fixtureCatalog.snapshot,
      model: 'fixture-model', cli_version: 'fixture-cli',
      started_at: '2026-10-04T01:00:00Z', finished_at: '2026-10-04T01:01:00Z',
      requests_sent: 1, model_turns_completed: 1, cache_hits: 0,
      accepted_rule_count: 0, review_issue_count: 0, rejected_review_quote_count: 0, no_rule_finding_count: 0,
      sources: [{ source_doc_id: source.doc_id, status: 'validated_candidates',
        source_sha256: hash(source.text), prompt_sha256: hash('prompt'), schema_sha256: hash('schema'),
        response_sha256: hash('response'), transport_sha256: hash('transport'),
        model: 'fixture-model', cli_version: 'fixture-cli',
        started_at: '2026-10-04T01:00:00Z', finished_at: '2026-10-04T01:01:00Z',
        model_called_this_run: true, exit_code: 0, usage: { input_tokens: 10, output_tokens: 20 },
        accepted_rules: 0, review_issues: 0, rejected_review_quote_count: 0, no_rule_findings: 0 }],
    },
  };
  const check = pack => aggregate(fixtureCatalog, [{ path: 'artifacts/fixture.json', file_sha256: hash(JSON.stringify(pack)), pack }]);
  assert.equal(check(completed).coverage.stats.processed, 1);
  assert.equal(check(completed).coverage.stats.model_calls_count, 1);
  const version13 = structuredClone(completed);
  version13.provenance.compiler_version = 'lawdiff-codex-cli-compiler/1.3.0';
  assert.equal(check(version13).coverage.stats.processed, 1);
  assert.equal(check(version13).coverage.runs[0].compiler_version, 'lawdiff-codex-cli-compiler/1.3.0');

  const timeout = structuredClone(completed);
  timeout.provenance.status = 'stopped_requires_review';
  timeout.provenance.model_turns_completed = 0;
  Object.assign(timeout.provenance.sources[0], { status: 'rejected_requires_review', response_sha256: null, failure_code: 'cli_timeout', exit_code: null });
  delete timeout.provenance.sources[0].usage;
  assert.equal(check(timeout).coverage.stats.rejected, 1);
  timeout.provenance.sources[0].status = 'validated_candidates'; // The exact single-field relabeling regression.
  assert.equal(check(timeout).coverage.stats.processed, 0);
  assert.equal(check(timeout).coverage.stats.rejected, 1);

  for (const field of ['source_sha256', 'prompt_sha256', 'schema_sha256', 'response_sha256', 'transport_sha256', 'usage', 'exit_code']) {
    const incomplete = structuredClone(completed); delete incomplete.provenance.sources[0][field];
    assert.equal(check(incomplete).coverage.stats.processed, 0, field);
  }
  for (const patch of [{ usage: {} }, { usage: { input_tokens: 10 } }, { failure_code: 'cli_timeout' }, { model: 'other-model' }, { cli_version: 'other-cli' }, { model_called_this_run: false }]) {
    const contradictory = structuredClone(completed); Object.assign(contradictory.provenance.sources[0], patch);
    assert.equal(check(contradictory).coverage.stats.processed, 0, JSON.stringify(patch));
  }
  const noCompletedTurns = structuredClone(completed); noCompletedTurns.provenance.model_turns_completed = 0;
  assert.equal(check(noCompletedTurns).coverage.stats.processed, 0);

  const cached = structuredClone(completed);
  Object.assign(cached.provenance, { requests_sent: 0, model_turns_completed: 0, cache_hits: 1 });
  Object.assign(cached.provenance.sources[0], { status: 'cache_hit_revalidated', model_called_this_run: false, original_run_id: 'earlier-fixture-run' });
  delete cached.provenance.sources[0].exit_code;
  assert.equal(check(cached).coverage.stats.processed, 1);
  assert.equal(check(cached).coverage.stats.model_calls_count, 0);
  delete cached.provenance.sources[0].original_run_id;
  assert.equal(check(cached).coverage.stats.processed, 0);
});
