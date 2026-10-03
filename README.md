# LawDiff

**Every address. Every layer. Every change.**

[Open the live demo](https://yatrinn.github.io/lawdiff/) · [Submission guide](docs/submission-guide.md)

A source-grounded housing-law change desk for the RealPage challenge at Hack-Nation 7. Explore the supplied 500-address sample, move through five change cases, inspect executable coverage conditions and exact source quotations, and share an English/Spanish rights card.

## Run

Node.js 22 or newer. The app runs without API keys.

```sh
npm ci
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:4317. Deploy the project to Vercel using the included configuration, or serve `dist/` with any static host. No database or paid browser API is needed.

## The product

- **The Field:** one mark per sample address, grouped by its dataset collection. These clusters are not a geographic map.
- **Layers:** state, county and legally matched city. County is shown as context; the corpus does not include a county-rule layer.
- **Resolve:** change a hypothetical or user-supplied fact and inspect the resulting condition trace. Local overlays stay in browser storage and never alter the supplied sample or submission exports.
- **Rights card:** English/Spanish category summary, source-linked detail, QR deep link and print-to-PDF. Translation is AI-assisted and not independently reviewed.
- Search addresses or rules with Command/Ctrl+K; dark appearance and mobile layouts are included.

## Architecture and truthfulness

The shipped rule records were extracted by Codex from captured source texts, with exact-span and structural checks. This is **Codex-assisted extraction**, not a completed external Anthropic API batch or independent legal review. `scripts/compile.mjs` provides a separate reproducible, budget-limited Anthropic pipeline for additional candidate extraction. It requires credentials and explicitly supplied model prices. See [compiler documentation](docs/compiler.md).

A single JavaScript rule engine powers the browser and submission export. It uses three-valued coverage logic: missing evidence remains unknown unless another condition already decides the result. It checks legal jurisdiction, effective dates, explicit precedence and possible conflicts. Runtime evaluation makes no model calls. Determinism does not prove that an extracted interpretation is legally correct.

`public/data/catalog.json` includes the supplied source collection and address records, plus clearly identified supplemental sources and geographic provenance when available. `public/data/rule-pack.json` contains executable rules and extraction provenance. `public/data/validation.json` records source-span and structural checks. Unit tests cover independent boundary and failure cases.

## Reproduce the deliverables

```sh
npm run export
```

This writes `submission/rules.json`, `submission/lookups.json`, `submission/changes.json`, and an extraction audit. Browser evidence is excluded. T1–T5 come from the downloaded participant package. **No official scoring script or answer key was supplied; no official accuracy score is claimed.**

To reimport the original organizer files, place the unchanged starter package in `data/starter/` and run `npm run prepare:data`, then `node scripts/assemble.mjs`. The checked-in catalog and rule artifacts are sufficient to run the app; the original download and API caches are excluded from Git.

## Known limits

- Source capture is incomplete; missing texts and source gaps are visible. Lack of an extracted rule does not prove lack of legal protection.
- Ownership, occupancy certificates, unit counts and exemption facts are often absent. Some city assignments may remain unresolved.
- Geographic matches are address interpolation, not parcel-level legal determinations or reconstructed historical boundaries.
- Old rate notices expire; pending bills never become active simply by advancing time.
- Possible state/local conflicts are review flags, not legal preemption determinations.
- Public sample data supports this prototype. It is not legal advice or a production compliance determination.

See [California review](docs/california-review.md), [NJ/MA review](docs/nj-ma-review.md), [method note](docs/method-note.md), and the [submission guide](docs/submission-guide.md).

## License

Original code is MIT licensed. Government texts, organizer-provided data and third-party material retain their applicable terms; the code license does not relicense source content. The QR generator is Kazuhiko Arase's MIT-licensed `qrcode-generator`; its notice is preserved in `public/vendor/qrcode.js`. See [third-party notices](THIRD_PARTY_NOTICES.md).
