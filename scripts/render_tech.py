#!/usr/bin/env python3
"""Render the captioned technical explanation; these are diagrams, not app captures.

Requires Pillow, ffmpeg, ffprobe, Node/npm, and the Python standard library.
Runs the current test suites and verifies visible snapshot counts before encoding.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT.parents[1] / "work" / "lawdiff-tech"
MEDIA = ROOT / "media"
WIDTH, HEIGHT, FPS = 1920, 1080, 30
BLUE, INK, MUTED = "#155DE9", "#17191D", "#667180"
LIGHT, LINE, WHITE = "#F5F7FA", "#D9DFE7", "#FFFFFF"
FONT_PATHS = {
    False: ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
    True: ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
}


def run(args, log=None):
    proc = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if log:
        (WORK / log).write_text(proc.stdout + proc.stderr)
    if proc.returncode:
        raise RuntimeError(f"Command failed: {args[0]}\n{proc.stderr[-3000:]}\n{proc.stdout[-3000:]}")
    return proc.stdout + proc.stderr


def font(size, bold=False):
    for path in FONT_PATHS[bold]:
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    raise RuntimeError("An Arial or DejaVu Sans font is required.")


def text(draw, xy, content, size, color=INK, bold=False, max_width=None, spacing=12):
    f = font(size, bold)
    if max_width:
        for line in content.splitlines():
            if draw.textlength(line, font=f) > max_width:
                raise ValueError(f"Text would overflow: {line}")
    draw.multiline_text(xy, content, font=f, fill=color, spacing=spacing, anchor="la")


def arrow(draw, x1, y, x2, color=LINE):
    draw.line((x1, y, x2 - 13, y), fill=color, width=3)
    draw.polygon([(x2, y), (x2 - 13, y - 7), (x2 - 13, y + 7)], fill=color)


def rule(draw, y):
    draw.line((112, y, 1808, y), fill=LINE, width=2)


def base(index, headline, caption):
    im = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    d = ImageDraw.Draw(im)
    text(d, (112, 58), "LawDiff", 39, BLUE, True)
    text(d, (1057, 66), "Technical walkthrough · Captioned", 27, MUTED, max_width=751)
    text(d, (112, 161), headline, 78, bold=True, max_width=1696, spacing=13)
    rule(d, 866)
    text(d, (112, 903), caption, 34, INK, max_width=1696, spacing=14)
    text(d, (112, 1021), "Technical diagrams · Build snapshot: October 4, 2026", 22, MUTED)
    text(d, (1717, 1021), f"0{index} / 06", 22, MUTED)
    return im, d


def rounded(d, box, color=LIGHT, outline=None):
    d.rounded_rectangle(box, radius=26, fill=color, outline=outline, width=2)


def check_snapshot():
    catalog = json.loads((ROOT / "public/data/catalog.json").read_text())
    pack = json.loads((ROOT / "public/data/rule-pack.json").read_text())
    sources = {s["doc_id"]: s for s in catalog["sources"]}
    spans = 0
    for record in pack["rules"]:
        assert record["quoted_span"] in sources[record["source_doc_id"]]["text"]
        spans += 1
        for kind in ("source_evidence", "additional_evidence", "relation_evidence"):
            for ev in record.get(kind, []):
                sid = ev.get("doc_id") or ev.get("source_doc_id") or record["source_doc_id"]
                quote = ev.get("quote") or ev.get("quoted_span")
                assert quote in sources[sid]["text"]
                spans += 1
    matches = sum(bool(a.get("geography", {}).get("legal_city")) for a in catalog["addresses"])
    observed = {"records": len(pack["rules"]), "quotation_spans": spans, "addresses": len(catalog["addresses"]), "legal_city_matches": matches}
    assert observed == {"records": 58, "quotation_spans": 193, "addresses": 500, "legal_city_matches": 475}, observed
    node_output = run(["npm", "test"], "javascript-tests.txt")
    assert re.search(r"tests\s+45\b", node_output) and re.search(r"pass\s+45\b", node_output)
    py_output = run([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "*_test.py"], "geography-tests.txt")
    assert "Ran 10 tests" in py_output and "OK" in py_output
    observed.update(javascript_tests=45, geography_tests=10, pack_sha256=hashlib.sha256((ROOT / "public/data/rule-pack.json").read_bytes()).hexdigest())
    (WORK / "snapshot.json").write_text(json.dumps(observed, indent=2))
    return sources


def scenes(sources):
    frames = []
    captions = []
    receipt = json.loads((ROOT / "public/data/extraction-run.json").read_text())
    candidates = json.loads((ROOT / "public/data/extraction-candidates.json").read_text())
    assert receipt["status"] in ("completed_machine_validation", "completed_with_review_items")
    assert receipt["requests_sent"] > 0 and receipt["accepted_rule_count"] == len(candidates["rules"]) > 0
    successful = [s for s in receipt["sources"] if s["status"] == "validated_candidates"]
    assert successful
    for s in successful:
        assert hashlib.sha256(sources[s["source_doc_id"]]["text"].encode()).hexdigest() == s["source_sha256"]
    for r in candidates["rules"]:
        assert r["quoted_span"] in sources[r["source_doc_id"]]["text"]
    cap = "A recorded Codex CLI run reads source text and emits rule candidates.\nExact quotations and executable conditions are checked before review."
    im, d = base(1, "Source in.\nChecked candidates out.", cap)
    for x, num, title, detail in [(112, "01", "Read", ", ".join(s["source_doc_id"] for s in successful)), (728, "02", "Extract", receipt["model"]), (1344, "03", "Validate", "Schema + exact spans")]:
        text(d, (x, 421), num, 27, BLUE, True)
        text(d, (x, 475), title, 57, INK, True)
        text(d, (x, 559), detail, 30, MUTED, max_width=464)
    arrow(d, 565, 510, 666)
    arrow(d, 1180, 510, 1287)
    rounded(d, (112, 672, 1808, 818))
    text(d, (151, 700), str(receipt["accepted_rule_count"]), 64, BLUE, True)
    noun = "candidate" if receipt["accepted_rule_count"] == 1 else "candidates"
    text(d, (255, 715), f'{noun} · {receipt["review_issue_count"]} review items', 34, INK, True)
    text(d, (1008, 700), "Separate from the 58-record public pack.", 28, MUTED)
    text(d, (1008, 752), "Interpretation still needs expert review.", 28, MUTED)
    frames.append(im); captions.append(cap)

    cap = "Captured files carry hashes. Primary and supplemental quotations\nmust occur verbatim in their referenced source texts."
    im, d = base(2, "Keep the chain\nof evidence.", cap)
    columns = [(112, "01", "Capture", "Source identity + file hash"), (728, "02", "Link", "Record + exact passage"), (1344, "03", "Check", "Verbatim source match")]
    for x, n, title, sub in columns:
        text(d, (x, 421), n, 27, BLUE, True)
        text(d, (x, 475), title, 57, INK, True)
        text(d, (x, 559), sub, 30, MUTED)
    arrow(d, 565, 510, 666)
    arrow(d, 1180, 510, 1287)
    rounded(d, (112, 672, 1808, 818))
    text(d, (151, 708), "193", 62, BLUE, True)
    text(d, (297, 721), "checked quotation spans", 36, INK, True)
    sha = sources["D069"]["download_sha256"]
    text(d, (1025, 701), "D069 · captured file SHA-256", 25, MUTED)
    text(d, (1025, 745), sha[:28] + "…", 28, INK)
    frames.append(im); captions.append(cap)

    cap = "One JavaScript engine serves browser answers and submission exports.\nIt evaluates a restricted rule language. Runtime makes no model calls."
    im, d = base(3, "One engine.\nTwo outputs.", cap)
    rounded(d, (112, 421, 635, 710))
    text(d, (151, 463), "Restricted conditions", 38, INK, True)
    text(d, (151, 537), "all  ·  any  ·  not", 36, BLUE, True)
    text(d, (151, 604), "Allowed facts + comparisons", 29, MUTED)
    arrow(d, 667, 566, 751, BLUE)
    rounded(d, (789, 421, 1260, 710), INK)
    text(d, (841, 474), "Shared engine", 43, WHITE, True)
    text(d, (841, 548), "public/engine.mjs", 30, "#C6CFDB")
    text(d, (841, 616), "Deterministic evaluation", 28, "#C6CFDB")
    arrow(d, 1294, 566, 1377, BLUE)
    text(d, (1421, 466), "Browser", 44, INK, True)
    text(d, (1421, 600), "Exports", 44, INK, True)
    text(d, (112, 770), "User simulations stay separate from original sample exports.", 29, MUTED)
    frames.append(im); captions.append(cap)

    cap = "Missing evidence remains unknown unless another condition decides it.\nCalendar checks distinguish effective dates from pending proposals."
    im, d = base(4, "Missing facts\nstay missing.", cap)
    for x, title, sub, fill in [(112, "TRUE", "Condition satisfied", LIGHT), (695, "FALSE", "Condition excluded", LIGHT), (1278, "UNKNOWN", "Evidence still needed", "#EAF0FF")]:
        rounded(d, (x, 428, x + 530, 654), fill)
        text(d, (x + 36, 465), title, 51, BLUE if title == "UNKNOWN" else INK, True)
        text(d, (x + 36, 556), sub, 30, MUTED)
    text(d, (112, 731), "FALSE + UNKNOWN in an AND condition → FALSE", 33, INK, True)
    text(d, (112, 789), "Advancing the date never makes a pending bill active.", 29, MUTED)
    frames.append(im); captions.append(cap)

    cap = "Regression tests challenge source tampering, jurisdiction mismatches,\nmalformed conditions, calendar boundaries and geographic provenance."
    im, d = base(5, "Test the\nfailure cases.", cap)
    text(d, (112, 412), "45", 116, INK, True)
    text(d, (112, 566), "JavaScript tests passed", 33, MUTED)
    text(d, (569, 412), "10", 116, INK, True)
    text(d, (569, 566), "Geography tests passed", 33, MUTED)
    for y, item in [(442, "Altered quotation"), (544, "Wrong source jurisdiction"), (646, "Malformed condition")]:
        text(d, (1080, y), item, 31, INK, True)
        text(d, (1593, y), "Rejected", 31, BLUE, True)
    text(d, (112, 773), "Internal regression checks. No official accuracy score is claimed.", 29, MUTED)
    frames.append(im); captions.append(cap)

    cap = "475 sample addresses have matched legal cities; 25 remain unresolved.\nExact quotations support review. They do not prove legal interpretation."
    im, d = base(6, "Traceable\nis not certified.", cap)
    text(d, (105, 412), "475 / 500", 124, BLUE, True)
    text(d, (112, 584), "Sample addresses with matched legal cities", 34, MUTED)
    text(d, (1163, 422), "25", 107, INK, True)
    text(d, (1167, 576), "City matches unresolved", 34, MUTED)
    rule(d, 683)
    text(d, (112, 737), "Expert legal review remains necessary.", 44, INK, True)
    text(d, (112, 804), "Prototype · Match counts are not measured legal accuracy.", 28, MUTED)
    frames.append(im); captions.append(cap)
    return frames, captions


def write_srt(captions, durations):
    def stamp(seconds):
        return f"00:{seconds // 60:02}:{seconds % 60:02},000"
    cursor, cues = 0, []
    for i, (caption, duration) in enumerate(zip(captions, durations), 1):
        cues.append(f"{i}\n{stamp(cursor)} --> {stamp(cursor + duration)}\n{caption}\n")
        cursor += duration
    assert cursor == 56
    (MEDIA / "lawdiff-tech.srt").write_text("\n".join(cues), encoding="utf-8")


def main():
    WORK.mkdir(parents=True, exist_ok=True)
    MEDIA.mkdir(parents=True, exist_ok=True)
    for binary in ("ffmpeg", "ffprobe", "npm"):
        if not shutil.which(binary):
            raise RuntimeError(f"Missing dependency: {binary}")
    sources = check_snapshot()
    frames, captions = scenes(sources)
    durations = [9, 9, 10, 10, 10, 8]
    write_srt(captions, durations)
    concat = []
    for i, (im, duration) in enumerate(zip(frames, durations), 1):
        path = WORK / f"scene-{i:02}.png"
        im.save(path)
        concat.extend([f"file '{path.as_posix()}'", f"duration {duration}"])
    concat.append(f"file '{(WORK / 'scene-06.png').as_posix()}'")
    manifest = WORK / "timeline.ffconcat"
    manifest.write_text("\n".join(concat) + "\n")
    output = MEDIA / "lawdiff-tech.mp4"
    run(["ffmpeg", "-hide_banner", "-y", "-f", "concat", "-safe", "0", "-i", str(manifest), "-vf", f"fps={FPS},format=yuv420p", "-t", "56", "-c:v", "libx264", "-profile:v", "high", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", "-an", "-metadata", "title=LawDiff — Technical walkthrough · Captioned", "-metadata", "comment=Technical diagrams with verified automatic extraction receipt; build snapshot 2026-10-04; no legal accuracy claim.", str(output)], "ffmpeg.log")
    probe = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(output)]))
    video = next(s for s in probe["streams"] if s["codec_type"] == "video")
    assert video["codec_name"] == "h264" and video["width"] == WIDTH and video["height"] == HEIGHT
    assert float(probe["format"]["duration"]) == 56.0
    assert video["nb_frames"] == "1680"
    (WORK / "ffprobe.json").write_text(json.dumps(probe, indent=2))
    (WORK / "captions.json").write_text(json.dumps([{"duration": duration, "caption": cap} for duration, cap in zip(durations, captions)], indent=2))
    print(json.dumps({"file": str(output), "duration_seconds": 56, "width": WIDTH, "height": HEIGHT, "frames": 1680, "audio": False, "bytes": output.stat().st_size}, indent=2))


if __name__ == "__main__":
    main()
