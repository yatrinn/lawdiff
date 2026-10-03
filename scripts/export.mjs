import { readFile, writeFile, mkdir } from "node:fs/promises";
import { validateRulePack } from "../public/engine.mjs";
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
validateRulePack(pack, catalog.sources);
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
    findings: pack.findings,
    automatic_pipeline_demonstration: automaticPipeline,
    provenance_note: "The loaded pack and separate automatic pipeline demonstration have distinct provenance. Candidate generation is not independent legal review.",
  },
}))
  await writeFile(new URL(`${name}.json`, out), JSON.stringify(data, null, 2));
console.log(
  "Submission JSON generated from original sample; browser overlays excluded.",
);
