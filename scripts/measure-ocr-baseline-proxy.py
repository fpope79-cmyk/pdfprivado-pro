from __future__ import annotations
import json,statistics,math
from pathlib import Path
import numpy as np
from PIL import Image
BANK=Path('/mnt/data/pdfprivado-v14-bank');DOCS=['190604','seguro-pages-2-3','190213','maiz','sd7-low-native-text','maiz15-v16prep']
rows=[]
for doc in DOCS:
 root=BANK/doc;pp=root/'document.json';pp=pp if pp.exists() else root/'document-geometry.json';data=json.load(open(pp))
 for page in data['pages']:
  if page.get('source')!='ocr' or not(root/page.get('graphicsImage','')).exists():continue
  src=np.asarray(Image.open(root/page['sourceImage']).convert('RGB'),dtype=np.int16);gfx=np.asarray(Image.open(root/page['graphicsImage']).convert('RGB'),dtype=np.int16);sy=src.shape[0]/page['height'];sx=src.shape[1]/page['width'];diff=np.max(np.abs(src-gfx),axis=2)
  for i,l in enumerate(page.get('layout',[])):
   conf=float(l.get('confidence') or 0);runs=[r for r in l.get('styledRuns',[]) if 'y'in r and 'height'in r]
   if conf<75 or len(runs)<3:continue
   robust=statistics.median(page['height']-float(r['y']) for r in runs)
   union=float(l.get('ocrBottom') or (float(l.get('ocrTop',0))+float(l.get('height',0))))
   top=float(l.get('ocrTop') or max(0,robust-float(l.get('height',10))))
   x0=max(0,int((float(l.get('x',0))-2)*sx));x1=min(src.shape[1],int((float(l.get('x',0))+float(l.get('width',1))+2)*sx)+1);y0=max(0,int((top-1)*sy));y1=min(src.shape[0],int((max(union,robust)+2)*sy)+1)
   if x1-x0<4 or y1-y0<4:continue
   region=diff[y0:y1,x0:x1]; ink=(region>=30); counts=ink.sum(axis=1)
   # baseline proxy = strongest ink row in lower 60% of text box, then +0.5 pixel.
   start=max(0,int(len(counts)*.40));tail=counts[start:]
   if tail.size==0 or tail.max()<3:continue
   target=(y0+start+int(np.argmax(tail))+0.5)/sy
   rows.append({'doc':doc,'page':page['pageNumber'],'line':i,'target':target,'robust':robust,'union':union,'signedRobust':target-robust,'signedUnion':target-union,'absRobust':abs(target-robust),'absUnion':abs(target-union)})
print('lines',len(rows))
for key in ['signedRobust','signedUnion','absRobust','absUnion']:
 vals=[r[key] for r in rows];print(key,'mean',statistics.fmean(vals),'median',statistics.median(vals),'p10',sorted(vals)[int(.1*len(vals))],'p90',sorted(vals)[int(.9*len(vals))])
print('robust better',sum(r['absRobust']<r['absUnion'] for r in rows),'union better',sum(r['absUnion']<r['absRobust'] for r in rows),'tie',sum(abs(r['absUnion']-r['absRobust'])<1e-9 for r in rows))
out=Path('/mnt/data/pdfprivado-v15-work/benchmark/v16-baseline-proxy.json');out.write_text(json.dumps({'summary':{'lines':len(rows),'meanSignedRobust':statistics.fmean(r['signedRobust'] for r in rows),'medianSignedRobust':statistics.median(r['signedRobust'] for r in rows),'meanAbsRobust':statistics.fmean(r['absRobust'] for r in rows),'meanAbsUnion':statistics.fmean(r['absUnion'] for r in rows)},'rows':rows},indent=2),encoding='utf8')
