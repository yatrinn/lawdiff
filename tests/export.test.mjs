import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupsFor, changesFor, matchesCase } from '../public/exporter.mjs';
import { evaluateAddress, validateRulePack } from '../public/engine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const catalog = read('public/data/catalog.json');
const pack = read('public/data/rule-pack.json');
const ids = addresses => addresses.map(a => a.address_id).sort();
const sameSet = (actual, expected) => assert.deepEqual([...actual].sort(), [...expected].sort());
const miniCatalog = (addresses, changes = catalog.changes) => ({ snapshot: '2026-10-01', addresses, changes });
const address = (id, state, city = null) => ({ address_id: id, state, postal_city: city || 'Unverified', year_built: null, units: null, geography: { legal_city: city } });
// Synthetic contract fixtures, not assertions about any actual law.
const fixtureRule = (overrides = {}) => ({ team_rule_id: 'test-scope', source_doc_id: 'D069', level: 'state', jurisdiction: 'NJ',
  category: 'algorithmic_rent_setting', status: 'in_force', title: 'Synthetic export contract fixture', requirement: 'Fixture conditional requirement.',
  effective_date: '2027-07-01', coverage_conditions: { all: [] }, ...overrides });

test('the actual public pack passes source and condition validation', () => {
  assert.equal(validateRulePack(pack, catalog.sources), true);
});

test('lookups contain all 500 unique original sample IDs and documented fields', () => {
  const output = lookupsFor(catalog, pack);
  assert.equal(catalog.addresses.length, 500);
  assert.equal(new Set(ids(catalog.addresses)).size, 500);
  sameSet(Object.keys(output.lookups), ids(catalog.addresses));
  assert.equal(output.as_of, catalog.snapshot);
  const valid = new Set(['applies', 'unknown', 'superseded', 'not_yet_effective', 'pending']);
  const ruleIds = new Set(pack.rules.map(r => r.team_rule_id));
  for (const rows of Object.values(output.lookups)) {
    assert.equal(new Set(rows.map(r => r.team_rule_id)).size, rows.length);
    for (const row of rows) {
      assert(ruleIds.has(row.team_rule_id)); assert(valid.has(row.result));
      assert.equal(typeof row.explanation, 'string'); assert.equal(typeof row.conflict_flag, 'boolean');
      assert.deepEqual(Object.keys(row).sort(), ['team_rule_id', 'result', 'explanation', 'conflict_flag'].sort());
    }
  }
});

test('real exports preserve original facts and never read browser simulation storage', () => {
  const before = JSON.stringify(catalog), baseline = lookupsFor(catalog, pack);
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw Error('Export must not read browser overlays.'); } });
    assert.deepEqual(lookupsFor(catalog, pack), baseline);
    assert.doesNotThrow(() => changesFor(catalog, pack));
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete globalThis.localStorage;
  }
  assert.equal(JSON.stringify(catalog), before);
});

test('a hypothetical fact can resolve a preview but never contaminates original exports', () => {
  const a = address('original-nj', 'NJ');
  const r = fixtureRule({ effective_date: '2026-01-01', coverage_conditions: { field: 'primary_residence', op: 'eq', value: true } });
  assert.equal(evaluateAddress([r], a, '2026-10-01', { primary_residence: true })[0].result, 'applies');
  assert.equal(lookupsFor(miniCatalog([a]), { rules: [r] }).lookups[a.address_id][0].result, 'unknown');
  assert.equal(a.primary_residence, undefined);
});

test('missing material facts never become affected applies results after enactment', () => {
  const a = address('needs-primary-use', 'NJ');
  const r = fixtureRule({ coverage_conditions: { all: [
    { field: 'primary_residence', op: 'eq', value: true },
    { field: 'inpatient_medical_care', op: 'eq', value: false },
  ] } });
  const c = miniCatalog([a]);
  assert.equal(lookupsFor(c, { rules: [r] }).lookups[a.address_id][0].result, 'not_yet_effective');
  assert.equal(lookupsFor(c, { rules: [r] }, '2027-07-02').lookups[a.address_id][0].result, 'unknown');
  assert.deepEqual(changesFor(c, { rules: [r] }).T3.affected_address_ids, []);
  assert.deepEqual(changesFor(c, { rules: [r] }).T3.unknown_address_ids, [a.address_id]);
});

test('coverage prose remains unresolved in lookup and change exports', () => {
  const a = address('needs-interpretation', 'NJ');
  const r = fixtureRule({ coverage_conditions: 'Material property exclusions await qualified interpretation.', execution_review_pending: true });
  const c = miniCatalog([a]);
  assert.equal(lookupsFor(c, { rules: [r] }, '2027-07-02').lookups[a.address_id][0].result, 'unknown');
  assert.deepEqual(changesFor(c, { rules: [r] }).T3.affected_address_ids, []);
  assert.deepEqual(changesFor(c, { rules: [r] }).T3.unknown_address_ids, [a.address_id]);
});

test('actual export assignments remain inside their legal state and verified city', () => {
  const output = lookupsFor(catalog, pack, '2027-07-02');
  const ruleMap = new Map(pack.rules.map(r => [r.team_rule_id, r]));
  for (const a of catalog.addresses) for (const row of output.lookups[a.address_id]) {
    const r = ruleMap.get(row.team_rule_id);
    assert.equal(r.level === 'state' ? r.jurisdiction : r.jurisdiction.split(',').at(-1).trim(), a.state);
    if (r.level === 'city') {
      if (a.geography?.legal_city) assert.equal(r.jurisdiction, `${a.geography.legal_city}, ${a.state}`);
      else assert.equal(row.result, 'unknown');
    }
  }
});

test('verified city boundaries prevail over postal labels and missing geography stays unknown', () => {
  const r = fixtureRule({ jurisdiction: 'Hoboken, NJ', level: 'city', source_doc_id: 'test-city', effective_date: '2026-01-01' });
  const addresses = [address('hob', 'NJ', 'Hoboken'), address('jc', 'NJ', 'Jersey City'), address('newark', 'NJ', 'Newark'), address('unknown', 'NJ'), address('other-state', 'CA', 'Hoboken')];
  for (const a of addresses) a.postal_city = 'Hoboken';
  const result = changesFor(miniCatalog(addresses), { rules: [r] }).T2;
  sameSet(result.affected_address_ids, ['hob']); sameSet(result.unknown_address_ids, ['unknown']);
  const copied = structuredClone(catalog);
  for (const a of copied.addresses) a.postal_city = 'Hoboken';
  assert.deepEqual(changesFor(copied, pack), changesFor(catalog, pack));
});

test('pending proposals remain pending beyond their proposed date and never become obligations', () => {
  const a = address('ma', 'MA', 'Boston');
  const r = fixtureRule({ source_doc_id: 'D045', jurisdiction: 'MA', status: 'pending', effective_date: '2026-01-01', coverage_conditions: { field: 'primary_residence', op: 'eq', value: true } });
  const c = miniCatalog([a]);
  for (const date of ['2026-10-01', '2035-01-01']) assert.equal(lookupsFor(c, { rules: [r] }, date).lookups.ma[0].result, 'pending');
  assert.deepEqual(changesFor(c, { rules: [r] }).T4.affected_address_ids, ['ma']);
  for (const real of pack.rules.filter(r => r.status === 'pending')) {
    for (const original of catalog.addresses) {
      const row = evaluateAddress([real], original, '2035-01-01')[0];
      assert(!['applies', 'superseded'].includes(row.result));
    }
  }
});

test('failed proposals generate no active obligation or change even with missing evidence', () => {
  const a = address('ma', 'MA', 'Cambridge');
  const r = fixtureRule({ jurisdiction: 'MA', category: 'rent_increase_limits', status: 'failed',
    coverage_conditions: { field: 'owner_type', op: 'eq', value: 'corporation' } });
  const c = miniCatalog([a]);
  assert.deepEqual(lookupsFor(c, { rules: [r] }).lookups.ma, []);
  const result = changesFor(c, { rules: [r] }).T5;
  assert.deepEqual(result.affected_address_ids, []); assert.deepEqual(result.conflict_flag_address_ids, []);
  const failedIds = new Set(pack.rules.filter(rule => rule.status === 'failed').map(r => r.team_rule_id));
  for (const rows of Object.values(lookupsFor(catalog, pack).lookups)) assert(rows.every(row => !failedIds.has(row.team_rule_id)));
});

test('conflict flags require both covered operative rules, not just overlapping categories', () => {
  const nj = fixtureRule({ possible_conflicts: ['local'] });
  const local = fixtureRule({ team_rule_id: 'local', source_doc_id: 'test-city', jurisdiction: 'Hoboken, NJ', level: 'city', effective_date: '2026-01-01', coverage_conditions: { field: 'primary_residence', op: 'eq', value: true } });
  const c = miniCatalog([address('hob', 'NJ', 'Hoboken')]);
  assert.deepEqual(changesFor(c, { rules: [nj, local] }).T3.conflict_flag_address_ids, []);
  const certain = { ...local, coverage_conditions: { all: [] } };
  assert.deepEqual(changesFor(c, { rules: [nj, certain] }).T3.conflict_flag_address_ids, ['hob']);
});

test('all five actual change exports contain unique real IDs, without hiding unknown sets', () => {
  const output = changesFor(catalog, pack), known = new Set(ids(catalog.addresses));
  assert.deepEqual(Object.keys(output).sort(), ['T1', 'T2', 'T3', 'T4', 'T5']);
  for (const change of catalog.changes) {
    const result = output[change.test_id];
    for (const key of ['affected_address_ids', 'unknown_address_ids', 'conflict_flag_address_ids']) {
      assert.equal(new Set(result[key]).size, result[key].length); assert(result[key].every(id => known.has(id)));
    }
    assert.equal(typeof result.notes, 'string');
    if (!['pending', 'negative'].includes(change.type)) for (const id of result.affected_address_ids) {
      const a = catalog.addresses.find(row => row.address_id === id);
      assert(evaluateAddress(pack.rules, a, change.as_of_after || change.as_of || catalog.snapshot)
        .some(row => matchesCase(row.rule, change.test_id) && row.result === 'applies'));
    }
  }
});
