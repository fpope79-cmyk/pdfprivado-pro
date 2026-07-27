from __future__ import annotations
import json, math, statistics
from pathlib import Path
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BANK=Path('/mnt/data/pdfprivado-v14-bank')
DOCS=['190604','seguro-pages-2-3','190213','maiz','sd7-low-native-text','maiz15-v16prep']
FONTS={
 'Arial':'/usr/share/fonts/truetype/croscore/Arimo-Regular.ttf',
 'Times New Roman':'/usr/share/fonts/truetype/croscore/Tinos-Regular.ttf',
 'Courier New':'/usr/share/fonts/truetype/croscore/Cousine-Regular.ttf',
 'Calibri':'/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf',
 'Cambria':'/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf',
}
@lru_cache(maxsize=2048)
def font(path,px): return ImageFont.truetype(path,max(1,int(px)))
def clean(s): return ' '.join(str(s or '').split())
def clamp(v,a,b): return max(a,min(b,float(v)))
def width(text,size,path):
    f=font(path,max(1,round(size*10))); b=f.getbbox(str(text or '')); return max(.01,(b[2]-b[0])/10)
def segs(line):
    s=[x for x in line.get('segments',[]) if clean(x.get('text'))]
    return s or [{'text':clean(line.get('text')),'x':line.get('x',0),'width':max(1,line.get('width',1))}]
def initial(line,page):
    raw=clamp(line.get('fontSize',9),1,96); layout=page.get('layout',[]); sizes=sorted(float(x.get('fontSize',0)) for x in layout if float(x.get('fontSize',0))>0); med=sizes[len(sizes)//2] if sizes else raw; L=len(clean(line.get('text')).replace(' ','')); mx=med*1.35 if L>=55 else med*1.55 if L>=28 else med*1.80 if L>=18 else math.inf; raw=min(raw,mx); area=max(1,page['width']*page['height']); cov=sum(max(0,float(e.get('width',0)))*max(0,float(e.get('height',e.get('fontSize',0)))) for e in layout)/area; return raw*(1.35/.82 if len(layout)<=32 and cov>=.24 else 1)
def display(line,page,path):
    raw=initial(line,page); ss=segs(line); target=sum(max(0,float(s.get('width',0))) for s in ss) if len(ss)>1 else max(1,float(ss[0].get('width',line.get('width',1)))); measured=sum(width(s['text'],raw,path) for s in ss); fit=clamp((target/max(1,measured))*.98,.58,1.08); sparse=len(page.get('layout',[]))<=32; base=.78 if sparse else .86; blend=.72 if sparse else .42; return max(4.2,raw*(fit*blend+base*(1-blend)))
def anchor(line,page,size,path):
    conf=float(line.get('confidence') or 0); runs=sorted([r for r in line.get('styledRuns',[]) if clean(r.get('text')) and 'x' in r and 'width' in r],key=lambda r:float(r['x']));
    if conf<75 or len(runs)<2 or len(runs)>28 or sum(len(clean(r['text']).replace(' ','')) for r in runs)<5:return False
    # v14 prediction error using this family
    pred=[];act=[]
    for s in segs(line):
        x0=float(s.get('x',line.get('x',0)));x1=x0+float(s.get('width',1));sr=[r for r in runs if x0-.2<=float(r['x'])+float(r['width'])/2<=x1+.2]
        if not sr:continue
        full=' '.join(clean(r['text']) for r in sr); m=width(full,size,path); ratio=float(s.get('width',1))/max(.01,m); sc=round(ratio*100) if .90<=ratio<=1.10 else 100; prefix=''
        for i,r in enumerate(sr):
            if i:prefix+=' '
            pred.append(x0+width(prefix,size,path)*sc/100);act.append(float(r['x']));prefix+=clean(r['text'])
    if len(pred)!=len(runs):return False
    es=[abs(a-b) for a,b in zip(act,pred)]; return statistics.fmean(es)>=max(.75,size*.075) or max(es)>=max(1.8,size*.17)
def draw_scaled(base,text,x,baseline,size,path,target_width=None,scale=2):
    f=font(path,max(1,round(size*scale))); # PIL baseline anchor
    if target_width is None:
        ImageDraw.Draw(base).text((x*scale,baseline*scale),text,font=f,fill=(0,0,0),anchor='ls');return
    # temp image and horizontal fit only within word-scale guard
    bbox=f.getbbox(text,anchor='ls'); w=max(1,bbox[2]-bbox[0]); ratio=(target_width*scale)/w
    if not (.78<=ratio<=1.22):
        ImageDraw.Draw(base).text((x*scale,baseline*scale),text,font=f,fill=(0,0,0),anchor='ls');return
    h=max(4,round(size*scale*1.7)); tmp=Image.new('L',(w+8,h),0); td=ImageDraw.Draw(tmp); td.text((2,h*.72),text,font=f,fill=255,anchor='ls'); nw=max(1,round((w+8)*ratio)); tmp=tmp.resize((nw,h),Image.Resampling.BICUBIC); base.paste((0,0,0),(round(x*scale),round(baseline*scale-h*.72)),tmp)
def error(src,gfx,cand,box):
    x0,y0,x1,y1=box; s=np.asarray(src)[y0:y1,x0:x1].astype(np.int16);g=np.asarray(gfx)[y0:y1,x0:x1].astype(np.int16);c=np.asarray(cand)[y0:y1,x0:x1].astype(np.int16)
    if not s.size:return math.inf
    sd=np.max(np.abs(s-g),axis=2);cd=np.max(np.abs(c-g),axis=2);mask=(sd>=18)|(cd>=18)
    if mask.sum()<30:return math.inf
    return float(np.abs(s-c).mean(axis=2)[mask].mean())

def main():
    results=[]
    for doc in DOCS:
        root=BANK/doc; path=root/'document.json'; path=path if path.exists() else root/'document-geometry.json'; data=json.load(open(path))
        for page in data['pages']:
            if page.get('source')!='ocr' or not (root/page.get('graphicsImage','')).exists():continue
            src=Image.open(root/page['sourceImage']).convert('RGB');gfx=Image.open(root/page['graphicsImage']).convert('RGB'); sx=src.width/page['width']; sy=src.height/page['height']
            for li,line in enumerate(page.get('layout',[])):
                text=clean(line.get('text')); conf=float(line.get('confidence') or 0)
                if conf<70 or len(text.replace(' ',''))<5:continue
                runs=[r for r in line.get('styledRuns',[]) if clean(r.get('text')) and 'x' in r and 'width' in r]
                hint=statistics.median(page['height']-float(r['y']) for r in runs) if runs else float(line.get('ocrBottom') or 0)
                x0=max(0,math.floor((float(line.get('x',0))-3)*sx));x1=min(src.width,math.ceil((float(line.get('x',0))+float(line.get('width',1))+3)*sx)); top=float(line.get('ocrTop') or max(0,hint-float(line.get('height',10))));y0=max(0,math.floor((top-3)*sy));y1=min(src.height,math.ceil((hint+3)*sy)); box=(x0,y0,x1,y1)
                errs={}
                for fam,pathfont in FONTS.items():
                    ds=display(line,page,pathfont); cand=gfx.copy(); anchored=anchor(line,page,ds,pathfont)
                    if anchored and runs:
                        for r in sorted(runs,key=lambda z:float(z['x'])):draw_scaled(cand,clean(r['text']),float(r['x']),hint,ds,pathfont,float(r['width']),sx)
                    else:
                        for s in segs(line):draw_scaled(cand,clean(s['text']),float(s.get('x',line.get('x',0))),hint,ds,pathfont,float(s.get('width',1)),sx)
                    errs[fam]=error(src,gfx,cand,box)
                if not math.isfinite(errs['Arial']):continue
                best=min(errs,key=errs.get); gain=(errs['Arial']-errs[best])/max(1,errs['Arial'])
                results.append({'doc':doc,'page':page['pageNumber'],'line':li,'text':text[:120],'arial':errs['Arial'],'bestFamily':best,'best':errs[best],'relativeGain':gain,'errors':errs})
    strong=[r for r in results if r['bestFamily']!='Arial' and r['relativeGain']>=.03 and r['arial']-r['best']>=.5]
    from collections import Counter
    summary={'lines':len(results),'bestFamilies':Counter(r['bestFamily'] for r in results),'strongNonArial':len(strong),'strongFamilies':Counter(r['bestFamily'] for r in strong),'meanGainStrong':statistics.fmean(r['relativeGain'] for r in strong) if strong else 0,'examples':sorted(strong,key=lambda r:r['relativeGain'],reverse=True)[:30]}
    out=Path('/mnt/data/pdfprivado-v15-work/benchmark/v17-font-family-proxy.json');out.write_text(json.dumps({'summary':summary,'lines':results},ensure_ascii=False,indent=2,default=lambda x:dict(x)),encoding='utf8');print(json.dumps(summary,ensure_ascii=False,indent=2,default=lambda x:dict(x)));print(out)
if __name__=='__main__':main()
