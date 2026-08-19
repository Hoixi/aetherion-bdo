"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Castle, ChevronLeft, Circle as CircleIcon, Type as TypeIcon, Minus,
  Trash2, Upload, MousePointer2, Save, Undo2, ImagePlus,
} from "lucide-react";
import "../theme.css";

/**
 * Kale kurulum noktaları — görsel tabanlı.
 *
 * Garmoth'un koordinat dönüşümünü kaynaktan güvenilir biçimde çıkaramadık;
 * haritayı zaten doğru kompoze edilmiş haliyle almak o düğümü tamamen
 * kesiyor. Zemin düz bir görsel, üstündeki çizimler 0–1 aralığında
 * saklanıyor, böylece görsel değişse de işaretler oranını koruyor.
 *
 * Harita görselleri garmoth.com'dan, izinleriyle.
 */

type Shape =
  | { t: "c"; x: number; y: number; r: number; k: string }
  | { t: "l"; pts: number[]; k: string }
  | { t: "t"; x: number; y: number; s: string; k: string };

type Fort = {
  id: string;
  name: string;
  region: string;
  /** public altındaki yol ya da yüklenen görselin data URL'i */
  img: string;
  shapes: Shape[];
};

const STORE = "aetherion_forts_v2";
const COLORS = ["#e8b451", "#48bb78", "#ef5f5f", "#6b93ff", "#b98cff", "#ffffff"];

/** Görsel gelmeden de yapı dursun diye önceden tanımlı kaleler */
const SEED: Omit<Fort, "shapes">[] = [
  { id: "balenos-genel",  region: "Balenos",  name: "Balenos Genel",      img: "/map/forts/balenos-genel.webp" },
  { id: "cron-castle",    region: "Balenos",  name: "Cron Castle",        img: "/map/forts/cron-castle.webp" },
  { id: "forest-plunder", region: "Balenos",  name: "Yağma Ormanı",       img: "/map/forts/forest-plunder.webp" },
  { id: "bartali-farm",   region: "Balenos",  name: "Bartali Çiftliği",   img: "/map/forts/bartali-farm.webp" },
  { id: "western-guard",  region: "Balenos",  name: "Batı Muhafız Kampı", img: "/map/forts/western-guard.webp" },
  { id: "altar-agris",    region: "Balenos",  name: "Agris Sunağı",       img: "/map/forts/altar-agris.webp" },
  { id: "wolf-hill",      region: "Balenos",  name: "Kurt Tepesi",        img: "/map/forts/wolf-hill.webp" },
  { id: "serendia-genel", region: "Serendia", name: "Serendia Genel",     img: "/map/forts/serendia-genel.webp" },
];

export default function KalelerPage() {
  const [forts, setForts] = useState<Fort[]>([]);
  const [sel, setSel] = useState(0);
  const [tool, setTool] = useState<"pan" | "c" | "l" | "t">("pan");
  const [color, setColor] = useState(COLORS[0]);
  const [draft, setDraft] = useState<Shape[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [broken, setBroken] = useState<Record<string, boolean>>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let base: Fort[] = SEED.map((f) => ({ ...f, shapes: [] }));
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        const saved: Fort[] = JSON.parse(raw);
        // Kayıtlıyı koru, listeye sonradan eklenen kaleler de gelsin
        base = base.map((f) => saved.find((s) => s.id === f.id) ?? f);
        for (const s of saved) if (!base.some((f) => f.id === s.id)) base.push(s);
      }
    } catch { /* bozuk kayıt — tohumla başla */ }
    setForts(base);
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);

  const cur = forts[sel] ?? null;
  const regions = Array.from(new Set(forts.map((f) => f.region)));

  function persist(next: Fort[]) {
    setForts(next);
    try { localStorage.setItem(STORE, JSON.stringify(next)); }
    catch { setMsg("Kaydedilemedi — tarayıcı deposu dolmuş olabilir."); }
  }

  /** Tıklanan yeri görselin oranına çevirir — görsel değişse de yerinde kalsın */
  function rel(e: React.MouseEvent): [number, number] {
    const el = wrapRef.current;
    if (!el) return [0, 0];
    const r = el.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }

  function onClick(e: React.MouseEvent) {
    if (tool === "pan" || !cur) return;
    const [x, y] = rel(e);
    if (tool === "c") setDraft((d) => [...d, { t: "c", x, y, r: 0.03, k: color }]);
    if (tool === "t") {
      const s = window.prompt("Etiket");
      if (s) setDraft((d) => [...d, { t: "t", x, y, s, k: color }]);
    }
    if (tool === "l") {
      setDraft((d) => {
        const last = d[d.length - 1];
        if (last && last.t === "l" && last.pts.length < 4) {
          return [...d.slice(0, -1), { ...last, pts: [...last.pts, x, y] }];
        }
        return [...d, { t: "l", pts: [x, y], k: color }];
      });
    }
  }

  function save() {
    if (!cur || draft.length === 0) return;
    persist(forts.map((f, i) => (i === sel ? { ...f, shapes: [...f.shapes, ...draft] } : f)));
    setDraft([]);
    setMsg("Çizim kaydedildi.");
  }

  function clearSaved() {
    if (!cur) return;
    persist(forts.map((f, i) => (i === sel ? { ...f, shapes: [] } : f)));
    setDraft([]);
    setMsg("Bu haritanın çizimleri silindi.");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !cur) return;
    const id = cur.id;
    const reader = new FileReader();
    reader.onload = () => {
      persist(forts.map((f, i) => (i === sel ? { ...f, img: String(reader.result) } : f)));
      setBroken((b) => ({ ...b, [id]: false }));
      setMsg("Görsel yüklendi.");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const shown = cur ? [...cur.shapes, ...draft] : [];
  const missing = cur ? broken[cur.id] : false;

  return (
    <div className="t-root t-glow relative min-h-full">
      <header className="t-nav sticky top-0 z-50">
        <div className="mx-auto max-w-[1400px] px-5 h-[68px] flex items-center gap-4">
          <Link href="/test" className="t-tab"><ChevronLeft className="w-3.5 h-3.5" /> Panel</Link>
          <div className="flex items-center gap-2">
            <Castle className="w-4 h-4" style={{ color: "var(--t-gold)" }} strokeWidth={2} />
            <span className="text-[15px] font-bold">Kale Kurulumları</span>
          </div>
          {msg && (
            <span className="ml-auto text-[11px]" style={{ color: "var(--t-gold)" }}>{msg}</span>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-5 py-6 space-y-3">
        {regions.map((region) => (
          <div key={region} className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.08em] w-16 flex-shrink-0"
                  style={{ color: "var(--t-faint)" }}>{region}</span>
            {forts.map((f, i) => f.region !== region ? null : (
              <button key={f.id} className="t-tab" data-on={i === sel}
                      onClick={() => { setSel(i); setDraft([]); }}>
                {f.name}
              </button>
            ))}
          </div>
        ))}

        {cur && (
          <div className="t-card p-3 !mt-4">
            <div className="flex items-center gap-2 flex-wrap mb-3">
              {([["pan", MousePointer2, "Gez"], ["c", CircleIcon, "Daire"],
                 ["l", Minus, "Çizgi"], ["t", TypeIcon, "Yazı"]] as const).map(([k, Ico, lbl]) => (
                <button key={k} className="t-tab" data-on={tool === k} onClick={() => setTool(k)}>
                  <Ico className="w-3.5 h-3.5" /> {lbl}
                </button>
              ))}

              <div className="flex items-center gap-1 ml-1">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setColor(c)} className="w-5 h-5 rounded-full"
                          style={{ background: c, outline: color === c ? "2px solid #fff6" : "none", outlineOffset: 2 }} />
                ))}
              </div>

              <div className="ml-auto flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
                <button className="t-tab" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="w-3.5 h-3.5" /> Görsel
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
                {cur.shapes.length > 0 && draft.length === 0 && (
                  <button className="t-tab" onClick={clearSaved}>
                    <Trash2 className="w-3.5 h-3.5" /> Çizimleri Sil
                  </button>
                )}
              </div>
            </div>

            <div ref={wrapRef} onClick={onClick}
                 className="relative w-full rounded-lg overflow-hidden select-none"
                 style={{ background: "#0d1b1c", minHeight: 300,
                          cursor: tool === "pan" ? "default" : "crosshair" }}>
              {missing ? (
                <div className="grid place-items-center py-20 px-6 text-center">
                  <Upload className="w-7 h-7 mb-3" style={{ color: "var(--t-faint)" }} strokeWidth={1.5} />
                  <p className="text-[13px] mb-1.5" style={{ color: "var(--t-dim)" }}>
                    <strong>{cur.name}</strong> için harita görseli yok.
                  </p>
                  <p className="text-[11px] max-w-md leading-relaxed" style={{ color: "var(--t-faint)" }}>
                    Garmoth rehberindeki haritanın ekran görüntüsünü al ve üstteki{" "}
                    <strong>Görsel</strong> ile yükle. Herkeste görünmesi için{" "}
                    <code style={{ color: "var(--t-gold)" }}>public/map/forts/{cur.id}.webp</code>{" "}
                    olarak repoya koy.
                  </p>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cur.img} alt={cur.name} className="w-full block"
                     onError={() => setBroken((b) => ({ ...b, [cur.id]: true }))} />
              )}

              {/* Çizim katmanı — oranlı koordinat, görselden bağımsız */}
              {!missing && (
                <svg viewBox="0 0 1 1" preserveAspectRatio="none"
                     className="absolute inset-0 w-full h-full pointer-events-none">
                  {shown.map((s, i) => {
                    if (s.t === "c") {
                      return <circle key={i} cx={s.x} cy={s.y} r={s.r}
                                     fill={s.k + "33"} stroke={s.k} strokeWidth={2}
                                     vectorEffect="non-scaling-stroke" />;
                    }
                    if (s.t === "l" && s.pts.length >= 4) {
                      const pts: string[] = [];
                      for (let j = 0; j + 1 < s.pts.length; j += 2) pts.push(`${s.pts[j]},${s.pts[j + 1]}`);
                      return <polyline key={i} points={pts.join(" ")} fill="none" stroke={s.k}
                                       strokeWidth={2} vectorEffect="non-scaling-stroke"
                                       strokeLinecap="round" />;
                    }
                    if (s.t === "t") {
                      return (
                        <text key={i} x={s.x} y={s.y} fill={s.k} fontSize={0.028} fontWeight={700}
                              textAnchor="middle" stroke="#000" strokeWidth={0.006}
                              style={{ paintOrder: "stroke" }}>
                          {s.s}
                        </text>
                      );
                    }
                    return null;
                  })}
                </svg>
              )}

              {draft.length > 0 && (
                <span className="absolute top-2 right-2 text-[10px] px-2 py-1 rounded-md"
                      style={{ background: "#000a", color: "var(--t-gold)" }}>
                  {draft.length} kaydedilmedi
                </span>
              )}
            </div>
          </div>
        )}

        <p className="text-[11px] pb-6" style={{ color: "var(--t-faint)" }}>
          Harita görselleri{" "}
          <a href="https://garmoth.com" target="_blank" rel="noreferrer"
             style={{ color: "var(--t-gold)" }}>garmoth.com</a>{" "}
          izniyle kullanılıyor. Çizimler tarayıcında saklanıyor.
        </p>
      </main>
    </div>
  );
}
