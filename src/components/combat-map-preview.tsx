"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {Map as LeafletMap} from "leaflet";
import "leaflet/dist/leaflet.css";
import {dunyaToGarmoth} from "@/lib/savas-olaylari";
import {addCombatHeat} from "@/lib/combat-heat-layer";
import {TILE_URL,TILE_SIZE,MAX_TILE_ZOOM,MAX_ZOOM,toProj} from "@/lib/garmoth-forts";
type Event={id:number;time:string;ours:string;opponent:string;guild:string;outcome:string;xyz:number[]};
export function CombatMapPreview({events}:{events:Event[]}){
  const container=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null);
  const [ready,setReady]=useState(false),[filter,setFilter]=useState("all"),[player,setPlayer]=useState("");
  const [error,setError]=useState(""),[loaded,setLoaded]=useState(false);
  const [heat,setHeat]=useState(true);
  const selected=useMemo(()=>events.filter(e=>(filter==="all"||e.outcome===filter)&&(!player||`${e.ours} ${e.opponent}`.toLocaleLowerCase("tr").includes(player.toLocaleLowerCase("tr")))),[events,filter,player]);
  useEffect(()=>{let disposed=false;void import("leaflet").then(L=>{
    if(disposed||!container.current)return;
    const crs=L.extend({},L.CRS.Simple,{transformation:new L.Transformation(1,0,1,0)});
    const m=L.map(container.current,{crs,minZoom:0,maxZoom:MAX_ZOOM});map.current=m;
    L.tileLayer(TILE_URL,{tileSize:TILE_SIZE,noWrap:true,maxNativeZoom:MAX_TILE_ZOOM,maxZoom:MAX_ZOOM,attribution:"Garmoth / Black Desert"}).on("tileload",()=>{if(!disposed)setLoaded(true);}).on("tileerror",()=>{if(!disposed)setError("Harita karoları yüklenemedi; internet/CDN erişimini kontrol edin.");}).addTo(m);
    m.setView([100,100],4);setReady(true);
  }).catch(()=>{if(!disposed)setError("Harita başlatılamadı.");});return()=>{disposed=true;map.current?.remove();map.current=null;};},[]);
  useEffect(()=>{if(!ready||!map.current)return;let disposed=false;let cleanup=()=>{};
    void import("leaflet").then(L=>{if(disposed||!map.current)return;const m=map.current,group=L.layerGroup().addTo(m);let removeHeat=()=>{};cleanup=()=>{removeHeat();group.remove();};
      const points:[number,number][]=[];
      for(const e of selected){
        // Same approximate world fit and measured projection as the fort map.
        const [gx,gy]=dunyaToGarmoth(e.xyz[0],e.xyz[2]);const point=toProj(gx,gy);points.push(point);
        const label=document.createElement("div");label.textContent=`${e.outcome==="kill"?"KILL":"ÖLÜM"} · ${e.ours} / ${e.opponent} · ${e.guild} · ${new Date(e.time).toLocaleTimeString("tr-TR",{timeZone:"Europe/Istanbul"})} · Konum adayı: ${e.xyz.map(n=>n.toFixed(1)).join(", ")}`;
        L.circleMarker(point,{radius:7,color:e.outcome==="kill"?"#22c55e":"#ef4444",fillOpacity:.8,weight:2}).bindPopup(label).addTo(group);
      }
      if(points.length)m.fitBounds(L.latLngBounds(points).pad(.3),{maxZoom:9});
      if(heat)removeHeat=addCombatHeat(m,points);
    });return()=>{disposed=true;cleanup();};},[ready,selected,heat]);
  return <main className="mx-auto max-w-7xl p-5 space-y-4">
    <h1 className="text-2xl font-bold">BDO savaş konumları · Yerel deney</h1>
    <p className="rounded border border-amber-500 p-3 text-amber-300">Yaklaşık konum: dünya → Garmoth kale haritası dönüşümü kullanılıyor; elle Bartali'ye kaydırma yok. Dünya eşlemesi ve XYZ eksen sırası henüz saha ölçümüyle doğrulanmadı. Noktalar kesin ölüm yeri değildir; konumun hangi oyuncuya ait olduğu da doğrulanmadı.</p>
    <p>İsimler / kill-ölüm yönü: kullanıcının doğruladığı alan eşlemesi. Koordinatlar tailHex üzerinden yeniden okunur. DB kaydı ve otomatik yükleme yok.</p>
    <div className="flex flex-wrap gap-4"><label>Olay türü <select className="bg-zinc-800 p-2" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Tümü</option><option value="kill">Bizim kill · yeşil</option><option value="death">Bizim ölüm · kırmızı</option></select></label><label>Oyuncu <input className="bg-zinc-800 p-2" value={player} onChange={e=>setPlayer(e.target.value)}/></label><span>{selected.length} / {events.length} olay</span></div>
    <label><input type="checkbox" checked={heat} onChange={e=>setHeat(e.target.checked)}/> Isı haritası · olay yoğunluğu</label>
    {heat&&<p className="text-sm">Mavi → sarı → kırmızı: düşükten yüksek yoğunluğa. 36 ekran pikseli yarıçap; zoom değişince görsel yoğunluk değişir. Bölge kazanma/kaybetme ölçüsü değildir.</p>}
    {!loaded&&<p role="status">Harita karoları bekleniyor…</p>}{error&&!loaded&&<p role="alert">{error}</p>}
    <div ref={container} style={{height:520,background:"#181827"}}/>
    <p>Noktaya tıklayarak olayı açabilirsiniz. Isı haritası yaklaşık konumların deneysel yoğunluğudur; gerçek ölüm yerleri henüz kalibre edilmedi.</p>
    <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th>TR saati</th><th>Bizim oyuncu</th><th>Rakip</th><th>Sonuç</th><th>Ham konum adayı</th></tr></thead><tbody>{selected.map(e=><tr key={e.id}><td>{new Date(e.time).toLocaleTimeString("tr-TR",{timeZone:"Europe/Istanbul"})}</td><td>{e.ours}</td><td>{e.opponent}</td><td>{e.outcome==="kill"?"Kill":"Ölüm"}</td><td>{e.xyz.map(n=>n.toFixed(2)).join(" / ")}</td></tr>)}</tbody></table></div>
  </main>;
}
