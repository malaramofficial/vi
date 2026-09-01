'use client';

import { useRef, useState } from 'react';
import { Download, Image as ImageIcon, Sparkles, Upload, X } from 'lucide-react';

const templates = [
  { id: 'political', title: 'Political Campaign', emoji: '🇮🇳', needs: ['photo','name','designation','party'] },
  { id: 'birthday', title: 'Birthday Wish', emoji: '🎂', needs: ['photo','name','message'] },
  { id: 'festival', title: 'Festival Greeting', emoji: '🪔', needs: ['photo','name','festival'] },
  { id: 'business', title: 'Business Promo', emoji: '🚀', needs: ['photo','name','business','phone'] },
];

export default function Home() {
  const [selected, setSelected] = useState<typeof templates[number] | null>(null);
  const [form, setForm] = useState<Record<string,string>>({});
  const [photo, setPhoto] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [poster, setPoster] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const choose = (t: typeof templates[number]) => {
    setSelected(t); setForm({}); setPhoto(''); setPoster('');
  };

  const upload = (file?: File) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setPhoto(String(r.result));
    r.readAsDataURL(file);
  };

  const generate = () => {
    if (!selected || !form.name) return alert('कृपया अपना नाम भरें');
    setLoading(true);
    setTimeout(() => {
      const canvas = canvasRef.current!;
      canvas.width = 1080; canvas.height = 1350;
      const ctx = canvas.getContext('2d')!;
      const g = ctx.createLinearGradient(0,0,1080,1350);
      const colors: Record<string,[string,string]> = {
        political:['#ff7a18','#af002d'], birthday:['#7b2ff7','#f107a3'],
        festival:['#f7971e','#ffd200'], business:['#11998e','#38ef7d']
      };
      const c = colors[selected.id] || ['#222','#666'];
      g.addColorStop(0,c[0]); g.addColorStop(1,c[1]); ctx.fillStyle=g; ctx.fillRect(0,0,1080,1350);
      ctx.fillStyle='rgba(255,255,255,.12)'; ctx.beginPath(); ctx.arc(900,150,300,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font='bold 54px Arial';
      ctx.fillText(selected.emoji+'  '+selected.title.toUpperCase(),540,115);
      ctx.font='bold 86px Arial'; ctx.fillText(form.name.toUpperCase(),540,1050);
      const sub = form.designation || form.business || form.festival || form.message || 'BEST WISHES';
      ctx.font='42px Arial'; ctx.fillText(sub.slice(0,48),540,1120);
      if (photo) {
        const img = new Image(); img.onload=()=>{ ctx.save(); ctx.beginPath(); ctx.arc(540,560,270,0,Math.PI*2); ctx.clip(); ctx.drawImage(img,270,290,540,540); ctx.restore(); ctx.strokeStyle='#fff';ctx.lineWidth=12;ctx.beginPath();ctx.arc(540,560,276,0,Math.PI*2);ctx.stroke(); finish(canvas);}; img.src=photo;
      } else { ctx.fillStyle='rgba(255,255,255,.22)';ctx.beginPath();ctx.arc(540,560,270,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='120px Arial';ctx.fillText('AI',540,600); finish(canvas); }
    }, 900);
  };
  const finish=(c:HTMLCanvasElement)=>{setPoster(c.toDataURL('image/png'));setLoading(false)};

  return <main className="min-h-screen bg-slate-950 text-white">
    <canvas ref={canvasRef} className="hidden" />
    <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/90 backdrop-blur px-5 py-4 flex justify-between">
      <div><b className="text-xl">Poster<span className="text-fuchsia-400">AI</span></b><p className="text-xs text-slate-400">Create • Generate • Download</p></div>
      <Sparkles className="text-yellow-300" />
    </header>

    {!selected ? <section className="max-w-5xl mx-auto p-5">
      <div className="py-8 text-center"><h1 className="text-3xl font-black">अपना पोस्टर चुनें</h1><p className="text-slate-400 mt-2">Template चुनते ही आवश्यक जानकारी मांगी जाएगी</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{templates.map(t=><button key={t.id} onClick={()=>choose(t)} className="rounded-3xl p-5 text-left bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 hover:scale-[1.02] transition"><div className="text-5xl mb-8">{t.emoji}</div><b>{t.title}</b><p className="text-xs text-slate-400 mt-2">Tap to create →</p></button>)}</div>
    </section> : <section className="max-w-md mx-auto p-5">
      <button onClick={()=>setSelected(null)} className="text-slate-400 mb-4">← वापस</button>
      <div className="rounded-3xl bg-slate-900 border border-white/10 p-5">
        <h2 className="text-2xl font-bold">{selected.emoji} {selected.title}</h2>
        <p className="text-sm text-slate-400 mt-1">AI आपके लिए डिजाइन तैयार करेगा</p>
        <label className="mt-5 block cursor-pointer border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center">
          {photo ? <img src={photo} className="w-28 h-28 object-cover rounded-full mx-auto"/> : <><Upload className="mx-auto mb-2"/><span>अपनी फोटो अपलोड करें</span></>}
          <input type="file" accept="image/*" className="hidden" onChange={e=>upload(e.target.files?.[0])}/>
        </label>
        {selected.needs.filter(x=>x!=='photo').map(field=><input key={field} value={form[field]||''} onChange={e=>setForm({...form,[field]:e.target.value})} placeholder={{name:'आपका नाम *',designation:'पद / Designation',party:'Party / संगठन',message:'अपना संदेश',festival:'त्योहार का नाम',business:'Business नाम',phone:'Mobile नंबर'}[field]} className="w-full mt-3 rounded-xl bg-slate-800 border border-slate-700 p-3 outline-none focus:border-fuchsia-400"/>)}
        <button disabled={loading} onClick={generate} className="w-full mt-5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 p-4 font-bold">{loading?'AI Poster बना रहा है...':'✨ Generate Poster'}</button>
      </div>
      {poster && <div className="mt-5 rounded-3xl overflow-hidden bg-white p-2"><img src={poster} className="w-full"/><a href={poster} download={'poster-'+Date.now()+'.png'} className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-950 text-white p-4 font-bold"><Download size={18}/> Download PNG</a></div>}
    </section>}
  </main>;
}
