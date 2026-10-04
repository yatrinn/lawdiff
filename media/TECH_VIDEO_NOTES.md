# Technical video production notes

`lawdiff-tech.mp4`: **56 seconds, 1920 × 1080, 30 fps, H.264 video and AAC audio**. Six authored diagrams are labelled “Technical walkthrough · Synthetic narration.” They explain recorded build evidence; they are not an API recording or a live test session. English captions are burned in, with a matching spoken-text SRT.

The English voice is **Leslie**, a preset synthetic voice generated through Runway with Eleven Multilingual v2. It is not a cloned voice or Yannik's voice. Recorded inputs, exact spoken text, chapter lengths and input hashes are in `narration/tech.json`.

| Time | Picture | English narration and captions |
|---|---|---|
| 00–12 s | Aufgezeichnete Extraktion → unveränderte Auswahl → Adressauswertung. | Recorded model calls extract rule candidates. Source review selects unchanged records. One selected pack drives the workspace and all five hundred submitted address lookups. |
| 12–19 s | Quellenhash und exakte Originalpassage. | Captured files carry hashes. Source quotations must occur verbatim in their referenced text. |
| 19–29 s | Eine Engine für Browser und Exporte. | One JavaScript engine serves browser answers and submission exports. It evaluates explicit conditions, without model calls at query time. |
| 29–38 s | Wahr, falsch und unbekannt; Wirksamkeit und Pending-Status. | Missing evidence remains unknown unless another condition decides it. Calendar checks distinguish effective laws from pending proposals. |
| 38–45 s | Tatsächlich bestandene Regressionstests des eingefrorenen Builds. | Regression tests cover source tampering, jurisdiction mismatches, missing facts and calendar boundaries. |
| 45–56 s | Amtliche geografische Belege, ungeklärte Zuordnungen und Grenzen der Auslegung. | Official geographic evidence identifies legal cities. Unresolved addresses stay visible. Exact quotations support review, but do not prove legal interpretation. |

The chapter lengths are **12 / 7 / 10 / 9 / 7 / 11 seconds**. The diagrams display counts read from the frozen artifacts; the narration avoids changeable release totals. “Five hundred” in the spoken text and “500” in the diagram refer to the same supplied address sample.

The shared build validator checks the selected records, catalog and corpus receipts before the picture is rendered. The renderer also runs the JavaScript and geography tests; a failure stops rendering. The corpus receipt separately accounts for processed sources, missing texts, rejected or withheld attempts and unprocessed entries. Narrative coverage awaiting execution review remains unknown in address evaluation. Neither record counts nor geographic matches are accuracy measurements.

Exact quotation presence and deterministic execution do not certify interpretation. The displayed shortened SHA-256 value is a real source fingerprint, not a legal-validity guarantee. Model calls were used for extraction; runtime evaluation makes none. No monetary-cost, independent legal-review or complete-coverage claim is made.

## Reproduce

Run these commands from the repository root after restoring and building the frozen data:

```sh
python3 scripts/render_tech.py
python3 scripts/narrate_videos.py tech
```

The first command renders a silent picture intermediate and validates the frozen artifacts and tests. The second verifies the recorded narration hashes, aligns the six chapters and adds AAC audio. It makes no new speech-generation request and requires no API credentials. Running only the picture renderer does **not** reproduce the delivered narrated film.

Dependencies are Pillow, FFmpeg/FFprobe, Node, Python and Arial or DejaVu Sans. Work images, validation receipts and test outputs remain under `work/lawdiff-tech/`, outside the deliverable tree. `lawdiff-tech.probe.json` records the final encoding and narration alignment. Inspect all six final scenes and listen to the full film after encoding; regenerate and review again if its underlying data changes.
