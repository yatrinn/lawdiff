import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCondition, evaluateRule, evaluateAddress, factsFor,
  jurisdictionMatch, validateCondition, validDate,
} from '../public/engine.mjs';

const condition = value => value === null ? { field: 'units', op: 'gte', value: 2 } : value;
const address = { state: 'CA', postal_city: 'Van Nuys', year_built: 1978, units: 20, geography: { legal_city: 'Los Angeles' } };
const rule = extra => ({
  team_rule_id: 'fixture', jurisdiction: 'CA', level: 'state', status: 'in_force',
  category: 'rent_increase_limits', effective_date: '2026-01-01',
  coverage_conditions: { all: [] }, requirement: 'Synthetic test requirement.', ...extra,
});

test('AND uses three-valued truth, including decisive false with missing evidence', () => {
  const cases = [[true,true,true],[true,false,false],[true,null,null],[false,true,false],[false,false,false],[false,null,false],[null,true,null],[null,false,false],[null,null,null]];
  for (const [a,b,expected] of cases) {
    const result = evaluateCondition({ all: [condition(a),condition(b)] }, {});
    assert.equal(result.value, expected, `${a} AND ${b}`);
    if (expected !== null) assert.deepEqual(result.missing, []);
  }
});

test('OR uses three-valued truth, including decisive true with missing evidence', () => {
  const cases = [[true,true,true],[true,false,true],[true,null,true],[false,true,true],[false,false,false],[false,null,null],[null,true,true],[null,false,null],[null,null,null]];
  for (const [a,b,expected] of cases) assert.equal(evaluateCondition({ any: [condition(a),condition(b)] }, {}).value, expected, `${a} OR ${b}`);
});

test('negation retains uncertainty and deduplicates missing evidence', () => {
  assert.equal(evaluateCondition({ not: condition(null) }, {}).value, null);
  assert.equal(evaluateCondition({ not: false }, {}).value, true);
  assert.deepEqual(evaluateCondition({ all: [condition(null),condition(null)] }, {}).missing, ['units']);
});

test('zero and false are known facts; numeric strings are not silently coerced', () => {
  assert.equal(evaluateCondition({ field: 'units', op: 'eq', value: 0 }, { units: 0 }).value, true);
  assert.equal(evaluateCondition({ field: 'owner_occupied', op: 'eq', value: false }, { owner_occupied: false }).value, true);
  assert.equal(evaluateCondition({ field: 'units', op: 'gte', value: 2 }, { units: '20' }).value, null);
  for (const units of [undefined,null,'']) assert.equal(evaluateCondition(condition(null), { units }).value, null);
});

test('empty all/any groups preserve their logical identities', () => {
  assert.equal(evaluateCondition({ all: [] }, {}).value, true);
  assert.equal(evaluateCondition({ any: [] }, {}).value, false);
});

test('residential use does not infer a primary residence or a fee collector license', () => {
  const facts = factsFor(address, {}, '2026-10-01');
  for (const field of ['primary_residence', 'inpatient_medical_care', 'licensed_long_term_care', 'detention_or_correctional_facility', 'fee_charger_is_landlord', 'fee_charger_is_landlord_agent', 'fee_charger_nj_real_estate_licensee']) {
    validateCondition({ field, op: 'eq', value: false });
    assert.equal(evaluateCondition({ field, op: 'eq', value: false }, facts).value, null);
  }
  const collector = { any: [{ field: 'fee_charger_is_landlord', op: 'eq', value: true }, { field: 'fee_charger_nj_real_estate_licensee', op: 'eq', value: false }] };
  assert.equal(evaluateCondition(collector, facts).value, null);
  assert.equal(evaluateCondition(collector, {...facts, fee_charger_is_landlord: true}).value, true);
  assert.equal(evaluateCondition(collector, {...facts, fee_charger_is_landlord: false, fee_charger_nj_real_estate_licensee: true}).value, false);
  const actorScope = { any: [
    { field: 'fee_charger_is_landlord', op: 'eq', value: true },
    { all: [{ field: 'fee_charger_is_landlord_agent', op: 'eq', value: true }, { field: 'fee_charger_nj_real_estate_licensee', op: 'eq', value: false }] },
  ] };
  assert.equal(evaluateCondition(actorScope, {fee_charger_is_landlord: false, fee_charger_nj_real_estate_licensee: false}).value, null);
  assert.equal(evaluateCondition(actorScope, {fee_charger_is_landlord: false, fee_charger_is_landlord_agent: false, fee_charger_nj_real_estate_licensee: false}).value, false);
});

test('condition validation rejects arbitrary operators, unknown fields and unbounded trees', () => {
  assert.throws(() => validateCondition({ field: 'units', op: 'eval', value: 'process.exit()' }));
  assert.throws(() => validateCondition({ field: '__proto__', op: 'eq', value: true }));
  assert.throws(() => validateCondition({ field: 'units', op: 'in', value: '2,3' }));
  assert.throws(() => validateCondition({ field: 'units', op: 'gte' }));
  let deep = true;
  for (let i=0;i<20;i++) deep = { not: deep };
  assert.throws(() => validateCondition(deep));
});

test('legal city determines local jurisdiction; postal city cannot substitute', () => {
  const local = rule({ level:'city', jurisdiction:'Los Angeles, CA' });
  assert.equal(jurisdictionMatch(local,address),true);
  assert.equal(jurisdictionMatch(local,{...address,geography:{legal_city:'Burbank'}}),false);
  assert.equal(jurisdictionMatch(local,{...address,postal_city:'Los Angeles',geography:{}}),null);
  assert.equal(jurisdictionMatch(local,{...address,state:'NJ',geography:{}}),false);
  assert.equal(evaluateRule(local,{...address,geography:{}},'2026-10-01').result,'unknown');
});

test('real calendar dates are required, including leap years', () => {
  for (const date of ['2026-02-30','2026-02-29','2026-13-01','2026-01','2026-1-1','garbage']) {
    assert.equal(validDate(date),false,date);
    assert.throws(() => evaluateRule(rule(),address,date));
  }
  assert.equal(validDate('2024-02-29'),true);
});

test('certificate age changes at the exact anniversary and is not inferred from year built', () => {
  assert.equal(factsFor(address,{},'2026-10-01').certificate_age_years,undefined);
  assert.equal(factsFor(address,{certificate_of_occupancy:'2011-10-02'},'2026-10-01').certificate_age_years,14);
  assert.equal(factsFor(address,{certificate_of_occupancy:'2011-10-02'},'2026-10-02').certificate_age_years,15);
  assert.equal(factsFor(address,{certificate_of_occupancy:'2027-01-01'},'2026-10-01').certificate_age_years,undefined);
});

test('effective date is inclusive and version end date exclusive', () => {
  const dated=rule({effective_date:'2026-01-01',end_date:'2027-01-01'});
  assert.equal(evaluateRule(dated,address,'2025-12-31').result,'not_yet_effective');
  assert.equal(evaluateRule(dated,address,'2026-01-01').result,'applies');
  assert.equal(evaluateRule(dated,address,'2026-12-31').result,'applies');
  assert.equal(evaluateRule(dated,address,'2027-01-01').result,'not_applicable');
});

test('missing historical dates do not become invented commencement dates', () => {
  const undated=rule({effective_date:null});
  assert.equal(evaluateRule(undated,address,'2025-12-31').result,'unknown');
  assert.equal(evaluateRule(rule({effective_date:'2026'}),address,'2026-10-01').result,'unknown');
});

test('pending and failed proposals cannot become active merely by moving the date', () => {
  assert.equal(evaluateRule(rule({status:'pending',effective_date:null}),address,'2030-01-01').result,'pending');
  assert.equal(evaluateRule(rule({status:'failed',effective_date:null}),address,'2030-01-01').result,'not_applicable');
});

test('a false necessary condition excludes coverage despite other unknown facts', () => {
  const covered=rule({coverage_conditions:{all:[{field:'units',op:'lte',value:4},{field:'owner_type',op:'eq',value:'natural_person'}]}});
  assert.equal(evaluateRule(covered,address,'2026-10-01').result,'not_applicable');
});

test('local precedence is explicit, not inferred merely from city level', () => {
  const state=rule({team_rule_id:'state'});
  const city=rule({team_rule_id:'city',level:'city',jurisdiction:'Los Angeles, CA'});
  assert.equal(evaluateAddress([state,city],address,'2026-10-01')[0].result,'applies');
  assert.equal(evaluateAddress([state,{...city,supersedes:['state']}],address,'2026-10-01')[0].result,'superseded');
  assert.equal(evaluateAddress([state,{...city,supersedes:['state'],coverage_conditions:{field:'owner_type',op:'eq',value:'natural_person'}}],address,'2026-10-01')[0].result,'applies');
});

test('explicit conflict relations flag both active rules without inventing a winner', () => {
  const state=rule({team_rule_id:'state',possible_conflicts:['city']});
  const city=rule({team_rule_id:'city',level:'city',jurisdiction:'Los Angeles, CA'});
  const rows=evaluateAddress([state,city],address,'2026-10-01');
  assert(rows.every(r=>r.result==='applies'&&r.conflict_flag===true));
});
