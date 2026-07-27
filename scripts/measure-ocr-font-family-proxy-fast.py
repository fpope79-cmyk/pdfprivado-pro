from __future__ import annotations
import json,math,statistics
from pathlib import Path
from functools import lru_cache
from collections import Counter
import numpy as np
from PIL import Image,ImageDraw,ImageFont
BANK=Path('/mnt/data/pdfprivado-v14-bank');DOCS=['190604','seguro-pages-2-3','190213','maiz','sd7-low-native-text','maiz15-v16prep']
FONTS={'Arial':'/usr/share/fonts/truetype/croscore/Arimo-Regular.ttf','Times New Roman':'/usr/share/fonts/truetype/croscore/Tinos-Regular.ttf','Courier New':'/usr/share/fonts/truetype/croscore/Cousine-Regular.ttf','Calibri':'/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf','Cambria':'/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf'}
@lru_cache(maxsize=4096)
def font(path,px):return ImageFont.truetype(path,max(1,int(px)))
def clean(s):return ' '.join(str(s or '').split())
def clamp(v,a,b):return max(a,min(b,float(v)))
def width(t,size,path):b=font(path,round(size*10)).getbbox(str(t));return max(.01,(b[2]-b[0])/10)
def segs(l):
 s=[x for x in l.get('segments',[]) if clean(x.get('text'))];return s or [{'text':clean(l.get('text')),'x':l.get('x',0),'width':max(1,l.get('width',1))}]
def initial(l,p):
 raw=clamp(l.get('fontSize',9),1,96); ls=p.get('layout',[]);sizes=sorted(float(x.get('fontSize',0)) for x in ls if float(x.get('fontSize',0))>0);med=sizes[len(sizes)//2] if sizes else raw;L=len(clean(l.get('text')).replace(' ',''));mx=med*1.35 if L>=55 else med*1.55 if L>=28 else med*1.8 if L>=18 else math.inf;raw=min(raw,mx);area=max(1,p['width']*p['height']);cov=sum(max(0,float(e.get('width',0)))*max(0,float(e.get('height',e.get('fontSize',0)))) for e in ls)/area;return raw*(1.35/.82 if len(ls)<=32 and cov>=.24 else 1)
def display(l,p,path):
 raw=initial(l,p);ss=segs(l);target=sum(float(s.get('width',0)) for s in ss) if len(ss)>1 else max(1,float(ss[0].get('width',l.get('width',1))));m=sum(width(s['text'],raw,path) for s in ss);fit=clamp(target/max(1,m)*.98,.58,1.08);sparse=len(p.get('layout',[]))<=32;base=.78 if sparse else .86;blend=.72 if sparse else .42;return max(4.2,raw*(fit*blend+base*(1-blend)))
def anchored(l,p,size,path):
 conf=float(l.get('confidence') or 0);runs=sorted([r for r in l.get('styledRuns',[]) if clean(r.get('text')) and 'x'in r and'width'in r],key=lambda r:float(r['x']));
 if conf<75 or not(2<=len(runs)<=28) or sum(len(clean(r['text']).replace(' ','')) for r in runs)<5:return False
 pred=[];act=[]
 for s in segs(l):
  x0=float(s.get('x',l.get('x',0)));x1=x0+float(s.get('width',1));sr=[r for r in runs if x0-.2<=float(r['x'])+float(r['width'])/2<=x1+.2]
  if not sr:continue
  full=' '.join(clean(r['text']) for r in sr);ratio=float(s.get('width',1))/width(full,size,path);sc=round(ratio*100) if .9<=ratio<=1.1 else 100;prefix=''
  for i,r in enumerate(sr):
   if i:prefix+=' '
   pred.append(x0+width(prefix,size,path)*sc/100);act.append(float(r['x']));prefix+=clean(r['text'])
 if len(pred)!=len(runs):return False
 e=[abs(a-b) for a,b in zip(act,pred)];return statistics.fmean(e)>=max(.75,size*.075) or max(e)>=max(1.8,size*.17)
def draw_text(crop,text,x,baseline,size,path,target,scale,origin):
 f=font(path,round(size*scale)); xx=x*scale-origin[0]; yy=baseline*scale-origin[1]; bbox=f.getbbox(text,anchor='ls');w=max(1,bbox[2]-bbox[0]);ratio=(target*scale)/w if target else 1
 if .78<=ratio<=1.22 and abs(ratio-1)>=.02:
  h=max(8,round(size*scale*1.8));tmp=Image.new('L',(w+8,h),0);d=ImageDraw.Draw(tmp);d.text((2,h*.72),text,font=f,fill=255,anchor='ls');tmp=tmp.resize((max(1,round((w+8)*ratio)),h),Image.Resampling.BICUBIC);crop.paste((0,0,0),(round(xx),round(yy-h*.72)),tmp)
 else:ImageDraw.Draw(crop).text((xx,yy),text,font=f,fill=(0,0,0),anchor='ls')
def err(src,gfx,cand):
 s=np.asarray(src).astype(np.int16);g=np.asarray(gfx).astype(np.int16);c=np.asarray(cand).astype(np.int16);sd=np.max(np.abs(s-g),2);cd=np.max(np.abs(c-g),2);m=(sd>=18)|(cd>=18)
 return float(np.abs(s-c).mean(2)[m].mean()) if m.sum()>=30 else math.inf
def main():
 res=[]
 for doc in DOCS:
  root=BANK/doc;pp=root/'document.json';pp=pp if pp.exists() else root/'document-geometry.json';data=json.load(open(pp))
  for page in data['pages']:
   if page.get('source')!='ocr' or not(root/page.get('graphicsImage','')).exists():continue
   src=Image.open(root/page['sourceImage']).convert('RGB');gfx=Image.open(root/page['graphicsImage']).convert('RGB');scale=src.width/page['width']
   for li,l in enumerate(page.get('layout',[])):
    text=clean(l.get('text'));conf=float(l.get('confidence') or 0)
    if conf<75 or len(text.replace(' ',''))<7:continue
    runs=[r for r in l.get('styledRuns',[]) if clean(r.get('text')) and'x'in r and'width'in r];hint=statistics.median(page['height']-float(r['y']) for r in runs) if runs else float(l.get('ocrBottom') or 0);top=float(l.get('ocrTop') or hint-float(l.get('height',10)))
    x0=max(0,math.floor((float(l.get('x',0))-4)*scale));x1=min(src.width,math.ceil((float(l.get('x',0))+float(l.get('width',1))+4)*scale));y0=max(0,math.floor((top-5)*scale));y1=min(src.height,math.ceil((hint+5)*scale))
    if x1-x0<10 or y1-y0<8:continue
    sc=src.crop((x0,y0,x1,y1));gc=gfx.crop((x0,y0,x1,y1));errs={}
    for fam,path in FONTS.items():
     ds=display(l,page,path);cc=gc.copy()
     if anchored(l,page,ds,path) and runs:
      for r in sorted(runs,key=lambda z:float(z['x'])):draw_text(cc,clean(r['text']),float(r['x']),hint,ds,path,float(r['width']),scale,(x0,y0))
     else:
      for sg in segs(l):draw_text(cc,clean(sg['text']),float(sg.get('x',l.get('x',0))),hint,ds,path,float(sg.get('width',1)),scale,(x0,y0))
     errs[fam]=err(sc,gc,cc)
    if not math.isfinite(errs['Arial']):continue
    best=min(errs,key=errs.get);gain=(errs['Arial']-errs[best])/max(1,errs['Arial']);res.append({'doc':doc,'page':page['pageNumber'],'line':li,'text':text[:100],'arial':errs['Arial'],'bestFamily':best,'best':errs[best],'relativeGain':gain,'errors':errs})
  print(doc,'processed',len(res))
 strong=[r for r in res if r['bestFamily']!='Arial' and r['relativeGain']>=.04 and r['arial']-r['best']>=.6]
 sm={'lines':len(res),'bestFamilies':dict(Counter(r['bestFamily'] for r in res)),'strongNonArial':len(strong),'strongFamilies':dict(Counter(r['bestFamily'] for r in strong)),'meanGainStrong':statistics.fmean(r['relativeGain'] for r in strong) if strong else 0,'examples':sorted(strong,key=lambda r:r['relativeGain'],reverse=True)[:25]}
 out=Path('/mnt/data/pdfprivado-v15-work/benchmark/v17-font-family-proxy.json');out.write_text(json.dumps({'summary':sm,'lines':res},ensure_ascii=False,indent=2));print(json.dumps(sm,ensure_ascii=False,indent=2));print(out)
if __name__=='__main__':main()
