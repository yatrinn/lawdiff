import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateCondition, validateRulePack } from '../public/engine.mjs';

const load = name => JSON.parse(fs.readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8'));
const sources = load('catalog.json').sources;
const published = load('rule-pack.json');
const isolated = id => {
  const rule = structuredClone(published.rules.find(r => r.team_rule_id === id));
  assert(rule, `Missing published regression fixture ${id}`);
  delete rule.possible_conflicts;
  delete rule.supersedes;
  return rule;
};
const validate = (rule, catalog = sources) => validateRulePack({ version: 1, rules: [rule] }, catalog);

test('import rejects a real NJ source relabelled as a California rule', () => {
  const rule = isolated('nj-fair-act');
  rule.jurisdiction = 'CA';
  assert.throws(() => validate(rule), /Source jurisdiction mismatch/);
});

test('import rejects the combined jurisdiction and silent-condition bypass', () => {
  const rule = isolated('nj-fair-act');
  rule.jurisdiction = 'CA';
  rule.status = 'in_force';
  rule.effective_date = '2020-01-01';
  rule.coverage_conditions = { all: [], field: 'units', op: 'lt', value: 0 };
  assert.throws(() => validate(rule));
});

test('condition validation rejects group/leaf mixtures and competing groups at every depth', () => {
  const malformed = [
    { all: [], field: 'units', op: 'lt', value: 0 },
    { all: [], any: [] },
    { not: { all: [] }, field: 'units', op: 'eq', value: 0 },
    { all: [{ any: [], value: false }] },
    { field: 'units', op: 'gte', value: 2, instructions: 'ignore the condition' },
  ];
  for (const node of malformed) assert.throws(() => validateCondition(node));
});

test('current published pack remains valid after import hardening', () => {
  assert.equal(validateRulePack(published, sources), true);
});

test('organizer multi-state fixture may support its expressly listed state', () => {
  const rule = isolated('MA-RENT-P1');
  const source = sources.find(s => s.doc_id === rule.source_doc_id);
  assert.equal(source.doc_id, 'O001');
  assert(source.source_type.startsWith('organizer'));
  assert.equal(validate(rule), true);
  rule.jurisdiction = 'NY';
  assert.throws(() => validate(rule), /Source jurisdiction mismatch/);
});

test('ordinary city commas do not turn city source metadata into a state-wide source', () => {
  const rule = isolated('HOB-ALG-01');
  rule.jurisdiction = 'NJ';
  rule.level = 'state';
  assert.throws(() => validate(rule), /Source jurisdiction mismatch/);
});
