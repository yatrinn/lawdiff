#!/usr/bin/env python3
"""Bundle the verified challenge files and presentation assets, without credentials."""
from pathlib import Path
import hashlib
import json
import subprocess
import zipfile

root = Path(__file__).resolve().parents[1]
target = root.parent / "LawDiff-Abgabepaket.zip"
files = {}
for name in ("rules.json", "lookups.json", "changes.json", "extraction-audit.json", "method-note.pdf"):
    files[name] = root / "submission" / name
for name in ("extraction-run.json", "extraction-candidates.json"):
    files[f"pipeline/{name}"] = root / "public/data" / name
for name in ("lawdiff-demo.mp4", "lawdiff-tech.mp4", "VIDEO_NOTES.md", "TECH_VIDEO_NOTES.md"):
    files[f"media/{name}"] = root / "media" / name
for path in (root / "media").glob("lawdiff-*.srt"):
    files[f"media/{path.name}"] = path
for path in (root / "presentation").iterdir():
    if path.suffix in (".pdf", ".pptx"):
        files[f"presentation/{path.name}"] = path
for path in (root / "docs").glob("*.md"):
    files[f"docs/{path.name}"] = path
for path in files.values():
    if not path.is_file():
        raise SystemExit(f"Missing deliverable: {path.name}")
manifest = {
    "repository": "https://github.com/yatrinn/lawdiff",
    "demo": "https://yatrinn.github.io/lawdiff/",
    "commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=root, text=True).strip(),
    "event_submitted": False,
    "still_required": ["Yannik's authentic team video", "Yannik's team photograph", "Final submission on HackOS and Google Form"],
    "sha256": {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files.items()},
}
intro = """LAWD IFF / HACK-NATION 7 / REALPAGE

Öffentliche Demo: https://yatrinn.github.io/lawdiff/
Vollständiger Quellcode: https://github.com/yatrinn/lawdiff

Die drei Challenge-Dateien und die einseitige Methodennotiz liegen direkt hier.
media/ enthält den Demo- und Technikfilm (je 56 Sekunden, englische Einblendungen,
ohne Ton). presentation/ enthält den Pitch als PDF und bearbeitbare PowerPoint.
docs/submission-guide.md führt durch beide erforderlichen Abgaben.
docs/video-scripts.md enthält deinen englischen Text für das persönliche Teamvideo.

NOCH OFFEN: Dein echtes Teamvideo, dein Foto und die endgültige Einreichung auf
HackOS UND im Google-Formular. Es wurde noch nichts beim Hackathon eingereicht.
Abgabe laut bereitgestellten Eventangaben: 4. Oktober 2026, 15:00 Europe/Berlin.

Die automatisierten Prüfungen belegen technische Eigenschaften, keine unabhängige
rechtliche Prüfung. Quellen- und Datenlücken sind in der App und Methodennotiz
ausgewiesen. manifest.json enthält Dateiprüfsummen und den Quellcode-Commit.
""".replace("LAWD IFF", "LAWDIFF")
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as out:
    out.writestr("START-HERE.txt", intro)
    out.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))
    for name, path in sorted(files.items()):
        out.write(path, name)
with zipfile.ZipFile(target) as out:
    failure = out.testzip()
    if failure:
        raise SystemExit(f"Archive integrity error: {failure}")
print(f"Created {target.name}: {len(files) + 2} files, {target.stat().st_size:,} bytes")
