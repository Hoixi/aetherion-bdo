"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Castle, ChevronLeft, Circle as CircleIcon, Type as TypeIcon, Minus,
  Square, Trash2, MousePointer2, Save, Undo2, Eye, EyeOff, Tag, Check,
} from "lucide-react";
import "../theme.css";
import balenosRaw from "@/data/forts/balenos.json";
import serendiaRaw from "@/data/forts/serendia.json";
import {
  buildForts, iconUrl, iconLabel, ICON_LABELS, type Shape,
} from "@/lib/garmoth-forts";
import type { DrawTool } from "@/components/fort-map";

/**
 * Kale kurulum haritaları.
 *
 * Harita garmoth karolarından canlı çiziliyor, kurulum noktaları da
 * garmoth'un kendi şekil verisinden geliyor — ikisi de kaynağında ne ise o.
 * Üstüne kendi çizimlerimiz biniyor; onlar da aynı şekil şemasında, yani
 * tek bir çizim yolu ikisine birden yetiyor.
 *
 * Kaynak: garmoth.com occupation rehberleri, izinleriyle.
 */

const FortMap = dynamic(() => import("@/components/fort-map"), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center h-full text-[12px]"
         style={{ color: "var(--t-faint)" }}>Harita yükleniyor…</div>
  ),
});

type RawMap = { h: string; s: Shape[] };
const FORTS = buildForts(
  balenosRaw as unknown as RawMap[],
  serendiaRaw as unknown as RawMap[],
);

const STORE = "aetherion_fort_draw_v1";
const COLORS = ["#e8b451", "#48bb78", "#ef5f5f", "#6b93ff", "#b98cff", "#ffffff"];
/** Yeni dairenin koordinat birimindeki yarıçapı — kale kutusu ~5 birim */
const CIRCLE_R = 0.8;

const TOOLS: [DrawTool, typeof MousePointer2, string][] = [
  ["pan", MousePointer2, "Gez"],
  ["c", CircleIcon, "Daire"],
  ["r", Square, "Kutu"],
  ["l", Minus, "Çizgi"],
  ["t", TypeIcon, "Yazı"],
];

export default function KalelerPage() {
  const [sel, setSel] = useState("balenos-genel");
  const [tool, setTool] = useState<DrawTool>("pan");
  const [color, setColor] = useState(COLORS[0]);
  const [draft, setDraft] = useState<Shape[]>([]);
  const [saved, setSaved] = useState<Record<string, Shape[]>>({});
  const [showSource, setShowSource] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  /** Kutu çizerken bekleyen ilk köşe */
  const cornerRef = useRef<[number, number] | null>(null);

  const fort = useMemo(() => FORTS.find((f) => f.id === sel) ?? FORTS[0], [sel]);
  const drawn = saved[fort.id] ?? [];

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setSaved(JSON.parse(raw));
    } catch { /* bozuk kayıt — boş başla */ }
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);

  // Kale değişince yarım kalan çizim taşınmasın
  useEffect(() => {
    setDraft([]);
    cornerRef.current = null;
  }, [sel]);

  function persist(next: Record<string, Shape[]>) {
    setSaved(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); }
    catch { setMsg("Kaydedilemedi — tarayıcı deposu dolu olabilir."); }
  }

  function onPick(cx: number, cy: number) {
    if (tool === "c") {
      setDraft((d) => [...d, { t: "c", p: [cx, cy], r: CIRCLE_R, k: color }]);
      return;
    }

    if (tool === "r") {
      const c = cornerRef.current;
      if (!c) { cornerRef.current = [cx, cy]; setMsg("İkinci köşeye tıkla."); return; }
      cornerRef.current = null;
      setDraft((d) => [...d, { t: "r", p: [c[0], c[1], cx, cy], k: color }]);
      return;
    }

    if (tool === "t") {
      const s = window.prompt("Etiket");
      if (s) setDraft((d) => [...d, { t: "t", p: [cx, cy], x: s, k: color, z: 14 }]);
      return;
    }

    if (tool === "l") {
      // Aynı çizgiye eklemeye devam et; yeni çizgi için aracı yeniden seç
      setDraft((d) => {
        const last = d[d.length - 1];
        if (last && last.t === "l" && last.k === color) {
          return [...d.slice(0, -1), { ...last, p: [...last.p, cx, cy] }];
        }
        return [...d, { t: "l", p: [cx, cy], k: color }];
      });
    }
  }

  function save() {
    if (draft.length === 0) return;
    persist({ ...saved, [fort.id]: [...drawn, ...draft] });
    setDraft([]);
    cornerRef.current = null;
    setMsg("Çizim kaydedildi.");
  }

  function clearSaved() {
    const next = { ...saved };
    delete next[fort.id];
    persist(next);
    setDraft([]);
    setMsg("Bu haritanın çizimleri silindi.");
  }

  /** Bu haritada geçen ikonlar — efsane kutusu için */
  const legend = useMemo(() => {
    const ids = new Set<string>();
    for (const s of fort.shapes) if (s.t === "i") ids.add(s.i);
    return Array.from(ids).sort(
      (a, b) => (ICON_LABELS[a] ? 0 : 1) - (ICON_LABELS[b] ? 0 : 1),
    );
  }, [fort]);

  const spots = useMemo(
    () => fort.shapes.filter((s) => s.t === "i" && s.i === "notretreatingflag").length,
    [fort],
  );

  return (
    <div className="t-root t-glow relative min-h-full">
      <header className="t-nav sticky top-0 z-[60]">
        <div className="mx-auto max-w-[1500px] px-5 h-[68px] flex items-center gap-4">
          <Link href="/test" className="t-tab"><ChevronLeft className="w-3.5 h-3.5" /> Panel</Link>
          <div className="flex items-center gap-2">
            <Castle className="w-4 h-4" style={{ color: "var(--t-gold)" }} strokeWidth={2} />
            <span className="text-[15px] font-bold">Kale Kurulumları</span>
          </div>
          {msg && <span className="ml-auto text-[11px]" style={{ color: "var(--t-gold)" }}>{msg}</span>}
        </div>
      </header>

      <main className="relative mx-auto max-w-[1500px] px-5 py-5 space-y-3">
        {/* Kale seçimi */}
        {(["Balenos", "Serendia"] as const).map((region) => (
          <div key={region} className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.08em] w-[70px] flex-shrink-0"
                  style={{ color: "var(--t-faint)" }}>{region}</span>
            {FORTS.filter((f) => f.region === region).map((f) => (
              <button key={f.id} className="t-tab" data-on={f.id === sel}
                      onClick={() => setSel(f.id)}>
                {f.name}
                {saved[f.id]?.length ? (
                  <Check className="w-3 h-3" style={{ color: "var(--t-good)" }} />
                ) : null}
              </button>
            ))}
          </div>
        ))}

        <div className="t-card p-3 !mt-4">
          {/* Araç çubuğu */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {TOOLS.map(([k, Ico, lbl]) => (
              <button key={k} className="t-tab" data-on={tool === k}
                      onClick={() => { setTool(k); cornerRef.current = null; }}>
                <Ico className="w-3.5 h-3.5" /> {lbl}
              </button>
            ))}

            <div className="flex items-center gap-1 ml-1">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setColor(c)} className="w-5 h-5 rounded-full"
                        style={{ background: c, outline: color === c ? "2px solid #fff6" : "none",
                                 outlineOffset: 2 }} />
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button className="t-tab" data-on={showSource}
                      onClick={() => setShowSource((v) => !v)}>
                {showSource ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                Garmoth
              </button>
              <button className="t-tab" data-on={showLabels}
                      onClick={() => setShowLabels((v) => !v)}>
                <Tag className="w-3.5 h-3.5" /> Etiketler
              </button>
              {draft.length > 0 && (
                <>
                  <button className="t-tab" onClick={() => setDraft((d) => d.slice(0, -1))}>
                    <Undo2 className="w-3.5 h-3.5" /> Geri
                  </button>
                  <button className="t-tab" data-on onClick={save}>
                    <Save className="w-3.5 h-3.5" /> Kaydet ({draft.length})
                  </button>
                </>
              )}
              {drawn.length > 0 && draft.length === 0 && (
                <button className="t-tab" onClick={clearSaved}>
                  <Trash2 className="w-3.5 h-3.5" /> Çizimleri Sil
                </button>
              )}
            </div>
          </div>

          {/* Harita — Leaflet kendi z-index'ini 400'e kadar veriyor,
              kart konumlandırılmazsa üst menünün üstüne çıkıyor */}
          <div className="relative z-0 rounded-lg overflow-hidden"
               style={{ background: "#0a1418" }}>
            <FortMap
              shapes={fort.shapes}
              drawn={drawn}
              draft={draft}
              showSource={showSource}
              showLabels={showLabels}
              tool={tool}
              onPick={onPick}
              fitKey={fort.id}
              className="w-full h-[clamp(420px,64vh,760px)]"
            />
          </div>

          {/* Efsane */}
          {legend.length > 0 && (
            <div className="flex items-center gap-x-4 gap-y-2 flex-wrap mt-3 pt-3"
                 style={{ borderTop: "1px solid var(--t-line)" }}>
              {legend.map((id) => (
                <span key={id} className="flex items-center gap-1.5 text-[11px]"
                      style={{ color: "var(--t-dim)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={iconUrl(id)} alt="" className="w-5 h-5" />
                  {iconLabel(id)}
                </span>
              ))}
              {spots > 0 && (
                <span className="text-[11px] ml-auto" style={{ color: "var(--t-faint)" }}>
                  {spots} kurulum noktası
                </span>
              )}
            </div>
          )}
        </div>

        <p className="text-[11px] pb-6 leading-relaxed" style={{ color: "var(--t-faint)" }}>
          Harita karoları, kurulum noktaları ve ikonlar{" "}
          <a href="https://garmoth.com" target="_blank" rel="noreferrer"
             style={{ color: "var(--t-gold)" }}>garmoth.com</a>{" "}
          izniyle kullanılıyor. Kendi çizimlerin şimdilik yalnızca bu tarayıcıda saklanıyor.
        </p>
      </main>
    </div>
  );
}
