import { readFile, writeFile, mkdir, cp, rm, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateBuildSnapshot } from "./validate-artifacts.mjs";
const root = new URL("../", import.meta.url);
// Gate the complete data snapshot before touching validation.json or dist/.
const [catalogBytes, packBytes, coverageBytes, candidatesBytes, reviewedBytes, selectionBytes] = await Promise.all([
  "public/data/catalog.json", "public/data/rule-pack.json", "public/data/corpus-coverage.json", "public/data/corpus-candidates.json",
  "data/extracted/automatic-reviewed.json", "data/extracted/automatic-selection.json",
].map(path => readFile(new URL(path, root))));
const corpus = validateBuildSnapshot({ catalogBytes, packBytes, coverageBytes, candidatesBytes, reviewedBytes, selectionBytes });
const { catalog, pack } = corpus;
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
  executable_rules: pack.rules.filter(r => r.execution_review_pending !== true).length,
  coverage_review_records: pack.rules.filter(r => r.execution_review_pending === true).length,
  primary_quotes: pack.rules.length,
  supplemental_quotes: extra,
  addresses: 500,
  geocoded: catalog.stats.geocoded,
  source_texts: catalog.stats.availableTexts,
  official_score: null,
  legal_review: false,
  pack_sha256: createHash("sha256").update(JSON.stringify(pack)).digest("hex"),
  corpus_file_sha256: corpus.file_sha256,
  automatic_selection: { source_file_sha256: pack.assembly.source_file_sha256,
    selection_file_sha256: pack.assembly.selection_file_sha256,
    original_artifacts_revalidated: true, rules_modified: false, independent_legal_review: false },
  checks: [
    "Rule structure, executable conditions and explicit coverage-review flags",
    "Primary and supplementary exact source spans",
    "Real calendar dates",
    "Unique address and rule identifiers",
    "Referenced rule identifiers",
    "Automatic selection audit and unchanged per-rule hashes",
    "Corpus catalog bytes, source hashes, candidate-set hashes and reconciled receipts",
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
  "app.mjs", "engine.mjs", "exporter.mjs", "visuals.mjs", "corpus.mjs", "styles.css",
  "vendor/qrcode.js", "data/catalog.json", "data/rule-pack.json", "data/validation.json",
  "data/extraction-run.json", "data/extraction-candidates.json",
];
const revisionHash = createHash("sha256");
for (const optional of ["data/corpus-coverage.json", "data/corpus-candidates.json"]) {
  try { await access(new URL(`dist/${optional}`, root)); browserFiles.push(optional); } catch {}
}
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
