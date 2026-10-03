#!/usr/bin/env python3
"""Render a clearly labelled data diagram from a successful, recorded extraction."""
import hashlib
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw
from render_tech import font

ROOT = Path(__file__).resolve().parents[1]
receipt = json.loads((ROOT / 'public/data/extraction-run.json').read_text())
pack = json.loads((ROOT / 'public/data/extraction-candidates.json').read_text())
catalog = json.loads((ROOT / 'public/data/catalog.json').read_text())
assert receipt['status'] in ('completed_machine_validation', 'completed_with_review_items')
assert receipt['requests_sent'] > 0 and len(pack['rules']) == receipt['accepted_rule_count'] > 0
r = next((r for r in pack['rules'] if r['source_doc_id'] == 'D069'), pack['rules'][0])
s = next(s for s in catalog['sources'] if s['doc_id'] == r['source_doc_id'])
run_source = next(s for s in receipt['sources'] if s['source_doc_id'] == r['source_doc_id'])
assert run_source['status'] == 'validated_candidates'
assert hashlib.sha256(s['text'].encode()).hexdigest() == run_source['source_sha256']
assert r['quoted_span'] in s['text']
im = Image.new('RGB', (1440, 1000), '#ffffff'); d = ImageDraw.Draw(im)
INK, BLUE, MUTED = '#17191d', '#155de9', '#667180'
def put(x, y, text, size=30, color=INK, bold=False, width=1300):
    f = font(size, bold)
    for line in text.splitlines():
        assert d.textlength(line, font=f) <= width, line
    d.multiline_text((x,y), text, font=f, fill=color, spacing=10)
put(66, 54, 'RECORDED EXTRACTION  /  ACTUAL OUTPUT', 23, BLUE, True)
put(62, 116, 'From law to a checked rule.', 55, bold=True)
candidate_noun = 'candidate' if len(pack['rules']) == 1 else 'candidates'
put(66, 198, f'{receipt["model"]}  ·  {len(receipt["sources"])} sources  ·  {len(pack["rules"])} {candidate_noun}  ·  {len(pack["review"])} review items', 29, MUTED)
for x, title in [(66, '01  Source'), (540, '02  Model'), (1014, '03  Check')]:
    put(x, 300, title, 34, BLUE, True, 360)
put(66, 371, r['source_doc_id'], 48, bold=True, width=350)
put(66, 442, '\n'.join(textwrap.wrap(s['jurisdictions'], 22)), 28, MUTED, width=390)
put(540, 371, 'Structured JSON', 35, bold=True, width=410)
put(540, 435, 'Rule + conditions\n+ exact quotation', 27, MUTED, width=395)
put(1014, 371, 'Passed', 42, bold=True, width=350)
put(1014, 435, 'Source identity\nSchema + spans', 27, MUTED, width=350)
for x in (461, 936):
    d.line((x,395,x+46,395), fill='#a4afbf', width=3)
    d.polygon([(x+55,395),(x+43,388),(x+43,402)], fill='#a4afbf')
d.rounded_rectangle((65,563,1375,858), radius=24, fill='#f5f7fa')
put(95, 593, 'EXTRACTED SOURCE PASSAGE · EXCERPT', 21, BLUE, True)
quote = ' '.join(r['quoted_span'].split())
lines = textwrap.wrap(quote, 75)
if len(lines) > 4: lines = lines[:4]; lines[-1] = lines[-1].rstrip(' .') + ' …'
put(95, 642, '\n'.join(lines), 28, width=1220)
put(95, 815, 'Source SHA-256: ' + run_source['source_sha256'][:32] + '…', 21, MUTED)
put(66, 902, 'Recorded result, not live playback. Candidates still require legal review.', 25, MUTED)
put(66, 948, 'The 58-record public pack has separate Codex-assisted provenance.', 23, MUTED)
out = ROOT / 'media/extraction-receipt.png'
im.save(out)
print(f'Created {out.name} from the recorded run; {len(pack["rules"])} candidates.')
