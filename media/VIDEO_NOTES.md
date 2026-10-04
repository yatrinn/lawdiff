# Demo video production notes

`lawdiff-demo.mp4`: **56 seconds, 1920 × 1080, 30 fps, H.264, no audio**. Seven actual interface still captures, six chapters. Explicitly labelled “Actual interface captures · edited walkthrough.” No reconstructed interface, pointer animation, artificial clicks or simulated success messages.

| Zeit | Bild | Englischer Text |
|---|---|---|
| 00–08 s | T3 vor Datum; Originalsample. | A new housing law lands on your desk. Which buildings need your attention? This is LawDiff. |
| 08–17 s | T3 nach Datum: 140 Adressen benötigen Scope-Fakten. | Move New Jersey’s FAIR Act past its effective date. The workspace reveals where missing property facts need a closer look. |
| 17–27 s | A0002 mit zugehöriger NJ-Regel (4 s), anschließend D069-Originaltext (6 s). | Open one address. See the requirement, its timing, and the original passage behind the interpretation. |
| 27–37 s | Review Brief mit offenen Fakten und nächstem Prüfschritt. | Now turn that finding into a review brief. Listed addresses get their status, source, and next check. |
| 37–47 s | Echte Oberfläche nach CSV-Download; keine künstliche Tabellenansicht. | Export the list for your compliance team: original address data, source wording, and what to review next. |
| 47–56 s | Integrity: automatische Extraktion, unveränderte Auswahl, gemeinsame Engine. | Rules extracted automatically. Selected records unchanged. One traceable pack powers the workspace and submission. Inspect the chain. |

The final scene shows the automatic extraction-to-selection-to-evaluation chain for the same shipped pack. The after-date NJ view shows **missing scope evidence**, not 140 established legal violations or covered addresses. The exact-source view preserves the captured statutory context. The review brief and CSV exclude hypothetical browser evidence.

102 English words are burned into the caption rail and repeated in the SRT. Optional narration is not included. CSV contents are not shown as a fabricated spreadsheet; scene five preserves the actual review dialog after its download action.

Reproduce with `python3 scripts/render_demo.py`; requires FFmpeg/FFprobe and Arial or an explicit font. Source images are the `captures/review-demo-*` files. The renderer verifies 1440 × 1000 input dimensions, hashes, duration, frame count and absence of audio. A changed capture requires rerendering. Source hashes and media properties are in `lawdiff-demo.probe.json`. Every scene must also be visually checked in the final encoded file.
