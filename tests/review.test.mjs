import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewBriefFor, reviewBriefCSV } from '../public/exporter.mjs';
const read = name => JSON.parse(readFileSync(new URL(`../public/data/${name}.json`, import.meta.url)));
const catalog = read('catalog'), pack = read('rule-pack');

test('review handoff keeps future requirements, active scope and local interactions distinct', () => {
  const before = reviewBriefFor(catalog, pack, 'T3', '2027-06-30');
  const after = reviewBriefFor(catalog, pack, 'T3', '2027-07-01');
  assert.equal(before.records.length,140);
  assert.equal(before.counts.applies,0);
  assert.equal(before.counts.not_yet_effective,140);
  assert.equal(after.counts.applies,0);
  assert.equal(after.counts.unknown,140);
  assert(after.records.every(r => r.missing.includes('primary_residence')));
  assert.equal(after.conflict_count,0); // Missing coverage cannot establish an operative conflict.
  assert(after.records.every(r => r.rows.every(row => row.rule.source_doc_id==='D069')));
  assert.throws(() => reviewBriefFor(catalog,pack,'T9','2026-10-01'));
  assert.throws(() => reviewBriefFor(catalog,pack,'T3','2026-02-30'));
});

test('review handoff does not turn unresolved city boundaries, pending or failed proposals into active obligations', () => {
  const local=reviewBriefFor(catalog,pack,'T2','2026-10-01');
  assert.equal(local.counts.applies,0);
  // Census consensus resolves A0168, A0279, A0400 and A0428 without
  // choosing a coordinate; only A0352 still has conflicting city evidence.
  assert.equal(local.counts.unknown,91);
  const unresolved = local.records.filter(r=>!r.legal_city);
  assert.deepEqual(unresolved.map(r=>r.address_id),['A0352']);
  assert(unresolved.every(r=>r.status==='unknown' && r.missing.includes('legal jurisdiction')));
  assert(local.records.filter(r=>r.legal_city).every(r=>r.missing.length>0));
  const pending=reviewBriefFor(catalog,pack,'T4','2028-12-31');
  assert.equal(pending.counts.applies,0);
  assert.equal(pending.counts.pending,110);
  const failed=reviewBriefFor(catalog,pack,'T5','2028-12-31');
  assert.equal(failed.records.length,0);
  assert.match(reviewBriefCSV(failed),/Coverage gap/); // The negative organizer case is known, but no extracted status record was accepted.
  const gap=reviewBriefFor(catalog,{rules:[]},'T3','2027-07-01');
  assert.match(reviewBriefCSV(gap),/Coverage gap/);
});

test('review CSV carries exact evidence, unresolved jurisdiction and spreadsheet-safe imported text', () => {
  const brief=reviewBriefFor(catalog,pack,'T2','2026-10-01');
  const csv=reviewBriefCSV(brief);
  assert(csv.startsWith('\ufeff'));
  assert.match(csv,/UNRESOLVED/);
  assert.match(csv,/local simulations and unverified overlays excluded/);
  assert(csv.includes(brief.records[0].rows[0].rule.quoted_span.replaceAll('"','""')));
  brief.records[0].street_address='  =HYPERLINK("https://example.test")';
  assert(reviewBriefCSV(brief).includes('"\'  =HYPERLINK(""https://example.test"")"'));
  assert(!reviewBriefCSV(brief).includes(',"  =HYPERLINK'));
});
