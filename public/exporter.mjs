import { evaluateAddress } from "./engine.mjs";
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
      rule.source_doc_id === "D022" &&
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
