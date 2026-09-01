'use client';
import { useRef, useState } from 'react';
import { Download, Sparkles, Upload, ArrowLeft, Wand2, RotateCcw } from 'lucide-react';

const templates = [
  {id:'political',title:'Political Campaign',emoji:'🇮🇳',desc:'नेता और जनप्रतिनिधि पोस्टर',needs:['photo','name','designation','party']},
  {id:'birthday',title:'Birthday Wish',emoji:'🎂',desc:'जन्मदिन की शानदार शुभकामनाएं',needs:['photo','name','message']},
  {id:'festival',title:'Festival Greeting',emoji:'🪔',desc:'त्योहारों के लिए',needs:['photo','name','festival']},
  {id:'business',title:'Business Promo',emoji:'🚀',desc:'बिज़नेस प्रचार',needs:['photo','name','business','phone']},
  {id:'college',title:'College Event',emoji:'🎓',desc:'कॉलेज और छात्र कार्यक्रम',needs:['photo','name','designation','message']},
  {id:'social',title:'Social Media',emoji:'🔥',desc:'वायरल सोशल पोस्ट',needs:['photo','name','message']},
];
const labels:Record<string,string>={name:'आपका नाम *',designation:'पद / Designation',party:'Party / संगठन',message:'अपना संदेश',festival:'त्योहार का नाम',business:'Business नाम',phone:'Mobile नंबर'};

export default function Home(){
 const [selected,setSelected]=useState<typeof templates[number]|null>(null);
 const [form,setForm]=useState<Record<string,string>>({});
 const [photo,setPhoto]=useState(''); const [loading,setLoading]=useState(false); const [poster,setPoster]=useState('');
 const [ratio,setRatio]=useState<'portrait'|'square'|'story'>('portrait'); const [style,setStyle]=useState<'premium'|'bold'|'minimal'>('premium');
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const choose=(t:typeof templates[number])=>{setSelected(t);setForm({});setPhoto('');setPoster('')};
 const upload=(f?:File)=>{if(!f)return;if(f.size>8*1024*1024)return alert('8MB से छोटी फोटो चुनें');const r=new FileReader();r.onload=()=>setPhoto(String(r.result));r.readAsDataURL(f)};
 const finish=(c:HTMLCanvasElement)=>{setPoster(c.toDataURL('image/png',1));setLoading(false)};
 const generate=()=>{
  if(!selected||!form.name.trim())return alert('कृपया अपना नाम भरें');
  setLoading(true);
  setTimeout(()=>{
   const c=canvasRef.current!; const size=ratio==='square'?[1080,1080]:ratio==='story'?[1080,1920]:[1080,1350]; c.width=size[0];c.height=size[1];
   const ctx=c.getContext('2d')!,w=c.width,h=c.height;
   const palettes:any={political:['#d71920','#ff8a00'],birthday:['#7c3aed','#ec4899'],festival:['#f97316','#facc15'],business:['#0f766e','#38bdf8'],college:['#1d4ed8','#7c3aed'],social:['#111827','#ef4444']};
   const p=palettes[selected.id];const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
   if(style==='premium'){ctx.fillStyle='rgba(255,255,255,.10)';ctx.beginPath();ctx.arc(w*.88,h*.12,w*.3,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(w*.1,h*.92,w*.25,0,Math.PI*2);ctx.fill()}
   if(style==='minimal'){ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(0,h*.68,w,h*.32)}
   ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='bold '+Math.round(w*.045)+'px Arial';ctx.fillText(selected.emoji+'  '+selected.title.toUpperCase(),w/2,h*.09);
   const drawText=(text:string,y:number,font:number)=>{ctx.font='bold '+font+'px Arial';const words=text.split(' ');let line='',yy=y;for(const word of words){const test=line+word+' ';if(ctx.measureText(test).width>w*.86){ctx.fillText(line,w/2,yy);yy+=font*1.2;line=word+' '}else line=test}ctx.fillText(line,w/2,yy)};
   const bottom=h*.78; drawText(form.name.toUpperCase(),bottom,Math.round(w*.075));
   const sub=form.designation||form.business||form.festival||form.message||'BEST WISHES';ctx.font=Math.round(w*.038)+'px Arial';ctx.fillText(sub.slice(0,55),w/2,bottom+w*.09);
   if(form.party||form.phone){ctx.font=Math.round(w*.028)+'px Arial';ctx.fillText((form.party||'')+'   '+(form.phone||''),w/2,bottom+w*.16)}
   const cx=w/2,cy=h*.43,r=Math.min(w,h)*.22;
   const drawPhoto=()=>{if(photo){const img=new Image();img.onload=()=>{ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();const s=Math.max((r*2)/img.width,(r*2)/img.height);const iw=img.width*s,ih=img.height*s;ctx.drawImage(img,cx-iw/2,cy-ih/2,iw,ih);ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(8,w*.008);ctx.beginPath();ctx.arc(cx,cy,r+8,0,Math.PI*2);ctx.stroke();finish(c)};img.src=photo}else{ctx.fillStyle='rgba(255,255,255,.18)';ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();ctx.font='bold '+Math.round(w*.1)+'px Arial';ctx.fillStyle='#fff';ctx.fillText('AI',cx,cy+20);finish(c)}};
   drawPhoto();
  },650)
 };
 return <main className="min-h-screen bg-slate-950 text-white"><canvas ref={canvasRef} className="hidden"/>
 <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur px-4 py-4 flex items-center justify-between"><div><b className="text-xl">Poster<span className="text-fuchsia-400">AI</span></b><p className="text-[11px] text-slate-400">Smart Poster Studio</p></div><Sparkles className="text-yellow-300"/></header>
 {!selected?<section className="max-w-6xl mx-auto p-4 md:p-7"><div className="rounded-3xl p-6 md:p-10 bg-gradient-to-br from-fuchsia-700/30 to-violet-700/10 border border-white/10 text-center"><span className="inline-flex gap-2 items-center rounded-full bg-white/10 px-3 py-1 text-xs"><Wand2 size={14}/> Hidden AI workflow</span><h1 className="text-3xl md:text-5xl font-black mt-4">एक क्लिक से अपना पोस्टर बनाइए</h1><p className="text-slate-300 mt-3">Template चुनें → जानकारी भरें → Poster Generate करें → Download करें</p></div><div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">{templates.map(t=><button key={t.id} onClick={()=>choose(t)} className="rounded-3xl p-5 min-h-52 text-left bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 hover:-translate-y-1 transition shadow-xl"><div className="text-5xl mb-8">{t.emoji}</div><b>{t.title}</b><p className="text-xs text-slate-400 mt-2">{t.desc}</p><span className="inline-block mt-4 text-xs text-fuchsia-300">Create now →</span></button>)}</div></section>:
 <section className="max-w-5xl mx-auto p-4 md:p-7"><button onClick={()=>setSelected(null)} className="flex items-center gap-2 text-slate-400 mb-4"><ArrowLeft size={18}/> सभी Templates</button><div className="grid md:grid-cols-2 gap-6"><div className="rounded-3xl bg-slate-900 border border-white/10 p-5"><h2 className="text-2xl font-bold">{selected.emoji} {selected.title}</h2><p className="text-sm text-slate-400 mt-1">Poster के अनुसार जानकारी भरें</p><label className="mt-5 block cursor-pointer border-2 border-dashed border-slate-700 hover:border-fuchsia-400 rounded-2xl p-5 text-center">{photo?<><img src={photo} className="w-28 h-28 object-cover rounded-full mx-auto"/><p className="text-xs mt-2">फोटो बदलने के लिए tap करें</p></>:<><Upload className="mx-auto mb-2"/><span>अपनी फोटो अपलोड करें</span><p className="text-xs text-slate-500 mt-1">JPG, PNG • Max 8MB</p></>}<input type="file" accept="image/*" className="hidden" onChange={e=>upload(e.target.files?.[0])}/></label>
 {selected.needs.filter(x=>x!=='photo').map(f=><input key={f} value={form[f]||''} onChange={e=>setForm({...form,[f]:e.target.value})} placeholder={labels[f]} className="w-full mt-3 rounded-xl bg-slate-800 border border-slate-700 p-3 outline-none focus:border-fuchsia-400"/>)}
 <div className="grid grid-cols-2 gap-3 mt-4"><select value={ratio} onChange={e=>setRatio(e.target.value as any)} className="rounded-xl bg-slate-800 border border-slate-700 p-3"><option value="portrait">Poster 4:5</option><option value="square">Square 1:1</option><option value="story">Story 9:16</option></select><select value={style} onChange={e=>setStyle(e.target.value as any)} className="rounded-xl bg-slate-800 border border-slate-700 p-3"><option value="premium">Premium</option><option value="bold">Bold</option><option value="minimal">Minimal</option></select></div>
 <button disabled={loading} onClick={generate} className="w-full mt-4 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 p-4 font-bold disabled:opacity-60">{loading?'Poster तैयार हो रहा है...':'✨ Generate Poster'}</button></div>
 <div className="rounded-3xl bg-slate-900 border border-white/10 p-4 flex flex-col justify-center">{poster?<><img src={poster} className="w-full rounded-2xl shadow-2xl"/><div className="grid grid-cols-2 gap-3 mt-3"><button onClick={generate} className="rounded-xl bg-slate-800 p-3 flex justify-center gap-2"><RotateCcw size={18}/> Regenerate</button><a href={poster} download={'poster-'+Date.now()+'.png'} className="rounded-xl bg-emerald-600 p-3 flex justify-center gap-2 font-bold"><Download size={18}/> Download</a></div></>:<div className="text-center py-20 text-slate-500"><ImageIcon className="mx-auto mb-3" size={48}/><p>आपका Poster यहां दिखाई देगा</p></div>}</div></div></section>}
 </main>
}