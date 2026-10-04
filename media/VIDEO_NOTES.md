# Demo video production notes

`lawdiff-demo.mp4`: **56 seconds, 1920 × 1080, 30 fps, H.264 video and AAC audio**. Seven actual interface still captures form six chapters. The picture identifies itself as “Actual interface captures · edited walkthrough” and discloses “Synthetic narration.” No reconstructed interface, pointer animation, artificial clicks or simulated success messages are used.

The English voice is **Leslie**, a preset synthetic voice generated through Runway with Eleven Multilingual v2. It is not voice cloning and does not represent Yannik speaking. The recorded chapter inputs, spoken text and their hashes are in `narration/demo.json`.

| Time | Picture | English narration and captions |
|---|---|---|
| 00–08 s | T3 vor dem Wirksamkeitsdatum; Originalsample. | A new housing law lands on your desk. Which buildings need your attention? This is LawDiff. |
| 08–17 s | T3 nach dem Datum; fehlende Fakten zum Anwendungsbereich bleiben sichtbar. | Move New Jersey’s FAIR Act past its effective date. The workspace reveals where missing property facts need a closer look. |
| 17–27 s | Eine Adresse mit zugehöriger NJ-Regel (4 s), anschließend Originaltext D069 (6 s). | Open one address. See the requirement, its timing, and the original passage behind the interpretation. |
| 27–37 s | Review Brief mit offenen Fakten und nächstem Prüfschritt. | Now turn that finding into a review brief. Listed addresses get their status, source, and next check. |
| 37–47 s | Echte Oberfläche nach dem CSV-Download; keine nachgebaute Tabellenansicht. | Export the list for your compliance team: original address data, source wording, and what to review next. |
| 47–56 s | Integrity: automatische Extraktion, unveränderte Auswahl, gemeinsame Engine. | Rules extracted automatically. Selected records unchanged. One traceable pack powers the workspace and submission. Inspect the chain. |

The final scene shows the automatic extraction-to-selection-to-evaluation chain for the same shipped pack. The after-date NJ view shows **missing scope evidence**, not established legal violations or confirmed coverage. The exact-source view makes the captured passage available for review; it does not certify the interpretation. The review brief and CSV use original sample data, excluding hypothetical browser evidence. CSV contents are not shown as a fabricated spreadsheet; scene five preserves the actual review dialog after its download action.

The six chapter lengths are **8 / 9 / 10 / 10 / 10 / 9 seconds**. The 102-word narration follows the burned-in captions and final SRT. Each chapter includes a short lead-in and pause. The audio is level-adjusted; speech is not truncated to fit a scene.

## Reproduce

Run these commands from the repository root after restoring and building the frozen data:

```sh
python3 scripts/render_demo.py
python3 scripts/narrate_videos.py demo
```

The first command renders the picture from `captures/review-demo-*` and writes a silent intermediate. The second verifies the existing narration input hashes, aligns the six chapters and adds AAC audio to the final MP4. It makes no new speech-generation request and requires no API credentials. Running only the first command does **not** reproduce the delivered narrated film.

FFmpeg/FFprobe and Arial or an explicit renderer font are required. The picture renderer checks 1440 × 1000 input dimensions, capture hashes, duration and frame count. The narration step checks one H.264 video stream, one AAC audio stream, 1920 × 1080, 1,680 frames and a 56-second duration. `lawdiff-demo.probe.json` describes the final film and audio alignment. After any changed capture or narration, rerender, watch every chapter and listen through the full encoded file.
