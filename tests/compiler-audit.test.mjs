import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { validateExtraction } from '../scripts/compile.mjs';
import { parseArgs, parseEvents, canContinueSourceError } from '../scripts/compile-codex.mjs';
import { evaluateRule } from '../public/engine.mjs';

// Synthetic evidence only. These tests never invoke the compiler CLI, a model,
// the network, or any project cache, and do not rely on unpublished work/ files.
const schema = JSON.parse(readFileSync(new URL('../data/schema/rule_record.schema.json', import.meta.url), 'utf8'));
const quote = 'Synthetic fixture: covered owners must observe this obligation, except when the specified special program applies.';
const reviewQuote = 'Synthetic review clause provides fees and costs for tenants.';
const incorrectReviewQuote = 'Synthetic review clause provides fees costs for tenants.';
const source = {
  doc_id: 'X001', jurisdictions: 'CA', url: 'https://example.test/X001',
  text: `${quote}\n${reviewQuote}`, retrieved_at: '2026-10-04T00:00:00Z',
};
const coverageProse = 'Covered owners, except those within the specified special program; determining that exception requires interpretation.';
const baseRule = {
  team_rule_id: 'x001-fixture', jurisdiction: 'CA', level: 'state',
  category: 'security_deposits', status: 'in_force', title: 'Synthetic fixture',
  requirement: quote, citation: 'Synthetic fixture section 1',
  source_url: source.url, quoted_span: quote, source_doc_id: source.doc_id,
  effective_date: '2026-01-01', coverage_conditions: { all: [] },
};
const extraction = (changes = {}) => ({
  rules: [{ ...structuredClone(baseRule), ...changes }], review: [], no_rule_findings: [],
});
const validate = value => validateExtraction(value, source, schema);
const hash = value => createHash('sha256').update(value).digest('hex');
const usage = { input_tokens: 12, output_tokens: 7 };
const encode = events => `${events.map(event => JSON.stringify(event)).join('\n')}\n`;
const eventsFor = (text = '{}') => [
  { type: 'thread.started', thread_id: 'synthetic-thread' },
  { type: 'turn.started' },
  { type: 'item.completed', item: { id: 'answer', type: 'agent_message', text } },
  { type: 'turn.completed', usage: { ...usage } },
];
const caught = run => {
  let error;
  try { run(); } catch (value) { error = value; }
  assert(error instanceof Error, 'Expected the exported API to reject this fixture.');
  return error;
};
const continueOptions = { enabled: true, phase: 'live', completedToolFreeTurn: true };

test('compiler preserves narrative coverage as non-executable, attributed review without mutating input', () => {
  const input = extraction({ coverage_conditions: coverageProse, execution_review_pending: true });
  const original = structuredClone(input);
  const output = validate(input);
  assert.deepEqual(input, original);
  assert.equal(output.rules[0].coverage_conditions, coverageProse);
  assert.equal(output.rules[0].execution_review_pending, true);
  assert.equal(output.rules[0].quoted_span, quote);
  assert.equal(output.review.length, 1);
  assert.equal(output.review[0].quoted_span, null);
  assert.equal(output.review[0].source_doc_id, source.doc_id);
  assert.match(output.review[0].issue, /x001-fixture/);
  const evaluation = evaluateRule(output.rules[0], { state: 'CA', units: 20 }, '2026-10-01', {
    local_rent_control_applies: true, residential: true,
  });
  assert.equal(evaluation.result, 'unknown');
  assert.deepEqual(evaluation.missing, ['coverage interpretation']);
});

test('compiler rejects prose without explicit review and prevents AST or unknown-fact review bypasses', () => {
  for (const flag of [undefined, false, 'true', 1, null]) {
    const input = extraction({ coverage_conditions: coverageProse });
    if (flag !== undefined) input.rules[0].execution_review_pending = flag;
    assert.throws(() => validate(input));
  }
  assert.throws(() => validate(extraction({ execution_review_pending: true })), /AST coverage cannot be marked/);
  assert.throws(() => validate(extraction({ coverage_conditions: { field: 'invented_program', op: 'eq', value: true } })), /Unsupported coverage field/);
  assert.throws(() => validate(extraction({ coverage_conditions: { all: [], field: 'units', op: 'lt', value: 0 } })), /Ambiguous condition group/);
  for (const prose of [' '.repeat(20), 'x'.repeat(19), 'x'.repeat(10001)]) {
    assert.throws(() => validate(extraction({ coverage_conditions: prose, execution_review_pending: true })));
  }
  assert.equal(validate(extraction()).review.length, 0);
  assert.equal(validate(extraction({ execution_review_pending: false })).review.length, 0);
});

test('an inexact review quotation is quarantined with a hash while valid rules and exact review evidence survive', () => {
  const input = extraction();
  const unverifiedIssue = 'The fee remedy needs further interpretation before implementation.';
  input.review = [
    { issue: 'This exact source passage requires separate review.', quoted_span: reviewQuote },
    { issue: unverifiedIssue, quoted_span: incorrectReviewQuote },
    { issue: 'This workflow issue has no supporting quotation.', quoted_span: null },
  ];
  const original = structuredClone(input);
  const output = validate(input);
  assert.deepEqual(input, original);
  assert.equal(output.rules.length, 1);
  assert.equal(output.rules[0].quoted_span, quote);
  assert.equal(output.review.length, 3);
  assert.equal(output.review[0].quoted_span, reviewQuote);
  assert.equal(output.review[2].quoted_span, null);
  const rejected = output.review[1];
  assert.equal(rejected.quoted_span, null);
  assert.equal(rejected.quote_verification, 'rejected_not_exact');
  assert.equal(rejected.issue_code, 'unverified_review_quote');
  assert.equal(rejected.rejected_quote_sha256, hash(incorrectReviewQuote));
  assert.equal(rejected.original_review_index, 1);
  assert.equal(rejected.unverified_model_issue, unverifiedIssue);
  assert.equal(rejected.source_doc_id, source.doc_id);
  assert.equal(rejected.source_url, source.url);
  assert.match(rejected.issue, /not as source evidence/);
  assert(!JSON.stringify(output).includes(incorrectReviewQuote));
  assert.deepEqual(validate(input), output, 'Quarantine must be deterministic.');
});

test('inexact operative and no-rule quotations remain fatal rather than entering review quarantine', () => {
  assert.throws(() => validate(extraction({
    quoted_span: 'Invented operative text that is not present in the synthetic source.',
  })), /Rule quotation is not an exact source span/);
  const input = extraction();
  input.no_rule_findings.push({
    category: 'algorithmic_rent_setting',
    finding: 'This synthetic absence claim still needs exact supporting evidence.',
    quoted_span: 'Invented absence finding that is not present in the synthetic source.',
  });
  assert.throws(() => validate(input), /No-rule finding quote is not an exact source span/);
});

test('models cannot inject quote-verification metadata or malformed review evidence', () => {
  for (const changes of [
    { quote_verification: 'exact' },
    { issue_code: 'verified_by_model' },
    { rejected_quote_sha256: 'a'.repeat(64) },
    { quoted_span: { text: reviewQuote } },
  ]) {
    const input = extraction();
    input.review.push({ issue: 'A synthetic issue for evidence review.', quoted_span: reviewQuote, ...changes });
    assert.throws(() => validate(input), /unexpected|incorrect type/);
  }
});

test('unverified compiler conflict flags, conflict notes and override relationships are rejected', () => {
  for (const changes of [
    { conflict_flag: true },
    { conflict_flag: true, conflict_note: 'Two different deadlines exist.' },
    { conflict_note: 'This source silently overrides every other rule.' },
    { overrides: ['unverified-other-rule'] },
  ]) assert.throws(() => validate(extraction(changes)));
  const input = extraction({ conflict_flag: false, conflict_note: null, overrides: [] });
  input.review.push({ issue: 'The interaction with another source requires review.', quoted_span: null });
  assert.equal(validate(input).rules.length, 1);
});

test('candidate output paths stay in artifacts and source-error continuation requires explicit opt-in', () => {
  const defaults = parseArgs([]);
  assert.equal(defaults.continueOnSourceError, false);
  assert.equal(defaults.output, 'artifacts/codex-compiler-pack.json');
  const selected = parseArgs(['--continue-on-source-error', '--output', 'artifacts/audit-candidates.v2.json']);
  assert.equal(selected.continueOnSourceError, true);
  assert.equal(selected.output, 'artifacts/audit-candidates.v2.json');
  for (const name of [
    '../pack.json', 'artifacts/../pack.json', '/tmp/pack.json', 'public/data/pack.json',
    'artifacts/sub/pack.json', 'artifacts/a..b.json', 'artifacts/.hidden.json',
    'artifacts/a%2fb.json', 'artifacts/a.json\0', 'artifacts/a.json\n',
    'artifacts/a.json;echo', 'artifacts/a\\b.json',
  ]) assert.throws(() => parseArgs(['--output', name]), error => error.code === 'invalid_output_path', name);
});

test('completed tool-free transport supplies usage and hashes without interpreting quoted tool names as events', () => {
  const response = JSON.stringify({ note: 'Synthetic quoted words: command_execution, tool_call, web_search.' });
  const events = eventsFor(response);
  events.splice(2, 0, { type: 'item.completed', item: { id: 'reasoning', type: 'reasoning', text: 'Synthetic reasoning.' } });
  const transport = encode(events);
  const parsed = parseEvents(transport);
  assert.deepEqual(parsed.extraction, JSON.parse(response));
  assert.deepEqual(parsed.usage, usage);
  assert.equal(parsed.responseHash, hash(response));
  assert.equal(parsed.transportHash, hash(transport));
  assert.equal(parsed.eventCount, events.length);
});

test('only classified content errors from completed live tool-free turns can continue', () => {
  for (const [text, expectedCode] of [
    ['{invalid}', 'invalid_final_json'],
    ['```json\n{}\n```', 'final_response_is_not_bare_json'],
  ]) {
    const transport = encode(eventsFor(text));
    const error = caught(() => parseEvents(transport));
    assert.equal(error.code, expectedCode);
    assert.deepEqual(error.completedTurn.usage, usage);
    assert.equal(error.completedTurn.transportHash, hash(transport));
    assert.equal(canContinueSourceError(error, continueOptions), true);
    for (const options of [
      { ...continueOptions, enabled: false },
      { ...continueOptions, phase: 'cache' },
      { ...continueOptions, completedToolFreeTurn: false },
      {},
    ]) assert.equal(canContinueSourceError(error, options), false);
  }
  for (const fake of [
    { code: 'invalid_final_json', completedTurn: { usage } },
    Object.assign(new Error('invalid_final_json'), { code: 'invalid_final_json', completedTurn: { usage } }),
  ]) assert.equal(canContinueSourceError(fake, continueOptions), false, 'Plain model-shaped errors are not certified compiler failures.');
});

test('tool attempts, incomplete transport and invalid usage never qualify for continuation', () => {
  const cases = [];
  const add = (mutate, code) => { const events = eventsFor('{invalid}'); mutate(events); cases.push([encode(events), code]); };
  add(events => events.splice(2, 0, { type: 'item.started', item: { type: 'command_execution', command: 'synthetic command, never executed' } }), 'tool_or_unrecognized_item_rejected');
  add(events => { events[2].item.tool_call = {}; }, 'tool_or_command_event_rejected');
  add(events => events.pop(), 'incomplete_or_multiple_cli_turns');
  add(events => events.splice(2, 0, { type: 'turn.started' }), 'incomplete_or_multiple_cli_turns');
  add(events => events.push({ type: 'item.completed', item: { type: 'reasoning', text: 'Late synthetic item.' } }), 'events_after_turn_completion');
  add(events => { delete events.at(-1).usage; }, 'missing_or_invalid_cli_usage');
  add(events => { events.at(-1).usage.output_tokens = -1; }, 'missing_or_invalid_cli_usage');
  add(events => { events.at(-1).usage.cached_input_tokens = 0.5; }, 'invalid_cli_usage_count');
  add(events => events.splice(2, 1), 'expected_one_final_agent_message');
  add(events => events.splice(2, 0, { type: 'future.untrusted.event' }), 'untrusted_or_failed_cli_event');
  cases.push(['not-json\n', 'non_json_cli_output']);
  for (const [transport, expectedCode] of cases) {
    const error = caught(() => parseEvents(transport));
    assert.equal(error.code, expectedCode);
    assert.equal(error.completedTurn, undefined, expectedCode);
    assert.equal(canContinueSourceError(error, continueOptions), false, expectedCode);
  }
});
