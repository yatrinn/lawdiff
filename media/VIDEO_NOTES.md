# Demo video production notes

`lawdiff-demo.mp4` is a **56-second captioned walkthrough assembled from seven actual interface screenshots in six chapters**. It is an edited sequence of still captures, not a continuous screen recording. The presentation adds a caption rail and chapter markers; it does not generate product screens, reconstruct data, animate a fictitious cursor, or imply a measured real-time processing speed. There is no audio. Captions are burned into the video; `lawdiff-demo.srt` contains the same authored narration text as an optional accessibility sidecar.

## Capture order and timing

| File | Time | Actual interface state |
|---|---|---|
| `captures/demo-01.png` | 00:00–00:07 | LawDiff overview, before the future New Jersey effective date |
| `captures/demo-02.png` | 00:07–00:17 | New Jersey FAIR Act enacted but not yet effective |
| `captures/demo-03.png` | 00:17–00:26 | After the effective date: 140 supplied New Jersey addresses in the extracted state rule; local conflict review remains visible |
| `captures/demo-04.png` | 00:26–00:36 | Captured source evidence in the real viewer |
| `captures/demo-05-before.png` | 00:36–00:40 | Los Angeles occupancy-date branch unresolved before the simulation |
| `captures/demo-05.png` | 00:40–00:46 | A visibly labelled hypothetical simulation resolves that branch; other missing exemption facts remain unresolved |
| `captures/demo-06.png` | 00:46–00:56 | Bilingual rights card based on original address data, excluding simulation overrides |

The 140-address count is a scope result for the supplied dataset and extracted rule, not a count of demonstrated violations. A quote match does not establish a correct legal interpretation. The Los Angeles simulated date is hypothetical, not newly verified property evidence. The real captures must visibly substantiate the corresponding caption before this video is used for submission.

## Reproduce

Requires Python 3, FFmpeg with `drawtext` and H.264 encoding, FFprobe, and an installed Arial font (or explicit font paths). No third-party Python package is needed.

```sh
python3 scripts/render_demo.py --check
python3 scripts/render_demo.py --preview 5
python3 scripts/render_demo.py
```

The renderer requires all seven capture files and refuses to generate replacements. Their supplied filenames end in `.png`; FFprobe identified the capture payloads as JPEG, which FFmpeg reads by content. It preserves the entire aspect ratio of each input in a 1440×1000 image pane, with no cropping. The left 460px rail contains authored captions. Scene cuts are intentional and do not represent uninterrupted interaction. The original capture files are never modified.

Output: 1920×1080, 30 fps, H.264 high profile, YUV 4:2:0, 56 seconds, no audio. The script verifies these properties with FFprobe and writes the resulting `lawdiff-demo.probe.json`. The composer uses six scene durations of 7, 10, 9, 10, 10 and 10 seconds.

## Completed render verification

Rendered on 2026-10-03. FFprobe confirmed 56.000 seconds, 1,680 frames at 30 fps, 1920×1080 H.264 with `yuv420p`, no audio stream, and a 1,449,261-byte output. Seven frames extracted from the finished MP4 at 2, 12, 20, 30, 38, 43 and 51 seconds are saved as `demo-preview-*.png`. Representative encoded frames, including both Los Angeles states and the Spanish rights card, were visually inspected for caption fit and fidelity to the provided actual captures. Input captures were left unchanged.

This demo file does not replace the separate technical explanation video or the participant's authentic team video and photo. Nothing in this media directory constitutes an event submission.
