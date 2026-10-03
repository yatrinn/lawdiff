import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateRulePack } from "../public/engine.mjs";
const root = new URL("../", import.meta.url),
  read = async (p) => JSON.parse(await readFile(new URL(p, root), "utf8"));
const catalog = await read("public/data/catalog.json");
const inputs = await Promise.all(
  ["california", "nj-ma"].map(async (name) => ({
    name,
    data: await read(`data/extracted/${name}.json`),
  })),
);
const pack = {
  version: 1,
  generated_at: new Date().toISOString(),
  method: "codex_assisted_extraction",
  interpretation_review: "Not independently legally validated",
  rules: inputs.flatMap((x) => x.data.rules),
  findings: inputs.flatMap((x) => x.data.findings || []),
  review: inputs.flatMap((x) => x.data.review || []),
  audit: inputs.map((x) => ({
    scope: x.name,
    method: "codex_assisted_extraction",
    rules: x.data.rules.length,
    external_api_batch: false,
    artifact_sha256: createHash("sha256")
      .update(JSON.stringify(x.data))
      .digest("hex"),
  })),
};
pack.rules.push({
  team_rule_id: "MA-RENT-P1",
  jurisdiction: "MA",
  level: "state",
  category: "rent_increase_limits",
  status: "failed",
  title: "Rent-control ballot proposal — organizer negative case",
  requirement:
    "The organizer’s T5 case records IP 25-21 as failed. It creates no active rent cap in this model. An independent court or ballot record has not been captured.",
  requirement_es:
    "El caso T5 del organizador identifica IP 25-21 como una propuesta fallida. No crea un límite de alquiler vigente en este modelo. No se ha capturado un registro judicial independiente.",
  coverage_conditions: { all: [] },
  effective_date: null,
  citation: "Organizer dev/change_tests.json, T5",
  source_doc_id: "O001",
  source_url: catalog.sources.find((s) => s.doc_id === "O001").url,
  quoted_span:
    "No rent cap reported for any Boston or Cambridge address; IP 25-21 recorded as failed. Affected set is empty.",
  extraction_method: "organizer_test_status",
  review_status: "organizer_metadata_only",
  conflict_flag: false,
});
validateRulePack(pack, catalog.sources);
let quotes = 0;
for (const rule of pack.rules)
  for (const ev of rule.source_evidence || []) {
    const source = catalog.sources.find(
      (s) => s.doc_id === (ev.doc_id || rule.source_doc_id),
    );
    if (!source?.text?.includes(ev.quote))
      throw Error(
        `Supplemental quote mismatch ${rule.team_rule_id} ${ev.doc_id}`,
      );
    quotes++;
  }
await writeFile(
  new URL("public/data/rule-pack.json", root),
  JSON.stringify(pack, null, 2),
);
console.log(
  `Assembled ${pack.rules.length} rules; ${quotes} supplemental quotations verified.`,
);
