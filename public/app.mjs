import { lookupsFor, changesFor } from "./exporter.mjs";
import { icon, renderField, renderLayers, catName } from "./visuals.mjs";
import {
  FACTS,
  escapeHTML as h,
  evaluateAddress,
  validateRulePack,
  validDate,
  evaluateCondition,
  factsFor,
} from "./engine.mjs";
const $ = (s) => document.querySelector(s);
let report = null,
  rightsLang = "en",
  playTimer = null;
let extractionRun = null,
  extractionRunState = "idle";
let catalog,
  pack,
  view = "changes",
  caseId = "T3",
  asOf = "2026-10-01",
  addressId = null,
  ruleId = null,
  query = "",
  overrides = {};
try {
  overrides = JSON.parse(localStorage.getItem("lawdiff-evidence-v1") || "{}");
} catch {}
const labels = {
  applies: "Applies",
  unknown: "Needs evidence",
  not_applicable: "Not applicable",
  not_yet_effective: "Not yet effective",
  pending: "Pending proposal",
  superseded: "Superseded",
};
const selectedCase = () => catalog.changes.find((c) => c.test_id === caseId);
const scope = () =>
  catalog.addresses.filter((a) => selectedCase().states.includes(a.state));
const evidenceValues = (a) =>
  Object.fromEntries(
    Object.entries(overrides[a.address_id] ?? {}).map(([k, v]) => [k, v.value]),
  );
function evaluations(a) {
  return evaluateAddress(pack.rules, a, asOf, evidenceValues(a));
}
function caseRuleMatches(r) {
  if (caseId === "T1")
    return (
      r.source_doc_id === "D022" && r.category === "algorithmic_rent_setting"
    );
  if (caseId === "T2")
    return (
      r.category === "algorithmic_rent_setting" &&
      ["Hoboken, NJ", "Jersey City, NJ"].includes(r.jurisdiction)
    );
  if (caseId === "T3")
    return (
      r.source_doc_id === "D069" && r.category === "algorithmic_rent_setting"
    );
  if (caseId === "T4")
    return (
      r.jurisdiction === "MA" &&
      r.category === "algorithmic_rent_setting" &&
      r.status === "pending"
    );
  return (
    r.status === "failed" &&
    r.jurisdiction === "MA" &&
    r.category === "rent_increase_limits"
  );
}
function caseRules(a) {
  return evaluations(a).filter((r) => caseRuleMatches(r.rule));
}
function statusFor(a) {
  if (!pack.rules.length)
    return selectedCase().states.includes(a.state) ? "scope" : "outside";
  const r = caseRules(a).filter((x) => x.result !== "not_applicable");
  return (
    ["unknown", "applies", "pending", "not_yet_effective", "superseded"].find(
      (s) => r.some((x) => x.result === s),
    ) || "outside"
  );
}
function displayDate(s) {
  return new Date(s + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
function cityLabel(a) {
  return a.geography?.legal_city || a.postal_city;
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
function download(name, data) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function activateView(next) {
  stopPlayback();
  view = next;
  render();
  window.scrollTo({ top: 0 });
}
function selectCase(id) {
  stopPlayback();
  view = "changes";
  if (!catalog.changes.some((c) => c.test_id === id))
    throw Error("Unknown change case.");
  caseId = id;
  asOf =
    selectedCase().as_of_before || selectedCase().as_of || catalog.snapshot;
  addressId = scope()[0]?.address_id;
  query = "";
  ruleId = null;
  render();
}
function selectAddress(id) {
  if (!catalog.addresses.some((a) => a.address_id === id))
    throw Error("Unknown address.");
  addressId = id;
  ruleId = null;
  view = "address";
  render();
  window.scrollTo({ top: 0 });
}
function render() {
  document
    .querySelectorAll("[data-view]")
    .forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $("#workspace").innerHTML =
    view === "changes"
      ? renderChanges()
      : view === "address"
        ? renderAddress()
        : view === "sources"
          ? `<div class="standalone-content">${renderSources()}</div>`
          : `<div class="standalone-content">${renderIntegrity()}</div>`;
  $("#footer-meta").textContent =
    `${catalog.stats.addresses} sample addresses · Source snapshot ${catalog.snapshot}`;
  bindContent();
  if (view === "integrity" && extractionRunState === "idle") loadExtractionRun();
}
function renderChanges() {
  const c = selectedCase(),
    rs = pack.rules.filter(caseRuleMatches),
    notRun = !pack.rules.length;
  const counts = {
    applies: 0,
    unknown: 0,
    pending: 0,
    not_yet_effective: 0,
    outside: 0,
  };
  catalog.addresses.forEach((a) => {
    const v = statusFor(a);
    counts[v] = (counts[v] || 0) + 1;
  });
  const number =
    c.type === "pending"
      ? counts.pending
      : c.type === "negative"
        ? 0
        : counts.applies;
  const future =
    c.type === "pending"
      ? "Potential scope"
      : c.type === "negative"
        ? "New obligations"
        : "Applies now";
  const conflictCount = catalog.addresses.filter((a) =>
    caseRules(a).some((r) => r.conflict_flag),
  ).length;
  return `<div class="workspace-grid"><aside class="change-sidebar"><div class="sidebar-top"><span class="eyebrow">WORKSPACE</span><span class="small muted">07</span></div><div class="sidebar-label"><span>CHANGE CASES</span><span>5</span></div>${catalog.changes.map((x) => `<button class="change-item ${x.test_id === caseId ? "selected" : ""}" data-case="${x.test_id}" aria-pressed="${x.test_id === caseId}"><span class="meta"><span>${h(x.states.join(" / "))}</span><span>${x.test_id}</span></span><div class="name">${h(x.short)}</div><div class="sub">${x.type === "pending" ? "Pending legislation" : x.type === "negative" ? "Failed proposal" : x.type === "boundary" ? "Local boundaries" : displayDate(x.date)}</div></button>`).join("")}<div class="sidebar-note"><span class="eyebrow">ONE FACT CAN MATTER</span><p>See how a missing occupancy date changes a single branch of the answer.</p><button class="text-button" data-address="A0107">Explore the boundary case</button></div><div class="sidebar-bottom">${icon("shield", 15)} Source-grounded. Reviewable.</div></aside>
 <section class="main-column"><div class="page-heading"><div><span class="eyebrow">${h(c.label)}</span><h1>${h(c.short)}</h1><p class="muted">${h(c.description)}</p></div><span class="context-tag">${c.type === "pending" ? "Proposed" : c.type === "negative" ? "Not enacted" : asOf < c.date ? "Before effective date" : "Change in view"}</span></div>
 <div class="stage-grid"><section class="field-card"><div class="field-header"><div><span class="eyebrow">THE FIELD</span><h3>500 addresses. One clear view.</h3></div><span class="field-count">${icon("home", 16)} 3 states</span></div>${renderField(catalog, statusFor, addressId)}<div class="field-legend"><span><i class="legend-dot applies"></i>Applies</span><span><i class="legend-dot unknown"></i>Needs evidence</span><span><i class="legend-dot not_yet_effective"></i>Future</span><span><i class="legend-dot pending"></i>Pending</span><span><i class="legend-dot outside"></i>Other</span></div><div class="field-note">One mark = one supplied address. Clusters follow sample collections, not map coordinates.</div>
 <div class="timeline"><div class="timeline-head"><button class="play-button" id="play-timeline" aria-label="Play timeline">${icon("play", 16)}</button><div><span class="eyebrow">AS OF</span><strong id="timeline-date">${displayDate(asOf)}</strong></div><div class="timeline-jumps"><button class="button button-light" data-date="${c.as_of_before || catalog.snapshot}">Before</button><button class="button button-light" data-date="${c.date}">After</button><input type="date" id="as-of" aria-label="As of date" value="${asOf}" min="2024-01-01" max="2028-12-31"></div></div><input id="time-scrubber" type="range" min="0" max="1460" value="${Math.round((new Date(asOf + "T12:00Z") - new Date("2024-01-01T12:00Z")) / 86400000)}" aria-label="Move through time"><div class="timeline-years"><span>2024</span><span>2025</span><span>2026</span><span>2027</span></div></div></section>
 <aside class="impact-inspector"><span class="eyebrow">THE IMPACT</span><div class="impact-number">${notRun ? "—" : number}<span>/ 500</span></div><h3>${future}</h3><p class="muted">${notRun ? "No extracted rules loaded." : c.type === "negative" ? "No change: this proposal did not become law." : c.type === "pending" ? "Possible coverage if enacted. These bills are not active law." : "Addresses meeting this change’s extracted conditions on the selected date."}</p><div class="impact-breakdown"><div><span>Needs evidence</span><strong>${counts.unknown}</strong></div><div><span>Not yet effective</span><strong>${counts.not_yet_effective}</strong></div><div><span>Possible conflicts</span><strong>${conflictCount}</strong></div><div><span>Rules in this case</span><strong>${rs.length}</strong></div></div><div class="inspector-source"><span class="eyebrow">START AT THE SOURCE</span>${
   (c.sources.length ? c.sources : rs.map((r) => r.source_doc_id))
     .slice(0, 3)
     .map((id) => {
       const src = catalog.sources.find((s) => s.doc_id === id);
       return src
         ? `<button class="source-chip" data-source="${id}">${icon("document", 16)}<span>${id}<small>${h(src.jurisdictions)}</small></span><span>↗</span></button>`
         : "";
     })
     .join("") ||
   '<p class="small muted">Source coverage is being resolved.</p>'
 }</div><button class="button button-wide" id="inspect-address">Explore an address</button></aside></div>
 ${notRun ? '<div class="notice">Source preview: the real sample is loaded, but extracted applicability results are not yet available.</div>' : rs.length === 0 && c.type !== "negative" ? '<div class="notice">This case has no source-supported extracted rule in the current pack. Zero computed matches must not be read as proof that no rule exists.</div>' : ""}
 <div class="below-field"><span>${icon("layers", 18)} Every address. Every layer. Every change.</span><button class="text-button" data-view-link="integrity">Inspect the method</button></div></section></div>`;
}
function renderAddress() {
  const a =
    catalog.addresses.find((x) => x.address_id === addressId) ||
    catalog.addresses.find((x) => x.address_id === "A0107");
  addressId = a.address_id;
  const rows = evaluations(a).filter(
    (r) => r.result !== "not_applicable" || r.team_rule_id === ruleId,
  );
  const reasoning = renderEvidence(a);
  return `<div class="address-heading"><div><button class="text-button back-button" data-view-link="changes">Change desk</button><div class="eyebrow">${h(a.address_id)} · ADDRESS WORKSPACE</div><h1>${h(a.street_address.toLowerCase())}</h1><p class="muted">${h(cityLabel(a))}, ${a.state} ${h(a.zip)} · ${displayDate(asOf)}</p></div><div class="address-heading-actions"><button class="button" id="find-address">${icon("search", 16)} Find address</button><button class="button button-dark" id="rights-button">${icon("share", 16)} Rights card</button></div></div>
 <div class="address-workspace"><aside class="address-overview"><div class="panel layer-panel"><div class="panel-head"><h3>The jurisdiction layers</h3>${icon("layers")}</div>${renderLayers(a, rows)}<div class="layer-caption">${a.geography?.legal_city ? "Legal city from the recorded geographic match." : "Legal city not verified; the postal label is not a substitute."} The corpus defines state and city rules.</div></div><div class="panel facts-panel"><div class="panel-head"><h3>What the record tells us</h3><span class="status-pill neutral">Source data</span></div><div class="facts-list"><div><span>Year built</span><strong>${a.year_built ?? "Not supplied"}</strong></div><div><span>Units</span><strong>${a.units ?? "Not supplied"}</strong></div><div><span>Occupancy certificate</span><strong>Not supplied</strong></div><div><span>Ownership details</span><strong>Not supplied</strong></div></div><p class="fact-provenance">${h(a.source_dataset)}<br>Retrieved ${h(a.retrieved_at)}</p></div></aside>
 <section class="address-rules"><div class="section-title"><h3>The rules at this address</h3><span class="meta">${rows.length} records · ${asOf}</span></div>${rows.length ? rows.map((r) => `<button class="rule-card ${r.team_rule_id === ruleId ? "selected" : ""}" data-rule="${h(r.team_rule_id)}"><div class="rule-card-top"><span class="eyebrow">${h(catName(r.rule.category))}</span><span class="status-pill ${r.result === "unknown" ? "amber" : r.result === "applies" ? "" : "neutral"}">${labels[r.result]}</span></div><h3>${h(r.rule.title)}</h3><p>${h(r.rule.requirement)}</p><div class="rule-card-bottom"><span>${h(r.rule.jurisdiction)}</span><span>${h(r.rule.citation)}</span></div>${r.conflict_flag ? '<span class="conflict-label">Possible interaction · review required</span>' : ""}</button>`).join("") : '<div class="panel empty-list">No source-supported rules are loaded for this address yet. This is not a finding that the address has no protections.</div>'}</section>
 <aside class="panel reasoning-panel"><div class="panel-head"><h3>The reasoning</h3>${icon("document")}</div><div class="evidence-body">${reasoning}</div></aside></div>`;
}
function renderBuildingList() {
  let list = (query ? catalog.addresses : scope()).filter((a) =>
    `${a.street_address} ${a.postal_city} ${a.state} ${a.address_id}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    list
      .slice(0, 100)
      .map(
        (a) =>
          `<button class="building-row ${a.address_id === addressId ? "selected" : ""}" data-address="${a.address_id}"><div class="street">${h(a.street_address.toLowerCase())}</div><div class="city">${h(cityLabel(a))}, ${a.state} · ${h(a.zip)}</div><span class="chevron" aria-hidden="true">›</span></button>`,
      )
      .join("") ||
    '<p class="empty-list">No sample addresses match your search.</p>'
  );
}
function renderCondition(node, facts) {
  const evaluated = evaluateCondition(node, facts),
    state =
      evaluated.value === null ? "missing" : evaluated.value ? "met" : "unmet",
    label = { missing: "Needs evidence", met: "Met", unmet: "Not met" }[state];
  if (typeof node === "boolean")
    return `<p>${node ? "No additional condition." : "Condition excluded."}</p>`;
  const children = node.all || node.any || (node.not ? [node.not] : null);
  if (children) {
    if (!children.length)
      return "<p>No additional building condition in this extracted rule.</p>";
    return `<div class="condition-group"><div class="condition-group-heading"><span>${node.all ? "All of these" : node.any ? "Any of these" : "The following must be false"}</span><span class="condition-state ${state}">${label}</span></div>${children.map((n) => renderCondition(n, facts)).join("")}</div>`;
  }
  const dateComparison = validDate(node.value);
  const op = {
    eq: "equals",
    neq: "does not equal",
    lt: dateComparison ? "before" : "less than",
    lte: dateComparison ? "on or before" : "at most",
    gt: dateComparison ? "after" : "more than",
    gte: dateComparison ? "on or after" : "at least",
    in: "is one of",
    exists: "is known",
  }[node.op];
  const value = facts[node.field];
  return `<div class="condition-leaf"><span class="condition-status-dot ${state}" aria-label="${label}"></span><div><strong>${h(FACTS[node.field] || node.field)}</strong><span>${value == null ? "Not supplied" : h(value)} · ${h(op)} ${node.op === "exists" ? "" : h(Array.isArray(node.value) ? node.value.join(", ") : node.value)}</span></div></div>`;
}
function renderEvidence(a) {
  if (!a) return "<p>No address selected.</p>";
  const rows = evaluations(a).filter(
    (r) => r.result !== "not_applicable" || r.team_rule_id === ruleId,
  );
  const row =
    rows.find((r) => r.team_rule_id === ruleId) ||
    rows.find(
      (r) =>
        r.result === "unknown" &&
        r.missing.includes("certificate_of_occupancy"),
    ) ||
    rows[0];
  ruleId = row?.team_rule_id || null;
  const c = selectedCase(),
    source = catalog.sources.find(
      (s) => c.sources.includes(s.doc_id) && s.available,
    );
  let out = `<span class="status-pill ${row?.result === "unknown" ? "amber" : "neutral"}">${row ? labels[row.result] : "Awaiting extracted rules"}</span><h3>${h(a.street_address.toLowerCase())}</h3><p class="small muted">${h(cityLabel(a))}, ${a.state} ${h(a.zip)}</p><div class="fact-row"><span>Built <strong>${a.year_built ?? "Unknown"}</strong></span><span>Units <strong>${a.units ?? "Unknown"}</strong></span><span>City <strong>${a.geography?.legal_city ? "Matched" : "Unverified"}</strong></span></div>`;
  if (!row) {
    return (
      out +
      `<div class="reason-step"><span class="step-number">1</span><div><h4>Start with the original source</h4><p>${source ? "The supplied source is available to inspect. A matching quotation alone does not verify a legal interpretation." : "Some local documents are links only. Missing text stays visible as a coverage gap."}</p>${
        source
          ? `<div class="quote">${h(
              source.text
                .split("\n")
                .filter((x) => x.trim())
                .slice(0, 3)
                .join("\n")
                .slice(0, 260),
            )}</div><button class="text-button" data-source="${source.doc_id}">Read ${source.doc_id}</button>`
          : ""
      }</div></div><div class="reason-step"><span class="step-number">2</span><div><h4>Compile and check the interpretation</h4><p>The extraction pipeline will produce executable conditions with exact source spans. No applicability claim is made until a rule pack is loaded.</p></div></div><div class="reason-step"><span class="step-number">3</span><div><h4>Resolve only what the facts support</h4><p>${a.geography?.legal_city ? "The legal city is grounded in a geographic match." : "The postal city has not been accepted as the legal jurisdiction."} Missing owner and occupancy information remains unknown.</p></div></div>`
    );
  }
  if (rows.length > 1)
    out += `<select class="rule-select" id="rule-select" aria-label="Select applicable rule">${rows.map((r) => `<option value="${h(r.team_rule_id)}" ${r.team_rule_id === ruleId ? "selected" : ""}>${h(r.rule.title)} — ${labels[r.result]}</option>`).join("")}</select>`;
  out += `<div class="reason-step"><span class="step-number">1</span><div><h4>${h(row.rule.title)}</h4><p>${h(row.rule.requirement)}</p><div class="quote">“${h(row.rule.quoted_span)}”</div><button class="text-button" data-source="${h(row.rule.source_doc_id)}">${h(row.rule.citation)} · View source</button></div></div>`;
  out += `<div class="reason-step"><span class="step-number">2</span><div><h4>Coverage against this building</h4>${row.missing.includes("legal jurisdiction") ? "<p>The legal city must be established before local coverage can be evaluated.</p>" : renderCondition(row.rule.coverage_conditions, factsFor(a, evidenceValues(a), asOf))}</div></div>`;
  out += `<div class="reason-step"><span class="step-number">3</span><div><h4>${labels[row.result]} · ${displayDate(asOf)}</h4><p>${h(row.explanation)}</p>${row.conflict_flag ? "<p><strong>Possible interaction with another rule. Human review required.</strong></p>" : ""}${row.missing.length ? `<div class="quote">Needs: ${row.missing.map((f) => h(FACTS[f] || f)).join(", ")}</div>` : ""}</div></div>`;
  const editable = row.missing.filter((f) => FACTS[f]);
  if (editable.length)
    out += `<div class="evidence-actions"><button class="button button-dark" id="add-evidence">What would clarify this?</button></div>`;
  if (Object.keys(overrides[a.address_id] ?? {}).length)
    out += `<p class="rule-pack-state">LOCAL OVERLAY · Simulation or unverified evidence. Original data preserved.</p><button class="text-button" id="reset-evidence">Restore supplied facts</button>`;
  return out;
}
function renderSources() {
  return `<div class="page-heading"><div><span class="eyebrow">THE SOURCE COLLECTION</span><h1>Every answer has a source.</h1><p class="muted" style="margin-top:16px">${catalog.stats.availableTexts} available texts from ${catalog.stats.sourceRecords} source records. Gaps are part of the record.</p></div><button class="button" id="download-sources">Export manifest</button></div><div class="table-scroll"><table class="source-table"><thead><tr><th>DOCUMENT</th><th>JURISDICTION</th><th>ORIGINAL SOURCE</th><th>AVAILABILITY</th><th></th></tr></thead><tbody>${catalog.sources.map((s) => `<tr><td>${h(s.doc_id)}</td><td>${h(s.jurisdictions)}</td><td class="source-url">${h(s.url)}</td><td><span class="status-pill ${s.available ? "" : "neutral"}">${s.available ? "Text available" : s.capture === "yes" ? "Text unavailable" : "Link only"}</span></td><td><button class="text-button" data-source="${h(s.doc_id)}">Inspect</button></td></tr>`).join("")}</tbody></table></div>`;
}
function checkedExtractionRun(value) {
  const count = (v) => {
    const n = Array.isArray(v) ? v.length : v;
    if (!Number.isSafeInteger(n) || n < 0) throw Error("Invalid run count.");
    return n;
  };
  const validStatuses = ["completed_machine_validation", "completed_with_review_items"];
  if (!value || !validStatuses.includes(value.status) ||
      typeof value.model !== "string" || !value.model.trim() ||
      !Array.isArray(value.sources) || !value.sources.length ||
      !Array.isArray(value.limitations) || value.limitations.some((s) => typeof s !== "string") ||
      typeof value.duration_seconds !== "number" || !Number.isFinite(value.duration_seconds) || value.duration_seconds < 0)
    throw Error("Incomplete extraction run record.");
  const started = Date.parse(value.started_at), finished = Date.parse(value.finished_at);
  if (typeof value.started_at !== "string" || typeof value.finished_at !== "string" ||
      !Number.isFinite(started) || !Number.isFinite(finished) || finished < started)
    throw Error("Invalid run timestamps.");
  const accepted = count(value.accepted_rule_count), requests = count(value.requests_sent);
  const sources = value.sources.map((source) => {
    if (!source || typeof source.source_doc_id !== "string" || !source.source_doc_id ||
        typeof source.source_sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(source.source_sha256) ||
        !["validated_candidates", "cache_hit", "failed_requires_review"].includes(source.status))
      throw Error("Invalid source provenance.");
    const acceptedRules = count(source.accepted_rules), issueCount = count(source.review_issues);
    if (source.status === "failed_requires_review" && acceptedRules !== 0)
      throw Error("A failed source cannot claim accepted candidates.");
    return { ...source, acceptedRules, issueCount };
  });
  if (new Set(sources.map((s) => s.source_doc_id)).size !== sources.length ||
      sources.reduce((sum, source) => sum + source.acceptedRules, 0) !== accepted)
    throw Error("Run totals do not reconcile.");
  const hasFailedSources = sources.some((s) => s.status === "failed_requires_review");
  const hasReviewItems = hasFailedSources || sources.some((s) => s.issueCount > 0);
  if (value.status === "completed_machine_validation" && hasReviewItems)
    throw Error("Run status contradicts its source results.");
  // Downloads stay inside this project's data directory. No URL from a run
  // record may send a visitor to an external origin or execute script content.
  let candidateUrl = null;
  if (typeof value.candidate_pack_url === "string") {
    const url = new URL(value.candidate_pack_url, location.href);
    const expected = new URL("./data/extraction-candidates.json", location.href);
    if (url.origin === expected.origin && url.pathname === expected.pathname && !url.hash)
      candidateUrl = expected.href;
  }
  return { ...value, sources, accepted, requests, hasFailedSources, hasReviewItems, candidateUrl };
}
async function loadExtractionRun() {
  extractionRunState = "loading";
  try {
    const response = await fetch("./data/extraction-run.json");
    if (response.status === 404) {
      extractionRunState = "absent";
      return;
    }
    if (!response.ok) throw Error("The saved extraction run is unavailable.");
    extractionRun = checkedExtractionRun(await response.json());
    extractionRunState = "ready";
  } catch {
    extractionRun = null;
    extractionRunState = "unavailable";
  }
  if (view === "integrity") render();
}
function renderExtractionRun() {
  if (extractionRunState === "unavailable")
    return `<aside class="extraction-run-unavailable" role="status">${icon("document", 18)}<div><strong>Extraction record unavailable</strong><p>The separate run record could not be loaded or its totals could not be verified. No run result is claimed.</p></div></aside>`;
  if (!extractionRun) return "";
  const run = extractionRun;
  const failed = run.sources.every((s) => s.status === "failed_requires_review");
  const review = run.status === "completed_with_review_items" || run.hasReviewItems || run.accepted === 0;
  const state = failed ? "failed" : review ? "review" : "validated";
  const status = failed ? "Extraction failed" : run.hasFailedSources ? "Completed with failed sources" : review ? "Review items remain" : "Machine checks complete";
  const seconds = run.duration_seconds;
  const duration = seconds < 60 ? `${Number(seconds.toFixed(1))}s` : `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
  const formatTime = (stamp) => new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "medium", timeZone: "UTC",
  }).format(new Date(stamp)) + " UTC";
  const loadedPack = pack.method === "codex_assisted_extraction"
    ? `The ${pack.rules.length} Codex-assisted records loaded in this workspace remain a separate pack.`
    : `The ${pack.rules.length} records currently loaded in this workspace remain a separate pack.`;
  return `<section class="extraction-run-card" data-run-state="${state}" aria-labelledby="extraction-run-heading">
    <div class="extraction-run-heading"><div><span class="eyebrow">AUTOMATIC EXTRACTION</span><h3 id="extraction-run-heading">A run you can inspect.</h3></div><span class="extraction-run-status">${icon(failed ? "close" : review ? "document" : "check", 15)}${status}</span></div>
    <p class="extraction-run-context">${loadedPack} Any candidates from this recorded compiler run require review before they can replace the loaded records.</p>
    <ol class="extraction-run-flow" aria-label="Recorded extraction workflow"><li><span class="extraction-flow-number">01</span><strong>Source</strong><span>${run.sources.length} recorded ${run.sources.length === 1 ? "input" : "inputs"}</span></li><li><span class="extraction-flow-number">02</span><strong>Model</strong><span>${h(run.model)}</span></li><li><span class="extraction-flow-number">03</span><strong>Validate</strong><span>Machine checks</span></li><li><span class="extraction-flow-number">04</span><strong>Review</strong><span>Human review required</span></li></ol>
    <div class="extraction-run-metrics"><div><strong>${run.accepted}</strong><span>${run.accepted === 1 ? "candidate passed checks" : "candidates passed checks"}</span></div><div><strong>${run.requests}</strong><span>model requests sent</span></div><div><strong>${duration}</strong><span>recorded runtime</span></div></div>
    <details class="extraction-run-provenance"><summary>Sources and run details<span>${run.sources.length} ${run.sources.length === 1 ? "source" : "sources"}</span></summary><dl class="extraction-run-times"><div><dt>Started</dt><dd>${h(formatTime(run.started_at))}</dd></div><div><dt>Finished</dt><dd>${h(formatTime(run.finished_at))}</dd></div></dl><div class="extraction-run-sources">${run.sources.map((source) => {
      const label = source.status === "failed_requires_review" ? "Failed · review required" : source.acceptedRules === 0 ? "Review only" : source.status === "cache_hit" ? "Cached result" : "Candidates validated";
      const canOpen = catalog.sources.some((s) => s.doc_id === source.source_doc_id);
      return `<div class="extraction-run-source" data-source-status="${source.status}"><div>${canOpen ? `<button class="text-button" data-source="${h(source.source_doc_id)}">${h(source.source_doc_id)} ${icon("document", 13)}</button>` : `<strong>${h(source.source_doc_id)}</strong>`}<span>${label}</span></div><p>${source.acceptedRules} ${source.acceptedRules === 1 ? "candidate" : "candidates"} passed checks${source.issueCount ? ` · ${source.issueCount} review ${source.issueCount === 1 ? "issue" : "issues"}` : ""}</p><code title="Source SHA-256">${h(source.source_sha256)}</code></div>`;
    }).join("")}</div></details>
    ${run.limitations.length ? `<ul class="extraction-run-limitations">${run.limitations.map((item) => `<li>${h(item)}</li>`).join("")}</ul>` : ""}
    <div class="extraction-run-footer"><span>Source matches and machine checks do not establish legal correctness.</span>${run.candidateUrl && run.accepted > 0 ? `<a class="button extraction-run-download" href="${h(run.candidateUrl)}" download="extraction-candidates.json">${icon("download", 15)}Download candidates</a>` : ""}</div>
  </section>`;
}
function renderIntegrity() {
  return `<div class="page-heading"><div><span class="eyebrow">BUILT TO BE CHECKED</span><h1>Confidence needs evidence.</h1><p class="muted" style="margin-top:16px">What has been processed, what has been checked, and what remains unresolved.</p></div></div><div class="integrity-cards"><div class="integrity-card"><span class="eyebrow">EXTRACTED RULES</span><strong>${pack.rules.length}</strong><p>${pack.rules.length ? "Loaded rules passed source-span and structural checks. This does not establish legal correctness." : "Extraction has not run. No benchmark score or rule coverage is claimed."}</p></div><div class="integrity-card"><span class="eyebrow">SOURCE TEXTS</span><strong>${catalog.stats.availableTexts}<span class="muted" style="font-size:20px"> / ${catalog.stats.sourceRecords}</span></strong><p>Available text, as distinct from link-only or unavailable sources.</p></div><div class="integrity-card"><span class="eyebrow">LEGAL CITY MATCHES</span><strong>${catalog.stats.geocoded}<span class="muted" style="font-size:20px"> / 500</span></strong><p>Postal labels are not automatically treated as legal city boundaries.</p></div></div><div class="integrity-content">${renderExtractionRun()}${report ? `<h3>Checks on this build</h3><div class="validation-list">${report.checks.map((c) => `<div class="validation-row"><span>${h(c)}</span><strong>Passed</strong></div>`).join("")}</div><p>${report.primary_quotes + report.supplemental_quotes} exact quotations checked. These checks establish source presence and structure, not independent legal validation.</p>` : ""}<h3>Official scoring</h3><p>${catalog.organizerScoringAvailable ? "An organizer scoring file is present. Results must be generated and inspected before being reported." : "The downloaded participant package contains no score.py or development answer key. We cannot report an official score. Internal tests are separate from organizer evaluation."}</p><h3>What a source match establishes</h3><p>The quoted passage occurs in the supplied document. Whether it supports the interpretation is a separate question. Reproducible execution does not make an incorrect interpretation correct.</p><h3>Changes and local evidence</h3><p>Time comparisons use the supplied building facts, not reconstructed historical building records. Evidence you add is stored only in this browser and excluded from the unmodified sample export.</p><h3>Known gaps</h3><p>Ownership, some construction years, unit counts and certificate-of-occupancy dates are not included for all buildings. A possible conflict is flagged for review rather than silently resolved.</p><div class="evidence-actions"><button class="button" id="download-audit">Export extraction audit</button><button class="button" id="download-changes">Export change cases</button><button class="button" id="download-lookups" ${pack.rules.length ? "" : "disabled"}>Export sample lookups</button></div></div>`;
}
function openSource(id) {
  const s = catalog.sources.find((s) => s.doc_id === id);
  if (!s) return;
  const rule =
      pack.rules.find(
        (r) => r.team_rule_id === ruleId && r.source_doc_id === id,
      ) || pack.rules.find((r) => r.source_doc_id === id),
    quote = rule?.quoted_span;
  let sourceHTML = h(s.text || "");
  if (quote && s.text?.includes(quote))
    sourceHTML = sourceHTML.replace(h(quote), "<mark>" + h(quote) + "</mark>");
  $("#source-title").textContent = `${s.doc_id} · ${s.jurisdictions}`;
  $("#source-content").innerHTML =
    `<h2>${s.source_capture === "web_tool_text" ? "The captured source excerpt." : s.doc_id === "O001" ? "The organizer’s test case." : "The captured source text."}</h2><p class="muted">Retrieved ${h(s.retrieved_at || "date not supplied")} · ${h(s.source_type)}</p>${s.capture_scope ? `<p class="small muted">${h(s.capture_scope)}</p>` : ""}<p><a href="${h(/^https?:\/\//.test(s.url) ? s.url : "#")}" target="_blank" rel="noopener noreferrer">Open original source</a></p>${s.text ? `<pre>${sourceHTML}</pre>` : '<p class="notice">No usable text is available in the downloaded starter pack. This source has not been used to support an extracted rule.</p>'}<p class="small muted">Captured-text SHA-256: ${h(s.download_sha256 || "unavailable")}</p>`;
  $("#source-dialog").showModal();
  $("#source-content mark")?.scrollIntoView({ block: "center" });
}
function openSearch() {
  stopPlayback();
  $("#command-input").value = "";
  renderSearch("");
  $("#command-dialog").showModal();
  $("#command-input").focus();
}
function renderSearch(value) {
  const q = value.toLowerCase().trim();
  const addresses = catalog.addresses
    .filter((a) =>
      `${a.street_address} ${a.postal_city} ${a.geography?.legal_city || ""} ${a.address_id}`
        .toLowerCase()
        .includes(q),
    )
    .slice(0, 7);
  const rules = q
    ? pack.rules
        .filter((r) =>
          `${r.title} ${r.jurisdiction} ${r.citation}`
            .toLowerCase()
            .includes(q),
        )
        .slice(0, 4)
    : [];
  $("#command-results").innerHTML =
    `<div class="search-section-label">${q ? "ADDRESSES" : "EXPLORE THE SAMPLE"}</div>${addresses.map((a) => `<button class="search-result" data-search-address="${a.address_id}">${icon("home", 18)}<span><strong>${h(a.street_address.toLowerCase())}</strong><small>${h(cityLabel(a))}, ${a.state} · ${a.address_id}</small></span><span>↗</span></button>`).join("")}${rules.length ? '<div class="search-section-label">SOURCE-GROUNDED RULES</div>' : ""}${rules.map((r) => `<button class="search-result" data-search-source="${r.source_doc_id}">${icon("document", 18)}<span><strong>${h(r.title)}</strong><small>${h(r.citation)}</small></span><span>↗</span></button>`).join("")}${!addresses.length && !rules.length ? '<p class="empty-list">No matches in this source collection.</p>' : ""}`;
  document.querySelectorAll("[data-search-address]").forEach(
    (b) =>
      (b.onclick = () => {
        $("#command-dialog").close();
        selectAddress(b.dataset.searchAddress);
      }),
  );
  document.querySelectorAll("[data-search-source]").forEach(
    (b) =>
      (b.onclick = () => {
        $("#command-dialog").close();
        openSource(b.dataset.searchSource);
      }),
  );
}
function showRights() {
  const a = catalog.addresses.find((x) => x.address_id === addressId);
  if (!a) return;
  const es = rightsLang === "es",
    rows = evaluateAddress(pack.rules, a, asOf).filter(
      (r) => r.result !== "not_applicable",
    ),
    cats = [...new Set(rows.map((r) => r.rule.category))];
  const translated = {
    applies: "Se aplica",
    unknown: "Falta información",
    pending: "Propuesta pendiente",
    not_yet_effective: "Aún no vigente",
    superseded: "Sustituida",
  };
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("address", a.address_id);
  url.searchParams.set("date", asOf);
  url.searchParams.set("card", "1");
  url.searchParams.set("lang", rightsLang);
  $("#rights-content").innerHTML =
    `<div class="rights-toolbar"><p class="muted">${es ? "Un lugar. Sus reglas." : "One place. Its rules."}</p><div class="segmented"><button data-lang="en" class="${!es ? "selected" : ""}">EN</button><button data-lang="es" class="${es ? "selected" : ""}">ES</button></div></div><article class="rights-wallet"><div class="wallet-brand">${icon("layers", 25)} LawDiff <span>${es ? "TARJETA DE DERECHOS" : "RIGHTS CARD"}</span></div><h2>${h(a.street_address.toLowerCase())}</h2><p>${h(cityLabel(a))}, ${a.state}</p><div class="wallet-date">${es ? "Fecha de evaluación" : "Evaluated as of"} ${asOf}</div><div class="wallet-summary">${
      cats
        .map((c) => {
          const cr = rows.filter((r) => r.rule.category === c);
          const active = cr.filter((r) => r.result === "applies").length,
            missing = cr.filter((r) => r.result === "unknown").length;
          return `<div><span>${h(catName(c, rightsLang))}</span><strong>${active ? active + (es ? " aplicables" : " apply") : missing ? (es ? "Falta información" : "Needs evidence") : es ? "Consultar estado" : "See status"}</strong></div>`;
        })
        .join("") ||
      `<p>${es ? "No hay reglas respaldadas por fuentes cargadas." : "No source-supported rules loaded."}</p>`
    }</div><div class="wallet-bottom"><span>${a.address_id} · ${es ? "Datos originales" : "Original sample"}<br>${es ? "Prototipo de investigación · No es asesoría legal" : "Research prototype · Not legal advice"}</span><div id="rights-qr" aria-label="Link to this source-based card"></div></div></article><p class="small muted">${es ? "Las simulaciones y los datos locales no se incluyen. La traducción es asistida por IA; la fuente en inglés prevalece." : "Simulations and local evidence are excluded. AI-assisted translation; English source text controls."}</p><div class="rights-detail">${rows.map((r) => `<details><summary><span>${h(catName(r.rule.category, rightsLang))}</span><span class="small">${h(es ? translated[r.result] : labels[r.result])}</span></summary><p>${h(es ? r.rule.requirement_es || r.rule.requirement : r.rule.requirement)}</p><p class="small muted">${h(r.rule.citation)} · ${h(r.rule.title)}${es && !r.rule.requirement_es ? " · Texto fuente en inglés" : ""}</p></details>`).join("")}</div><div class="modal-actions"><button class="button" id="print-rights">${icon("document", 16)} ${es ? "Imprimir / PDF" : "Print / PDF"}</button><button class="button button-dark" id="copy-rights">${icon("share", 16)} ${es ? "Copiar enlace" : "Copy link"}</button></div>`;
  if (typeof qrcode === "function") {
    const qr = qrcode(0, "M");
    qr.addData(url.href);
    qr.make();
    $("#rights-qr").innerHTML = qr.createSvgTag({
      cellSize: 2,
      margin: 3,
      scalable: true,
    });
  }
  document.querySelectorAll("[data-lang]").forEach(
    (b) =>
      (b.onclick = () => {
        rightsLang = b.dataset.lang;
        showRights();
      }),
  );
  $("#print-rights").onclick = () => window.print();
  $("#copy-rights").onclick = async () => {
    try {
      await navigator.clipboard.writeText(url.href);
      toast(es ? "Enlace copiado." : "Link copied.");
    } catch {
      toast("Copy the address from your browser to share this view.");
    }
  };
  if (!$("#rights-dialog").open) $("#rights-dialog").showModal();
}
$("#command-button").onclick = openSearch;
$("#command-input").oninput = (e) => renderSearch(e.target.value);
$("#command-input").onkeydown = (e) => {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    $("#command-results button")?.focus();
  }
  if (e.key === "Enter") $("#command-results button")?.click();
};
$("#command-results").onkeydown = (e) => {
  if (!["ArrowDown", "ArrowUp"].includes(e.key)) return;
  e.preventDefault();
  const buttons = [...document.querySelectorAll("#command-results button")],
    i = buttons.indexOf(document.activeElement);
  buttons[
    (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length
  ]?.focus();
};
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("lawdiff-theme") || "light";
} catch {}
$("#theme-button").onclick = () => {
  const mode =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem("lawdiff-theme", mode);
  } catch {}
};
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    openSearch();
  }
  if (
    e.target.matches(".building-dot") &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
  ) {
    e.preventDefault();
    const buttons = [...document.querySelectorAll(".building-dot")],
      i = buttons.indexOf(e.target),
      delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 }[
        e.key
      ];
    const next = buttons[Math.max(0, Math.min(buttons.length - 1, i + delta))];
    e.target.tabIndex = -1;
    next.tabIndex = 0;
    next.focus();
  }
});
function updateTimeline(value) {
  if (!validDate(value)) return;
  asOf = value;
  const template = document.createElement("template");
  template.innerHTML = renderChanges();
  const target = template.content;
  document.querySelectorAll(".building-dot").forEach((b) => {
    b.className =
      "building-dot " +
      statusFor(
        catalog.addresses.find((a) => a.address_id === b.dataset.address),
      ) +
      (b.dataset.address === addressId ? " selected" : "");
  });
  for (const selector of [".impact-inspector", ".context-tag"]) {
    const current = $(selector),
      next = target.querySelector(selector);
    if (current && next) current.replaceWith(next);
  }
  $("#timeline-date").textContent = displayDate(asOf);
  $("#as-of").value = asOf;
  $("#time-scrubber").value = Math.round(
    (new Date(asOf + "T12:00Z") - new Date("2024-01-01T12:00Z")) / 86400000,
  );
  document
    .querySelectorAll("[data-source]")
    .forEach((b) => (b.onclick = () => openSource(b.dataset.source)));
  if ($("#inspect-address"))
    $("#inspect-address").onclick = () => {
      addressId = scope()[0]?.address_id;
      activateView("address");
    };
}
function stopPlayback() {
  if (playTimer) {
    clearInterval(playTimer);
    playTimer = null;
  }
}
function bindContent() {
  document
    .querySelectorAll("[data-view-link]")
    .forEach((b) => (b.onclick = () => activateView(b.dataset.viewLink)));
  document.querySelectorAll("[data-rule]").forEach(
    (b) =>
      (b.onclick = () => {
        ruleId = b.dataset.rule;
        render();
      }),
  );
  if ($("#inspect-address"))
    $("#inspect-address").onclick = () => {
      addressId = scope()[0]?.address_id;
      activateView("address");
    };
  if ($("#find-address")) $("#find-address").onclick = openSearch;
  if ($("#rights-button")) $("#rights-button").onclick = () => showRights();
  if ($("#time-scrubber"))
    $("#time-scrubber").oninput = (e) => {
      stopPlayback();
      updateTimeline(
        new Date(Date.UTC(2024, 0, 1 + Number(e.target.value), 12))
          .toISOString()
          .slice(0, 10),
      );
    };
  if ($("#play-timeline"))
    $("#play-timeline").onclick = () => {
      if (playTimer) {
        stopPlayback();
        $("#play-timeline").innerHTML = icon("play", 16);
        return;
      }
      let day = Math.max(
        0,
        Math.round(
          (new Date((selectedCase().as_of_before || "2026-10-01") + "T12:00Z") -
            new Date("2024-01-01T12:00Z")) /
            86400000,
        ) - 45,
      );
      const finish =
        Math.round(
          (new Date(selectedCase().date + "T12:00Z") -
            new Date("2024-01-01T12:00Z")) /
            86400000,
        ) + 30;
      playTimer = setInterval(() => {
        day += 7;
        updateTimeline(
          new Date(Date.UTC(2024, 0, 1 + day, 12)).toISOString().slice(0, 10),
        );
        if ($("#play-timeline"))
          $("#play-timeline").innerHTML = icon("pause", 16);
        if (day >= finish) {
          stopPlayback();
          if ($("#play-timeline"))
            $("#play-timeline").innerHTML = icon("play", 16);
        }
      }, 90);
    };

  document
    .querySelectorAll("[data-case]")
    .forEach((b) => (b.onclick = () => selectCase(b.dataset.case)));
  document
    .querySelectorAll("[data-address]")
    .forEach((b) => (b.onclick = () => selectAddress(b.dataset.address)));
  document
    .querySelectorAll("[data-source]")
    .forEach((b) => (b.onclick = () => openSource(b.dataset.source)));
  document.querySelectorAll("[data-date]").forEach(
    (b) =>
      (b.onclick = () => {
        stopPlayback();
        updateTimeline(b.dataset.date);
      }),
  );
  if ($("#as-of"))
    $("#as-of").onchange = (e) => {
      if (e.target.validity.valid && e.target.value) {
        updateTimeline(e.target.value);
      }
    };
  if ($("#address-search"))
    $("#address-search").oninput = (e) => {
      query = e.target.value;
      $("#building-list").innerHTML = renderBuildingList();
      document
        .querySelectorAll("#building-list [data-address]")
        .forEach((b) => (b.onclick = () => selectAddress(b.dataset.address)));
    };
  if ($("#rule-select"))
    $("#rule-select").onchange = (e) => {
      ruleId = e.target.value;
      render();
    };
  if ($("#add-evidence"))
    $("#add-evidence").onclick = () => {
      const a = catalog.addresses.find((a) => a.address_id === addressId);
      const row = evaluations(a).find((r) => r.team_rule_id === ruleId);
      $("#evidence-context").textContent =
        `${a.street_address} · ${row.rule.title}`;
      $("#evidence-field").innerHTML = row.missing
        .filter((f) => FACTS[f])
        .map((f) => `<option value="${h(f)}">${h(FACTS[f])}</option>`)
        .join("");
      $("#evidence-value").value = "";
      $("#evidence-reference").value =
        "Hypothetical assumption for this simulation";
      $("#evidence-mode").value = "simulation";
      $("#evidence-dialog").showModal();
    };
  if ($("#reset-evidence"))
    $("#reset-evidence").onclick = () => {
      delete overrides[addressId];
      saveEvidence();
      render();
      toast("Restored the supplied building facts.");
    };
  if ($("#download-sources"))
    $("#download-sources").onclick = () =>
      download(
        "source-manifest.json",
        catalog.sources.map(({ text, ...s }) => s),
      );
  if ($("#download-audit"))
    $("#download-audit").onclick = () =>
      download("extraction-audit.json", pack.audit || []);
  if ($("#download-lookups"))
    $("#download-lookups").onclick = () =>
      download("lookups.json", lookupsFor(catalog, pack, asOf));
  if ($("#download-changes"))
    $("#download-changes").onclick = () =>
      download("changes.json", changesFor(catalog, pack));
}
function saveEvidence() {
  try {
    localStorage.setItem("lawdiff-evidence-v1", JSON.stringify(overrides));
  } catch {
    toast(
      "Browser storage unavailable. Evidence applies to this session only.",
    );
  }
}
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => activateView(b.dataset.view)));
document
  .querySelectorAll("[data-close]")
  .forEach(
    (b) => (b.onclick = () => document.getElementById(b.dataset.close).close()),
  );
$("#import-button").onclick = () => $("#import-dialog").showModal();
$("#download-pack").onclick = () => download("lawdiff-rule-pack.json", pack);
$("#pack-file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 10_000_000) throw Error("Rule pack exceeds 10 MB.");
    const candidate = JSON.parse(await file.text());
    validateRulePack(candidate, catalog.sources);
    pack = candidate;
    ruleId = null;
    $("#import-status").textContent =
      `Loaded ${pack.rules.length} source-checked rules. Legal interpretation remains subject to review.`;
    render();
    toast("Rule pack loaded. Results recalculated.");
  } catch (err) {
    $("#import-status").textContent = err.message;
  }
};
$("#evidence-form").onsubmit = (e) => {
  e.preventDefault();
  const field = $("#evidence-field").value;
  let value = $("#evidence-value").value.trim();
  const ref = $("#evidence-reference").value.trim();
  if (!FACTS[field] || !ref) return;
  if (
    [
      "units",
      "year_built",
      "owner_total_units",
      "owner_property_count",
      "tenant_months",
      "all_tenants_months",
      "certificate_age_years",
    ].includes(field)
  ) {
    value = Number(value);
    if (
      !Number.isInteger(value) ||
      value < 0 ||
      $("#evidence-value").value.trim() === ""
    ) {
      toast("Enter a non-negative whole number.");
      return;
    }
  } else if (!["certificate_of_occupancy", "owner_type"].includes(field)) {
    if (!["true", "false", "yes", "no"].includes(value.toLowerCase())) {
      toast("Enter yes or no.");
      return;
    }
    value = ["true", "yes"].includes(value.toLowerCase());
  } else if (field === "certificate_of_occupancy" && !validDate(value)) {
    toast("Use YYYY-MM-DD for the occupancy date.");
    return;
  }
  overrides[addressId] ??= {};
  overrides[addressId][field] = {
    value,
    reference: ref,
    entered_at: new Date().toISOString(),
    mode: $("#evidence-mode").value,
    verified: false,
  };
  saveEvidence();
  $("#evidence-dialog").close();
  render();
  toast("Evidence applied. The answer has been recalculated.");
};
try {
  [catalog, pack] = await Promise.all(
    ["./data/catalog.json", "./data/rule-pack.json"].map(async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw Error("The source collection could not be loaded.");
      return r.json();
    }),
  );
  validateRulePack(pack, catalog.sources);
  const params = new URLSearchParams(location.search);
  addressId = catalog.addresses.some(
    (a) => a.address_id === params.get("address"),
  )
    ? params.get("address")
    : scope()[0]?.address_id;
  if (params.has("address")) view = "address";
  if (validDate(params.get("date"))) asOf = params.get("date");
  rightsLang = params.get("lang") === "es" ? "es" : "en";
  render();
  if (params.get("card") === "1") showRights();
  fetch("./data/validation.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((r) => {
      report = r;
      if (view === "integrity") render();
    })
    .catch(() => {});
  const api = {
    getState: () => ({
      view,
      caseId,
      asOf,
      addressId,
      rules: pack.rules.length,
    }),
    selectCase,
    selectAddress,
  };
  window.lawdiff = api;
  if (document.modelContext?.registerTool) {
    for (const t of [
      {
        name: "inspect_lawdiff_state",
        description:
          "Read the current LawDiff view, date and selected address.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => api.getState(),
      },
      {
        name: "select_lawdiff_change",
        description:
          "Select one of the five supplied change cases in the visible workspace.",
        inputSchema: {
          type: "object",
          properties: {
            case_id: { type: "string", enum: ["T1", "T2", "T3", "T4", "T5"] },
          },
          required: ["case_id"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input) => {
          selectCase(input.case_id);
          return api.getState();
        },
      },
    ]) {
      try {
        await document.modelContext.registerTool(t);
      } catch {}
    }
  }
} catch (err) {
  $("#workspace").innerHTML =
    `<div class="initial-state"><h2>We could not open this collection.</h2><p class="muted">${h(err.message)}</p><button class="button" id="retry-load">Try again</button></div>`;
  $("#retry-load").onclick = () => location.reload();
}
