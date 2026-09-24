"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import type {Map as LeafletMap} from "leaflet";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import {buildForts,fortMarkers,toProj,TILE_URL,TILE_SIZE,MAX_TILE_ZOOM,MAX_ZOOM,type Shape,type NodeWarNode} from "@/lib/garmoth-forts";
import balenos from "@/data/forts/balenos.json";
import serendia from "@/data/forts/serendia.json";
import nodes from "@/data/forts/nodes.json";
type Place={id:string;name:string;region:string;x:number;y:number;kind:"castle"|"node"};
const forts=buildForts(balenos as unknown as {h:string;s:Shape[]}[],serendia as unknown as {h:string;s:Shape[]}[]);
const places:Place[]=[...fortMarkers(forts).map(f=>({...f,kind:"node" as const})),...(nodes.nodes as NodeWarNode[]).map(n=>({id:n.slug,name:n.name,region:n.region,x:n.x,y:n.y,kind:n.castle?"castle" as const:"node" as const}))];
const regions=Array.from(new Set(places.map(p=>p.region))).sort();
// Permission to use public map icons was reported by the user on 2026-09-24.
const icons={castle:"https://nodewar.gg/svg/map/castle.svg",node:"https://nodewar.gg/svg/map/node.svg"};
export function WarAtlas(){
  const box=useRef<HTMLDivElement>(null),map=useRef<LeafletMap|null>(null);
  const [ready,setReady]=useState(false),[query,setQuery]=useState(""),[region,setRegion]=useState("all"),[kind,setKind]=useState("all"),[selected,setSelected]=useState<string|null>(null),[error,setError]=useState("");
  const visible=useMemo(()=>places.filter(p=>(region==="all"||p.region===region)&&(kind==="all"||p.kind===kind)&&p.name.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"))),[region,kind,query]);
  useEffect(()=>{let dead=false;void import("leaflet").then(L=>{if(dead||!box.current)return;
    const crs=L.extend({},L.CRS.Simple,{transformation:new L.Transformation(1,0,1,0)});
    const m=L.map(box.current,{crs,minZoom:0,maxZoom:MAX_ZOOM});map.current=m;
    L.tileLayer(TILE_URL,{tileSize:TILE_SIZE,maxNativeZoom:MAX_TILE_ZOOM,maxZoom:MAX_ZOOM,noWrap:true,attribution:"Harita: Garmoth · İkonlar: Nodewar.gg"}).on("tileerror",()=>{if(!dead)setError("Bazı harita karoları yüklenemedi.");}).addTo(m);
    m.setView(toProj(282,190),5);setReady(true);
  }).catch(()=>{if(!dead)setError("Harita başlatılamadı.");});return()=>{dead=true;map.current?.remove();map.current=null;};},[]);
  useEffect(()=>{if(!ready||!map.current)return;let dead=false;let cleanup=()=>{};void import("leaflet").then(L=>{if(dead||!map.current)return;const m=map.current,g=L.layerGroup().addTo(m);cleanup=()=>{g.remove();};
    for(const p of visible){
      const label=document.createElement("span");label.textContent=`${p.name} · ${p.region}`;
      L.marker(toProj(p.x,p.y),{icon:L.icon({iconUrl:icons[p.kind],iconSize:[28,28],iconAnchor:[14,14]}),title:p.name,alt:p.name}).bindTooltip(label).on("click",()=>setSelected(p.id)).addTo(g);
    }
    const chosen=visible.find(p=>p.id===selected);
    if(chosen)m.setView(toProj(chosen.x,chosen.y),7);
    else if(visible.length)m.fitBounds(L.latLngBounds(visible.map(p=>toProj(p.x,p.y))).pad(.15),{maxZoom:7});
  });return()=>{dead=true;cleanup();};},[visible,ready,selected]);
  const detail=visible.find(p=>p.id===selected);
  return <main className="p-4 space-y-4">
    <header className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Savaş Atlası</h1><p className="text-sm opacity-70">Bölge, kale ve mevzi kataloğu · yerel ilk sürüm</p></div><Link href="/savas-haritasi">Savaş kayıtları / ısı haritası →</Link></header>
    <p className="text-sm text-amber-300">Bölgeler filtre olarak sunulur; kesin bölge sınır poligonları henüz eklenmedi. Mevcut katalog canlı sahiplik, gün veya güncel tier verisi değildir. Konumlar yaklaşık olabilir.</p>
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-3 rounded border border-zinc-700 p-3">
        <label className="block">Kale / mevzi ara<input className="block w-full bg-zinc-800 p-2" value={query} onChange={e=>{setQuery(e.target.value);setSelected(null);}}/></label>
        <label className="block">Bölge<select className="block w-full bg-zinc-800 p-2" value={region} onChange={e=>{setRegion(e.target.value);setSelected(null);}}><option value="all">Tüm bölgeler</option>{regions.map(r=><option key={r}>{r}</option>)}</select></label>
        <label className="block">Tür<select className="block w-full bg-zinc-800 p-2" value={kind} onChange={e=>{setKind(e.target.value);setSelected(null);}}><option value="all">Tümü</option><option value="castle">Kuşatma kalesi</option><option value="node">Mevzi / node</option></select></label>
        <p aria-live="polite">{visible.length} sonuç</p>
        <div className="max-h-80 overflow-auto">{visible.map(p=><button key={p.id} className="block w-full text-left p-2 rounded hover:bg-zinc-800" aria-pressed={selected===p.id} onClick={()=>setSelected(p.id)}>{p.name}<small className="block opacity-60">{p.region}</small></button>)}{!visible.length&&<p>Sonuç bulunamadı.</p>}</div>
      </aside>
      <section className="space-y-2">{error&&<p role="status">{error}</p>}<div ref={box} className="rounded-lg" style={{height:"65vh",minHeight:420,background:"#181827"}}/>{detail&&<p>{detail.name} · {detail.region} · {detail.kind==="castle"?"Kuşatma kalesi":"Mevzi"}</p>}</section>
    </div>
    <p className="text-xs opacity-60">İkonlar: <a href="https://nodewar.gg/map" target="_blank" rel="noreferrer">Nodewar.gg</a> (kullanıcının bildirdiği yönetici izni). Taban harita ve kale kataloğu projedeki mevcut Garmoth entegrasyonundan; ek mevziler mevcut nodes.json kataloğundan.</p>
  </main>;
}
