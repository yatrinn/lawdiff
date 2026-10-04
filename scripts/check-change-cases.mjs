import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { evaluateAddress, validateRulePack } from '../public/engine.mjs';
import { changesFor, matchesCase } from '../public/exporter.mjs';

const ids = rows => rows.map(row => row.address_id).sort();
const minus = (a, b) => a.filter(id => !new Set(b).has(id));
const union = (...arrays) => [...new Set(arrays.flat())].sort();
const localCities = new Set(['Hoboken', 'Jersey City']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

// The organizer expectations below are test expectations, never evidence that
// missing primary-residence, owner, exemption, or jurisdiction facts are true.
export function checkChangeCases(catalog, pack, generatedAt = new Date().toISOString()) {
  const changes = changesFor(catalog, pack);
  const cases = [];
  for (const change of catalog.changes) {
    const id = change.test_id;
    if (!['T1', 'T2', 'T3', 'T4', 'T5'].includes(id)) continue;
    const state = id === 'T1' ? 'CA' : ['T2', 'T3'].includes(id) ? 'NJ' : 'MA';
    const addresses = catalog.addresses.filter(a => a.state === state);
    const expected = id === 'T5' ? [] : id === 'T2'
      ? ids(addresses.filter(a => localCities.has(a.geography?.legal_city))) : ids(addresses);
    const unresolvedJurisdiction = id === 'T2' ? ids(addresses.filter(a => !a.geography?.legal_city)) : [];
    // Observe bill identity independently of its claimed status, otherwise an
    // incorrectly active pending bill would disappear from this check.
    const caseRule = rule => id === 'T4'
      ? rule.jurisdiction === 'MA' && rule.category === 'algorithmic_rent_setting' && ['D045', 'D046', 'D047', 'M001', 'M002'].includes(rule.source_doc_id)
      : matchesCase(rule, id);
    const selected = pack.rules.filter(caseRule);
    const afterDate = change.as_of_after || change.as_of || catalog.snapshot;
    const snapshot = asOf => {
      const statuses = {};
      const missing = {};
      const activeOutside = [];
      for (const address of catalog.addresses) {
        const rows = evaluateAddress(pack.rules, address, asOf).filter(row => caseRule(row.rule));
        for (const status of new Set(rows.map(row => row.result))) {
          (statuses[status] ??= []).push(address.address_id);
        }
        for (const fact of new Set(rows.flatMap(row => row.missing || []))) {
          (missing[fact] ??= []).push(address.address_id);
        }
        if (address.state !== state && rows.some(row => ['applies', 'pending', 'superseded'].includes(row.result))) activeOutside.push(address.address_id);
      }
      return { as_of: asOf, address_ids_by_result: statuses,
        counts_by_result: Object.fromEntries(Object.entries(statuses).map(([key, value]) => [key, value.length])),
        missing_evidence_address_ids: missing, active_outside_expected_state_ids: activeOutside };
    };
    const after = snapshot(afterDate);
    const before = change.as_of_before ? snapshot(change.as_of_before) : null;
    const actual = changes[id];
    const contradictions = [], unresolved = [];
    const issue = (target, code, description, addressIds = []) => target.push({ code, description, address_ids: union(addressIds) });
    if (!selected.length) issue(unresolved, 'source_coverage_gap', 'No matching source-supported record is loaded; an empty result is not proof that no rule exists.');
    const extraAffected = minus(actual.affected_address_ids, expected);
    if (extraAffected.length) issue(contradictions, 'affected_outside_expected_scope', 'Affected addresses exceed the organizer state or verified city boundary.', extraAffected);
    if (after.active_outside_expected_state_ids.length) issue(contradictions, 'cross_state_leak', 'An active or pending result is assigned outside the expected state.', after.active_outside_expected_state_ids);
    const missingAffected = minus(expected, actual.affected_address_ids);
    if (missingAffected.length) issue(unresolved, 'expected_scope_not_established', 'The organizer expects these addresses in the affected set; the loaded evidence has not established that outcome.', missingAffected);
    if (actual.unknown_address_ids.length) issue(unresolved, 'unknown_coverage', 'Coverage remains unresolved. These addresses are not counted as satisfying the expected applies result.', actual.unknown_address_ids);
    if (unresolvedJurisdiction.length) issue(unresolved, 'unresolved_city_boundary', 'Legal-city evidence is missing for these New Jersey addresses; postal labels are not substituted.', unresolvedJurisdiction);
    if (before) {
      const wrongActive = (before.address_ids_by_result.applies || []).filter(a => expected.includes(a));
      if (wrongActive.length) issue(contradictions, 'active_before_expected_effective_date', 'The organizer expects not_yet_effective on the before date, but the loaded pack reports an active rule.', wrongActive);
      const absentBefore = minus(expected, before.address_ids_by_result.not_yet_effective || []);
      if (absentBefore.length) issue(unresolved, 'before_status_not_established', 'The expected not_yet_effective status is not established on the before date.', absentBefore);
    }
    if (id === 'T2') {
      const wrongCity = [];
      for (const address of addresses.filter(a => a.geography?.legal_city)) {
        for (const row of evaluateAddress(pack.rules, address, afterDate).filter(row => matchesCase(row.rule, id))) {
          if (['applies', 'pending', 'superseded'].includes(row.result) && row.rule.jurisdiction !== `${address.geography.legal_city}, NJ`) wrongCity.push(address.address_id);
        }
      }
      if (wrongCity.length) issue(contradictions, 'local_boundary_leak', 'A city rule is assigned to an address with a different verified legal city.', wrongCity);
    }
    let expectedConflicts = [];
    if (id === 'T3') {
      expectedConflicts = ids(addresses.filter(a => localCities.has(a.geography?.legal_city)));
      const absent = minus(expectedConflicts, actual.conflict_flag_address_ids);
      if (absent.length) issue(unresolved, 'expected_conflict_not_established', 'The organizer expects a possible state/local conflict flag. Current scope or relationship evidence has not established it.', absent);
      const nonLocal = addresses.filter(a => a.geography?.legal_city && !localCities.has(a.geography.legal_city)).map(a => a.address_id);
      const extra = actual.conflict_flag_address_ids.filter(a => nonLocal.includes(a));
      if (extra.length) issue(contradictions, 'conflict_outside_local_boundaries', 'Conflict flags extend to a verified city outside the specified local ordinances.', extra);
    }
    if (id === 'T4') {
      const active = union(after.address_ids_by_result.applies || [], after.address_ids_by_result.superseded || []);
      if (active.length) issue(contradictions, 'proposal_reported_active', 'A supplied pending proposal is reported as an active obligation.', active);
      const absent = minus(expected, after.address_ids_by_result.pending || []);
      if (absent.length) issue(unresolved, 'pending_scope_not_established', 'The expected pending, potential scope is absent for these addresses.', absent);
      if (!selected.some(r => ['D045', 'M001'].includes(r.source_doc_id)) || !selected.some(r => ['D046', 'D047', 'M002'].includes(r.source_doc_id)))
        issue(unresolved, 'one_or_more_pending_bills_missing', 'The loaded records do not represent both supplied pending bills.');
    }
    if (id === 'T5') {
      const activeCaps = addresses.filter(address => evaluateAddress(pack.rules, address, afterDate).some(row => row.rule.category === 'rent_increase_limits' && ['applies', 'superseded'].includes(row.result)));
      if (activeCaps.length) issue(contradictions, 'active_ma_rent_cap', 'The organizer expects no active rent cap for the supplied Massachusetts addresses.', ids(activeCaps));
      if (actual.conflict_flag_address_ids.length) issue(contradictions, 'failed_proposal_conflict', 'A failed proposal creates no operative conflict.', actual.conflict_flag_address_ids);
      if (!selected.some(r => r.status === 'failed')) issue(unresolved, 'failed_status_not_recorded', 'The failed ballot status is not represented by a loaded record.');
    }
    cases.push({ test_id: id, title: change.title, organizer_expected_behavior: change.expected_behavior,
      outcome: contradictions.length ? 'MISMATCH' : unresolved.length ? 'PARTIAL' : 'PASS',
      loaded_rule_ids: selected.map(r => r.team_rule_id), loaded_source_ids: union(selected.map(r => r.source_doc_id)),
      expected_affected_address_ids: expected, expected_conflict_address_ids: expectedConflicts,
      actual: { ...actual, affected_count: actual.affected_address_ids.length, unknown_count: actual.unknown_address_ids.length, conflict_count: actual.conflict_flag_address_ids.length },
      before, after, contradictions, unresolved });
  }
  return { version: 1, generated_at: generatedAt, method: 'qualitative_organizer_change_case_comparison',
    not_a_jury_score: true, legal_certification: false,
    outcome_definitions: { PASS: 'The loaded outputs satisfy the supplied qualitative expectation and contain no detected contradiction.',
      PARTIAL: 'No detected contradictory active assignment, but evidence, scope, dates, relationships or required records remain unresolved.',
      MISMATCH: 'At least one loaded outcome contradicts the supplied qualitative expectation.' },
    limitations: ['Organizer expectations are test references, not authority to invent missing coverage facts.',
      'Address counts by result may overlap when an address has multiple rules; affected, unknown and conflict sets are reported separately.',
      'This reports actual loaded pack behavior. Source-quote checks do not establish legal correctness or legal completeness.',
      'The T2/T3 local reference uses verified legal-city evidence; unresolved geography is retained as a limitation.'], cases };
}

async function main() {
  if (process.argv.includes('--help')) { console.log('node scripts/check-change-cases.mjs\nWrites submission/change-case-review.json from the actual public catalog and rule pack. No jury score or inferred missing facts.'); return; }
  if (process.argv.length > 2) throw Error('Unsupported option. Use --help.');
  const root = new URL('../', import.meta.url);
  const [catalogBytes, packBytes] = await Promise.all(['public/data/catalog.json', 'public/data/rule-pack.json'].map(name => readFile(new URL(name, root))));
  const catalog = JSON.parse(catalogBytes), pack = JSON.parse(packBytes);
  validateRulePack(pack, catalog.sources);
  const report = checkChangeCases(catalog, pack);
  report.inputs = { catalog: 'public/data/catalog.json', catalog_sha256: sha(catalogBytes),
    rule_pack: 'public/data/rule-pack.json', rule_pack_sha256: sha(packBytes), original_sample_only: true };
  await mkdir(new URL('submission/', root), { recursive: true });
  await writeFile(new URL('submission/change-case-review.json', root), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: 'submission/change-case-review.json', cases: report.cases.map(c => ({ test_id: c.test_id, outcome: c.outcome, affected: c.actual.affected_count, unknown: c.actual.unknown_count, conflicts: c.actual.conflict_count })) }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
