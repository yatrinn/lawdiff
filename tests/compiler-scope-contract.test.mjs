import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  ADDRESS_SCOPE_CONTRACT, ORGANIZER_SCOPE_CONTEXT, COMPILER_VERSION,
  makeRequest, toolSchema, validateExtraction,
} from '../scripts/compile.mjs';
import { VERSION, makePrompt, parseArgs } from '../scripts/compile-codex.mjs';
import { evaluateRule } from '../public/engine.mjs';

// Synthetic legal fixtures test the software contract, not legal accuracy or
// model extraction quality. No test below calls a model, network or Codex CLI.
const root = new URL('../', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('data/schema/rule_record.schema.json', root), 'utf8'));
const asOf = '2026-10-01';
const quote = 'Synthetic fixture: This rule covers units intended as primary residences, excluding inpatient medical care, licensed long-term care and detention facilities. A covered lessor must not purchase a defined coordination service; exclusively same-owner activity and qualifying licensed providers are excluded from that service definition.';
const source = { doc_id: 'X930', jurisdictions: 'NJ', url: 'https://example.test/X930',
  retrieved_at: '2026-10-01T00:00:00Z', text: quote };
const leaf = (field, value) => ({ field, op: 'eq', value });
const scope = { all: [leaf('primary_residence', true), leaf('inpatient_medical_care', false),
  leaf('licensed_long_term_care', false), leaf('detention_or_correctional_facility', false)] };
const scopeFacts = { primary_residence: true, inpatient_medical_care: false,
  licensed_long_term_care: false, detention_or_correctional_facility: false };
const requirement = 'A covered lessor must not purchase a defined coordination service. Exclusively same-owner activity and qualifying licensed providers are excluded from the service definition.';
const exemptions = 'Medical, long-term-care and detention facilities are outside the covered unit definition; same-owner-only activity and qualifying licensed providers are excluded from the regulated service definition.';
const rule = {
  team_rule_id: 'x930-coordination', jurisdiction: 'NJ', level: 'state',
  category: 'algorithmic_rent_setting', status: 'in_force', title: 'Synthetic coordination duty',
  requirement, exemptions, citation: 'Synthetic fixture section 1',
  source_doc_id: source.doc_id, source_url: source.url, quoted_span: quote,
  effective_date: '2026-01-01', coverage_conditions: scope,
};
const extraction = record => ({ rules: [structuredClone(record)], review: [], no_rule_findings: [] });
const hash = value => createHash('sha256').update(value).digest('hex');

test('both compiler transports share one versioned scope contract and non-evidentiary dataset context', () => {
  const originalSchema = structuredClone(schema);
  const api = makeRequest(source, { model: 'test-model', maxOutputTokens: 8000 }, schema, asOf);
  const cli = makePrompt(source, { model: 'test-model' }, schema, asOf);
  assert.equal(COMPILER_VERSION, 'lawdiff-source-compiler/1.3.1');
  assert.equal(VERSION, 'lawdiff-codex-cli-compiler/1.3.1');
  for (const prompt of [api.request.system, cli.prompt]) {
    assert.equal(prompt.split(ADDRESS_SCOPE_CONTRACT).length, 2, 'The shared contract occurs exactly once.');
    assert.match(prompt, /not property-specific evidence of primary residence/);
    assert.match(prompt, /A provider-only duty is not a personal duty of the landlord or resident/);
    assert.match(prompt, /Missing evidence about actual conduct or a product does not alone require prose coverage/);
    assert(!prompt.includes('Coverage must represent material actor restrictions as well as property conditions when the fact vocabulary supports them.'));
  }
  const input = JSON.parse(api.request.messages[0].content);
  assert.equal(input.organizer_scope_context, ORGANIZER_SCOPE_CONTEXT);
  assert.equal(input.untrusted_source_text, source.text);
  assert(cli.prompt.includes(JSON.stringify(input)));
  assert(!/\b(?:D069|S003|D024|T[1-5]|140|250|500)\b/.test(ADDRESS_SCOPE_CONTRACT), 'The contract cannot prescribe benchmark sources or answer counts.');
  assert.deepEqual(schema, originalSchema, 'Building the response schema must not mutate the organizer schema.');
  assert.deepEqual(api.inputSchema, toolSchema(schema));
});

test('prompt and schema fingerprints are reproducible and bind source/context/version', () => {
  const a = makePrompt(source, { model: 'test-model' }, schema, asOf);
  const b = makePrompt(source, { model: 'test-model' }, schema, asOf);
  assert.deepEqual(a, b);
  assert.equal(a.promptHash, hash(a.prompt));
  assert.equal(a.schemaHash, hash(JSON.stringify(a.inputSchema)));
  assert.equal(a.sourceHash, hash(source.text));
  assert.notEqual(a.promptHash, hash(a.prompt.replace(COMPILER_VERSION, 'lawdiff-source-compiler/1.2.1')));
  assert.notEqual(a.promptHash, hash(a.prompt.replace(ORGANIZER_SCOPE_CONTEXT, 'Different research context.')));
  assert.notEqual(a.promptHash, makePrompt({ ...source, text: source.text + '\nAdditional evidence.' }, { model: 'test-model' }, schema, asOf).promptHash);
});

test('automatic records preserve operative start and exclusive statutory sunset through evaluation', () => {
  const temporalQuote = quote + ' This version is operative April 1, 2024 and is repealed January 1, 2030.';
  const temporalSource = { ...source, text: temporalQuote };
  const record = { ...rule, quoted_span: temporalQuote, effective_date: '2024-04-01', end_date: '2030-01-01' };
  const accepted = validateExtraction(extraction(record), temporalSource, schema).rules[0];
  assert.equal(evaluateRule(accepted, { state: 'NJ' }, '2024-03-31', scopeFacts).result, 'not_yet_effective');
  assert.equal(evaluateRule(accepted, { state: 'NJ' }, '2024-04-01', scopeFacts).result, 'applies');
  assert.equal(evaluateRule(accepted, { state: 'NJ' }, '2029-12-31', scopeFacts).result, 'applies');
  assert.equal(evaluateRule(accepted, { state: 'NJ' }, '2030-01-01', scopeFacts).result, 'not_applicable');
  assert.match(toolSchema(schema).properties.rules.items.properties.effective_date.description, /operative date/);
  assert.match(toolSchema(schema).properties.rules.items.properties.end_date.description, /sunset/);
});

test('automatic sunset fields reject impossible or reversed dates', () => {
  assert.throws(() => validateExtraction(extraction({ ...rule, end_date: '2030-02-30' }), source, schema), /calendar date/);
  assert.throws(() => validateExtraction(extraction({ ...rule, end_date: '2025-12-31' }), source, schema), /end must follow/);
});

test('complete property AST stays executable with absent values while conduct qualifications remain intact', () => {
  const input = extraction(rule);
  const original = structuredClone(input);
  const output = validateExtraction(input, source, schema);
  assert.deepEqual(input, original);
  assert.equal(output.review.length, 0, 'Missing data does not make the AST incomplete.');
  assert.deepEqual(output.rules[0].coverage_conditions, scope);
  assert.equal(output.rules[0].requirement, requirement);
  assert.equal(output.rules[0].exemptions, exemptions);
  const address = { state: 'NJ', use_code: '4C', use_description: 'Residential rental sample' };
  const unknown = evaluateRule(output.rules[0], address, asOf);
  assert.equal(unknown.result, 'unknown');
  assert.deepEqual(new Set(unknown.missing), new Set(Object.keys(scopeFacts)));
  assert.equal(evaluateRule(output.rules[0], address, asOf, scopeFacts).result, 'applies',
    'Known property scope needs no asserted software use, payment or violation.');
  assert.equal(evaluateRule(output.rules[0], address, asOf, { ...scopeFacts, inpatient_medical_care: true }).result, 'not_applicable');
});

test('owner and notice exemptions remain decisive eligibility conditions rather than descriptive footnotes', () => {
  const ownerQuote = 'Synthetic fixture: The cap covers housing whose occupancy certificate is at least fifteen years old, except a separately alienable unit owned by a natural person where the required exemption notice was given.';
  const ownerSource = { ...source, text: ownerQuote };
  const ownerRule = { ...rule, category: 'rent_increase_limits', requirement: ownerQuote,
    exemptions: 'The stated ownership, separate-title and notice conditions establish the exemption.', quoted_span: ownerQuote,
    coverage_conditions: { all: [
      { field: 'certificate_age_years', op: 'gte', value: 15 },
      { not: { all: [leaf('separately_alienable', true), leaf('owner_type', 'natural_person'), leaf('exemption_notice_given', true)] } },
    ] } };
  const accepted = validateExtraction(extraction(ownerRule), ownerSource, schema).rules[0];
  const known = { certificate_of_occupancy: '2000-01-01', separately_alienable: true, exemption_notice_given: true };
  const address = { state: 'NJ' };
  const missingOwner = evaluateRule(accepted, address, asOf, known);
  assert.equal(missingOwner.result, 'unknown');
  assert.deepEqual(missingOwner.missing, ['owner_type']);
  assert.equal(evaluateRule(accepted, address, asOf, { ...known, owner_type: 'natural_person' }).result, 'not_applicable');
  assert.equal(evaluateRule(accepted, address, asOf, { ...known, owner_type: 'corporation' }).result, 'applies');
});

test('previously supported narrative candidates remain review-only and are never reinterpreted into an empty AST', () => {
  const prose = 'Source-defined unit eligibility still requires interpretation of an unrepresented special institutional program.';
  const oldShape = extraction({ ...rule, coverage_conditions: prose, execution_review_pending: true });
  const accepted = validateExtraction(oldShape, source, schema);
  assert.equal(accepted.rules[0].coverage_conditions, prose);
  assert.equal(accepted.rules[0].execution_review_pending, true);
  assert.equal(evaluateRule(accepted.rules[0], { state: 'NJ' }, asOf, scopeFacts).result, 'unknown');
  assert.equal(accepted.review.length, 1);
  assert.equal(oldShape.review.length, 0, 'Validation cannot mutate the original candidate.');
});

test('dry-run fingerprints real selected sources without launching a missing CLI executable', () => {
  const text = execFileSync(process.execPath, ['scripts/compile-codex.mjs', '--dry-run',
    '--source', 'D069,S003,D024', '--limit', '3', '--max-requests', '3', '--timeout-seconds', '1800',
    '--codex-bin', '/definitely-not-installed/lawdiff-test-cli', '--output', 'artifacts/scope-contract-dry-run.json'],
  { cwd: root, encoding: 'utf8', timeout: 10000 });
  const plan = JSON.parse(text);
  assert.equal(plan.compiler_version, VERSION);
  assert.equal(plan.cli_called, false);
  assert.equal(plan.model_called, false);
  assert.equal(plan.writes, false);
  assert.equal(plan.timeout_seconds, 1800);
  const catalog = JSON.parse(readFileSync(new URL('public/data/catalog.json', root), 'utf8'));
  assert.equal(plan.selected_sources.length, 3);
  for (const entry of plan.selected_sources) {
    const actualSource = catalog.sources.find(value => value.doc_id === entry.source_doc_id);
    const expected = makePrompt(actualSource, { model: plan.model }, schema, catalog.snapshot);
    assert.equal(entry.status, 'ready');
    assert.equal(entry.prompt_sha256, expected.promptHash);
    assert.equal(entry.source_sha256, expected.sourceHash);
    assert.equal(entry.schema_sha256, expected.schemaHash);
  }
});

test('long source timeout remains explicitly bounded at 1800 seconds', () => {
  assert.equal(parseArgs([]).timeoutSeconds, 300);
  assert.equal(parseArgs(['--timeout-seconds', '1800']).timeoutSeconds, 1800);
  for (const value of ['1801', '0', '-1', 'Infinity', '1.5'])
    assert.throws(() => parseArgs(['--timeout-seconds', value]));
});
