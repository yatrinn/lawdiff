import { readFile, writeFile, mkdir, cp, rm, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateRulePack } from "../public/engine.mjs";
const root = new URL("../", import.meta.url),
  read = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const catalog = await read("public/data/catalog.json"),
  pack = await read("public/data/rule-pack.json");
validateRulePack(pack, catalog.sources);
if (catalog.addresses.length !== 500)
  throw Error("Expected supplied 500-address sample.");
const ids = new Set(catalog.addresses.map((a) => a.address_id));
if (ids.size !== 500) throw Error("Duplicate address.");
let extra = 0;
for (const r of pack.rules)
  extra +=
    (r.source_evidence?.length || 0) +
    (r.additional_evidence?.length || 0) +
    (r.relation_evidence?.length || 0);
const report = {
  generated_at: new Date().toISOString(),
  rules: pack.rules.length,
  primary_quotes: pack.rules.length,
  supplemental_quotes: extra,
  addresses: 500,
  geocoded: catalog.stats.geocoded,
  source_texts: catalog.stats.availableTexts,
  official_score: null,
  legal_review: false,
  pack_sha256: createHash("sha256").update(JSON.stringify(pack)).digest("hex"),
  checks: [
    "Rule structure and executable conditions",
    "Primary and supplementary exact source spans",
    "Real calendar dates",
    "Unique address and rule identifiers",
    "Referenced rule identifiers",
  ],
};
await writeFile(
  new URL("public/data/validation.json", root),
  JSON.stringify(report, null, 2),
);
await rm(new URL("dist/", root), { recursive: true, force: true });
await mkdir(new URL("dist/", root));
await cp(new URL("public/", root), new URL("dist/", root), { recursive: true });
// One revision across the module graph and data prevents a stale cached file
// from being combined with the next published version.
const browserFiles = [
  "app.mjs", "engine.mjs", "exporter.mjs", "visuals.mjs", "styles.css",
  "vendor/qrcode.js", "data/catalog.json", "data/rule-pack.json", "data/validation.json",
  "data/extraction-run.json", "data/extraction-candidates.json",
];
const revisionHash = createHash("sha256");
for (const file of browserFiles) revisionHash.update(await readFile(new URL(`dist/${file}`, root)));
const revision = revisionHash.digest("hex").slice(0, 16);
for (const file of ["index.html", "app.mjs", "engine.mjs", "exporter.mjs", "visuals.mjs"]) {
  const target = new URL(`dist/${file}`, root);
  const content = await readFile(target, "utf8");
  const versioned = content.replace(/(["'])\.\/((?:data\/|vendor\/)?[\w-]+\.(?:mjs|js|css|json))\1/g,
    (match, quote, asset) => browserFiles.includes(asset) ? `${quote}./${asset}?v=${revision}${quote}` : match);
  await writeFile(target, versioned);
}
for (const file of [
  "media/lawdiff-demo.mp4",
  "media/lawdiff-tech.mp4",
  "presentation/lawdiff-pitch.pdf",
  "presentation/lawdiff-pitch.pptx",
  "submission/method-note.pdf",
]) {
  const source = new URL(file, root);
  try { await access(source); } catch { continue; }
  const target = new URL(`dist/${file}`, root);
  await mkdir(new URL(".", target), { recursive: true });
  await cp(source, target);
}
console.log(
  `Built static site: ${pack.rules.length} rules, ${pack.rules.length + extra} checked quotations.`,
);
