"""Import the supplied public starter pack without guessing missing building facts."""
import csv, hashlib, json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
STARTER=ROOT/'data/starter'
def csvrows(path): return list(csv.DictReader(path.open(encoding='utf-8-sig')))
addresses=csvrows(STARTER/'data/sample_addresses.csv')
geocodes=json.loads((ROOT/'data/geocodes.json').read_text()) if (ROOT/'data/geocodes.json').exists() else {}
for row in addresses:
    row['year_built']=int(row['year_built']) if row['year_built'].isdigit() else None
    row['units']=int(row['units']) if row['units'].isdigit() else None
    row['geography']=geocodes.get(row['address_id'])
sources=csvrows(STARTER/'corpus/corpus_manifest.csv')
for row in sources:
    path=STARTER/'corpus'/row['text_file'] if row['text_file'] else None
    row['text']=path.read_text(encoding='utf-8-sig') if path and path.is_file() else None
    row['available']=bool(row['text'] and len(row['text'])>200)
    row['download_sha256']=hashlib.sha256(path.read_bytes()).hexdigest() if path and path.is_file() else None
for extra in sorted((ROOT/'data/supplemental').glob('*.json')):
    records=json.loads(extra.read_text())
    if isinstance(records,list):
        for row in records:
            row.setdefault('available',bool(row.get('text')))
            row.setdefault('download_sha256',hashlib.sha256(row.get('text','').encode()).hexdigest())
            row.setdefault('capture','supplemental')
            sources.append(row)
changes=json.loads((STARTER/'dev/change_tests.json').read_text())
ui={
 'T1':{'short':'California pricing restrictions','heading':'A statewide change.\nEvery address in view.','description':'California’s AB 325 / SB 763 change case crosses its January 2026 effective date. Compare the same buildings on either side.','label':'CALIFORNIA · STATE LAW','states':['CA'],'sources':['C001','D022'],'symbol':'01','date':'2026-01-02'},
 'T2':{'short':'Two cities. Two boundaries.','heading':'Same state.\nDifferent local rules.','description':'Hoboken and Jersey City have separate local restrictions. The legal city boundary determines which one belongs in an address’s answer.','label':'NEW JERSEY · LOCAL LAWS','states':['NJ'],'sources':[],'symbol':'02','date':'2026-10-01'},
 'T3':{'short':'New Jersey FAIR Act','heading':'One law changes.\nSee what follows.','description':'New Jersey’s FAIR Act takes effect July 1, 2027. Trace its scope across the sample and identify the property facts that still need review.','label':'NEW JERSEY · STATE LAW','states':['NJ'],'sources':['D069'],'symbol':'03','date':'2027-07-02'},
 'T4':{'short':'Massachusetts proposals','heading':'A possible future.\nClearly marked.','description':'Explore the scope of two pending bills. A proposal stays a proposal, even when the date moves forward.','label':'MASSACHUSETTS · PENDING BILLS','states':['MA'],'sources':['M001','M002'],'symbol':'04','date':'2026-10-01'},
 'T5':{'short':'The proposal that did not pass','heading':'No new rule.\nThat matters, too.','description':'The supplied change case records the rent-control ballot question as struck. It must never become an active rent cap.','label':'MASSACHUSETTS · FAILED PROPOSAL','states':['MA'],'sources':['O001','D048'],'symbol':'05','date':'2026-10-01'}
}
for c in changes: c.update(ui[c['test_id']])
data={'version':1,'snapshot':'2026-10-01','addresses':addresses,'sources':sources,'changes':changes,'stats':{'addresses':len(addresses),'sourceRecords':len(sources),'availableTexts':sum(x['available'] for x in sources),'states':len(set(a['state'] for a in addresses)),'geocoded':sum(bool(a['geography'] and a['geography'].get('legal_city')) for a in addresses)},'organizerScoringAvailable':(STARTER/'score.py').exists()}
(ROOT/'public/data').mkdir(exist_ok=True,parents=True)
(ROOT/'public/data/catalog.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
pack=ROOT/'public/data/rule-pack.json'
if not pack.exists(): pack.write_text(json.dumps({'version':1,'generated_at':None,'method':'not_run','rules':[],'review':[],'audit':[]}))
print(json.dumps(data['stats'],indent=2))
