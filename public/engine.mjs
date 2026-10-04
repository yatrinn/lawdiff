export const FACTS = {
  year_built: "Year built",
  units: "Number of units",
  certificate_of_occupancy: "Certificate-of-occupancy date",
  owner_type: "Owner type",
  owner_occupied: "Owner occupied",
  owner_total_units: "Owner’s total units",
  owner_property_count: "Owner’s property count",
  new_construction_exemption: "New-construction exemption filed",
  residential: "Residential use",
  tenant_opt_in: "Tenant opted in",
  seasonal: "Seasonal rental",
};
Object.assign(FACTS, {
  transient_hotel: "Transient tourist hotel",
  affordable_housing: "Affordable housing",
  dormitory: "Dormitory",
  separately_alienable: "Separately alienable dwelling",
  exemption_notice_given: "Required exemption notice given",
  tenant_months: "Tenant occupancy in months",
  all_tenants_months: "All tenants’ occupancy in months",
  owner_shared_facilities: "Owner shares required facilities",
  licensed_care_facility: "Licensed care facility",
  certificate_age_years: "Occupancy certificate age in years",
  la_rso_exempt: "Los Angeles RSO exemption established",
  sf_rent_control_exempt: "San Francisco rent-control exemption established",
  local_just_cause_exempt: "Local just-cause exemption established",
  berkeley_ordinance_exempt: "Berkeley ordinance exemption established",
  berkeley_rent_exempt: "Berkeley rent exemption established",
  service_member: "Tenant is a service member",
  local_rent_control_applies: "Local rent control applies",
  original_lease_expired: "Original lease has expired",
  mobilehome: "Mobilehome",
  tenancy_short_term: "Short-term tenancy",
  unit_fair_chance_exempt: "Fair Chance unit exemption established",
  boston_policy_covered: "Boston policy coverage established",
  ma_short_vacation_tenancy: "Massachusetts short vacation tenancy",
  institutional_housing_exemption:
    "Institutional housing exemption established",
  transient_housing: "Transient housing",
  nj_disabled_family_trust: "New Jersey disabled-family trust exception",
  written_lease: "Written lease",
  tenancy_at_will: "Tenancy at will",
  primary_residence: "Dwelling intended for use as a primary residence",
  inpatient_medical_care: "Unit is an inpatient medical-care facility",
  licensed_long_term_care: "Unit is a licensed long-term-care facility",
  detention_or_correctional_facility: "Unit is a detention or correctional facility",
  fee_charger_is_landlord: "Person charging the application fee is the property's landlord",
  fee_charger_is_landlord_agent: "Person charging the application fee acts as an agent of the property's landlord",
  fee_charger_nj_real_estate_licensee: "Person charging the application fee is a New Jersey Real Estate Commission licensee",
});
export function validDate(s) {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s
  );
}
export const CATEGORIES = [
  "rent_increase_limits",
  "just_cause_eviction",
  "security_deposits",
  "application_screening_fees",
  "screening_restrictions",
  "algorithmic_rent_setting",
];
export const unique = (a) => [...new Set(a)];
export const escapeHTML = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function result(value, missing = [], trace = []) {
  return { value, missing: unique(missing), trace };
}
export function validateCondition(node, depth = 0) {
  if (depth > 15) throw Error("Condition nesting exceeds 15 levels.");
  if (typeof node === "boolean") return;
  if (!node || typeof node !== "object" || Array.isArray(node))
    throw Error("Coverage must be an executable condition, not prose.");
  const groups = ["all", "any", "not"].filter((k) => Object.hasOwn(node, k));
  if (
    groups.length > 1 ||
    (groups.length === 1 && Object.keys(node).length !== 1)
  )
    throw Error("Condition groups cannot mix operators or leaf fields.");
  if (
    !groups.length &&
    Object.keys(node).some((k) => !["field", "op", "value"].includes(k))
  )
    throw Error("Unsupported condition property.");
  if ("all" in node || "any" in node) {
    const a = node.all ?? node.any;
    if (!Array.isArray(a) || a.length > 100)
      throw Error("Invalid condition group.");
    a.forEach((x) => validateCondition(x, depth + 1));
    return;
  }
  if ("not" in node) {
    validateCondition(node.not, depth + 1);
    return;
  }
  if (
    !Object.hasOwn(FACTS, node.field) ||
    !["eq", "neq", "lt", "lte", "gt", "gte", "in", "exists"].includes(node.op)
  )
    throw Error("Unsupported fact or comparison.");
  if (node.op === "in" && !Array.isArray(node.value))
    throw Error("Membership requires a list.");
  if (node.op !== "exists" && node.value === undefined)
    throw Error("Comparison value is missing.");
}
export function evaluateCondition(node, facts) {
  if (typeof node === "boolean") return result(node);
  if (!node || typeof node !== "object")
    return result(null, ["coverage interpretation"]);
  if ("all" in node || "any" in node) {
    const isAll = "all" in node,
      children = (isAll ? node.all : node.any).map((x) =>
        evaluateCondition(x, facts),
      );
    const decisive = children.some((x) => x.value === !isAll);
    const value = decisive
      ? !isAll
      : children.some((x) => x.value === null)
        ? null
        : isAll;
    return result(
      value,
      value === null ? children.flatMap((x) => x.missing) : [],
      children.flatMap((x) => x.trace),
    );
  }
  if ("not" in node) {
    const r = evaluateCondition(node.not, facts);
    return { ...r, value: r.value === null ? null : !r.value };
  }
  const v = facts[node.field],
    missing = v === null || v === undefined || v === "";
  if (node.op === "exists")
    return result(
      !missing,
      [],
      [{ field: node.field, value: v, expected: "known", result: !missing }],
    );
  if (missing)
    return result(
      null,
      [node.field],
      [
        {
          field: node.field,
          value: null,
          expected: node.value,
          op: node.op,
          result: null,
        },
      ],
    );
  const target = node.value;
  if (node.op !== "in" && typeof v !== typeof target)
    return result(
      null,
      [node.field],
      [
        {
          field: node.field,
          value: v,
          expected: target,
          op: node.op,
          result: null,
          reason: "Fact and condition use different types.",
        },
      ],
    );
  const operations = {
    eq: () => v === target,
    neq: () => v !== target,
    lt: () => v < target,
    lte: () => v <= target,
    gt: () => v > target,
    gte: () => v >= target,
    in: () => Array.isArray(target) && target.includes(v),
  };
  const value = operations[node.op]?.() ?? null;
  return result(value, value === null ? [node.field] : [], [
    {
      field: node.field,
      value: v,
      expected: target,
      op: node.op,
      result: value,
    },
  ]);
}
export function factsFor(address, overrides = {}, asOf) {
  const facts = {
    year_built: address.year_built,
    units: address.units,
    ...overrides,
  };
  if (
    validDate(facts.certificate_of_occupancy) &&
    validDate(asOf) &&
    facts.certificate_of_occupancy <= asOf
  ) {
    const date = facts.certificate_of_occupancy;
    facts.certificate_age_years =
      Number(asOf.slice(0, 4)) -
      Number(date.slice(0, 4)) -
      (asOf.slice(5) < date.slice(5) ? 1 : 0);
  }
  return facts;
}
export function jurisdictionMatch(rule, address) {
  if (rule.level === "state") return rule.jurisdiction === address.state;
  const suffix = rule.jurisdiction.split(",").at(-1)?.trim();
  if (suffix && suffix !== address.state) return false;
  if (!address.geography?.legal_city) return null;
  return (
    rule.jurisdiction === `${address.geography.legal_city}, ${address.state}`
  );
}
export function evaluateRule(rule, address, asOf, overrides = {}) {
  if (!validDate(asOf)) throw Error("A real calendar date is required.");
  const coverageReview = typeof rule.coverage_conditions === "string";
  if ((coverageReview && rule.execution_review_pending !== true) ||
      (!coverageReview && rule.execution_review_pending === true))
    throw Error("Coverage review must be explicitly paired with non-executable prose.");
  const j = jurisdictionMatch(rule, address);
  const base = {
    team_rule_id: rule.team_rule_id,
    rule,
    missing: [],
    trace: [],
    conflict_flag: false,
  };
  if (j === false)
    return {
      ...base,
      result: "not_applicable",
      explanation: "Outside this rule’s legal jurisdiction.",
    };
  if (rule.status === "failed")
    return {
      ...base,
      result: "not_applicable",
      explanation: "This proposal did not become law.",
    };
  if (rule.end_date && asOf >= rule.end_date)
    return {
      ...base,
      result: "not_applicable",
      explanation: "This rule version no longer applies on the selected date.",
    };
  if (j === null)
    return {
      ...base,
      result: "unknown",
      missing: ["legal jurisdiction"],
      explanation:
        "The legal city has not been verified. The postal city is not used as a substitute.",
    };
  const c = coverageReview ? result(null, ["coverage interpretation"]) : evaluateCondition(
    rule.coverage_conditions,
    factsFor(address, overrides, asOf),
  );
  c.missing = unique(
    c.missing.map((f) =>
      f === "certificate_age_years" ? "certificate_of_occupancy" : f,
    ),
  );
  if (c.value === false)
    return {
      ...base,
      trace: c.trace,
      result: "not_applicable",
      explanation: "A necessary coverage condition is not met.",
    };
  if (rule.status === "pending")
    return {
      ...base,
      trace: c.trace,
      missing: c.missing,
      result: "pending",
      explanation:
        "Pending proposal. Not in force; this is a potential scope, not an active obligation.",
    };
  const date = rule.effective_date;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && asOf < date)
    return {
      ...base,
      trace: c.trace,
      missing: c.missing,
      result: "not_yet_effective",
      explanation: `Enacted, but not effective until ${date}.`,
    };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
    return {
      ...base,
      result: "unknown",
      missing: ["precise effective date"],
      explanation: "The source does not establish a complete effective date.",
    };
  if (!date && (rule.status === "not_yet_effective" || asOf < "2026-10-01"))
    return {
      ...base,
      result: "unknown",
      missing: ["effective date"],
      explanation:
        "The available date evidence does not establish this rule’s status on the selected date.",
    };
  if (c.value === null)
    return {
      ...base,
      trace: c.trace,
      result: "unknown",
      missing: c.missing,
      explanation:
        coverageReview ? "This source-supported rule has documented coverage and exceptions that still require specialist review before address applicability can be determined."
          : "The outcome depends on evidence missing from the supplied building record.",
    };
  return {
    ...base,
    trace: c.trace,
    result: "applies",
    conflict_flag: !!rule.conflict_flag,
    explanation: rule.requirement,
  };
}
export function evaluateAddress(rules, address, asOf, overrides = {}) {
  const rows = rules.map((r) => evaluateRule(r, address, asOf, overrides));
  for (const row of rows) {
    if (row.result !== "applies") continue;
    for (const id of row.rule.supersedes ?? []) {
      const other = rows.find((r) => r.team_rule_id === id);
      if (other?.result === "applies") {
        other.result = "superseded";
        other.explanation = `Superseded by ${row.rule.title}. ${row.rule.interaction ?? ""}`;
      }
    }
    for (const id of row.rule.possible_conflicts ?? []) {
      const other = rows.find((r) => r.team_rule_id === id);
      if (other?.result === "applies") {
        row.conflict_flag = true;
        other.conflict_flag = true;
      }
    }
  }
  return rows;
}
export function validateRulePack(pack, sources) {
  if (
    pack.version !== 1 ||
    !Array.isArray(pack.rules) ||
    pack.rules.length > 2000
  )
    throw Error("Expected a version 1 LawDiff rule pack.");
  const ids = new Set();
  for (const r of pack.rules) {
    for (const key of [
      "team_rule_id",
      "jurisdiction",
      "level",
      "category",
      "status",
      "title",
      "requirement",
      "citation",
      "source_url",
      "quoted_span",
      "source_doc_id",
    ])
      if (typeof r[key] !== "string" || !r[key])
        throw Error(`Missing ${key} in a rule.`);
    if (ids.has(r.team_rule_id))
      throw Error(`Duplicate rule identifier: ${r.team_rule_id}`);
    ids.add(r.team_rule_id);
    if (
      !["state", "city"].includes(r.level) ||
      !CATEGORIES.includes(r.category) ||
      !["in_force", "not_yet_effective", "pending", "failed"].includes(r.status)
    )
      throw Error("Invalid rule classification.");
    const source = sources.find((s) => s.doc_id === r.source_doc_id);
    if (
      source?.jurisdictions &&
      source.jurisdictions !== r.jurisdiction &&
      !source.jurisdictions.split(/;\s*/).includes(r.jurisdiction) &&
      !(
        source.source_type?.startsWith("organizer") &&
        source.jurisdictions.split(/,\s*/).includes(r.jurisdiction)
      )
    )
      throw Error(`Source jurisdiction mismatch: ${r.team_rule_id}`);
    if (
      !source?.text ||
      r.quoted_span.length < 20 ||
      !source.text.includes(r.quoted_span)
    )
      throw Error(
        `Source quotation does not match the supplied text: ${r.team_rule_id}`,
      );
    if (r.source_url !== source.url)
      throw Error(`Source URL mismatch: ${r.team_rule_id}`);
    for (const key of ["effective_date", "end_date"])
      if (r[key] != null && !validDate(r[key]))
        throw Error(`Invalid calendar date: ${r.team_rule_id} ${key}`);
    if (r.end_date && r.effective_date && r.end_date <= r.effective_date)
      throw Error(`Rule end must follow its effective date: ${r.team_rule_id}`);
    for (const key of [
      "source_evidence",
      "additional_evidence",
      "relation_evidence",
    ]) {
      if (r[key] !== undefined && !Array.isArray(r[key]))
        throw Error(`Invalid evidence list: ${r.team_rule_id}`);
      for (const ev of r[key] || []) {
        const id = ev.doc_id || ev.source_doc_id || r.source_doc_id,
          quote = ev.quote || ev.quoted_span,
          s = sources.find((s) => s.doc_id === id);
        if (
          typeof quote !== "string" ||
          quote.length < 10 ||
          !s?.text?.includes(quote)
        )
          throw Error(
            `Supplemental source quotation mismatch: ${r.team_rule_id} ${id}`,
          );
      }
    }
    for (const key of ["supersedes", "possible_conflicts"])
      if (
        r[key] !== undefined &&
        (!Array.isArray(r[key]) ||
          r[key].some((id) => typeof id !== "string" || id === r.team_rule_id))
      )
        throw Error(`Invalid rule relationship: ${r.team_rule_id}`);
    if (typeof r.coverage_conditions === "string") {
      if (r.execution_review_pending !== true || r.coverage_conditions.trim().length < 20 || r.coverage_conditions.length > 10000)
        throw Error("Narrative coverage requires explicit review and a bounded description.");
    } else {
      if (r.execution_review_pending === true)
        throw Error("Executable coverage cannot be marked as non-executable prose.");
      validateCondition(r.coverage_conditions);
    }
  }
  for (const r of pack.rules)
    for (const id of [...(r.supersedes ?? []), ...(r.possible_conflicts ?? [])])
      if (!ids.has(id)) throw Error(`Unknown related rule: ${id}`);
  return true;
}
