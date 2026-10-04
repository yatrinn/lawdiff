# LawDiff

**Every address. Every layer. Every change.**

[Open the live demo](https://yatrinn.github.io/lawdiff/) · [Demo film](https://yatrinn.github.io/lawdiff/media/lawdiff-demo.mp4) · [Technical film](https://yatrinn.github.io/lawdiff/media/lawdiff-tech.mp4) · [Pitch deck](presentation/lawdiff-pitch.pdf) · [Submission guide](docs/submission-guide.md)

A source-grounded housing-law change desk for the RealPage challenge at Hack-Nation 7. Explore the supplied 500-address sample, move through five change cases, inspect executable coverage conditions and exact source quotations, and share an English/Spanish rights card.

## Run

Node.js 22 or newer. The app runs without API keys.

```sh
npm ci
node scripts/restore-extraction.mjs
npm test
npm run build
npm run dev
```

Open http://127.0.0.1:4317. Deploy the project to Vercel using the included configuration, or serve `dist/` with any static host. No database or paid browser API is needed.

## The product

- **The Field:** one mark per sample address, grouped by its dataset collection. These clusters are not a geographic map.
- **Layers:** state, county and legally matched city. County is shown as context; the corpus does not include a county-rule layer.
- **Resolve:** change a hypothetical or user-supplied fact and inspect the resulting condition trace. Local overlays stay in browser storage and never alter the supplied sample or submission exports.
- **Review brief:** turn a change into an address-level worklist with missing facts, possible interactions and exact source evidence. Export a spreadsheet-ready CSV from the original sample; future and pending requirements remain distinct from current scope.
- **Rights card:** English/Spanish category summary, source-linked detail, QR deep link and print-to-PDF. Translation is AI-assisted and not independently reviewed.
- Search addresses or rules with Command/Ctrl+K; dark appearance and mobile layouts are included.

## Architecture and truthfulness

The shipped pack is an **explicit selection of unchanged automatic Codex CLI outputs**. Every selected rule links to the captured text, exact source passage, original run, model, prompt/schema hashes and original output hash. Source review was AI-assisted; it is not independent legal review. The same selected pack drives the workspace and all three submission JSONs. Coverage that cannot be safely expressed as executable conditions stays a narrative record with `execution_review_pending: true`; the engine returns `unknown` rather than interpreting it at runtime. The full corpus receipt separately accounts for processed, missing, rejected and unprocessed sources. See [reproduction instructions](docs/codex-extraction.md).

`scripts/compile.mjs` also provides an alternative budget-limited Anthropic pipeline. That alternative has not been live-run and requires credentials and explicitly supplied model prices. See [Anthropic compiler documentation](docs/compiler.md).

A single JavaScript rule engine powers the browser and submission export. It uses three-valued coverage logic: missing evidence remains unknown unless another condition already decides the result. It checks legal jurisdiction, effective dates, explicit precedence and possible conflicts. Runtime evaluation makes no model calls. Determinism does not prove that an extracted interpretation is legally correct.

`public/data/catalog.json` includes the supplied source collection and address records, plus clearly identified supplemental sources and geographic provenance when available. `public/data/rule-pack.json` contains 89 selected records: 13 executable coverage definitions and 76 narrative records awaiting interpretation review, with extraction provenance. `public/data/validation.json` records source-span and structural checks. Unit tests cover independent boundary and failure cases.

## Reproduce the deliverables

```sh
npm run export
```

This writes `submission/rules.json`, `submission/lookups.json`, `submission/changes.json`, and an extraction audit. Browser evidence is excluded. T1–T5 come from the downloaded participant package. **No official scoring script or answer key was supplied; no official accuracy score is claimed.**

To reimport the original organizer files, place the unchanged starter package in `data/starter/` and run `npm run prepare:data`. Changing the catalog invalidates the pinned audit; regenerate the selection, aggregation and assembly as described in the reproduction instructions before building. The checked-in catalog and rule artifacts are sufficient to run the app; the original download and API caches are excluded from Git.

## Known limits

- Source capture is incomplete; missing texts and source gaps are visible. Lack of an extracted rule does not prove lack of legal protection.
- Ownership, occupancy certificates, unit counts and exemption facts are often absent. Some city assignments may remain unresolved.
- Geographic matches are address interpolation, not parcel-level legal determinations or reconstructed historical boundaries.
- Old rate notices expire; pending bills never become active simply by advancing time.
- Possible state/local conflicts are review flags, not legal preemption determinations.
- Public sample data supports this prototype. It is not legal advice or a production compliance determination.

See the [current challenge matrix](docs/challenge-matrix.md), [method note](docs/method-note.md), and [submission guide](docs/submission-guide.md). Earlier California and NJ/MA review notes concern historical development fixtures, not the final automatic selection.

## Customer and commercial hypothesis

**When housing law changes, LawDiff shows which decisions need review—and what evidence is missing.** The proposed first buyer is a regional residential portfolio operator's compliance or operations lead, working with their legal reviewer. The first paid job would be a bounded portfolio change review: establish affected properties, identify decisive missing records, and hand the resulting worklist to the team that can resolve them. The current prototype implements the change-to-address-to-evidence portion and a portable review brief. It does not yet integrate lease-renewal dates, assign staff, collect documents or record legal approval.

There is evidence of an existing workflow, and there is existing competition. [RealPage offers compliance subscriptions and expert audits](https://www.realpage.com/compliance-services/) for affordable housing, an adjacent market rather than proof of demand for this particular product. [Yardi Revenue IQ](https://www.yardi.com/product/revenue-iq/) includes rent-control compliance in its product positioning. [DwellDocket's public API preview](https://dwelldocket.com/api/) already supplies structured property-law records with provenance; its page explicitly says paid quotas and commercial guarantees are not active. [Regology](https://www.regology.com/regulatory-change-agent) links legal changes to applicability and controls. These offerings refute a claim that a property-law API, change monitoring or deterministic legal logic is new by itself. The vendors' claims have not been independently benchmarked here.

Our differentiating hypothesis is the full review loop: a versioned change, its effect on a specific building, the fact preventing a decision, and a reproducible re-evaluation when that fact is supplied. The hypothesis must be tested against both existing software and today's manual process. Public laws and an LLM alone are not a defensible moat.

The next commercial milestone is a **paid 30-day pilot with a fixed jurisdiction and portfolio scope**, not an unlimited compliance promise. A customer and qualified reviewer would agree on a reference set before measuring review time, missed cases, unnecessary alerts and unresolved evidence. A pilot price would cover the measured onboarding and review effort. Recurring portfolio subscriptions are the primary business-model hypothesis; an API follows if the same workflow repeats across buyers. No customer, payment, time saving or willingness to pay is claimed today.

For a seed discussion, the prototype supports a product thesis. Investment readiness still needs independent legal evaluation, evidence that customers pay and keep using it, and repeatable delivery without proportional expert-service costs. Two or three independent paid pilots are our proposed validation milestone, not a funding guarantee. We should change the product or stop this commercial direction if buyers already solve the workflow adequately, do not value the evidence loop, or require more bespoke review than a software business can support.

Competitive review: October 4, 2026. This is a focused review of public product descriptions, not an exhaustive novelty or patent search.

## License

Original code is MIT licensed. Government texts, organizer-provided data and third-party material retain their applicable terms; the code license does not relicense source content. The QR generator is Kazuhiko Arase's MIT-licensed `qrcode-generator`; its notice is preserved in `public/vendor/qrcode.js`. See [third-party notices](THIRD_PARTY_NOTICES.md).
