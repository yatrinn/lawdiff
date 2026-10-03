import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookupsFor, changesFor } from '../public/exporter.mjs';
import { evaluateAddress, validateRulePack } from '../public/engine.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const catalog=read('public/data/catalog.json');
const pack=read('public/data/rule-pack.json');
const ids=addresses=>addresses.map(a=>a.address_id).sort();
const sameSet=(actual,expected)=>assert.deepEqual([...actual].sort(),[...expected].sort());
const stateIds=state=>ids(catalog.addresses.filter(a=>a.state===state));
const localNJ=catalog.addresses.filter(a=>a.state==='NJ'&&['Hoboken','Jersey City'].includes(a.geography?.legal_city));
const unknownNJ=catalog.addresses.filter(a=>a.state==='NJ'&&!a.geography?.legal_city);

test('the public merged pack passes source and condition validation',()=>{
  assert.equal(validateRulePack(pack,catalog.sources),true);
});

test('lookups contain all 500 unique sample IDs with the documented result fields',()=>{
  const output=lookupsFor(catalog,pack);
  assert.equal(catalog.addresses.length,500);
  assert.equal(new Set(catalog.addresses.map(a=>a.address_id)).size,500);
  assert.equal(Object.keys(output.lookups).length,500);
  assert.equal(output.as_of,catalog.snapshot);
  sameSet(Object.keys(output.lookups),ids(catalog.addresses));
  const validResults=new Set(['applies','unknown','superseded','not_yet_effective','pending']);
  const validRuleIds=new Set(pack.rules.map(r=>r.team_rule_id));
  for(const rows of Object.values(output.lookups)){
    assert(Array.isArray(rows));
    assert.equal(new Set(rows.map(r=>r.team_rule_id)).size,rows.length);
    for(const row of rows){
      assert(validRuleIds.has(row.team_rule_id));
      assert(validResults.has(row.result));
      assert.equal(typeof row.explanation,'string');
      assert.equal(typeof row.conflict_flag,'boolean');
      assert.deepEqual(Object.keys(row).sort(),['team_rule_id','result','explanation','conflict_flag'].sort());
    }
  }
});

test('the export uses original data and never reads browser simulation storage',()=>{
  const before=JSON.stringify(catalog),baseline=lookupsFor(catalog,pack);
  const candidate=catalog.addresses.find(a=>a.state==='CA'&&a.units>4);
  assert(candidate);
  const original=evaluateAddress(pack.rules,candidate,catalog.snapshot).find(r=>r.team_rule_id==='CA-DEP-01');
  const simulated=evaluateAddress(pack.rules,candidate,catalog.snapshot,{units:3}).find(r=>r.team_rule_id==='CA-DEP-01');
  assert.equal(original.result,'applies');
  assert.equal(simulated.result,'unknown');
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  try{
    Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Sample export must not read user overlays.');}});
    assert.deepEqual(lookupsFor(catalog,pack),baseline);
    assert.doesNotThrow(()=>changesFor(catalog,pack));
  }finally{
    if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);
    else delete globalThis.localStorage;
  }
  assert.equal(JSON.stringify(catalog),before,'Evaluation must not mutate original building facts.');
});

test('T1 affects exactly all 250 supplied California addresses',()=>{
  const result=changesFor(catalog,pack).T1;
  assert.equal(stateIds('CA').length,250);
  sameSet(result.affected_address_ids,stateIds('CA'));
  assert.deepEqual(result.unknown_address_ids,[]);
});

test('T3 affects exactly all 140 supplied New Jersey addresses',()=>{
  const result=changesFor(catalog,pack).T3;
  assert.equal(stateIds('NJ').length,140);
  sameSet(result.affected_address_ids,stateIds('NJ'));
  assert.deepEqual(result.unknown_address_ids,[]);
  sameSet(result.conflict_flag_address_ids,ids(localNJ));
});

test('T4 reports exactly 110 Massachusetts addresses as potential scope, not active law',()=>{
  const result=changesFor(catalog,pack).T4;
  assert.equal(stateIds('MA').length,110);
  sameSet(result.affected_address_ids,stateIds('MA'));
  assert.match(result.notes,/potential scope/i);
  const lookups=lookupsFor(catalog,pack);
  for(const id of stateIds('MA')){
    const proposals=lookups.lookups[id].filter(r=>['ma-s2983-pending','ma-h5222-pending'].includes(r.team_rule_id));
    assert.equal(proposals.length,2);
    assert(proposals.every(r=>r.result==='pending'));
  }
});

test('T5 affected set stays empty and its failed status cites organizer metadata',()=>{
  const result=changesFor(catalog,pack).T5;
  assert.deepEqual(result.affected_address_ids,[]);
  assert.deepEqual(result.conflict_flag_address_ids,[]);
  const failed=pack.rules.find(r=>r.team_rule_id==='MA-RENT-P1');
  assert(failed);
  assert.equal(failed.status,'failed');
  assert.equal(failed.source_doc_id,'O001');
  assert.equal(failed.extraction_method,'organizer_test_status');
  const lookups=lookupsFor(catalog,pack);
  for(const id of stateIds('MA'))assert(!lookups.lookups[id].some(r=>r.team_rule_id===failed.team_rule_id));
});

test('T2 uses verified legal-city evidence and keeps unresolved NJ addresses separate',()=>{
  const result=changesFor(catalog,pack).T2;
  assert(localNJ.length>0,'Fixture needs actual geographic matches.');
  sameSet(result.affected_address_ids,ids(localNJ));
  sameSet(result.unknown_address_ids,ids(unknownNJ));
  assert(!result.affected_address_ids.some(id=>result.unknown_address_ids.includes(id)));
  const verifiedNewark=catalog.addresses.filter(a=>a.state==='NJ'&&a.geography?.legal_city==='Newark');
  for(const a of verifiedNewark){
    assert(!result.affected_address_ids.includes(a.address_id));
    assert(!result.unknown_address_ids.includes(a.address_id));
  }
  // Deliberately conflicting postal labels must not move a verified legal address across a boundary.
  const copied=structuredClone(catalog);
  for(const a of copied.addresses)if(a.state==='NJ')a.postal_city=a.geography?.legal_city==='Hoboken'?'Newark':'Hoboken';
  const relabeled=changesFor(copied,pack).T2;
  sameSet(relabeled.affected_address_ids,result.affected_address_ids);
  sameSet(relabeled.unknown_address_ids,result.unknown_address_ids);
});

test('all five change exports contain only unique real sample IDs',()=>{
  const output=changesFor(catalog,pack),known=new Set(ids(catalog.addresses));
  assert.deepEqual(Object.keys(output).sort(),['T1','T2','T3','T4','T5']);
  for(const result of Object.values(output)){
    for(const key of ['affected_address_ids','unknown_address_ids','conflict_flag_address_ids']){
      assert.equal(new Set(result[key]).size,result[key].length);
      assert(result[key].every(id=>known.has(id)));
    }
    assert.equal(typeof result.notes,'string');
  }
});
