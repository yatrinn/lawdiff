# Technical video production notes

`lawdiff-tech.mp4`: **56 seconds, 1920 × 1080, 30 fps, H.264, no audio**. Six authored diagrams labelled “Technical walkthrough · Captioned.” They explain recorded build evidence; they are not an API recording or a live test session. English captions are burned in and repeated in the SRT.

| Zeit | Bild | Englischer Text |
|---|---|---|
| 00–09 s | Dieselbe automatische Quelle→Auswahl→Adresse-Kette. 21/110 Quellen verarbeitet, 89 ausgewählte Records. | Recorded model calls extract candidates; source review selects unchanged records. One selected pack drives the workspace and all 500 submitted address lookups. |
| 09–18 s | Hash und exakte Originalpassage; 89 primäre Zitatstellen. | Captured files carry hashes. Primary and supplemental quotations must occur verbatim in their referenced source texts. |
| 18–28 s | Eine Engine für Browser und Exporte, kein Laufzeit-Modellaufruf. | One JavaScript engine serves browser answers and submission exports. It evaluates a restricted rule language. Runtime makes no model calls. |
| 28–38 s | Wahr/falsch/unbekannt, Datum und Pending-Status. | Missing evidence remains unknown unless another condition decides it. Calendar checks distinguish effective dates from pending proposals. |
| 38–48 s | 93 JavaScript- und 10 Geografie-Tests im geprüften Build. | Regression tests challenge source tampering, jurisdiction mismatches, malformed conditions, calendar boundaries and geographic provenance. |
| 48–56 s | 475 Ortszuordnungen, 25 offen; Grenzen des Zitatabgleichs. | 475 sample addresses have matched legal cities; 25 remain unresolved. Exact quotations support review. They do not prove legal interpretation. |

The shared build validator checks the selection, reviewed pack, catalog and corpus receipts before rendering. The selected pack contains 89 automatic records, 13 executable coverage definitions and 76 records awaiting interpretation review. The corpus receipt separately records 21 processed, 37 text-missing, 44 rejected/withheld and 8 unprocessed sources out of 110. These counts are not legal-accuracy measurements.

The renderer runs all 93 JavaScript tests and 10 geography tests; any failure stops it. It checks all 89 primary quotation spans and 475 legal-city matches. Exact quotation presence and deterministic execution do not certify interpretation. The shortened SHA-256 value is a real captured source fingerprint, not a legal-validity guarantee. Model calls were used for extraction, but runtime evaluation uses none. No monetary-cost or independent legal-review claim is made.

Reproduce with `python3 scripts/render_tech.py`; requires Pillow, FFmpeg/FFprobe, Node, Python and Arial or DejaVu Sans. Private API credentials are unnecessary. Work images, validation receipts and test outputs are outside the deliverable tree under `work/lawdiff-tech/`. Inspect all six scenes after encoding; if the data changes, regenerate and inspect again.
