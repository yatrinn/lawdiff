import { readFile, writeFile, mkdir } from "node:fs/promises";
import { validateBuildSnapshot } from "./validate-artifacts.mjs";
import { lookupsFor, changesFor } from "../public/exporter.mjs";
const root = new URL("../", import.meta.url),
  read = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const catalog = await read("public/data/catalog.json"),
  pack = await read("public/data/rule-pack.json");
let automaticPipeline = null;
try {
  automaticPipeline = await read("public/data/extraction-run.json");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
validateBuildSnapshot(Object.fromEntries(await Promise.all([
  ['catalogBytes','public/data/catalog.json'], ['packBytes','public/data/rule-pack.json'],
  ['coverageBytes','public/data/corpus-coverage.json'], ['candidatesBytes','public/data/corpus-candidates.json'],
  ['reviewedBytes','data/extracted/automatic-reviewed.json'], ['selectionBytes','data/extracted/automatic-selection.json']
].map(async ([key,path]) => [key,await readFile(new URL(path,root))]))));
const out = new URL("submission/", root);
await mkdir(out, { recursive: true });
for (const [name, data] of Object.entries({
  rules: { rules: pack.rules },
  lookups: lookupsFor(catalog, pack),
  changes: changesFor(catalog, pack),
  "extraction-audit": {
    method: pack.method,
    generated_at: pack.generated_at,
    legal_review: false,
    audit: pack.audit,
    provenance: pack.provenance,
    assembly: pack.assembly,
    review: pack.review,
    no_rule_findings: pack.no_rule_findings,
    historical_pipeline_test: automaticPipeline,
    provenance_note: "This submission uses the explicit selection of unchanged automatic records. The earlier two-source pipeline test is historical and is not the source of the selected pack. AI-assisted source review is not independent legal review.",
  },
}))
  await writeFile(new URL(`${name}.json`, out), JSON.stringify(data, null, 2));
console.log(
  "Submission JSON generated from original sample; browser overlays excluded.",
);
