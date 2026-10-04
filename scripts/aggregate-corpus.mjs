#!/usr/bin/env node
/** Offline aggregation of explicitly selected compiler artifacts. Never calls a model or promotes rules. */
import { readFile, writeFile, mkdir, rename, unlink, realpath } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATEGORIES, validateRulePack } from '../public/engine.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = 'lawdiff-corpus-aggregator/1.2.0';
export const SUPPORTED_COMPILER_VERSIONS = Object.freeze(['lawdiff-codex-cli-compiler/1.2.1', 'lawdiff-codex-cli-compiler/1.3.0', 'lawdiff-codex-cli-compiler/1.3.1', 'lawdiff-codex-cli-compiler/1.3.2']);
const OUTPUT = 'artifacts/corpus-candidates.json';
const COVERAGE = 'artifacts/corpus-coverage.json';
const SELECTION = 'data/extracted/automatic-selection.json';
const HASH = /^[a-f0-9]{64}$/;
const FINISHED = new Set(['completed_machine_validation', 'completed_with_review_items', 'partial_request_limit', 'stopped_requires_review']);
const SUCCESS = new Set(['validated_candidates', 'cache_hit_revalidated']);
const UNPROCESSED = new Set(['not_processed_after_stop', 'request_limit_not_processed', 'not_processed', 'source_requires_context_preserving_segmentation', 'missing_captured_source']);
const REJECTED = new Set(['rejected_requires_review', 'withheld_after_untrusted_run']);
const RULE_FIELDS = ['team_rule_id', 'jurisdiction', 'level', 'category', 'status', 'title', 'requirement', 'key_value', 'coverage_conditions', 'exemptions', 'overrides', 'interaction', 'effective_date', 'end_date', 'citation', 'source_url', 'quoted_span', 'source_doc_id', 'confidence', 'conflict_flag', 'conflict_note', 'execution_review_pending', 'requirement_es', 'retrieved_at', 'extraction_method', 'review_status', 'translation_note'];
const REVIEW_FIELDS = ['issue', 'quoted_span', 'source_doc_id', 'source_url', 'retrieved_at', 'issue_code', 'quote_verification', 'rejected_quote_sha256', 'original_review_index', 'unverified_model_issue'];
const FINDING_FIELDS = ['category', 'finding', 'quoted_span', 'source_doc_id', 'source_url', 'retrieved_at'];
const USAGE_FIELDS = ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens'];
const sha = value => createHash('sha256').update(value).digest('hex');
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
const pick = (value, fields) => Object.fromEntries(fields.filter(key => Object.hasOwn(value, key)).map(key => [key, structuredClone(value[key])]));
const sorted = value => Array.isArray(value) ? value.map(sorted) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
const stable = value => JSON.stringify(sorted(value));
const fail = message => { throw Error(message); };
const HELP = `LawDiff · offline corpus candidate aggregation

Usage: node scripts/aggregate-corpus.mjs --input artifacts/batch-1.json --input artifacts/batch-2.json
  --input PATH  Explicit completed Codex CLI compiler 1.2.1 or 1.3.0 artifact; repeat (maximum 100)
  --selection ${SELECTION}
                Optional explicit, hash-pinned source/run choice; preserves all attempts
  --dry-run     Validate and print coverage counts without writing files
  --help        Show help; no files read

Only artifacts/<basename>.json inputs are accepted. No discovery of other runs.
Writes ${OUTPUT} and ${COVERAGE}; never modifies the public/reviewed pack.
Processing means structural/source validation, not full interpretation or legal accuracy.
Different completed candidate sets are withheld unless the explicit manifest selects a validated completed run.
The complete selected source candidate set stays unchanged; manifest rule_ids constrain later promotion only.
Raw CLI logs, prompts, private cache files and source bodies are not published.
`;

export function parseArgs(argv) {
  const options = { inputs: [], selection: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--help') { options.help = true; continue; }
    if (flag === '--dry-run') { options.dryRun = true; continue; }
    if (flag === '--selection') {
      if (options.selection !== null || argv[++i] !== SELECTION) fail(`Use one explicit --selection ${SELECTION}.`);
      options.selection = SELECTION; continue;
    }
    if (flag !== '--input') fail('Only --input, --selection, --dry-run and --help are accepted.');
    const path = argv[++i];
    if (!/^artifacts\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(path || '') || path.includes('..') || [OUTPUT, COVERAGE].includes(path)) fail('Input must be an explicit artifacts/<basename>.json compiler output.');
    if (options.inputs.includes(path)) fail('Duplicate input path.');
    options.inputs.push(path);
  }
  if (!options.help && (!options.inputs.length || options.inputs.length > 100)) fail('Supply from one to 100 explicit input artifacts.');
  return options;
}

function declaredUsage(value) {
  if (value === undefined) return null;
  if (!object(value) || !integer(value.input_tokens) || !integer(value.output_tokens) || Object.keys(value).some(key => !USAGE_FIELDS.includes(key)) || Object.values(value).some(n => !integer(n))) fail('Invalid reported token usage.');
  return pick(value, USAGE_FIELDS);
}
function checkFields(item, allowed) {
  if (!object(item) || Object.keys(item).some(key => !allowed.includes(key))) fail('Unexpected candidate fields; possible private or unsupported content.');
}
function checkReview(item, source) {
  checkFields(item, REVIEW_FIELDS);
  if (typeof item.issue !== 'string' || !item.issue || item.issue.length > 4000) fail('Invalid review issue.');
  if (item.source_doc_id !== source.doc_id || (item.source_url !== undefined && item.source_url !== source.url)) fail('Review source identity mismatch.');
  if (item.quoted_span !== undefined && item.quoted_span !== null && (typeof item.quoted_span !== 'string' || !source.text?.includes(item.quoted_span))) fail('Review quote is not an exact source span.');
  if (item.issue_code === 'unverified_review_quote') {
    if (item.quoted_span !== null || item.quote_verification !== 'rejected_not_exact' || !HASH.test(item.rejected_quote_sha256 || '') || !integer(item.original_review_index) || typeof item.unverified_model_issue !== 'string' || !item.unverified_model_issue || !item.issue.startsWith('unverified_review_quote:')) fail('Rejected review quote lacks its required audit markers.');
  } else if (['issue_code', 'quote_verification', 'rejected_quote_sha256', 'original_review_index', 'unverified_model_issue'].some(key => Object.hasOwn(item, key))) fail('Unexpected review verification metadata.');
}
function checkFinding(item, source) {
  checkFields(item, FINDING_FIELDS);
  if (item.source_doc_id !== source.doc_id || item.source_url !== source.url || !CATEGORIES.includes(item.category) || typeof item.finding !== 'string' || item.finding.length < 10 || typeof item.quoted_span !== 'string' || item.quoted_span.length < 20 || !source.text?.includes(item.quoted_span)) fail('No-rule finding lacks exact source evidence.');
}
export function semanticFingerprint(rules, findings) {
  // Retrieval/extractor bookkeeping is not a legal difference. Every substantive
  // rule field (including IDs, quotations, conditions and translations) remains.
  const normalized = rules.map(rule => Object.fromEntries(Object.entries(rule).filter(([key]) => !['retrieved_at', 'extraction_method', 'review_status', 'translation_note'].includes(key))));
  const noRules = findings.map(item => pick(item, ['category', 'finding', 'quoted_span', 'source_doc_id', 'source_url']));
  return sha(stable({ rules: normalized.sort((a, b) => a.team_rule_id.localeCompare(b.team_rule_id)), no_rule_findings: noRules.sort((a, b) => stable(a).localeCompare(stable(b))) }));
}

/** Pure local operation: inputs contain parsed packs plus hashes of actual input-file bytes. */
export function aggregate(catalog, inputs, { generatedAt = new Date().toISOString(), catalogFileHash = null, aggregationId = randomUUID(), selection = null, selectionHash = null } = {}) {
  if (!object(catalog) || !Array.isArray(catalog.sources) || !/^\d{4}-\d{2}-\d{2}$/.test(catalog.snapshot || '') || !date(generatedAt)) fail('Invalid source catalog or aggregation timestamp.');
  if (catalogFileHash !== null && !HASH.test(catalogFileHash)) fail('Invalid catalog file hash.');
  const sources = new Map();
  for (const source of catalog.sources) {
    if (!object(source) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(source.doc_id || '') || sources.has(source.doc_id)) fail('Invalid or duplicate catalog source ID.');
    sources.set(source.doc_id, source);
  }
  const choices = new Map(), inputByPath = new Map();
  for (const input of inputs) {
    if (!object(input) || typeof input.path !== 'string' || inputByPath.has(input.path)) fail('Missing or duplicate explicit input artifact.');
    inputByPath.set(input.path, input);
  }
  if (selection !== null) {
    if (!HASH.test(selectionHash || '') || !object(selection) || selection.version !== 1 || Object.keys(selection).some(key => !['version', 'selections'].includes(key)) || !Array.isArray(selection.selections) || !selection.selections.length || selection.selections.length > 500) fail('Source selection requires a valid manifest and actual manifest-file hash.');
    const selectedIds = new Set();
    for (const entry of selection.selections) {
      if (!object(entry) || Object.keys(entry).some(key => !['artifact', 'source_doc_id', 'rule_ids', 'reason', 'artifact_sha256'].includes(key)) || !/^artifacts\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.json$/.test(entry.artifact || '') || entry.artifact.includes('..') || !sources.has(entry.source_doc_id) || choices.has(entry.source_doc_id) || typeof entry.reason !== 'string' || entry.reason.trim().length < 10 || entry.reason.length > 4000 || !Array.isArray(entry.rule_ids) || !entry.rule_ids.length || entry.rule_ids.length > 40 || !HASH.test(entry.artifact_sha256 || '')) fail('Source selection requires one explicit, hash-pinned artifact per known source and a documented reason.');
      for (const id of entry.rule_ids) {
        if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9_-]{1,120}$/.test(id) || selectedIds.has(id)) fail('Source selection rule IDs must be valid and globally unique.');
        selectedIds.add(id);
      }
      const input = inputByPath.get(entry.artifact), run = input?.pack?.provenance;
      if (!input || input.file_sha256 !== entry.artifact_sha256) fail(`Explicit source selection artifact is absent or its pinned hash changed: ${entry.artifact}`);
      if (!run || !['completed_machine_validation', 'completed_with_review_items'].includes(run.status) || Object.hasOwn(run, 'trust_status') || Object.hasOwn(run, 'failure_code')) fail('Explicit source selection requires a fully completed trusted run.');
      choices.set(entry.source_doc_id, { entry, selected: null });
    }
  } else if (selectionHash !== null) fail('A selection-file hash cannot be supplied without an explicit manifest.');
  const runs = [], attempts = [], runIds = new Set(), candidateSets = new Map();
  for (const input of inputs) {
    if (!object(input) || !HASH.test(input.file_sha256 || '') || typeof input.path !== 'string') fail('Input-file hash or path is missing.');
    const pack = input.pack, run = pack?.provenance;
    if (pack?.version !== 1 || !Array.isArray(pack.rules) || !Array.isArray(pack.review) || !Array.isArray(pack.no_rule_findings) || !object(run) || !SUPPORTED_COMPILER_VERSIONS.includes(run.compiler_version) || !FINISHED.has(run.status) || !date(run.started_at) || !date(run.finished_at) || Date.parse(run.finished_at) < Date.parse(run.started_at) || typeof run.run_id !== 'string' || !run.run_id || runIds.has(run.run_id) || run.as_of !== catalog.snapshot || !Array.isArray(run.sources)) fail(`Unsupported, unfinished, duplicate or malformed compiler run: ${input.path}`);
    runIds.add(run.run_id);
    const rows = new Map();
    for (const row of run.sources) {
      if (!object(row) || !sources.has(row.source_doc_id) || rows.has(row.source_doc_id) || ![...SUCCESS, ...UNPROCESSED, ...REJECTED].includes(row.status)) fail(`Invalid or duplicate source-attempt metadata: ${input.path}`);
      rows.set(row.source_doc_id, row);
    }
    for (const item of [...pack.rules, ...pack.review, ...pack.no_rule_findings]) if (!object(item) || !rows.has(item.source_doc_id)) fail(`Candidate/review has no matching source attempt: ${input.path}`);
    if (!integer(run.accepted_rule_count) || run.accepted_rule_count !== pack.rules.length) fail(`Run rule count mismatch: ${input.path}`);
    if ((run.review_issue_count !== undefined && run.review_issue_count !== pack.review.length) || (run.no_rule_finding_count !== undefined && run.no_rule_finding_count !== pack.no_rule_findings.length)) fail(`Run review/finding count mismatch: ${input.path}`);
    for (const key of ['requests_sent', 'model_turns_completed', 'cache_hits', 'duration_ms']) if (run[key] !== undefined && !integer(run[key])) fail(`Invalid run audit counter: ${input.path}`);
    for (const key of ['model', 'cli_version', 'failure_code', 'trust_status']) if (run[key] !== undefined && (typeof run[key] !== 'string' || run[key].length > 250)) fail(`Invalid run metadata: ${input.path}`);
    const rejectedQuoteCount = pack.review.filter(item => item.issue_code === 'unverified_review_quote').length;
    if (!integer(run.rejected_review_quote_count) || run.rejected_review_quote_count !== rejectedQuoteCount) fail(`Run rejected-review-quote count mismatch: ${input.path}`);
    const runRecord = { input_path: input.path, input_file_sha256: input.file_sha256,
      ...pick(run, ['run_id', 'compiler_version', 'model', 'cli_version', 'as_of', 'status', 'trust_status', 'failure_code', 'started_at', 'finished_at', 'duration_ms', 'requests_sent', 'model_turns_completed', 'cache_hits', 'accepted_rule_count', 'review_issue_count', 'rejected_review_quote_count', 'no_rule_finding_count']) };
    runs.push(runRecord);
    const liveSuccessCount = [...rows.values()].filter(row => row.status === 'validated_candidates').length;
    const cacheSuccessCount = [...rows.values()].filter(row => row.status === 'cache_hit_revalidated').length;
    for (const [sourceId, row] of rows) {
      const source = sources.get(sourceId), hasText = typeof source.text === 'string' && !!source.text.trim();
      const rules = pack.rules.filter(rule => rule.source_doc_id === sourceId);
      const review = pack.review.filter(item => item.source_doc_id === sourceId);
      const findings = pack.no_rule_findings.filter(item => item.source_doc_id === sourceId);
      const attemptId = `${run.run_id}:${sourceId}`;
      const attempt = { attempt_id: attemptId, source_doc_id: sourceId, run_id: run.run_id, input_path: input.path,
        input_file_sha256: input.file_sha256, original_status: row.status, run_started_at: run.started_at, run_finished_at: run.finished_at,
        ...pick(row, ['source_sha256', 'prompt_sha256', 'schema_sha256', 'response_sha256', 'transport_sha256', 'model', 'cli_version', 'started_at', 'finished_at', 'duration_ms', 'model_called_this_run', 'original_run_id', 'exit_code', 'failure_code', 'source_error_continued', 'accepted_rules', 'review_issues', 'no_rule_findings', 'rejected_review_quote_count']),
        usage: null, validation_status: 'unprocessed', validation_issues: [] };
      try { attempt.usage = declaredUsage(row.usage); } catch { attempt.validation_issues.push('invalid_reported_usage'); }
      const missing = ['source_sha256', 'model', 'cli_version', 'started_at', 'finished_at', 'usage'].filter(key => row[key] === undefined || row[key] === null);
      if (missing.length) attempt.missing_metadata = missing;
      if (run.trust_status) attempt.validation_issues.push('run_marked_untrusted');
      if (SUCCESS.has(row.status)) {
        if (!hasText) attempt.validation_issues.push('no_captured_source_text');
        if (!HASH.test(row.source_sha256 || '')) attempt.validation_issues.push('missing_or_invalid_source_hash');
        else if (hasText && row.source_sha256 !== sha(source.text)) attempt.validation_issues.push('source_hash_mismatch');
        for (const field of ['prompt_sha256', 'schema_sha256', 'response_sha256', 'transport_sha256']) {
          if (!HASH.test(row[field] || '')) attempt.validation_issues.push(`missing_or_invalid_${field}`);
        }
        if (!attempt.usage || !integer(attempt.usage.input_tokens) || !integer(attempt.usage.output_tokens)) attempt.validation_issues.push('missing_complete_source_usage');
        if (typeof run.model !== 'string' || !run.model || row.model !== run.model || typeof run.cli_version !== 'string' || !run.cli_version || row.cli_version !== run.cli_version) attempt.validation_issues.push('source_model_or_cli_mismatch');
        if (Object.hasOwn(row, 'failure_code')) attempt.validation_issues.push('success_has_failure_code');
        if (row.status === 'validated_candidates') {
          if (row.model_called_this_run !== true || row.exit_code !== 0) attempt.validation_issues.push('live_success_lacks_successful_cli_exit');
          if (!integer(run.model_turns_completed) || liveSuccessCount > run.model_turns_completed || !integer(run.requests_sent) || liveSuccessCount > run.requests_sent) attempt.validation_issues.push('live_success_exceeds_run_completion_counters');
          if (date(row.started_at) && Date.parse(row.started_at) < Date.parse(run.started_at)) attempt.validation_issues.push('live_success_predates_run');
        } else {
          if (row.model_called_this_run !== false || typeof row.original_run_id !== 'string' || !row.original_run_id || row.original_run_id === run.run_id || (row.exit_code !== undefined && row.exit_code !== 0)) attempt.validation_issues.push('cache_success_lacks_original_completed_run');
          if (!integer(run.cache_hits) || cacheSuccessCount > run.cache_hits) attempt.validation_issues.push('cache_success_exceeds_run_cache_counter');
        }
        if (!date(row.started_at) || !date(row.finished_at) || Date.parse(row.finished_at) < Date.parse(row.started_at)) attempt.validation_issues.push('missing_or_invalid_source_times');
        if (date(row.finished_at) && Date.parse(row.finished_at) > Date.parse(run.finished_at)) attempt.validation_issues.push('source_completion_after_run_completion');
        if (row.accepted_rules !== rules.length || row.review_issues !== review.length || row.no_rule_findings !== findings.length || row.rejected_review_quote_count !== review.filter(item => item.issue_code === 'unverified_review_quote').length) attempt.validation_issues.push('source_result_count_mismatch');
        try {
          for (const rule of rules) {
            checkFields(rule, RULE_FIELDS);
            if ((rule.conflict_flag !== undefined && rule.conflict_flag !== false) || rule.conflict_note != null || !Array.isArray(rule.overrides ?? []) || (rule.overrides ?? []).length) fail('Unverified rule relationship in generated candidate.');
          }
          validateRulePack({ version: 1, rules }, catalog.sources);
          review.forEach(item => checkReview(item, source)); findings.forEach(item => checkFinding(item, source));
        } catch (error) { attempt.validation_issues.push(`candidate_validation_failed: ${String(error.message).slice(0, 250)}`); }
        if (!attempt.validation_issues.length) {
          attempt.validation_status = 'processed';
          attempt.candidate_set_sha256 = semanticFingerprint(rules, findings);
          const set = { attempt, rules: structuredClone(rules), review: structuredClone(review), findings: structuredClone(findings) };
          if (!candidateSets.has(sourceId)) candidateSets.set(sourceId, []);
          candidateSets.get(sourceId).push(set);
        } else attempt.validation_status = 'rejected';
      } else if (REJECTED.has(row.status)) attempt.validation_status = 'rejected';
      else if (rules.length || findings.length) { attempt.validation_status = 'rejected'; attempt.validation_issues.push('candidates_attached_to_unprocessed_source'); }
      attempts.push(attempt);
    }
  }
  const sourceDecisions = [];
  for (const [sourceId, choice] of choices) {
    const selected = (candidateSets.get(sourceId) || []).find(set => set.attempt.input_path === choice.entry.artifact);
    if (!selected || selected.attempt.validation_status !== 'processed') fail(`Explicitly selected source attempt did not pass validation: ${sourceId}`);
    if (choice.entry.rule_ids.some(id => !selected.rules.some(rule => rule.team_rule_id === id))) fail(`Explicitly selected app rule is absent from the selected source candidate set: ${sourceId}`);
    choice.selected = selected;
    sourceDecisions.push({ source_doc_id: sourceId, artifact: choice.entry.artifact, artifact_sha256: choice.entry.artifact_sha256,
      run_id: selected.attempt.run_id, selected_attempt_id: selected.attempt.attempt_id, reason: choice.entry.reason,
      app_rule_ids: [...choice.entry.rule_ids] });
  }
  const sourceSelection = selection === null ? null : { manifest_path: SELECTION, manifest_file_sha256: selectionHash, decisions: sourceDecisions };
  const rules = [], review = [], noRuleFindings = [], coverageRows = [];
  for (const source of catalog.sources) {
    const sourceAttempts = attempts.filter(item => item.source_doc_id === source.doc_id), sets = candidateSets.get(source.doc_id) || [];
    const hasText = typeof source.text === 'string' && !!source.text.trim();
    const row = { source_doc_id: source.doc_id, source_url: source.url ?? null, jurisdiction: source.jurisdictions ?? null,
      catalog_declared_sha256: source.sha256 ?? null, catalog_text_sha256: hasText ? sha(source.text) : null,
      status: hasText ? 'unprocessed' : 'missing_text', accepted_rule_count: 0, execution_review_count: 0,
      rejected_review_quotes: 0, no_rule_finding_count: 0, selected_attempt_id: null,
      attempt_ids: sourceAttempts.map(item => item.attempt_id), notes: [] };
    const explicitChoice = choices.get(source.doc_id), setsDiffer = new Set(sets.map(set => set.attempt.candidate_set_sha256)).size > 1;
    if (!explicitChoice && sets.length && setsDiffer) {
      row.status = 'rejected'; row.notes.push('Different completed candidate sets require reconciliation; no candidate set was selected or merged.');
      review.push({ source_doc_id: source.doc_id, issue: 'Conflicting completed candidate sets were withheld. Compare their explicitly referenced input artifacts before selecting any rule.', quoted_span: null, issue_code: 'completed_candidate_sets_differ' });
    } else if (sets.length) {
      const selected = explicitChoice?.selected || sets.sort((a, b) => Date.parse(b.attempt.run_finished_at) - Date.parse(a.attempt.run_finished_at) || a.attempt.attempt_id.localeCompare(b.attempt.attempt_id))[0];
      row.status = 'processed'; row.selected_attempt_id = selected.attempt.attempt_id;
      row.accepted_rule_count = selected.rules.length; row.execution_review_count = selected.rules.filter(rule => rule.execution_review_pending === true).length;
      row.rejected_review_quotes = selected.review.filter(item => item.issue_code === 'unverified_review_quote').length;
      row.no_rule_finding_count = selected.findings.length;
      rules.push(...selected.rules); review.push(...selected.review); noRuleFindings.push(...selected.findings);
      if (explicitChoice) row.notes.push('An explicit hash-pinned manifest selected this complete source candidate set. Other attempts remain recorded; no rules were edited or mixed, and this is not independent legal review.');
      else if (sets.length > 1) row.notes.push('Identical completed candidate sets deduplicated; latest verification run selected. Other attempts remain separately recorded.');
      if (sourceAttempts.some(item => item.validation_status === 'rejected')) row.notes.push('A separate rejected attempt remains recorded; it was not merged into the selected candidates.');
    } else if (sourceAttempts.some(item => item.validation_status === 'rejected')) row.status = 'rejected';
    if (!source.url || !source.jurisdictions) row.notes.push('Catalog source URL or jurisdiction metadata is missing; no replacement was invented.');
    coverageRows.push(row);
  }
  validateRulePack({ version: 1, rules }, catalog.sources);
  const stats = { catalog_source_count: catalog.sources.length, processed: 0, missing_text: 0, rejected: 0, unprocessed: 0,
    accepted_rule_count: rules.length, execution_review_count: rules.filter(rule => rule.execution_review_pending === true).length,
    rejected_review_quotes: coverageRows.reduce((n, row) => n + row.rejected_review_quotes, 0), no_rule_finding_count: noRuleFindings.length,
    run_count: runs.length, attempt_count: attempts.length,
    model_calls_count: runs.every(run => integer(run.requests_sent)) ? runs.reduce((total, run) => total + run.requests_sent, 0) : null };
  coverageRows.forEach(row => stats[row.status]++);
  const limitations = ['Processed means that one completed candidate extraction passed the recorded structural/source checks, not that the source was fully interpreted or that its legal interpretation is correct.',
    'Candidates remain separate from the public/reviewed rule pack; no rule is promoted by this operation.',
    'Exact quotation matches establish source correspondence, not legal validity. Prose coverage awaiting execution review is not executable.',
    'Different completed candidate sets are withheld unless the explicit hash-pinned source selection manifest selects a validated completed run. Every attempt remains recorded; no candidate rules are edited or merged. This comparison does not itself establish a legal conflict.',
    'When supplied, source_selection records the manifest hash, explicit source/run choices and operator reasons. The full selected source candidate set is shown here; app_rule_ids identify the narrower later promotion selection. This is not independent legal review.',
    'Input-file SHA-256 values are computed from the files actually read. Missing original attempt metadata stays missing; no model calls, quotes, times or usage are inferred.',
    'Counts describe the selected candidate sets. All attempts remain separate; cached token usage describes the original turn and must not be added as a new model call.',
    'attempt_count counts source-attempt entries, including unprocessed sources; it is not a model-call count. model_calls_count sums requests_sent from the supplied run audits, including failed/timed-out invocations, and is null if any run omits that count.',
    'Only explicitly selected artifacts are represented. Private CLI logs, prompts, raw responses and source bodies are not included.'];
  const provenance = { aggregation_id: aggregationId, aggregator_version: VERSION, generated_at: generatedAt, as_of: catalog.snapshot,
    catalog_file_sha256: catalogFileHash, input_files: runs.map(run => ({ path: run.input_path, file_sha256: run.input_file_sha256, run_id: run.run_id })),
    coverage_report: COVERAGE, source_selection: sourceSelection, stats, limitations, no_model_calls: true, not_legal_review: true };
  return { candidates: { version: 1, provenance, rules, review, no_rule_findings: noRuleFindings },
    coverage: { version: 1, ...provenance, count_definitions: {
      attempt_count: 'Source-attempt entries in supplied run audits, including unprocessed entries; not a model-call count.',
      model_calls_count: 'Sum of reported requests_sent, including failed/timed-out invocations and excluding cache hits; null if any input run omits the count.' }, source_status_definitions: {
      processed: 'A completed source candidate set passed these checks; zero rules may mean review-only or an explicit no-rule finding, not exhaustive legal absence.',
      missing_text: 'No captured text is available in the current catalog.', rejected: 'No candidate set selected because attempts failed, timed out or failed validation, or completed candidate sets differed.',
      unprocessed: 'Captured text exists, but the supplied artifacts contain no accepted completed extraction.' },
      sources: coverageRows, runs, attempts } };
}

async function atomicJSON(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  try { await rename(temp, path); } catch (error) { await unlink(temp).catch(() => {}); throw error; }
}
export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv); if (options.help) { console.log(HELP); return; }
  const catalogBytes = await readFile(join(ROOT, 'public/data/catalog.json'));
  const inputs = [];
  for (const path of options.inputs) {
    const bytes = await readFile(join(ROOT, path));
    if (bytes.length > 32_000_000) fail(`Input artifact exceeds the local size limit: ${path}`);
    inputs.push({ path, file_sha256: sha(bytes), pack: JSON.parse(bytes.toString('utf8')) });
  }
  let selection = null, selectionHash = null;
  if (options.selection) {
    const actual = await realpath(join(ROOT, SELECTION)), allowed = await realpath(join(ROOT, 'data/extracted'));
    if (dirname(actual) !== allowed) fail('Selection manifest resolves outside its allowed directory.');
    const bytes = await readFile(actual);
    if (bytes.length > 2_000_000) fail('Selection manifest exceeds the local size limit.');
    selection = JSON.parse(bytes.toString('utf8')); selectionHash = sha(bytes);
  }
  const result = aggregate(JSON.parse(catalogBytes.toString('utf8')), inputs, { catalogFileHash: sha(catalogBytes), selection, selectionHash });
  if (!options.dryRun) {
    // A shared aggregation ID lets consumers reject a mismatched pair after an
    // interrupted filesystem write. Input artifacts and compiler locks are untouched.
    await atomicJSON(join(ROOT, COVERAGE), result.coverage);
    await atomicJSON(join(ROOT, OUTPUT), result.candidates);
  }
  console.log(JSON.stringify({ mode: options.dryRun ? 'dry_run' : 'written', model_called: false, promoted_rules: false,
    ...result.coverage.stats, candidate_output: options.dryRun ? null : OUTPUT, coverage_output: options.dryRun ? null : COVERAGE }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(`Corpus aggregation stopped: ${error.message}`); process.exitCode = 1; });
