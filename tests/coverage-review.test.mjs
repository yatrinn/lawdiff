import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRule, validateRulePack } from '../public/engine.mjs';
const source={doc_id:'fixture',jurisdictions:'CA',url:'https://example.test/law',text:'Synthetic fixture: the requirement and its exceptions need interpretation.'};
const rule={team_rule_id:'fixture-review',source_doc_id:'fixture',source_url:source.url,
  jurisdiction:'CA',level:'state',category:'rent_increase_limits',status:'in_force',
  title:'Synthetic review fixture',requirement:'Synthetic fixture, not an actual legal rule.',
  citation:'Synthetic test source',quoted_span:source.text,effective_date:'2026-01-01',
  coverage_conditions:'Synthetic exception coverage awaits an executable interpretation.',execution_review_pending:true};
const address={state:'CA',units:20,year_built:1978};
test('source-supported narrative coverage never becomes an active address decision through added facts',()=>{
  validateRulePack({version:1,rules:[rule]},[source]);
  for(const overrides of [{},{units:200,owner_type:'natural_person',local_rent_control_applies:true}]) {
    const result=evaluateRule(rule,address,'2026-10-01',overrides);
    assert.equal(result.result,'unknown');
    assert.deepEqual(result.missing,['coverage interpretation']);
    assert.match(result.explanation,/specialist review/);
  }
  assert.equal(evaluateRule(rule,{...address,state:'NJ'},'2026-10-01').result,'not_applicable');
  assert.equal(evaluateRule({...rule,status:'failed'},address,'2026-10-01').result,'not_applicable');
  assert.equal(evaluateRule({...rule,status:'pending'},address,'2030-01-01').result,'pending');
  assert.equal(evaluateRule(rule,address,'2025-12-31').result,'not_yet_effective');
});
test('import cannot hide executable conditions behind a prose flag or silently execute prose',()=>{
  for(const candidate of [
    {...rule,execution_review_pending:false},
    {...rule,execution_review_pending:undefined},
    {...rule,coverage_conditions:{all:[]}},
    {...rule,coverage_conditions:''},
    {...rule,coverage_conditions:null},
  ]) assert.throws(()=>validateRulePack({version:1,rules:[candidate]},[source]));
  assert.throws(()=>evaluateRule({...rule,coverage_conditions:{all:[]}},address,'2026-10-01'));
  assert.throws(()=>evaluateRule({...rule,execution_review_pending:false},address,'2026-10-01'));
  assert.throws(()=>validateRulePack({version:1,rules:[{...rule,quoted_span:'Invented and unsupported source evidence.'}]},[source]));
});
