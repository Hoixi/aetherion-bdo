"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import {
  Circle as CircleIcon, Type as TypeIcon, Minus,
  Square, Trash2, MousePointer2, Save, Undo2, Eye, EyeOff, Tag, Check,
  Cloud, HardDrive, Lock, X, Flag, ChevronRight,
} from "lucide-react";
import { TestShell } from "@/components/app-shell";
import balenosRaw from "@/data/forts/balenos.json";
import serendiaRaw from "@/data/forts/serendia.json";
import {
  buildForts, iconUrl, iconLabel, ICON_LABELS, guideImg, FORT_NAMES,
  type Shape, type FortSpot,
} from "@/lib/garmoth-forts";
import spotsTr from "@/data/forts/spots-tr.json";
import type { DrawTool } from "@/components/fort-map";

/**
 * Kale kurulum haritaları.
 *
 * Harita garmoth karolarından canlı çiziliyor, kurulum noktaları da
 * garmoth'un kendi şekil verisinden geliyor — ikisi de kaynağında ne ise o.
 * Üstüne kendi çizimlerimiz biniyor; onlar da aynı şekil şemasında, yani
 * tek bir çizim yolu ikisine birden yetiyor.
 *
 * Planlar sunucuda tutuluyor ki savaşa girecek herkes aynısını görsün.
 * Oturum yoksa sayfa yine açılıyor ama çizimler yalnızca o tarayıcıda
 * kalıyor — harita ve kurulum noktaları oturumsuz da işe yarıyor.
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

const SPOTS = spotsTr as Record<string, FortSpot[]>;

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

/** Planların nereden geldiği — sunucu erişilemezse yerele düşülüyor */
type Source = "loading" | "server" | "local";
type PlanMeta = { by: string; updatedAt: string };

export default function KalelerPage() {
  const [sel, setSel] = useState("balenos-genel");
  const [tool, setTool] = useState<DrawTool>("pan");
  const [color, setColor] = useState(COLORS[0]);
  const [draft, setDraft] = useState<Shape[]>([]);
  const [saved, setSaved] = useState<Record<string, Shape[]>>({});
  const [meta, setMeta] = useState<Record<string, PlanMeta>>({});
  const [source, setSource] = useState<Source>("loading");
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  /** Bölge haritasında bayrağa tıklayınca açılan kale rehberi */
  const [guide, setGuide] = useState<string | null>(null);
  /** Kutu çizerken bekleyen ilk köşe */
  const cornerRef = useRef<[number, number] | null>(null);

  const fort = useMemo(() => FORTS.find((f) => f.id === sel) ?? FORTS[0], [sel]);
  const drawn = saved[fort.id] ?? [];
  const editable = source === "local" || canEdit;

  useEffect(() => {
    let dead = false;

    (async () => {
      try {
        const res = await fetch("/api/forts/plans");
        if (res.ok) {
          const data = await res.json();
          if (dead) return;
          const shapes: Record<string, Shape[]> = {};
          const metas: Record<string, PlanMeta> = {};
          for (const [key, p] of Object.entries(data.plans as Record<string, {
            shapes: Shape[]; updatedAt: string; by: string;
          }>)) {
            shapes[key] = p.shapes;
            metas[key] = { by: p.by, updatedAt: p.updatedAt };
          }
          setSaved(shapes);
          setMeta(metas);
          setCanEdit(Boolean(data.canEdit));
          setSource("server");
          return;
        }
      } catch { /* ağ yok — yerele düş */ }

      if (dead) return;
      // Oturum yok ya da sunucuya ulaşılamadı: harita yine çalışsın,
      // çizimler bu tarayıcıda kalsın
      try {
        const raw = localStorage.getItem(STORE);
        if (raw) setSaved(JSON.parse(raw));
      } catch { /* bozuk kayıt — boş başla */ }
      setSource("local");
    })();

    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);

  // Kale değişince yarım kalan çizim taşınmasın
  useEffect(() => {
    setDraft([]);
    setGuide(null);
    cornerRef.current = null;
  }, [sel]);

  /** Bir kalenin planını yazar — sunucu varsa oraya, yoksa tarayıcıya */
  async function persist(fortKey: string, shapes: Shape[]) {
    const next = { ...saved };
    if (shapes.length === 0) delete next[fortKey];
    else next[fortKey] = shapes;
    setSaved(next);

    if (source !== "server") {
      try { localStorage.setItem(STORE, JSON.stringify(next)); }
      catch { setMsg("Kaydedilemedi — tarayıcı deposu dolu olabilir."); }
      return true;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/forts/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fortKey, shapes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMsg(err.error ?? "Sunucuya kaydedilemedi.");
        return false;
      }
      const data = await res.json();
      setMeta((m) => {
        const n = { ...m };
        if (data.cleared) delete n[fortKey];
        else n[fortKey] = { by: data.by, updatedAt: data.updatedAt };
        return n;
      });
      return true;
    } catch {
      setMsg("Sunucuya ulaşılamadı.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function onPick(cx: number, cy: number) {
    if (!editable) return;

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

  async function save() {
    if (draft.length === 0) return;
    const ok = await persist(fort.id, [...drawn, ...draft]);
    if (!ok) return;
    setDraft([]);
    cornerRef.current = null;
    setMsg(source === "server" ? "Plan kaydedildi, herkes görüyor." : "Çizim kaydedildi.");
  }

  async function clearSaved() {
    if (!window.confirm(`${fort.name} planındaki ${drawn.length} çizim silinecek. Emin misin?`)) return;
    const ok = await persist(fort.id, []);
    if (!ok) return;
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
    <TestShell
      title={fort.name}
      subtitle={
        source === "loading"
          ? "Yükleniyor…"
          : `${fort.region} · garmoth kurulum noktaları üzerine çizim`
      }
      aside={msg ? <span className="t-chip" style={{ color: "var(--t-gold)" }}>{msg}</span> : null}
      tabs={
        <div className="space-y-2">
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
        </div>
      }
    >
      <>
        <div className="t-card p-3">
          {/* Araç çubuğu */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {editable ? (
              <>
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
              </>
            ) : source === "server" ? (
              <span className="t-chip flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Sadece görüntüleme
              </span>
            ) : null}

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
              {editable && draft.length > 0 && (
                <>
                  <button className="t-tab" onClick={() => setDraft((d) => d.slice(0, -1))}>
                    <Undo2 className="w-3.5 h-3.5" /> Geri
                  </button>
                  <button className="t-tab" data-on onClick={save} disabled={busy}>
                    <Save className="w-3.5 h-3.5" />
                    {busy ? "Kaydediliyor…" : `Kaydet (${draft.length})`}
                  </button>
                </>
              )}
              {editable && drawn.length > 0 && draft.length === 0 && (
                <button className="t-tab" onClick={clearSaved} disabled={busy}>
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
              onFortClick={setGuide}
              className="w-full h-[clamp(420px,64vh,760px)]"
            />

            {guide && SPOTS[guide] && (
              <FortGuide id={guide} onClose={() => setGuide(null)}
                         onOpen={() => { setSel(guide); setGuide(null); }} />
            )}
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
              <span className="text-[11px] ml-auto flex items-center gap-3"
                    style={{ color: "var(--t-faint)" }}>
                {spots > 0 && <span>{spots} kurulum noktası</span>}
                {source === "server" ? (
                  <span className="flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5" />
                    {meta[fort.id]
                      ? `${meta[fort.id].by} · ${new Date(meta[fort.id].updatedAt)
                          .toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}`
                      : "plan yok"}
                  </span>
                ) : source === "local" ? (
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5" /> yalnızca bu tarayıcıda
                  </span>
                ) : null}
              </span>
            </div>
          )}
        </div>

        <p className="text-[11px] pb-6 leading-relaxed" style={{ color: "var(--t-faint)" }}>
          Harita karoları, kurulum noktaları ve ikonlar{" "}
          <a href="https://garmoth.com" target="_blank" rel="noreferrer"
             style={{ color: "var(--t-gold)" }}>garmoth.com</a>{" "}
          izniyle kullanılıyor.{" "}
          {source === "server"
            ? "Planlar sunucuda — savaşa girecek herkes aynısını görüyor."
            : source === "local"
              ? "Oturum açık değil, çizimler yalnızca bu tarayıcıda kalıyor."
              : null}
        </p>
      </>
    </TestShell>
  );
}

/**
 * Bölge haritasında bayrağa tıklayınca açılan kale rehberi.
 *
 * Garmoth'un her kurulum noktası için yazdığı değerlendirme ve ekran
 * görüntüsü burada, Türkçeleştirilmiş hâliyle. Haritanın üstünde kayan
 * bir panel olarak duruyor — ayrı sayfaya gitmek, haritadan kopardığı
 * için tercih edilmedi.
 */
function FortGuide({ id, onClose, onOpen }: {
  id: string; onClose: () => void; onOpen: () => void;
}) {
  const spots = SPOTS[id] ?? [];
  const [shot, setShot] = useState<string | null>(null);

  return (
    <div className="absolute inset-0 z-[1000] flex justify-end">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.55)" }}
           onClick={onClose} />

      <aside className="relative w-full sm:w-[440px] h-full overflow-y-auto"
             style={{ background: "var(--t-surface)", borderLeft: "1px solid var(--t-line-strong)" }}>
        <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3"
             style={{ background: "var(--t-surface)", borderBottom: "1px solid var(--t-line)" }}>
          <Flag className="w-4 h-4 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
          <h3 className="text-[14px] font-semibold truncate">{FORT_NAMES[id] ?? id}</h3>
          <button onClick={onOpen} className="t-tab ml-auto flex-shrink-0">
            Haritası <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="t-tab flex-shrink-0" aria-label="Kapat">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {spots.map((sp) => (
            <div key={sp.n} className="rounded-[var(--t-r)] overflow-hidden"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={guideImg(sp.img)} alt="" loading="lazy"
                   onClick={() => setShot(guideImg(sp.img))}
                   className="w-full block cursor-zoom-in" />

              <div className="p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="t-num text-[12px] font-bold w-5 h-5 rounded grid place-items-center flex-shrink-0"
                        style={{ background: "var(--t-gold-soft)", color: "var(--t-gold)" }}>
                    {sp.n}
                  </span>
                  <span className="text-[13px] font-semibold">{sp.dir}</span>
                  {sp.madpot && (
                    <span className="t-chip" style={{ color: "var(--t-bad)", borderColor: "#ef5f5f55" }}>
                      MADPOT
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mb-2.5">
                  {sp.tags.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(255,255,255,.05)", color: "var(--t-dim)" }}>
                      {t}
                    </span>
                  ))}
                </div>

                <p className="text-[12px] leading-relaxed" style={{ color: "var(--t-dim)" }}>
                  {sp.text}
                </p>
              </div>
            </div>
          ))}

          <p className="text-[10.5px] pb-2" style={{ color: "var(--t-faint)" }}>
            Değerlendirmeler garmoth.com occupation rehberinden, izniyle çevrildi.
          </p>
        </div>
      </aside>

      {/* Ekran görüntüsünü büyüt */}
      {shot && (
        <div className="fixed inset-0 z-[1100] grid place-items-center p-6"
             style={{ background: "rgba(0,0,0,.85)" }} onClick={() => setShot(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={shot} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
