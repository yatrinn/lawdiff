# Demo video production notes

`lawdiff-demo.mp4` is a **56-second captioned walkthrough combining a recorded-extraction data diagram with six actual interface screenshots in six chapters**. It is an edited sequence of still captures, not a continuous screen recording. The first diagram is generated directly from a completed model-run audit and its checked candidate output, clearly labelled as a recorded result. The remaining scenes use actual product captures. Caption rails and chapter markers do not imply continuous real-time interaction. There is no audio. Captions are burned into the video; `lawdiff-demo.srt` contains the same authored narration text as an optional accessibility sidecar.

## Capture order and timing

| File | Time | Actual interface state |
|---|---|---|
| `extraction-receipt.png` | 00:00–00:07 | Data diagram from an actual Codex CLI extraction: source, model, candidate and exact-span validation |
| `captures/demo-02.png` | 00:07–00:17 | New Jersey FAIR Act enacted but not yet effective |
| `captures/demo-03.png` | 00:17–00:26 | After the effective date: 140 supplied New Jersey addresses in the extracted state rule; local conflict review remains visible |
| `captures/demo-04.png` | 00:26–00:36 | Captured source evidence in the real viewer |
| `captures/demo-05-before.png` | 00:36–00:40 | Los Angeles occupancy-date branch unresolved before the simulation |
| `captures/demo-05.png` | 00:40–00:46 | A visibly labelled hypothetical simulation resolves that branch; other missing exemption facts remain unresolved |
| `captures/demo-06.png` | 00:46–00:56 | Bilingual rights card based on original address data, excluding simulation overrides |

The 140-address count is a scope result for the supplied dataset and extracted rule, not a count of demonstrated violations. A quote match does not establish a correct legal interpretation. The Los Angeles simulated date is hypothetical, not newly verified property evidence. The real captures must visibly substantiate the corresponding caption before this video is used for submission.

## Reproduce

Requires Python 3, Pillow for the extraction diagram, FFmpeg with `drawtext` and H.264 encoding, FFprobe, and an installed Arial font (or explicit font paths). Pillow is used only to lay out the recorded data diagram; it does not create or reconstruct product screenshots.

```sh
python3 scripts/render_extraction_receipt.py
python3 scripts/render_demo.py --check
python3 scripts/render_demo.py --preview 5
python3 scripts/render_demo.py
```

The video renderer requires the verified extraction diagram and six actual UI captures. Original capture files remain unchanged. Their supplied filenames end in `.png`; FFprobe identified the capture payloads as JPEG, which FFmpeg reads by content. It preserves the entire aspect ratio of each input in a 1440×1000 image pane, with no cropping. The left 460px rail contains authored captions. Scene cuts are intentional and do not represent uninterrupted interaction. The original capture files are never modified.

Output: 1920×1080, 30 fps, H.264 high profile, YUV 4:2:0, 56 seconds, no audio. The script verifies these properties with FFprobe and writes the resulting `lawdiff-demo.probe.json`. The composer uses six scene durations of 7, 10, 9, 10, 10 and 10 seconds.

## Render verification

The updated renderer checks the recorded model output before creating its diagram. After composition, FFprobe verifies the full MP4 duration, dimensions, codec and frame rate. The new encoded extraction frame was visually inspected on October 4; both Los Angeles capture states had already been inspected and their source images remain unchanged. The updated MP4 passes duration, dimensions and codec checks. This is an edited, captioned sequence, not an uninterrupted screen recording.

This demo file does not replace the separate technical explanation video or the participant's authentic team video and photo. Nothing in this media directory constitutes an event submission.
