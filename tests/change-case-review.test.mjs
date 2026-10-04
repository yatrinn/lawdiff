import test from 'node:test';
import assert from 'node:assert/strict';
import { checkChangeCases } from '../scripts/check-change-cases.mjs';

const a = (address_id, state, legal_city) => ({ address_id, state, geography: { legal_city }, units: null, year_built: null });
const rule = (overrides = {}) => ({ team_rule_id: 'fixture', source_doc_id: 'D069', level: 'state', jurisdiction: 'NJ', category: 'algorithmic_rent_setting',
  status: 'in_force', effective_date: '2027-07-01', coverage_conditions: { all: [] }, requirement: 'Synthetic test obligation.', title: 'Synthetic fixture', ...overrides });
const change = (test_id, overrides = {}) => ({ test_id, title: 'Synthetic organizer test', expected_behavior: 'Explicit synthetic expectation.',
  type: 'as_of', as_of_before: '2026-10-01', as_of_after: '2027-07-02', ...overrides });
const run = (c, rules, addresses = [a('nj', 'NJ', 'Newark')]) => checkChangeCases({ snapshot: '2026-10-01', addresses, changes: [c] }, { rules }, '2026-10-04T00:00:00Z').cases[0];

test('change review calls unresolved material facts PARTIAL, never a passing affected set', () => {
  const report = run(change('T3'), [rule({ coverage_conditions: { field: 'primary_residence', op: 'eq', value: true } })]);
  assert.equal(report.outcome, 'PARTIAL');
  assert.equal(report.actual.affected_count, 0);
  assert.equal(report.actual.unknown_count, 1);
  assert.deepEqual(report.after.missing_evidence_address_ids.primary_residence, ['nj']);
  assert.equal(report.contradictions.length, 0);
});

test('change review separates genuinely satisfied timing from wrong pre-effective activity', () => {
  assert.equal(run(change('T3'), [rule()]).outcome, 'PASS');
  const wrong = run(change('T3'), [rule({ effective_date: '2026-01-01' })]);
  assert.equal(wrong.outcome, 'MISMATCH');
  assert(wrong.contradictions.some(i => i.code === 'active_before_expected_effective_date'));
});

test('change review does not turn absent source coverage into a successful empty result', () => {
  const report = run(change('T3'), []);
  assert.equal(report.outcome, 'PARTIAL');
  assert(report.unresolved.some(i => i.code === 'source_coverage_gap'));
});

test('change review detects a pending bill incorrectly relabelled active', () => {
  const report = run(change('T4', { type: 'pending', as_of: '2026-10-01', as_of_before: undefined, as_of_after: undefined }),
    [rule({ source_doc_id: 'D045', jurisdiction: 'MA', effective_date: '2026-01-01' })], [a('ma', 'MA', 'Boston')]);
  assert.equal(report.outcome, 'MISMATCH');
  assert(report.contradictions.some(i => i.code === 'proposal_reported_active'));
});

test('change review requires both supplied pending bills, not just one plausible proposal', () => {
  const c = change('T4', { type: 'pending', as_of: '2026-10-01', as_of_before: undefined, as_of_after: undefined });
  const ma = [a('ma', 'MA', 'Boston')];
  const one = rule({ source_doc_id: 'D045', jurisdiction: 'MA', status: 'pending' });
  assert.equal(run(c, [one], ma).outcome, 'PARTIAL');
  assert.equal(run(c, [one, { ...one, source_doc_id: 'D046', team_rule_id: 'second' }], ma).outcome, 'PASS');
});

test('change review negative case detects an active cap and requires a failed-status record', () => {
  const c = change('T5', { type: 'negative', as_of: '2026-10-01', as_of_before: undefined, as_of_after: undefined });
  const ma = [a('ma', 'MA', 'Cambridge')];
  const failed = rule({ jurisdiction: 'MA', category: 'rent_increase_limits', status: 'failed' });
  assert.equal(run(c, [failed], ma).outcome, 'PASS');
  assert.equal(run(c, [], ma).outcome, 'PARTIAL');
  assert.equal(run(c, [failed, { ...failed, team_rule_id: 'bad-active', status: 'in_force', effective_date: '2026-01-01' }], ma).outcome, 'MISMATCH');
});

test('change review recognizes the complete bill-text supplements as both pending bills', () => {
  const c = change('T4', { type: 'pending', as_of: '2026-10-01', as_of_before: undefined, as_of_after: undefined });
  const bills = ['M001','M002'].map((id,index) => rule({source_doc_id:id,team_rule_id:'supplement-'+index,jurisdiction:'MA',status:'pending'}));
  assert.equal(run(c,bills,[a('ma','MA','Boston')]).outcome,'PASS');
});
