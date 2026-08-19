"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Castle, ChevronLeft, Circle as CircleIcon, Type as TypeIcon, Minus,
  Trash2, Download, Upload, MousePointer2, Save,
} from "lucide-react";
import "../theme.css";

/**
 * Kale kurulum noktaları.
 *
 * Garmoth'un gömülü haritaları şekilleri JSON olarak taşıyor; aynı formatı
 * kullanıyoruz, böylece hazır veri ile kendi çizimlerimiz tek render
 * yolundan geçiyor. Ayrı bir çizim formatı icat etmeye gerek yok.
 *
 * Görsel ve konum verisi garmoth.com'dan, izinleriyle.
 */

const TILE = "https://assets.garmoth.com/world-map/v2/tiles";
/**
 * Garmoth'un harita uzayı piksel değil: dünya 448 birim kare, merkez 224.
 * Zoom z'de ızgara 2^z karo, yani karo başına 448/2^z birim düşüyor.
 */
const WORLD = 448;

type Shape =
  | { t: "c"; p: [number, number]; r: number; k?: string }        // daire
  | { t: "t"; p: [number, number]; x: string; k?: string }        // metin
  | { t: "l"; p: number[]; k?: string }                           // çizgi
  | { t: "i"; p: [number, number]; x: string };                   // ikon

type Calib = {
  scaleX: number; scaleY: number;
  originX: number; originY: number;
  pivotX: number; pivotY: number; yFlip: number;
};

type FortMap = { name: string; c: Calib; s: Shape[]; zoom?: number };

const STORE = "aetherion_forts_v1";
const DEFAULT_CAL: Calib = {
  scaleX: 0.39, scaleY: 0.39, originX: 82.26, originY: 94.38,
  pivotX: 224, pivotY: 224, yFlip: -1,
};

/** Garmoth kalibrasyonu: oyun koordinatı → karo uzayı pikseli */
function project(p: [number, number], c: Calib): [number, number] {
  return [
    c.originX + (p[0] - c.pivotX) * c.scaleX + c.pivotX * c.scaleX,
    c.originY + (p[1] - c.pivotY) * c.scaleY * c.yFlip + c.pivotY * c.scaleY,
  ];
}

const COLORS = ["#e8b451", "#48bb78", "#ef5f5f", "#6b93ff", "#b98cff", "#ffffff"];

export default function KalelerPage() {
  const [maps, setMaps] = useState<FortMap[]>([]);
  const [idx, setIdx] = useState(0);
  const [tool, setTool] = useState<"pan" | "c" | "l" | "t">("pan");
  const [color, setColor] = useState(COLORS[0]);
  const [draft, setDraft] = useState<Shape[]>([]);
  const [importing, setImporting] = useState(false);
  const [raw, setRaw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORE);
      if (s) setMaps(JSON.parse(s));
    } catch { /* bozuk kayıt — boş başla */ }
  }, []);

  const cur = maps[idx] ?? null;
  const cal = cur?.c ?? DEFAULT_CAL;

  /** Görünen tüm şekiller — hazır veri + o an çizilenler */
  const shapes = useMemo(() => {
    const all = [...(cur?.s ?? []), ...draft];
    // Kaynakta koordinatsız şekiller olabiliyor (ör. "r") — çizim bozulmasın
    return all.filter((s) => {
      const p = s.p as (number | null)[];
      return Array.isArray(p) && p.length >= 2 && p.every((n) => typeof n === "number" && isFinite(n));
    });
  }, [cur, draft]);

  // Çizim alanının sınırları — şekillere göre otomatik
  const box = useMemo(() => {
    const pts = shapes.flatMap((s) => {
      if (s.t === "l") {
        const out: [number, number][] = [];
        for (let i = 0; i + 1 < s.p.length; i += 2) out.push([s.p[i], s.p[i + 1]]);
        return out;
      }
      return [s.p as [number, number]];
    });
    if (pts.length === 0) return { x: 0, y: 0, w: 448, h: 448 };
    const proj = pts.map((p) => project(p, cal));
    const xs = proj.map((p) => p[0]), ys = proj.map((p) => p[1]);
    const rawW = Math.max(...xs) - Math.min(...xs);
    const rawH = Math.max(...ys) - Math.min(...ys);
    // Dolgu içeriğe oranlı: bir kale birkaç birim yer kaplıyor, sabit
    // dolgu koyunca kutu açılıp bölge geneline zoom-out oluyordu
    const pad = Math.max(1.5, Math.max(rawW, rawH) * 0.18);
    const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
    return {
      x, y,
      w: Math.max(6, rawW + pad * 2),
      h: Math.max(6, rawH + pad * 2),
    };
  }, [shapes, cal]);

  function svgPoint(e: React.MouseEvent): [number, number] {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const r = svg.getBoundingClientRect();
    const gx = box.x + ((e.clientX - r.left) / r.width) * box.w;
    const gy = box.y + ((e.clientY - r.top) / r.height) * box.h;
    // Projeksiyonu tersine çevir — çizim de aynı uzayda saklansın
    return [
      (gx - cal.originX - cal.pivotX * cal.scaleX) / cal.scaleX + cal.pivotX,
      (gy - cal.originY - cal.pivotY * cal.scaleY) / (cal.scaleY * cal.yFlip) + cal.pivotY,
    ];
  }

  function onClick(e: React.MouseEvent) {
    if (tool === "pan") return;
    const p = svgPoint(e);
    if (tool === "c") setDraft((d) => [...d, { t: "c", p, r: Math.max(0.6, box.w / 40), k: color }]);
    if (tool === "t") {
      const x = window.prompt("Etiket");
      if (x) setDraft((d) => [...d, { t: "t", p, x, k: color }]);
    }
    if (tool === "l") {
      setDraft((d) => {
        const last = d[d.length - 1];
        if (last && last.t === "l" && last.p.length < 4) {
          return [...d.slice(0, -1), { ...last, p: [...last.p, p[0], p[1]] }];
        }
        return [...d, { t: "l", p: [p[0], p[1]], k: color }];
      });
    }
  }

  function importData() {
    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const next: FortMap[] = arr.map((m, i) => {
        const title = (m.s ?? m.shapes ?? []).find(
          (x: { t?: string; type?: string; x?: string; props?: { text?: string } }) =>
            (x.t === "t" || x.type === "text"),
        );
        return {
          name: title?.x ?? title?.props?.text ?? `Harita ${i + 1}`,
          c: m.c ?? m.calibration ?? DEFAULT_CAL,
          s: (m.s ?? m.shapes ?? []).map(
            (x: { t?: string; type?: string; p?: number[]; coords?: number[]; r?: number; radius?: number; x?: string; props?: { text?: string; alt?: string } }) => ({
              t: x.t ?? (x.type ?? "c")[0],
              p: x.p ?? x.coords ?? [0, 0],
              r: x.r ?? x.radius,
              x: x.x ?? x.props?.text ?? x.props?.alt,
            }),
          ),
        };
      });
      setMaps(next);
      localStorage.setItem(STORE, JSON.stringify(next));
      setIdx(0);
      setImporting(false);
      setRaw("");
      setMsg(`${next.length} harita alındı.`);
    } catch {
      setMsg("JSON okunamadı.");
    }
  }

  function saveDraft() {
    if (!cur || draft.length === 0) return;
    const next = maps.map((m, i) => (i === idx ? { ...m, s: [...m.s, ...draft] } : m));
    setMaps(next);
    localStorage.setItem(STORE, JSON.stringify(next));
    setDraft([]);
    setMsg("Çizim kaydedildi.");
  }

  /**
   * Zoom, kutunun büyüklüğüne göre seçilir: kaleye yakınlaşınca daha
   * ayrıntılı karo gelsin, bölge geneline bakarken boşuna yüzlerce
   * karo istenmesin. Hedef, kutuyu yaklaşık 10 karoyla kaplamak.
   */
  const { zoom, tiles } = useMemo(() => {
    const want = Math.max(1, box.w) / 10;
    let z = Math.round(Math.log2(WORLD / want));
    z = Math.max(2, Math.min(7, z));
    const span = WORLD / Math.pow(2, z);
    const n = Math.pow(2, z);
    const x0 = Math.max(0, Math.floor(box.x / span));
    const x1 = Math.min(n - 1, Math.floor((box.x + box.w) / span));
    const y0 = Math.max(0, Math.floor(box.y / span));
    const y1 = Math.min(n - 1, Math.floor((box.y + box.h) / span));
    const out: { x: number; y: number; s: number }[] = [];
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) out.push({ x, y, s: span });
    return { zoom: z, tiles: out };
  }, [box]);

  // Metin ve işaret boyutu kutuyla ölçeklenir — sabit punto uçuk kalıyor
  const uiScale = box.w / 100;

  return (
    <div className="t-root t-glow relative min-h-full">
      <header className="t-nav sticky top-0 z-50">
        <div className="mx-auto max-w-[1400px] px-5 h-[68px] flex items-center gap-4">
          <Link href="/test" className="t-tab"><ChevronLeft className="w-3.5 h-3.5" /> Panel</Link>
          <div className="flex items-center gap-2">
            <Castle className="w-4 h-4" style={{ color: "var(--t-gold)" }} strokeWidth={2} />
            <span className="text-[15px] font-bold">Kale Kurulumları</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {msg && <span className="text-[11px]" style={{ color: "var(--t-gold)" }}>{msg}</span>}
            <button className="t-tab" onClick={() => setImporting((v) => !v)}>
              <Upload className="w-3.5 h-3.5" /> Veri Al
            </button>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-5 py-6 space-y-4">
        {importing && (
          <div className="t-card p-4 space-y-3">
            <p className="text-[12px]" style={{ color: "var(--t-dim)" }}>
              Garmoth rehber sayfasını aç, konsolda{" "}
              <code style={{ color: "var(--t-gold)" }}>docs/garmoth-fort-extraction.md</code>{" "}
              içindeki betiği çalıştır, çıktıyı buraya yapıştır.
            </p>
            <textarea
              value={raw} onChange={(e) => setRaw(e.target.value)}
              rows={5} placeholder='[{"c":{...},"s":[...]}]'
              className="w-full rounded-lg px-3 py-2 text-[12px] font-mono"
              style={{ background: "var(--t-canvas)", border: "1px solid var(--t-line-strong)", color: "var(--t-text)" }}
            />
            <button className="t-tab" data-on onClick={importData}>
              <Download className="w-3.5 h-3.5" /> İçeri Al
            </button>
          </div>
        )}

        {maps.length === 0 ? (
          <div className="t-card p-10 text-center">
            <Castle className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--t-faint)" }} strokeWidth={1.5} />
            <p className="text-[13px]" style={{ color: "var(--t-dim)" }}>
              Henüz kale verisi yok. Üstteki <strong>Veri Al</strong> ile ekle.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {maps.map((m, i) => (
                <button key={i} className="t-tab" data-on={i === idx}
                        onClick={() => { setIdx(i); setDraft([]); }}>
                  {m.name}
                </button>
              ))}
            </div>

            <div className="t-card p-3">
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {([["pan", MousePointer2, "Gez"], ["c", CircleIcon, "Daire"],
                   ["l", Minus, "Çizgi"], ["t", TypeIcon, "Yazı"]] as const).map(([k, Ico, lbl]) => (
                  <button key={k} className="t-tab" data-on={tool === k} onClick={() => setTool(k)}>
                    <Ico className="w-3.5 h-3.5" /> {lbl}
                  </button>
                ))}

                <div className="flex items-center gap-1 ml-1">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)}
                            className="w-5 h-5 rounded-full"
                            style={{ background: c, outline: color === c ? "2px solid #fff6" : "none", outlineOffset: 2 }} />
                  ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {draft.length > 0 && (
                    <>
                      <button className="t-tab" onClick={() => setDraft([])}>
                        <Trash2 className="w-3.5 h-3.5" /> Temizle
                      </button>
                      <button className="t-tab" data-on onClick={saveDraft}>
                        <Save className="w-3.5 h-3.5" /> Kaydet ({draft.length})
                      </button>
                    </>
                  )}
                </div>
              </div>

              <svg
                ref={svgRef}
                viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
                onClick={onClick}
                className="w-full rounded-lg"
                style={{
                  background: "#0d1b1c",
                  cursor: tool === "pan" ? "grab" : "crosshair",
                  aspectRatio: `${box.w} / ${box.h}`,
                }}
              >
                {tiles.map((t) => (
                  <image key={t.x + "_" + t.y}
                         href={`${TILE}/${zoom}/${t.x}/${t.y}.webp`}
                         x={t.x * t.s} y={t.y * t.s}
                         width={t.s + 0.02} height={t.s + 0.02} />
                ))}

                {shapes.map((s, i) => {
                  const stroke = s.t === "i" ? "#fff" : (s as { k?: string }).k ?? "#e8b451";
                  if (s.t === "c") {
                    const [x, y] = project(s.p, cal);
                    return <circle key={i} cx={x} cy={y} r={Math.max(0.4, s.r * cal.scaleX)}
                                   fill={stroke + "44"} stroke={stroke}
                                   strokeWidth={uiScale * 0.35} />;
                  }
                  if (s.t === "t") {
                    const [x, y] = project(s.p, cal);
                    return (
                      <text key={i} x={x} y={y} fill={stroke}
                            fontSize={uiScale * 2.2} fontWeight={700}
                            textAnchor="middle" style={{ paintOrder: "stroke" }}
                            stroke="#000" strokeWidth={uiScale * 0.7}>
                        {s.x}
                      </text>
                    );
                  }
                  if (s.t === "l" && s.p.length >= 4) {
                    const pts: string[] = [];
                    for (let j = 0; j + 1 < s.p.length; j += 2) {
                      const [x, y] = project([s.p[j], s.p[j + 1]], cal);
                      pts.push(`${x},${y}`);
                    }
                    return <polyline key={i} points={pts.join(" ")} fill="none"
                                     stroke={stroke} strokeWidth={uiScale * 0.5} strokeLinecap="round" />;
                  }
                  if (s.t === "i") {
                    const [x, y] = project(s.p as [number, number], cal);
                    return <circle key={i} cx={x} cy={y} r={uiScale * 0.35}
                                   fill="#fff" opacity={0.55} />;
                  }
                  return null;
                })}
              </svg>
            </div>

            <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
              Konum ve harita verisi{" "}
              <a href="https://garmoth.com" target="_blank" rel="noreferrer"
                 style={{ color: "var(--t-gold)" }}>garmoth.com</a>{" "}
              izniyle kullanılıyor. Çizimler tarayıcında saklanıyor.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
