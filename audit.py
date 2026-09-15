from pathlib import Path
import re, json, html
root=Path('/tmp/workshop-fanya-review')
files={p.name for p in root.iterdir() if p.is_file()}
# referenced local assets in HTML/CSS/JS/SW
refs=set()
for p in root.glob('*.html'):
    s=p.read_text(errors='ignore')
    refs.update(re.findall(r'''(?:src|href)=["']([^"'#?]+)''',s))
for p in [root/'service-worker.js', root/'manifest.json']:
    s=p.read_text(errors='ignore')
    refs.update(x.lstrip('./') for x in re.findall(r'''["']\.?/?([A-Za-z0-9_.-]+\.(?:html|js|css|json|png))["']''',s))
missing=sorted(x for x in refs if x and not x.startswith(('http:','https:','data:')) and x not in files and x not in ('.',''))
print('MISSING_REFERENCES', missing)
# IDs per HTML
for p in root.glob('*.html'):
    ids=re.findall(r'''\bid=["']([^"']+)["']''',p.read_text(errors='ignore'))
    dup=sorted({x for x in ids if ids.count(x)>1})
    if dup: print('DUP_IDS',p.name,dup)
# Service worker list exact local files
sw=(root/'service-worker.js').read_text()
listed=set(re.findall(r'''["']\./([^"']+)["']''',sw.split('self.addEventListener("fetch"')[0]))
actual={p.name for p in root.iterdir() if p.is_file() and p.name not in {'README.md','CHANGELOG.md','WORK_ORDER_LIFECYCLE_APPROVED.md'}}
print('SW_UNLISTED_FILES',sorted(actual-listed))
print('SW_MISSING_FILES',sorted(listed-actual))
# compressor DB structural validation
s=(root/'compressor-db.js').read_text(errors='ignore')
json_text=s.split('=',1)[1].rstrip().rstrip(';').strip()
try:
    db=json.loads(json_text)
    records=sum(map(len,db.values()))
    bad=[]
    for brand, rs in db.items():
      for i,r in enumerate(rs):
        if not isinstance(r,dict) or not r.get('model'): bad.append((brand,i))
    print('COMPRESSOR_DB',len(db),records,'bad_records',len(bad),'brands_without_records',sum(not v for v in db.values()))
except Exception as e: print('COMPRESSOR_DB_PARSE_ERROR',repr(e))
# localStorage keys
keys=[]
for p in root.glob('*.js'):
    keys += re.findall(r'''localStorage\.(?:getItem|setItem)\(\s*["']([^"']+)''',p.read_text(errors='ignore'))
print('LOCAL_STORAGE_KEYS',sorted(set(keys)))
