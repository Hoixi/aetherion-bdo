"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
const WorldMap=dynamic(()=>import("@/components/bdo-leaflet-map").then(m=>m.BdoLeafletMap),{ssr:false,loading:()=> <p>Harita yükleniyor…</p>});
type Candidate={receivedAtMs:number;firstFamily:string;secondFamily:string};
type Recording={id:number;title:string;allianceName:string|null;startedAt:string|null;endedAt:string|null;directionVerified:boolean};
type Detail=Recording&{events:Candidate[]};
/** Beta desk only. Unknown direction/guild/location never becomes a tactical statistic. */
export function CombatAnalysisDesk({warId,preview}:{warId:number;preview?:Detail}){
  const [logs,setLogs]=useState<Recording[]>(preview?[preview]:[]);const [selected,setSelected]=useState(preview?String(preview.id):"");
  const [detail,setDetail]=useState<Detail|null>(preview??null);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  const [player,setPlayer]=useState("");const [minute,setMinute]=useState("");const alive=useRef(true);
  const url=`/api/app/wars/${warId}/combat-recordings`;
  const refresh=useCallback(async()=>{if(preview)return;const r=await fetch(url);const b=await r.json();if(!r.ok)throw new Error(b.error??"Kayıtlar alınamadı.");if(alive.current)setLogs(b.logs);},[url,preview]);
  useEffect(()=>{alive.current=true;void refresh().catch(e=>{if(alive.current)setError(String(e));});return()=>{alive.current=false;};},[refresh]);
  useEffect(()=>{if(preview||!selected){if(!preview)setDetail(null);return;}const controller=new AbortController();setDetail(null);setError("");
    void fetch(`${url}?recordingId=${selected}`,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error??"Kayıt okunamadı.");if(!controller.signal.aborted)setDetail(d);}).catch(e=>{if(!controller.signal.aborted)setError(String(e));});
    return()=>controller.abort();},[selected,url,preview]);
  async function upload(f:File){setBusy(true);setError("");try{
    if(f.size>8*1024*1024)throw new Error("Dosya 8 MB sınırını aşıyor.");
    const text=await f.text();const r=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:text});const d=await r.json();if(!r.ok)throw new Error(d.error??"Yüklenemedi.");
    if(!alive.current)return;await refresh();setSelected(String(d.id));
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:String(e));}finally{if(alive.current)setBusy(false);}}
  const events=useMemo(()=>{const start=detail?.startedAt?Date.parse(detail.startedAt):0;return (detail?.events??[]).filter(e=>(!player||e.firstFamily.toLocaleLowerCase("tr").includes(player.toLocaleLowerCase("tr"))||e.secondFamily.toLocaleLowerCase("tr").includes(player.toLocaleLowerCase("tr")))&&(!minute||Math.floor((e.receivedAtMs-start)/60000)===Number(minute)));},[detail,player,minute]);
  return <main className="mx-auto max-w-7xl p-5 space-y-4" style={{color:"var(--t-text)",background:"var(--t-bg)",minHeight:"100vh"}}>
    <Link href={`/savaslar/${warId}`} className="text-sm">← Savaşa dön</Link>
    <header><h1 className="text-2xl font-semibold">Savaş analiz masası <span className="text-sm" style={{color:"var(--t-gold)"}}>Yerel beta</span></h1><p className="text-sm opacity-70">Savaş #{warId} · Resmî hasar raporundan bağımsız canlı kayıt incelemesi</p></header>
    <div className="rounded-xl border p-4 text-sm" style={{borderColor:"var(--t-line)",color:"var(--t-gold)"}}>Bu aşama kalibrasyon içindir. İlk/ikinci isim henüz öldüren/ölen olarak doğrulanmadı. Adaylar K/D, klan karşılaştırması veya ısı haritasına katılmaz. Konum yoksa haritada nokta üretilmez.</div>
    <section className="flex flex-wrap gap-4 rounded-xl border p-4" style={{borderColor:"var(--t-line)"}}>
      <label className="text-sm">Kayıt<select aria-label="Kayıt seçimi" className="block bg-black/30 rounded p-2" value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setPlayer("");setMinute("");}}><option value="">Kayıt seçin…</option>{logs.map(l=><option key={l.id} value={l.id}>{l.allianceName??l.title} · {l.startedAt?new Date(l.startedAt).toLocaleString("tr-TR"):"Tarihsiz"}</option>)}</select></label>
      <label className="text-sm">Companion JSON kaydı<input className="block p-2" type="file" accept=".json,application/json" disabled={busy||!!preview} onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void upload(f);e.currentTarget.value="";}}/></label>
    </section>
    {error&&<p role="alert" style={{color:"var(--t-bad)"}}>{error}</p>}
    {!logs.length&&!error&&<p>Kayıt yok. Yerel Companion’dan savaş kaydı alıp JSON dosyasını buraya yükleyin.</p>}
    <section className="grid gap-3 sm:grid-cols-3" aria-label="Kayıt kapsamı">
      <div className="rounded-xl border p-4">Aday olay: <strong>{detail?.events.length??0}</strong></div>
      <div className="rounded-xl border p-4">Yön doğrulaması: <strong>Bekleniyor</strong></div>
      <div className="rounded-xl border p-4">Doğrulanmış konum: <strong>0</strong></div>
    </section>
    <section className="rounded-xl border p-4 space-y-2"><h2 className="font-semibold">Çatışma haritası</h2><p className="text-sm opacity-70">Kill / ölüm / bölgesel üstünlük katmanları, ham oyun koordinatı ve taban harita dönüşümü doğrulandıktan sonra açılacak. Kale planı koordinatları doğrudan kullanılmaz.</p><WorldMap markers={[]} className="h-[420px] rounded-lg"/></section>
    <section className="rounded-xl border p-4 space-y-3">
      <h2 className="font-semibold">Kalibrasyon için olay adayları</h2><p className="text-sm opacity-70">Saat, paketin bu bilgisayarda alındığı zamandır; sunucunun kesin olay saati olduğu varsayılmaz. İlk 200 filtrelenmiş satır gösterilir.</p>
      <div className="flex gap-3 flex-wrap"><label className="text-sm">Oyuncu<input aria-label="Oyuncu filtresi" className="block bg-black/30 rounded p-2" value={player} onChange={e=>setPlayer(e.target.value)}/></label><label className="text-sm">Kayıt dakikası<input aria-label="Dakika filtresi" className="block bg-black/30 rounded p-2" type="number" min={0} max={240} value={minute} onChange={e=>setMinute(e.target.value)}/></label></div>
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>Saat</th><th>İlk aile adı</th><th>İkinci aile adı</th><th>Konum</th></tr></thead><tbody>{events.slice(0,200).map((e,i)=><tr key={`${e.receivedAtMs}:${i}`} className="border-t"><td className="p-2">{new Date(e.receivedAtMs).toLocaleTimeString("tr-TR")}</td><td>{e.firstFamily}</td><td>{e.secondFamily}</td><td>Doğrulanmadı</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
