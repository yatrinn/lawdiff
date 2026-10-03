import { escapeHTML as h } from "./engine.mjs";
export const icon = (name, size = 18) => {
  const paths = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    document: '<path d="M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8M8 16h6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    play: '<path d="m9 5 11 7-11 7V5Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
    share: '<path d="M12 15V3m-4 4 4-4 4 4M6 10H4v11h16V10h-2"/>',
    home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/>',
    shield:
      '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.document}</svg>`;
};
function collection(a) {
  const s = a.source_dataset;
  if (s.includes("LA County")) return "Los Angeles";
  if (s.includes("DataSF")) return "San Francisco";
  if (s.includes("SANDAG")) return "San Diego";
  if (s.includes("Alameda")) return "Berkeley";
  if (s.includes("Boston")) return "Boston";
  if (s.includes("Cambridge")) return "Cambridge";
  return a.postal_city;
}
export function renderField(catalog, statusFor, selected) {
  const order = [
    "Los Angeles",
    "San Francisco",
    "San Diego",
    "Berkeley",
    "Jersey City",
    "Hoboken",
    "Newark",
    "Boston",
    "Cambridge",
  ];
  const groups = Object.groupBy(catalog.addresses, collection);
  const stateNames = {
    CA: "California",
    NJ: "New Jersey",
    MA: "Massachusetts",
  };
  return `<div class="building-field">${order
    .filter((c) => groups[c])
    .map((city, i) => {
      const rows = groups[city];
      return `<section class="city-cluster" style="--cluster:${i}" aria-label="${h(city)} sample collection"><div class="cluster-title"><span>${h(city)}</span><span>${rows.length}</span></div><div class="cluster-dots">${rows
        .map((a) => {
          const status = statusFor(a);
          return `<button class="building-dot ${status} ${a.address_id === selected ? "selected" : ""}" data-address="${a.address_id}" tabindex="${a.address_id === selected ? "0" : "-1"}" aria-label="${h(a.street_address)}, ${h(city)}; ${h(status.replaceAll("_", " "))}" title="${h(a.street_address)} · ${h(status.replaceAll("_", " "))}"></button>`;
        })
        .join(
          "",
        )}</div><span class="cluster-state">${stateNames[rows[0].state]}</span></section>`;
    })
    .join("")}</div>`;
}
export function renderLayers(address, rows) {
  const city = address.geography?.legal_city;
  const states = { CA: "California", NJ: "New Jersey", MA: "Massachusetts" };
  const county = address.geography?.county;
  const items = [
    {
      kind: "State",
      name: states[address.state],
      count: rows.filter(
        (r) => r.rule.level === "state" && r.result !== "not_applicable",
      ).length,
    },
    { kind: "County", name: county || "Not verified", count: 0 },
    {
      kind: "City",
      name: city || "Not verified",
      count: rows.filter(
        (r) => r.rule.level === "city" && r.result !== "not_applicable",
      ).length,
    },
  ];
  return `<div class="layers-visual" aria-label="Jurisdiction layers"><div class="layer-planes">${items.map((x, i) => `<div class="law-plane plane-${i}" style="--plane:${i}"><div class="plane-label">${icon("layers", 15)}<span>${x.kind}</span><strong>${h(x.name)}</strong></div><span class="plane-count">${x.count ? x.count + " rules" : x.kind === "County" ? "No county rules in this corpus" : city ? "No loaded city rules" : "Jurisdiction unresolved"}</span></div>`).join("")}</div></div>`;
}
export function catName(cat, lang = "en") {
  const cats = {
    rent_increase_limits: ["Rent increases", "Aumentos del alquiler"],
    just_cause_eviction: [
      "Eviction protections",
      "Protecciones contra el desalojo",
    ],
    security_deposits: ["Security deposits", "Depósitos de garantía"],
    application_screening_fees: ["Application fees", "Tarifas de solicitud"],
    screening_restrictions: ["Tenant screening", "Evaluación de inquilinos"],
    algorithmic_rent_setting: ["Algorithmic pricing", "Precios algorítmicos"],
  };
  return cats[cat]?.[lang === "es" ? 1 : 0] || cat;
}
