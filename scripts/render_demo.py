#!/usr/bin/env python3
"""Compose a 56-second review workflow from actual interface captures.

No image generation, UI reconstruction, cursor simulation, or narration is used.
Python standard library only; FFmpeg and FFprobe must be installed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[1]
WIDTH, HEIGHT, FPS = 1920, 1080, 30
SCENES = [
    {
        "seconds": 8,
        "title": "A law changes.\nWhat follows?",
        "caption": "A new housing law\nlands on your desk.\n\nWhich buildings need\nyour attention?\n\nThis is LawDiff.",
        "full_caption": "A new housing law lands on your desk. Which buildings need your attention? This is LawDiff.",
        "chapter": "THE QUESTION",
    },
    {
        "seconds": 9,
        "title": "See the\naddresses.",
        "caption": "Move New Jersey’s FAIR Act\npast its effective date.\n\nThe workspace reveals where\nmissing property facts\nneed a closer look.",
        "full_caption": "Move New Jersey’s FAIR Act past its effective date. The workspace reveals where missing property facts need a closer look.",
        "chapter": "THE CHANGE",
    },
    {
        "seconds": 10,
        "title": "Follow the\nsource.",
        "caption": "Open one address.\n\nSee the requirement,\nits timing, and the original\npassage behind\nthe interpretation.",
        "full_caption": "Open one address. See the requirement, its timing, and the original passage behind the interpretation.",
        "chapter": "THE EVIDENCE",
    },
    {
        "seconds": 10,
        "title": "Make it a\nreview brief.",
        "caption": "Now turn that finding\ninto a review brief.\n\nListed addresses get their\nstatus, source, and\nnext check.",
        "full_caption": "Now turn that finding into a review brief. Listed addresses get their status, source, and next check.",
        "chapter": "THE NEXT CHECK",
    },
    {
        "seconds": 10,
        "title": "Ready for\nhandoff.",
        "caption": "Export the list for your\ncompliance team:\n\noriginal address data,\nsource wording, and\nwhat to review next.",
        "full_caption": "Export the list for your compliance team: original address data, source wording, and what to review next.",
        "chapter": "THE HANDOFF",
    },
    {
        "seconds": 9,
        "title": "A traceable\nanswer.",
        "caption": "Rules extracted automatically.\nSelected records unchanged.\n\nOne traceable pack powers\nthe workspace and submission.\n\nInspect the chain.",
        "full_caption": "Rules extracted automatically. Selected records unchanged. One traceable pack powers the workspace and submission. Inspect the chain.",
        "chapter": "THE EXTRACTION CHAIN",
    },
]


def run(command: list[str], **kwargs):
    return subprocess.run(command, check=True, text=True, capture_output=True, **kwargs)


def binary(name: str, configured: str | None = None) -> str:
    candidate = configured or shutil.which(name)
    if not candidate:
        candidate = f"/opt/homebrew/bin/{name}"
    if not Path(candidate).is_file():
        raise RuntimeError(f"{name} is required; pass --{name} or add it to PATH.")
    return candidate


def font_path(bold: bool, configured: str | None) -> Path:
    choices = [configured] if configured else [
        f"/System/Library/Fonts/Supplemental/Arial{' Bold' if bold else ''}.ttf",
        f"/usr/share/fonts/truetype/dejavu/DejaVuSans{'-Bold' if bold else ''}.ttf",
    ]
    for choice in choices:
        if choice and Path(choice).is_file():
            return Path(choice)
    raise RuntimeError("Supply --font and --bold-font paths to installed fonts.")


def probe(ffprobe: str, path: Path) -> dict:
    result = run([ffprobe, "-v", "error", "-show_entries",
                  "stream=codec_name,width,height,pix_fmt,avg_frame_rate,nb_frames,codec_type:format=duration,size",
                  "-of", "json", str(path)])
    return json.loads(result.stdout)


def escape_filter_path(path: Path) -> str:
    # Quoted filter arguments still require escaping a colon or apostrophe.
    return str(path).replace("\\", "\\\\").replace(":", "\\:").replace("'", "'\\''")


def scene_filter(index: int, scene: dict, work: Path, regular: Path, bold: Path) -> str:
    texts = {
        "brand": "LAWDIFF",
        "chapter": scene["chapter"],
        "title": scene["title"],
        "caption": scene["caption"],
        "capture_note": "Actual interface captures\n· edited walkthrough",
        "number": f"{index:02d} / 06",
        "closing": "From legal change\nto the next review step.",
    }
    for key, value in texts.items():
        (work / f"{key}.txt").write_text(value, encoding="utf-8")

    def draw(key: str, x: int, y: int, size: int, color: str,
             weight: bool = False, spacing: int = 8) -> str:
        font = escape_filter_path(bold if weight else regular)
        text = escape_filter_path(work / f"{key}.txt")
        return (f"drawtext=fontfile='{font}':textfile='{text}':expansion=none:"
                f"x={x}:y={y}:fontsize={size}:fontcolor={color}:line_spacing={spacing}")

    # The source capture is fitted in full, never cropped or reconstructed.
    # Image pane: 1440x1000 at (464,40); rail: 460px wide.
    rail = [
        "drawbox=x=0:y=0:w=460:h=1080:color=0xf5f5f7:t=fill",
        "drawbox=x=44:y=56:w=6:h=23:color=0x155de9:t=fill",
        draw("brand", 63, 55, 23, "0x155de9", True),
        draw("chapter", 44, 210, 15, "0x687180", True),
        draw("title", 41, 256, 40, "0x101218", True, 10),
        "drawbox=x=44:y=388:w=42:h=3:color=0x155de9:t=fill",
        draw("caption", 44, 423, 23, "0x323842", False, 12),
        draw("capture_note", 44, 911, 17, "0x687180", False, 7),
        draw("number", 44, 1008, 17, "0x155de9", True),
    ]
    if index == 6:
        rail.insert(-2, draw("closing", 44, 737, 24, "0x155de9", True, 10))
    # Progress marks communicate six edited still scenes, not interactive motion.
    for step in range(1, 7):
        color = "0x155de9" if step == index else "0xd6dce5"
        rail.append(f"drawbox=x={284 + (step-1)*22}:y=1014:w=14:h=3:color={color}:t=fill")
    return (
        "[0:v]scale=1440:1000:force_original_aspect_ratio=decrease:flags=lanczos:out_range=tv,"
        "format=yuv420p,setsar=1,pad=1440:1000:(ow-iw)/2:(oh-ih)/2:color=0xffffff[capture];"
        f"color=c=0xffffff:s={WIDTH}x{HEIGHT}:r={FPS}," + ",".join(rail) + "[canvas];"
        "[canvas][capture]overlay=464:40:shortest=1,format=yuv420p,setparams=range=limited[out]"
    )


def srt_time(seconds: int) -> str:
    return f"{seconds//3600:02d}:{seconds//60%60:02d}:{seconds%60:02d},000"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--captures", type=Path, default=ROOT / "media/captures")
    parser.add_argument("--output", type=Path, default=ROOT / "media/lawdiff-demo.mp4")
    parser.add_argument("--ffmpeg")
    parser.add_argument("--ffprobe")
    parser.add_argument("--font")
    parser.add_argument("--bold-font")
    parser.add_argument("--check", action="store_true", help="Check source captures; do not render.")
    parser.add_argument("--preview", type=int, choices=range(1, 7), help="Render one layout still instead of the video.")
    args = parser.parse_args()
    ffmpeg, ffprobe = binary("ffmpeg", args.ffmpeg), binary("ffprobe", args.ffprobe)
    regular, bold = font_path(False, args.font), font_path(True, args.bold_font)
    captures = [args.captures / f"review-demo-{i:02d}.png" for i in range(1, 7)]
    address_capture = args.captures / "review-demo-03-address.png"
    needed = [captures[args.preview-1]] if args.preview else captures + [address_capture]
    missing = [str(path) for path in needed if not path.is_file()]
    if missing:
        raise SystemExit("The actual review-workflow captures are required:\n" + "\n".join(missing))
    input_probes = {p.name: probe(ffprobe, p) for p in needed}
    input_hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in needed}
    for path in needed:
        stream = next(s for s in input_probes[path.name]["streams"] if s["codec_type"] == "video")
        if (stream["width"], stream["height"]) != (1440, 1000):
            raise SystemExit(f"Expected the complete 1440x1000 capture: {path.name}")
    if args.check:
        print(json.dumps({"expected_seconds": 56, "output_size": [WIDTH, HEIGHT], "captures": input_probes}, indent=2))
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="lawdiff-demo-") as temp:
        work = Path(temp)
        regular_copy, bold_copy = work / "regular.ttf", work / "bold.ttf"
        shutil.copyfile(regular, regular_copy)
        shutil.copyfile(bold, bold_copy)
        clips = []
        selected = [args.preview] if args.preview else range(1, 7)
        for index in selected:
            scene = SCENES[index-1]
            folder = work / f"scene-{index}"
            folder.mkdir()
            graph = folder / "filter.txt"
            graph.write_text(scene_filter(index, scene, folder, regular_copy, bold_copy), encoding="utf-8")
            segments = ([(address_capture, 4), (captures[index-1], 6)]
                        if index == 3 and not args.preview else [(captures[index-1], scene["seconds"])])
            for segment, (capture, seconds) in enumerate(segments, 1):
                if args.preview:
                    output = args.output.with_name(f"demo-preview-{index:02d}.png")
                    tail = ["-frames:v", "1", "-update", "1", str(output)]
                else:
                    output = folder / f"clip-{segment}.mp4"
                    tail = ["-frames:v", str(seconds * FPS), "-an", "-c:v", "libx264",
                            "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
                            "-level:v", "4.1", "-r", str(FPS), "-threads", "2", str(output)]
                command = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-framerate", str(FPS),
                           "-i", str(capture), "-filter_complex_script", str(graph), "-map", "[out]", *tail]
                run(command)
                if args.preview:
                    print(f"Layout preview: {output}")
                    return
                clips.append(output)
            print(f"Rendered chapter {index}/6 ({scene['seconds']} seconds; actual interface captures)", flush=True)
        concat = work / "clips.txt"
        concat.write_text("".join(f"file '{clip}'\n" for clip in clips), encoding="utf-8")
        pending = args.output.with_name(args.output.stem + ".rendering.mp4")
        run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(concat),
             "-c", "copy", "-movflags", "+faststart", "-metadata", "title=LawDiff — captioned interface walkthrough",
             "-metadata", "comment=Edited walkthrough from actual interface still captures; no simulated cursor actions, reconstructed UI, or audio.", str(pending)])
        result = probe(ffprobe, pending)
        videos = [s for s in result["streams"] if s["codec_type"] == "video"]
        audios = [s for s in result["streams"] if s["codec_type"] == "audio"]
        assert len(videos) == 1 and not audios, "Expected one video stream and no audio."
        stream = videos[0]
        assert (stream["width"], stream["height"], stream["codec_name"], stream["pix_fmt"]) == (WIDTH, HEIGHT, "h264", "yuv420p")
        assert stream["avg_frame_rate"] == "30/1", "Unexpected frame rate."
        assert int(stream["nb_frames"]) == 56 * FPS, "Unexpected frame count."
        assert abs(float(result["format"]["duration"]) - 56) < 0.05, "Unexpected duration."
        assert all(hashlib.sha256(p.read_bytes()).hexdigest() == input_hashes[p.name] for p in needed), "A source capture changed during rendering; re-run with stable captures."
        result["composition"] = {
            "kind": "actual_interface_captures_edited_walkthrough",
            "scene_seconds": [s["seconds"] for s in SCENES],
            "scene_three_seconds": {address_capture.name: 4, captures[2].name: 6},
            "caption_word_count": sum(len(s["full_caption"].split()) for s in SCENES),
            "source_sha256": input_hashes,
            "source_capture_dimensions": [1440, 1000],
            "source_files_modified": False,
            "audio": False,
        }
        pending.replace(args.output)
    elapsed, captions = 0, []
    for index, scene in enumerate(SCENES, 1):
        end = elapsed + scene["seconds"]
        captions.append(f"{index}\n{srt_time(elapsed)} --> {srt_time(end)}\n{scene['full_caption']}\n")
        elapsed = end
    args.output.with_suffix(".srt").write_text("\n".join(captions), encoding="utf-8")
    args.output.with_suffix(".probe.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), "duration_seconds": 56, "resolution": "1920x1080",
                      "codec": "h264", "pixel_format": "yuv420p", "audio": False}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"Media tool failed:\n{exc.stderr}") from exc
