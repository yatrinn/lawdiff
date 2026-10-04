import { evaluateAddress, FACTS, validDate } from "./engine.mjs";
export function lookupsFor(catalog, pack, asOf = catalog.snapshot) {
  return {
    as_of: asOf,
    lookups: Object.fromEntries(
      catalog.addresses.map((a) => [
        a.address_id,
        evaluateAddress(pack.rules, a, asOf)
          .filter((r) => r.result !== "not_applicable")
          .map(({ team_rule_id, result, explanation, conflict_flag }) => ({
            team_rule_id,
            result,
            explanation,
            conflict_flag,
          })),
      ]),
    ),
  };
}
export function matchesCase(rule, id) {
  if (id === "T1")
    return (
      ["D022", "C001"].includes(rule.source_doc_id) &&
      rule.category === "algorithmic_rent_setting"
    );
  if (id === "T2")
    return (
      rule.category === "algorithmic_rent_setting" &&
      ["Hoboken, NJ", "Jersey City, NJ"].includes(rule.jurisdiction)
    );
  if (id === "T3")
    return (
      rule.source_doc_id === "D069" &&
      rule.category === "algorithmic_rent_setting"
    );
  if (id === "T4")
    return (
      rule.jurisdiction === "MA" &&
      rule.category === "algorithmic_rent_setting" &&
      rule.status === "pending"
    );
  return (
    rule.status === "failed" &&
    rule.jurisdiction === "MA" &&
    rule.category === "rent_increase_limits"
  );
}
export function changesFor(catalog, pack) {
  const out = {};
  for (const c of catalog.changes) {
    const rules = pack.rules.filter((r) => matchesCase(r, c.test_id)),
      affected = [],
      unknown = [],
      conflicts = [];
    for (const a of catalog.addresses) {
      const after = evaluateAddress(
        pack.rules,
        a,
        c.as_of_after || c.as_of || catalog.snapshot,
      ).filter((r) => matchesCase(r.rule, c.test_id));
      const before = c.as_of_before
        ? evaluateAddress(pack.rules, a, c.as_of_before).filter((r) =>
            matchesCase(r.rule, c.test_id),
          )
        : [];
      if (after.some((r) => r.result === "unknown")) unknown.push(a.address_id);
      if (after.some((r) => r.conflict_flag)) conflicts.push(a.address_id);
      if (c.type === "negative") continue;
      if (
        c.type === "pending"
          ? after.some((r) => r.result === "pending")
          : c.type === "boundary"
            ? after.some((r) => r.result === "applies")
            : after.some(
                (r) =>
                  r.result === "applies" &&
                  before.find((b) => b.team_rule_id === r.team_rule_id)
                    ?.result !== "applies",
              )
      )
        affected.push(a.address_id);
    }
    out[c.test_id] = {
      affected_address_ids: affected,
      conflict_flag_address_ids: conflicts,
      unknown_address_ids: unknown,
      notes:
        c.type === "negative"
          ? "No active rent cap is created by the failed ballot proposal. Empty affected set."
          : c.type === "pending"
            ? "Potential scope only, if enacted. No pending proposal is treated as current law."
            : rules.length
              ? "Computed from the loaded rule conditions and original sample. Unknown records are listed separately."
              : "Source-supported rules for this case are missing; an empty set is a coverage gap, not proof of no applicable law.",
    };
  }
  return out;
}

// A handoff for review, evaluated from the original sample. Local simulations
// are deliberately not accepted as an input to a shared operational record.
export function reviewBriefFor(catalog, pack, caseId, asOf) {
  const change = catalog.changes.find((c) => c.test_id === caseId);
  if (!change || !validDate(asOf)) throw Error("Unknown change or invalid date.");
  const rules = pack.rules.filter((r) => matchesCase(r, caseId));
  const counts = { applies: 0, unknown: 0, not_yet_effective: 0, pending: 0, superseded: 0 };
  const order = ["unknown", "applies", "not_yet_effective", "pending", "superseded"];
  const records = [];
  for (const address of catalog.addresses) {
    const rows = evaluateAddress(pack.rules, address, asOf)
      .filter((r) => matchesCase(r.rule, caseId) && r.result !== "not_applicable");
    if (!rows.length) continue;
    const status = order.find((s) => rows.some((r) => r.result === s));
    counts[status]++;
    const missing = [...new Set(rows.flatMap((r) => r.missing))];
    const conflict = rows.some((r) => r.conflict_flag);
    const nextStep = status === "unknown"
      ? missing.includes("coverage interpretation") ? "Have a qualified reviewer resolve the documented coverage and exceptions. This narrative is not an executable address decision."
        : `Establish: ${missing.map((f) => FACTS[f] || f).join(", ")}. Re-evaluate before a decision.`
      : status === "pending" ? "Monitor legislative status. This proposal creates no current obligation."
      : status === "not_yet_effective" ? "Review the source and plan for its effective date. Recheck missing facts before it takes effect."
      : conflict ? "Review the overlapping state and local requirements with a qualified reviewer."
      : status === "superseded" ? "Review the rule identified as superseding this version."
      : "Review the source-supported requirement against the actual property and operating practice.";
    records.push({ address_id: address.address_id, street_address: address.street_address,
      legal_city: address.geography?.legal_city || null, postal_city: address.postal_city,
      state: address.state, status, missing, conflict, next_step: nextStep, rows });
  }
  records.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)
    || Number(b.conflict) - Number(a.conflict) || a.address_id.localeCompare(b.address_id));
  return { case_id: caseId, title: change.short, as_of: asOf, snapshot: catalog.snapshot,
    counts, records, rules, conflict_count: records.filter((r) => r.conflict).length,
    basis: "Original supplied facts; local simulations and unverified overlays excluded.",
    note: rules.length === 0 ? "Coverage gap: no extracted rule is loaded for this case. An empty list does not establish that no law applies."
      : change.type === "negative" ? "No new obligation: the supplied proposal did not become law."
      : "Review preparation only. Listed scope does not establish a violation, legal correctness, or a complete compliance assessment." };
}

export function reviewBriefCSV(brief) {
  // Quote every field and neutralize spreadsheet formulas from imported text.
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const rows = [["case", "as_of", "source_snapshot", "address_id", "street_address", "legal_city", "postal_city", "state", "result", "missing_facts", "possible_conflict", "next_review_step", "rule_id", "rule_title", "effective_date", "source_id", "source_url", "citation", "quoted_span", "requirement", "basis", "scope_note"]];
  for (const record of brief.records) for (const row of record.rows) rows.push([
    brief.case_id, brief.as_of, brief.snapshot, record.address_id, record.street_address,
    record.legal_city || "UNRESOLVED", record.postal_city, record.state, row.result,
    row.missing.map((f) => FACTS[f] || f).join("; "), row.conflict_flag ? "Review required" : "No flag",
    record.next_step, row.team_rule_id, row.rule.title, row.rule.effective_date,
    row.rule.source_doc_id, row.rule.source_url, row.rule.citation, row.rule.quoted_span,
    row.rule.requirement, brief.basis, brief.note,
  ]);
  // Keep the conclusion explicit even when there are no address rows.
  if (!brief.records.length) rows.push([brief.case_id, brief.as_of, brief.snapshot,
    ...Array(17).fill(""), brief.basis, brief.note]);
  return "\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
