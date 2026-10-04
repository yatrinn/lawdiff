/** Validate a published extraction-coverage receipt before displaying counts. */
export function checkedCorpusCoverage(value, catalog) {
  const states = ['processed', 'missing_text', 'rejected', 'unprocessed'];
  const count = n => Number.isSafeInteger(n) && n >= 0;
  if (!value || value.version !== 1 || value.not_legal_review !== true ||
      !Array.isArray(value.sources) || !value.stats ||
      !Number.isFinite(Date.parse(value.generated_at))) throw Error('Invalid corpus receipt.');
  const ids = new Set(catalog.sources.map(s => s.doc_id));
  if (value.sources.length !== ids.size || value.stats.catalog_source_count !== ids.size ||
      new Set(value.sources.map(s => s.source_doc_id)).size !== ids.size)
    throw Error('Corpus receipt does not cover this catalog.');
  const totals = Object.fromEntries(states.map(s => [s, 0]));
  for (const field of ['accepted_rule_count', 'execution_review_count', 'rejected_review_quotes', 'no_rule_finding_count']) totals[field] = 0;
  for (const source of value.sources) {
    if (!ids.has(source.source_doc_id) || !states.includes(source.status)) throw Error('Unknown corpus source.');
    totals[source.status]++;
    for (const field of ['accepted_rule_count', 'execution_review_count', 'rejected_review_quotes', 'no_rule_finding_count']) {
      if (!count(source[field])) throw Error('Invalid source count.');
      totals[field] += source[field];
    }
    if (source.execution_review_count > source.accepted_rule_count ||
        (source.status !== 'processed' && (source.accepted_rule_count || source.no_rule_finding_count)))
      throw Error('Unprocessed source cannot claim accepted output.');
  }
  for (const [field, total] of Object.entries(totals))
    if (value.stats[field] !== total) throw Error('Corpus totals do not reconcile.');
  return value;
}
