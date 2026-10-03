import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRule, validateRulePack, validDate, CATEGORIES } from '../public/engine.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const rules=['california.json','nj-ma.json'].flatMap(name=>load(`data/extracted/${name}`).rules);
// Published catalog is self-contained; tests must work in a fresh clone without the ignored starter cache.
const sources=load('public/data/catalog.json').sources;
const rule=id=>{const r=rules.find(x=>x.team_rule_id===id);assert(r,`Missing fixture record ${id}`);return r;};
const la={state:'CA',year_built:1978,units:20,geography:{legal_city:'Los Angeles'}};
const copy=x=>JSON.parse(JSON.stringify(x));

test('all extracted records are executable and their primary evidence is exact',()=>{
  assert.equal(validateRulePack({version:1,rules},sources),true);
  for(const r of rules){
    assert(CATEGORIES.includes(r.category));
    assert.equal(r.extraction_method,'codex_assisted_extraction');
    assert(r.retrieved_at,`${r.team_rule_id}: retrieval date`);
    if(r.effective_date&&r.effective_date.length===10)assert(validDate(r.effective_date));
    if(r.end_date)assert(validDate(r.end_date));
  }
});

test('all supplemental exception and relation quotations exist in their stated sources',()=>{
  let count=0;
  for(const r of rules)for(const e of [...(r.source_evidence??[]),...(r.additional_evidence??[]),...(r.relation_evidence??[])]){
    const doc=e.doc_id??e.source_doc_id,quote=e.quote??e.quoted_span;
    assert.equal(typeof quote,'string',`${r.team_rule_id}: supplemental quote`);
    assert(sources.find(s=>s.doc_id===doc)?.text.includes(quote),`${r.team_rule_id}: ${doc}`);
    count++;
  }
  assert(count>0);
});

test('import rejects invented primary quotations, duplicate IDs and altered source URLs',()=>{
  const base=copy(rule('CA-ALG-01'));
  assert.throws(()=>validateRulePack({version:1,rules:[{...base,quoted_span:'Invented law that never appears in the supplied original source.'}]},sources));
  assert.throws(()=>validateRulePack({version:1,rules:[base,base]},sources));
  assert.throws(()=>validateRulePack({version:1,rules:[{...base,source_url:'https://example.com/unsupported'}]},sources));
});

test('import rejects a changed supplemental condition quote',()=>{
  const bad=copy(rule('LA-RENT-01'));
  bad.source_evidence[0].quote='This invented exemption would make all properties covered.';
  assert.throws(()=>validateRulePack({version:1,rules:[bad]},sources));
});

test('import rejects impossible effective and end dates',()=>{
  const base=copy(rule('CA-ALG-01'));
  assert.throws(()=>validateRulePack({version:1,rules:[{...base,effective_date:'2026-02-30'}]},sources));
  assert.throws(()=>validateRulePack({version:1,rules:[{...base,end_date:'2027-13-01'}]},sources));
});

test('LA boundary date resolves only its own condition, preserving separate exemption uncertainty',()=>{
  const r=rule('LA-RENT-01');
  const before=evaluateRule(r,la,'2026-10-01');
  assert.equal(before.result,'unknown');
  assert(before.missing.includes('certificate_of_occupancy'));
  const after=evaluateRule(r,la,'2026-10-01',{certificate_of_occupancy:'1978-09-30'});
  assert.equal(after.result,'unknown');
  assert(!after.missing.includes('certificate_of_occupancy'));
  assert(after.missing.includes('la_rso_exempt'));
  assert.equal(evaluateRule(r,la,'2026-10-01',{certificate_of_occupancy:'1978-10-01',la_rso_exempt:false}).result,'applies');
  assert.equal(evaluateRule(r,la,'2026-10-01',{certificate_of_occupancy:'1978-10-02',la_rso_exempt:false}).result,'not_applicable');
});

test('known 20-unit property excludes small-landlord exception despite missing owner identity',()=>{
  assert.equal(evaluateRule(rule('CA-DEP-01'),la,'2026-10-01').result,'applies');
  assert.equal(evaluateRule(rule('CA-DEP-02'),la,'2026-10-01').result,'not_applicable');
  const small={...la,units:3};
  assert.equal(evaluateRule(rule('CA-DEP-01'),small,'2026-10-01').result,'unknown');
  assert.equal(evaluateRule(rule('CA-DEP-02'),small,'2026-10-01').result,'unknown');
});

test('T1 transition is reproduced and organizer date provenance remains explicit',()=>{
  const r=rule('CA-ALG-01');
  assert(r.field_provenance?.effective_date);
  assert.equal(evaluateRule(r,la,'2025-12-31').result,'not_yet_effective');
  assert.equal(evaluateRule(r,la,'2026-01-02').result,'applies');
});

test('historical LA percentage expires and does not become current by accident',()=>{
  const r=rule('LA-RENT-02');const facts={certificate_of_occupancy:'1978-09-30',la_rso_exempt:false};
  assert.equal(evaluateRule(r,la,'2026-06-30',facts).result,'applies');
  assert.equal(evaluateRule(r,la,'2026-07-01',facts).result,'not_applicable');
});

test('San Diego draft remains visibly unverified; LA feasibility motion is not an enacted ban',()=>{
  assert.equal(rule('SD-ALG-P1').status,'pending');
  assert.equal(rule('SD-ALG-P1').effective_date,null);
  assert(rule('SD-ALG-P1').field_provenance?.status);
  assert(!rules.some(r=>r.source_doc_id==='D039'&&r.category==='algorithmic_rent_setting'&&r.status==='in_force'));
});

test('NJ FAIR Act changes at July1,2027; missing city resolution cannot prevent a state rule',()=>{
  const a={state:'NJ',units:null,geography:{}};
  assert.equal(evaluateRule(rule('nj-fair-act'),a,'2027-06-30').result,'not_yet_effective');
  assert.equal(evaluateRule(rule('nj-fair-act'),a,'2027-07-01').result,'applies');
});

test('NJ application-fee threshold stays unknown for missing unit count and excludes two units',()=>{
  const a={state:'NJ',units:null,geography:{}};
  assert.equal(evaluateRule(rule('nj-application-fee-cap'),a,'2026-10-01').result,'unknown');
  assert.equal(evaluateRule(rule('nj-application-fee-cap'),{...a,units:2},'2026-10-01').result,'not_applicable');
  assert.equal(evaluateRule(rule('nj-application-fee-cap'),{...a,units:3},'2026-10-01').result,'applies');
});

test('MA algorithmic bills stay pending and no state rent cap is invented',()=>{
  const a={state:'MA',geography:{legal_city:'Boston'}};
  for(const id of ['ma-s2983-pending','ma-h5222-pending'])assert.equal(evaluateRule(rule(id),a,'2026-10-01').result,'pending');
  assert(!rules.some(r=>r.jurisdiction==='MA'&&r.category==='rent_increase_limits'&&r.status==='in_force'));
});

test('Boston policy scope is not expanded to every Boston apartment',()=>{
  const a={state:'MA',units:12,geography:{legal_city:'Boston'}};
  assert.equal(evaluateRule(rule('boston-fair-chance-policy'),a,'2026-10-01').result,'unknown');
  assert.equal(evaluateRule(rule('boston-fair-chance-policy'),a,'2026-10-01',{boston_policy_covered:false}).result,'not_applicable');
});
