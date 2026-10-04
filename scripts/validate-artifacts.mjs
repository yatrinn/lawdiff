/** Offline integrity gates shared by assembly, build and presentation checks.
 * Hashes establish artifact consistency, not legal correctness or authorship.
 */
import { createHash } from 'node:crypto';
import { checkedCorpusCoverage } from '../public/corpus.mjs';
import { CATEGORIES, validateRulePack } from '../public/engine.mjs';
import { semanticFingerprint, SUPPORTED_COMPILER_VERSIONS } from './aggregate-corpus.mjs';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
const HASH = /^[a-f0-9]{64}$/;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const require = (condition, message) => { if (!condition) throw Error(message); };
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const artifactPath = value => typeof value === 'string' && /^artifacts\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(value) && !value.includes('..');
const decode = value => JSON.parse(Buffer.from(value).toString('utf8'));

function checkSourceAttempt(attempt, source, { runId, model, cliVersion, startedAt, finishedAt, artifact, artifactHash }) {
  require(object(attempt) && attempt.validation_status === 'processed' && Array.isArray(attempt.validation_issues) && attempt.validation_issues.length === 0, 'Selected attempt did not pass validation.');
  require(attempt.source_doc_id === source.doc_id && attempt.run_id === runId && attempt.attempt_id === `${runId}:${source.doc_id}`, 'Selected attempt identity mismatch.');
  require(attempt.input_path === artifact && attempt.input_file_sha256 === artifactHash, 'Selected attempt input hash mismatch.');
  require(typeof source.text === 'string' && !!source.text.trim() && attempt.source_sha256 === sha256(source.text), 'Selected attempt source hash mismatch.');
  for (const key of ['source_sha256', 'prompt_sha256', 'schema_sha256', 'response_sha256', 'transport_sha256', 'candidate_set_sha256'])
    require(HASH.test(attempt[key] || ''), `Selected attempt lacks ${key}.`);
  require(!Object.hasOwn(attempt, 'failure_code') && (!attempt.missing_metadata || attempt.missing_metadata.length === 0), 'Selected attempt contains a failure or missing metadata.');
  require(typeof model === 'string' && !!model && attempt.model === model && typeof cliVersion === 'string' && !!cliVersion && attempt.cli_version === cliVersion, 'Selected attempt model/CLI mismatch.');
  require(object(attempt.usage) && integer(attempt.usage.input_tokens) && integer(attempt.usage.output_tokens) && Object.values(attempt.usage).every(integer), 'Selected attempt lacks complete token usage.');
  require(date(startedAt) && date(finishedAt) && Date.parse(startedAt) <= Date.parse(finishedAt) && attempt.run_started_at === startedAt && attempt.run_finished_at === finishedAt, 'Selected attempt run times mismatch.');
  require(date(attempt.started_at) && date(attempt.finished_at) && Date.parse(attempt.started_at) <= Date.parse(attempt.finished_at) && Date.parse(attempt.finished_at) <= Date.parse(finishedAt), 'Selected attempt has invalid completion times.');
  if (attempt.original_status === 'validated_candidates') {
    require(attempt.model_called_this_run === true && attempt.exit_code === 0 && Date.parse(attempt.started_at) >= Date.parse(startedAt), 'Selected live attempt lacks a successful CLI exit.');
  } else {
    require(attempt.original_status === 'cache_hit_revalidated' && attempt.model_called_this_run === false && typeof attempt.original_run_id === 'string' && !!attempt.original_run_id && attempt.original_run_id !== runId && (attempt.exit_code === undefined || attempt.exit_code === 0), 'Selected cache attempt lacks original-run provenance.');
  }
  for (const key of ['accepted_rules', 'review_issues', 'rejected_review_quote_count', 'no_rule_findings']) require(integer(attempt[key]), `Selected attempt has invalid ${key}.`);
}

function checkSourceNotes(review, findings, source, { allowConflictNotice = false } = {}) {
  for (const item of review) {
    require(item.source_doc_id === source.doc_id && typeof item.issue === 'string' && !!item.issue && (item.source_url === undefined || item.source_url === source.url), 'Review source identity mismatch.');
    require(item.quoted_span == null || (typeof item.quoted_span === 'string' && item.quoted_span.length > 0 && source.text?.includes(item.quoted_span)), 'Review quote is not an exact source span.');
    if (item.issue_code === 'unverified_review_quote') {
      require(item.quoted_span === null && item.quote_verification === 'rejected_not_exact' && HASH.test(item.rejected_quote_sha256 || '') && integer(item.original_review_index) && typeof item.unverified_model_issue === 'string' && !!item.unverified_model_issue && item.issue.startsWith('unverified_review_quote:'), 'Rejected review quote lost its audit markers.');
    } else {
      require(!['quote_verification', 'rejected_quote_sha256', 'original_review_index', 'unverified_model_issue'].some(key => Object.hasOwn(item, key)) && (item.issue_code === undefined || (allowConflictNotice && item.issue_code === 'completed_candidate_sets_differ' && item.quoted_span === null)), 'Unexpected review verification metadata.');
    }
  }
  for (const item of findings) require(item.source_doc_id === source.doc_id && item.source_url === source.url && CATEGORIES.includes(item.category) && typeof item.finding === 'string' && item.finding.length >= 10 && typeof item.quoted_span === 'string' && item.quoted_span.length >= 20 && source.text?.includes(item.quoted_span), 'No-rule finding lacks exact source evidence.');
}

/** Checks the publicly shipped corpus pair against the bytes of this catalog. */
export function validateCorpusSnapshot({ catalogBytes, coverageBytes, candidatesBytes }) {
  const catalog = decode(catalogBytes), coverage = decode(coverageBytes), candidates = decode(candidatesBytes);
  checkedCorpusCoverage(coverage, catalog);
  validateRulePack(candidates, catalog.sources);
  require(coverage.catalog_file_sha256 === sha256(catalogBytes) && coverage.as_of === catalog.snapshot, 'Corpus catalog-file hash or snapshot is stale.');
  require(candidates.provenance?.not_legal_review === true && candidates.provenance?.no_model_calls === true, 'Corpus candidates lost their method limitations.');
  for (const key of ['aggregation_id', 'aggregator_version', 'generated_at', 'as_of', 'catalog_file_sha256', 'stats', 'input_files', 'source_selection']) require(same(candidates.provenance[key], coverage[key]), `Corpus candidate receipt mismatch: ${key}`);
  require(Array.isArray(candidates.review) && Array.isArray(candidates.no_rule_findings) && Array.isArray(coverage.attempts) && Array.isArray(coverage.runs) && Array.isArray(coverage.input_files), 'Corpus evidence/audit arrays are missing.');
  const attempts = new Map(), runs = new Map(), sources = new Map(catalog.sources.map(source => [source.doc_id, source]));
  for (const run of coverage.runs) {
    require(!runs.has(run.run_id) && typeof run.run_id === 'string' && !!run.run_id && SUPPORTED_COMPILER_VERSIONS.includes(run.compiler_version) && artifactPath(run.input_path) && HASH.test(run.input_file_sha256 || ''), 'Corpus run identity or input hash is invalid.');
    runs.set(run.run_id, run);
  }
  require(same(coverage.input_files, coverage.runs.map(run => ({ path: run.input_path, file_sha256: run.input_file_sha256, run_id: run.run_id }))), 'Corpus input-file audit mismatch.');
  for (const attempt of coverage.attempts) {
    const run = runs.get(attempt.run_id);
    require(!attempts.has(attempt.attempt_id) && sources.has(attempt.source_doc_id) && run && attempt.attempt_id === `${attempt.run_id}:${attempt.source_doc_id}` && attempt.input_path === run.input_path && attempt.input_file_sha256 === run.input_file_sha256, 'Corpus attempt identity/input mismatch.');
    attempts.set(attempt.attempt_id, attempt);
  }
  const decisions = new Map();
  if (coverage.source_selection != null) {
    const selection = coverage.source_selection;
    require(selection.manifest_path === 'data/extracted/automatic-selection.json' && HASH.test(selection.manifest_file_sha256 || '') && Array.isArray(selection.decisions) && selection.decisions.length > 0, 'Corpus source-selection manifest audit is invalid.');
    for (const decision of selection.decisions) {
      const attempt = attempts.get(decision.selected_attempt_id), run = runs.get(decision.run_id);
      require(sources.has(decision.source_doc_id) && !decisions.has(decision.source_doc_id) && artifactPath(decision.artifact) && HASH.test(decision.artifact_sha256 || '') && typeof decision.reason === 'string' && decision.reason.trim().length >= 10 && Array.isArray(decision.app_rule_ids) && decision.app_rule_ids.length > 0 && new Set(decision.app_rule_ids).size === decision.app_rule_ids.length, 'Corpus source-selection decision is invalid.');
      require(attempt?.source_doc_id === decision.source_doc_id && attempt.run_id === decision.run_id && attempt.input_path === decision.artifact && attempt.input_file_sha256 === decision.artifact_sha256 && attempt.validation_status === 'processed' && run && ['completed_machine_validation', 'completed_with_review_items'].includes(run.status) && !Object.hasOwn(run, 'trust_status') && !Object.hasOwn(run, 'failure_code'), 'Corpus explicit choice is not a validated completed source attempt.');
      const rules = candidates.rules.filter(rule => rule.source_doc_id === decision.source_doc_id);
      require(decision.app_rule_ids.every(id => rules.some(rule => rule.team_rule_id === id)), 'Corpus explicit choice contains absent app rule IDs.');
      decisions.set(decision.source_doc_id, decision);
    }
  }
  for (const item of [...candidates.review, ...candidates.no_rule_findings]) require(sources.has(item.source_doc_id), 'Corpus note references an unknown source.');
  for (const row of coverage.sources) {
    const source = sources.get(row.source_doc_id), hasText = typeof source.text === 'string' && !!source.text.trim();
    require(row.catalog_text_sha256 === (hasText ? sha256(source.text) : null) && row.catalog_declared_sha256 === (source.sha256 ?? null), `Corpus source hash mismatch: ${row.source_doc_id}`);
    require(row.source_url === (source.url ?? null) && row.jurisdiction === (source.jurisdictions ?? null), `Corpus source metadata mismatch: ${row.source_doc_id}`);
    require((row.status !== 'missing_text' || !hasText) && (row.status !== 'processed' || hasText), `Corpus captured-text status mismatch: ${row.source_doc_id}`);
    require(same(row.attempt_ids, coverage.attempts.filter(item => item.source_doc_id === row.source_doc_id).map(item => item.attempt_id)), 'Corpus source attempt list mismatch.');
    const rules = candidates.rules.filter(rule => rule.source_doc_id === row.source_doc_id), review = candidates.review.filter(item => item.source_doc_id === row.source_doc_id), findings = candidates.no_rule_findings.filter(item => item.source_doc_id === row.source_doc_id);
    checkSourceNotes(review, findings, source, { allowConflictNotice: row.status === 'rejected' });
    require(rules.length === row.accepted_rule_count && rules.filter(rule => rule.execution_review_pending === true).length === row.execution_review_count && findings.length === row.no_rule_finding_count && review.filter(item => item.issue_code === 'unverified_review_quote').length === row.rejected_review_quotes, 'Per-source corpus candidate/review count mismatch.');
    if (row.status === 'processed') {
      const attempt = attempts.get(row.selected_attempt_id), run = runs.get(attempt?.run_id);
      require(run && !run.trust_status, 'Corpus selected run is missing or untrusted.');
      checkSourceAttempt(attempt, source, { runId: run.run_id, model: run.model, cliVersion: run.cli_version, startedAt: run.started_at, finishedAt: run.finished_at, artifact: run.input_path, artifactHash: run.input_file_sha256 });
      require(attempt.candidate_set_sha256 === semanticFingerprint(rules, findings), 'Corpus candidate-set hash mismatch.');
      require(attempt.accepted_rules === rules.length && attempt.review_issues === review.length && attempt.no_rule_findings === findings.length && attempt.rejected_review_quote_count === row.rejected_review_quotes, 'Corpus selected attempt result counts mismatch.');
      const decision = decisions.get(row.source_doc_id);
      const variants = new Set(coverage.attempts.filter(item => item.source_doc_id === row.source_doc_id && item.validation_status === 'processed').map(item => item.candidate_set_sha256));
      require(variants.size <= 1 || decision, 'Different completed candidate sets require an explicit manifest decision.');
      require(!decision || decision.selected_attempt_id === row.selected_attempt_id, 'Corpus selected attempt contradicts its explicit manifest decision.');
    } else require(row.selected_attempt_id === null, 'Unprocessed/rejected corpus source has a selected attempt.');
    require(!decisions.has(row.source_doc_id) || row.status === 'processed', 'Explicit source choice was not processed.');
  }
  for (const run of coverage.runs) {
    const successful = coverage.attempts.filter(attempt => attempt.run_id === run.run_id && attempt.validation_status === 'processed');
    const live = successful.filter(attempt => attempt.original_status === 'validated_candidates').length, cached = successful.length - live;
    require(!live || (integer(run.requests_sent) && integer(run.model_turns_completed) && live <= run.requests_sent && live <= run.model_turns_completed), 'Corpus completed attempts exceed run counters.');
    require(!cached || (integer(run.cache_hits) && cached <= run.cache_hits), 'Corpus cache attempts exceed run counters.');
  }
  const calls = coverage.runs.every(run => integer(run.requests_sent)) ? coverage.runs.reduce((total, run) => total + run.requests_sent, 0) : null;
  require(coverage.stats.run_count === coverage.runs.length && coverage.stats.attempt_count === coverage.attempts.length && coverage.stats.model_calls_count === calls, 'Corpus run/attempt/model-call totals mismatch.');
  require(candidates.rules.length === coverage.stats.accepted_rule_count && candidates.no_rule_findings.length === coverage.stats.no_rule_finding_count, 'Corpus candidate totals mismatch.');
  return { catalog, coverage, candidates, file_sha256: { catalog: sha256(catalogBytes), 'corpus-coverage': sha256(coverageBytes), 'corpus-candidates': sha256(candidatesBytes) } };
}

/** Validates the unchanged rule objects and retained selection audit, without private caches. */
export function validatePromotionAudit(pack, catalog, catalogFileHash) {
  validateRulePack(pack, catalog.sources);
  const provenance = pack.provenance;
  require(pack.method === 'explicit_selection_of_automatic_candidates' && object(provenance) && provenance.selector_version === 'lawdiff-explicit-candidate-selection/1.0.0' && provenance.selection_path === 'data/extracted/automatic-selection.json', 'An explicit automatic-selection audit is required; assisted packs are not a fallback.');
  require(provenance.catalog_file_sha256 === catalogFileHash && provenance.as_of === catalog.snapshot && HASH.test(provenance.selection_file_sha256 || '') && provenance.no_model_calls === true && provenance.independent_legal_review === false, 'Promotion catalog/manifest hash or method mismatch.');
  require(Array.isArray(pack.audit) && Array.isArray(pack.review) && Array.isArray(pack.no_rule_findings) && Array.isArray(provenance.input_files), 'Promotion audit arrays are missing.');
  require(provenance.source_count === pack.audit.length && provenance.selected_rule_count === pack.rules.length && provenance.execution_review_count === pack.rules.filter(rule => rule.execution_review_pending === true).length, 'Promotion result totals mismatch.');
  const sources = new Map(catalog.sources.map(source => [source.doc_id, source])), inputs = new Map(), selectedIds = [], selectedSources = new Set();
  for (const input of provenance.input_files) {
    require(artifactPath(input.artifact) && !inputs.has(input.artifact) && HASH.test(input.artifact_sha256 || '') && SUPPORTED_COMPILER_VERSIONS.includes(input.compiler_version) && typeof input.run_id === 'string' && !!input.run_id, 'Promotion input-file audit is invalid.');
    inputs.set(input.artifact, input);
  }
  for (const audit of pack.audit) {
    const source = sources.get(audit.source_doc_id), input = inputs.get(audit.artifact);
    require(source && !selectedSources.has(audit.source_doc_id) && input && audit.artifact_sha256 === input.artifact_sha256 && audit.run_id === input.run_id && audit.compiler_version === input.compiler_version, 'Promotion source/input identity mismatch.');
    selectedSources.add(audit.source_doc_id);
    require(typeof audit.selection_reason === 'string' && audit.selection_reason.trim().length >= 10 && typeof audit.artifact_hash_pinned_in_selection === 'boolean', 'Promotion lacks an explicit selection reason.');
    checkSourceAttempt(audit.source_attempt, source, { runId: audit.run_id, model: audit.model, cliVersion: audit.cli_version, startedAt: audit.run_started_at, finishedAt: audit.run_finished_at, artifact: audit.artifact, artifactHash: audit.artifact_sha256 });
    const rules = pack.rules.filter(rule => rule.source_doc_id === audit.source_doc_id), review = pack.review.filter(item => item.source_doc_id === audit.source_doc_id), findings = pack.no_rule_findings.filter(item => item.source_doc_id === audit.source_doc_id);
    require(rules.length > 0 && same(audit.selected_rule_ids, rules.map(rule => rule.team_rule_id)) && Array.isArray(audit.omitted_rule_ids) && new Set([...audit.selected_rule_ids, ...audit.omitted_rule_ids]).size === audit.selected_rule_ids.length + audit.omitted_rule_ids.length && audit.source_attempt.accepted_rules === rules.length + audit.omitted_rule_ids.length, 'Promotion selected/omitted rule identifiers mismatch.');
    require(Array.isArray(audit.rules) && audit.rules.length === rules.length, 'Promotion rule hash records are missing.');
    rules.forEach((rule, index) => {
      const proof = audit.rules[index];
      require(rule.extraction_method === 'codex_cli_structured_extraction' && proof.team_rule_id === rule.team_rule_id && proof.rule_sha256 === sha256(JSON.stringify(rule)) && proof.extraction_method === rule.extraction_method && proof.review_status === (rule.review_status ?? null) && proof.execution_review_pending === (rule.execution_review_pending === true) && proof.independent_legal_review === false, `Promoted rule changed or lost automatic provenance: ${rule.team_rule_id}`);
    });
    selectedIds.push(...audit.selected_rule_ids);
    checkSourceNotes(review, findings, source);
    const flags = audit.source_review_flags, rejectedQuotes = review.filter(item => item.issue_code === 'unverified_review_quote').length;
    require(flags?.source_review_item_count === review.length && flags.rejected_review_quote_count === rejectedQuotes && flags.unresolved_review_items_preserved === (review.length > 0) && flags.independent_legal_review === false && audit.source_attempt.review_issues === review.length && audit.source_attempt.rejected_review_quote_count === rejectedQuotes && audit.source_attempt.no_rule_findings === findings.length, 'Promotion source reviews/findings were altered or discarded.');
    // The full source candidate set can be rehashed here when nothing was omitted.
    // For subsets the assembler reproduces the exact selection from original files.
    if (audit.omitted_rule_ids.length === 0) require(audit.source_attempt.candidate_set_sha256 === semanticFingerprint(rules, findings), 'Promoted full-source candidate hash mismatch.');
  }
  require(same(selectedIds, pack.rules.map(rule => rule.team_rule_id)) && inputs.size === new Set(pack.audit.map(audit => audit.artifact)).size, 'Promotion has unaudited rules or unused inputs.');
  for (const item of [...pack.review, ...pack.no_rule_findings]) require(selectedSources.has(item.source_doc_id), 'Promotion contains an unselected source note.');
  return true;
}

/** Validates the assembled public pack against its recorded intermediate content. */
export function validateAssembledPack(pack, catalog, catalogFileHash) {
  validatePromotionAudit(pack, catalog, catalogFileHash);
  const assembly = pack.assembly;
  require(assembly?.assembler_version === 'lawdiff-automatic-assembly/1.0.0' && assembly.source_path === 'data/extracted/automatic-reviewed.json' && HASH.test(assembly.source_file_sha256 || '') && HASH.test(assembly.source_content_sha256 || '') && assembly.catalog_file_sha256 === catalogFileHash && assembly.selection_file_sha256 === pack.provenance.selection_file_sha256 && assembly.original_artifacts_revalidated === true && assembly.rules_modified === false && assembly.independent_legal_review === false && date(assembly.assembled_at), 'Assembly provenance is missing or invalid.');
  const { assembly: omitted, ...original } = pack;
  require(sha256(JSON.stringify(original)) === assembly.source_content_sha256, 'Assembled pack differs from the recorded automatic-reviewed content.');
  return true;
}

/** Complete byte-bound public snapshot gate; no writes and no artifact/cache discovery. */
export function validateBuildSnapshot({ catalogBytes, packBytes, coverageBytes, candidatesBytes, reviewedBytes, selectionBytes }) {
  const result = validateCorpusSnapshot({ catalogBytes, coverageBytes, candidatesBytes }), pack = decode(packBytes);
  validateAssembledPack(pack, result.catalog, sha256(catalogBytes));
  require(pack.assembly.source_file_sha256 === sha256(reviewedBytes) && pack.assembly.selection_file_sha256 === sha256(selectionBytes), 'The automatic selection/intermediate changed after assembly. Reassemble before building.');
  const { assembly, ...selectedContent } = pack;
  require(same(selectedContent, decode(reviewedBytes)), 'Public pack does not retain the unchanged automatic-reviewed content.');
  if (result.coverage.source_selection != null) {
    const sourceSelection = result.coverage.source_selection, manifest = decode(selectionBytes);
    require(sourceSelection.manifest_file_sha256 === sha256(selectionBytes) && Array.isArray(manifest.selections) && manifest.selections.length === sourceSelection.decisions.length, 'Corpus source-selection manifest does not match the promoted selection.');
    for (const entry of manifest.selections) {
      const decision = sourceSelection.decisions.find(item => item.source_doc_id === entry.source_doc_id);
      require(decision && decision.artifact === entry.artifact && decision.artifact_sha256 === entry.artifact_sha256 && decision.reason === entry.reason && same(decision.app_rule_ids, entry.rule_ids), 'Corpus source decision differs from the explicit app manifest.');
    }
  }
  for (const audit of pack.audit) {
    const row = result.coverage.sources.find(item => item.source_doc_id === audit.source_doc_id);
    const attempt = result.coverage.attempts.find(item => item.attempt_id === row?.selected_attempt_id);
    require(row?.status === 'processed' && attempt?.input_path === audit.artifact && attempt.input_file_sha256 === audit.artifact_sha256 && attempt.run_id === audit.run_id, 'Promoted source does not match the selected corpus attempt.');
    for (const id of audit.selected_rule_ids) {
      const loaded = pack.rules.find(rule => rule.team_rule_id === id), candidate = result.candidates.rules.find(rule => rule.team_rule_id === id && rule.source_doc_id === audit.source_doc_id);
      require(candidate && same(loaded, candidate), 'Promoted rule differs from the reported corpus candidate.');
    }
  }
  return { ...result, pack, file_sha256: { ...result.file_sha256, 'rule-pack': sha256(packBytes) } };
}
