"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Check, Eye, EyeOff, DownloadCloud, X, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Route as RouteIcon, Search, RefreshCw, PictureInPicture2,
} from "lucide-react";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/map-categories";
import { planRoute } from "@/lib/route";
import type { EdaniaMarker } from "@/components/edania-map";
import { PipGuide, pipSupported } from "@/components/pip-guide";
import { MiniMap } from "@/components/mini-map";
import { TestShell, Card, Empty } from "@/components/app-shell";

/**
 * Edania haritası.
 *
 * Noktalar kategoriye göre süzülüyor, toplananlar işaretleniyor ve
 * kalanlar için rota çıkarılıyor. "Oyun modu" rotayı ayrı bir küçük
 * pencereye taşıyor — oyun tam ekranken siteye alt+tab yapmadan bakmak
 * için.
 */

// Leaflet yalnızca tarayıcıda çalışır
const EdaniaMap = dynamic(() => import("@/components/edania-map"), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center text-[13px]"
         style={{ height: "70vh", color: "var(--t-faint)" }}>
      Harita yükleniyor…
    </div>
  ),
});

type Point = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  mapX: number;
  mapY: number;
  imageUrl: string | null;
};

/** Oyun modu penceresi sayfa CSS'ini devralmıyor; renkler elle veriliyor */
const PIP = {
  bg: "#0b0b0c", deep: "#050505", line: "#1e1e22",
  text: "#f4f4f5", dim: "#9a9aa2", faint: "#5e5e66", gold: "#e8b451",
};

export default function HaritaPage() {
  const { data: session } = useSession();

  const [points, setPoints] = useState<Point[]>([]);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  const [active, setActive] = useState<Set<string>>(new Set(CATEGORY_ORDER));
  const [selected, setSelected] = useState<number | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [query, setQuery] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  /** Planlanan sıra id olarak tutulur; durak düşünce yeniden çözülmesin diye */
  const [plannedIds, setPlannedIds] = useState<number[] | null>(null);
  const [lightbox, setLightbox] = useState<{ shots: string[]; i: number } | null>(null);
  const [pipOpen, setPipOpen] = useState(false);
  const [canPip, setCanPip] = useState(false);
  const [stopIdx, setStopIdx] = useState(0);

  useEffect(() => { setCanPip(pipSupported()); }, []);

  useEffect(() => {
    fetch("/api/map-points")
      .then((r) => (r.ok ? r.json() : { points: [], done: [] }))
      .then((d: { points: Point[]; done: number[] }) => {
        setPoints(d.points);
        setDone(new Set(d.done));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((l) => (l ? { ...l, i: (l.i + 1) % l.shots.length } : l));
      if (e.key === "ArrowLeft") setLightbox((l) => (l ? { ...l, i: (l.i - 1 + l.shots.length) % l.shots.length } : l));
    }
    window.addEventListener("keydown", onKey);
    // Arkadaki sayfa kaymasın
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [lightbox]);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      // Lightbox açıkken Esc önce onu kapatsın
      if (e.key === "Escape") setFullscreen((f) => (lightbox ? f : false));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, lightbox]);

  function flip(prev: Set<number>, id: number) {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }

  async function toggleDone(id: number) {
    // İyimser güncelleme — istek başarısız olursa geri alınır
    setDone((prev) => flip(prev, id));
    const res = await fetch("/api/map-points/" + id + "/done", { method: "POST" });
    if (!res.ok) { setDone((prev) => flip(prev, id)); return; }
    const data = (await res.json()) as { done: boolean };
    setDone((prev) => {
      const next = new Set(prev);
      if (data.done) next.add(id); else next.delete(id);
      return next;
    });
  }

  async function seed() {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const res = await fetch("/api/map-points/seed", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSeedMsg(data.error ?? "İçeri alınamadı (" + res.status + ")");
      } else {
        setSeedMsg(
          `${data.created} eklendi, ${data.updated} güncellendi`
          + (data.moved ? `, ${data.moved} kategori değiştirdi` : "")
          + (data.stale ? ` · veride kalmayan ${data.stale} nokta duruyor` : "") + ".",
        );
        const fresh = await fetch("/api/map-points").then((r) => r.json());
        setPoints(fresh.points);
        setDone(new Set<number>(fresh.done));
      }
    } catch {
      setSeedMsg("İstek başarısız oldu.");
    } finally {
      setSeeding(false);
    }
  }

  const visible = useMemo(() => {
    // Türkçe büyük/küçük harf eşlemesi doğru olsun diye locale duyarlı
    const q = query.trim().toLocaleLowerCase("tr");
    return points.filter((p) => {
      if (!active.has(p.category)) return false;
      if (hideDone && done.has(p.id)) return false;
      if (!q) return true;
      return (
        p.title.toLocaleLowerCase("tr").includes(q) ||
        (p.description ?? "").toLocaleLowerCase("tr").includes(q) ||
        categoryMeta(p.category).label.toLocaleLowerCase("tr").includes(q)
      );
    });
  }, [points, active, hideDone, done, query]);

  /** Rotaya girebilecek duraklar: görünür, toplanabilir, henüz işaretlenmemiş */
  const eligible = useMemo(
    () => visible.filter((p) => categoryMeta(p.category).countable && !done.has(p.id)),
    [visible, done],
  );

  const solve = useCallback(
    (stops: Point[]) => planRoute(stops.map((p) => ({ id: p.id, nx: p.mapX, ny: p.mapY }))).map((p) => p.id),
    [],
  );

  /**
   * Sıra yalnızca durak *eklendiğinde* yeniden çözülür. Bir noktayı
   * topladığında küme küçülür ve mevcut sıra korunur — yoksa her
   * işaretlemede rota baştan kurulup elindeki plan dağılırdı.
   */
  useEffect(() => {
    if (!showRoute) { setPlannedIds(null); return; }
    setPlannedIds((prev) => {
      if (prev) {
        const known = new Set(prev);
        if (eligible.every((s) => known.has(s.id))) return prev;
      }
      return solve(eligible);
    });
  }, [showRoute, eligible, solve]);

  const route = useMemo(() => {
    if (!showRoute || !plannedIds) return null;
    const live = new Map(eligible.map((p) => [p.id, p]));
    const stops = plannedIds
      .map((id) => live.get(id))
      .filter((p): p is Point => !!p)
      .map((p) => ({ id: p.id, nx: p.mapX, ny: p.mapY }));
    return stops.length >= 2 ? stops : null;
  }, [showRoute, plannedIds, eligible]);

  const orderOf = useMemo(() => {
    const m = new Map<number, number>();
    route?.forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [route]);

  const markers: EdaniaMarker[] = useMemo(
    () => visible.map((p) => ({
      id: p.id, nx: p.mapX, ny: p.mapY,
      color: categoryMeta(p.category).color,
      label: p.title,
      done: done.has(p.id),
      order: orderOf.get(p.id),
    })),
    [visible, done, orderOf],
  );

  /** imageUrl bir JSON dizisi tutar; tek dize gelen eski kayıtlar da desteklenir */
  function shotsOf(p: Point): string[] {
    if (!p.imageUrl) return [];
    if (!p.imageUrl.startsWith("[")) return [p.imageUrl];
    try {
      const arr = JSON.parse(p.imageUrl);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  const sel = selected != null ? points.find((p) => p.id === selected) ?? null : null;

  // İlerleme yalnızca toplanabilir kategorilerden sayılır — NPC ve üs yöneticisi toplanmaz
  const countable = points.filter((p) => categoryMeta(p.category).countable);
  const collected = countable.filter((p) => done.has(p.id)).length;
  const pct = countable.length ? Math.round((collected / countable.length) * 100) : 0;

  if (loading) {
    return <TestShell title="Edania Haritası" subtitle="Yükleniyor…"><Empty>Noktalar geliyor…</Empty></TestShell>;
  }

  return (
    <TestShell
      title="Edania Haritası"
      subtitle="Tachyon mirasları, izleri ve bilgi noktaları. Topladığını işaretle, ilerlemeni takip et."
      aside={
        <span className="t-chip hidden sm:inline" style={{ color: "var(--t-gold)" }}>
          {collected}/{countable.length} · %{pct}
        </span>
      }
    >
      {session?.user?.isAdmin && (
        <Card hi className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[12.5px] flex-1 min-w-[200px]" style={{ color: "var(--t-dim)" }}>
              {points.length === 0
                ? "Haritada henüz nokta yok. Edania verisini içeri al — 244 nokta eklenecek."
                : "Edania verisini yeniden içeri al. Başlık, açıklama ve konum görselleri güncellenir; kopya oluşmaz."}
            </p>
            {points.length > 0 && (
              <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                {points.filter((p) => shotsOf(p).length > 0).length} noktada görsel var
              </span>
            )}
            {seedMsg && <span className="text-[12px]" style={{ color: "var(--t-gold)" }}>{seedMsg}</span>}
            <button onClick={seed} disabled={seeding}
                    className="text-[12px] font-semibold px-3 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                             border: "1px solid rgba(232,180,81,.3)" }}>
              <DownloadCloud className="w-3.5 h-3.5" strokeWidth={2} />
              {seeding ? "Alınıyor…" : "Noktaları içeri al"}
            </button>
          </div>
        </Card>
      )}

      {/* ── İlerleme ───────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
            Toplama ilerlemesi
          </span>
          <span className="t-num text-[13px] font-bold" style={{ color: "var(--t-gold)" }}>
            {collected} / {countable.length}
            <span className="font-normal" style={{ color: "var(--t-faint)" }}> · %{pct}</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
          <div className="h-full rounded-full transition-all"
               style={{ width: pct + "%",
                        background: "linear-gradient(90deg, rgba(232,180,81,.6), var(--t-gold))" }} />
        </div>
      </Card>

      {/* ── Süzgeçler ──────────────────────────────────────────────── */}
      <Card className={fullscreen ? "fixed top-3 left-3 right-3 z-[1050] p-3" : "p-3"}>
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Nokta ara — isim, bölge veya kategori"
                   className="w-full h-[34px] pl-9 pr-3 rounded-[var(--t-r-sm)] text-[12.5px] outline-none"
                   style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                            color: "var(--t-text)" }} />
          </div>
          {query && (
            <>
              <span className="text-[11px] whitespace-nowrap" style={{ color: "var(--t-faint)" }}>
                {visible.length} sonuç
              </span>
              <Tool onClick={() => setQuery("")} icon={X}>Temizle</Tool>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_ORDER.map((c) => {
            const meta = categoryMeta(c);
            const on = active.has(c);
            const total = points.filter((p) => p.category === c).length;
            const got = points.filter((p) => p.category === c && done.has(p.id)).length;
            return (
              <button key={c}
                      onClick={() => setActive((prev) => {
                        const next = new Set(prev);
                        if (next.has(c)) next.delete(c); else next.add(c);
                        return next;
                      })}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-[var(--t-r-sm)] text-[12px] transition-colors"
                      style={{
                        background: on ? "var(--t-raised)" : "transparent",
                        border: `1px solid ${on ? meta.color + "55" : "var(--t-line)"}`,
                        opacity: on ? 1 : 0.45,
                      }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                <span>{meta.label}</span>
                <span className="t-num" style={{ color: "var(--t-faint)" }}>
                  {meta.countable ? got + "/" + total : total}
                </span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {route && (
              <>
                <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>{route.length} durak</span>
                <Tool onClick={() => setPlannedIds(solve(eligible))} icon={RefreshCw}>Yeniden planla</Tool>
                {canPip && (
                  <Tool on={pipOpen} icon={PictureInPicture2}
                        onClick={() => { setStopIdx(0); setPipOpen((v) => !v); }}>
                    {pipOpen ? "Oyun modu açık" : "Oyun modu"}
                  </Tool>
                )}
              </>
            )}
            <Tool on={showRoute} icon={RouteIcon} onClick={() => setShowRoute((v) => !v)}>
              {showRoute ? "Rota açık" : "Rota çiz"}
            </Tool>
            <Tool on={hideDone} icon={hideDone ? EyeOff : Eye} onClick={() => setHideDone((v) => !v)}>
              {hideDone ? "Toplananlar gizli" : "Hepsi görünür"}
            </Tool>
            <Tool icon={fullscreen ? Minimize2 : Maximize2} onClick={() => setFullscreen((v) => !v)}>
              {fullscreen ? "Küçült" : "Tam ekran"}
            </Tool>
          </div>
        </div>
      </Card>

      {/* ── Harita + seçili nokta ──────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        <Card className={fullscreen
          ? "fixed inset-0 z-40 !rounded-none overflow-hidden"
          : "relative z-0 overflow-hidden"}>
          <EdaniaMap markers={markers} route={route ?? undefined} selectedId={selected}
                     onMarkerClick={setSelected}
                     className={fullscreen ? "w-full h-full" : "w-full h-[70vh] min-h-[420px]"} />
        </Card>

        <Card className={fullscreen
          ? "fixed top-24 right-3 w-[320px] max-h-[calc(100vh-8rem)] overflow-y-auto z-[1050] p-4"
          : "p-4 h-fit lg:sticky lg:top-4"}>
          {sel ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                      style={{ background: categoryMeta(sel.category).color }} />
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold break-words">{sel.title}</h3>
                  <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                    {categoryMeta(sel.category).label}
                    {sel.description ? " · " + sel.description : ""}
                  </p>
                </div>
              </div>

              {shotsOf(sel).map((src, i) => (
                <button key={src} type="button"
                        onClick={() => setLightbox({ shots: shotsOf(sel), i })}
                        className="block w-full rounded-[var(--t-r-sm)] overflow-hidden cursor-zoom-in transition-colors hover:border-[rgba(232,180,81,.5)]"
                        style={{ border: "1px solid var(--t-line)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={sel.title + " konumu " + (i + 1)} loading="lazy" className="w-full block" />
                </button>
              ))}

              <p className="text-[10px] leading-relaxed" style={{ color: "var(--t-faint)" }}>
                Nokta verisi ve görseller{" "}
                <a href="https://korbdo.co.kr" target="_blank" rel="noreferrer"
                   className="hover:underline" style={{ color: "var(--t-gold)" }}>korbdo.co.kr</a>{" "}
                izniyle kullanılıyor.
              </p>

              {categoryMeta(sel.category).countable && (
                <button onClick={() => toggleDone(sel.id)}
                        className="w-full text-[12.5px] font-semibold h-[36px] rounded-[var(--t-r-sm)] inline-flex items-center justify-center gap-1.5"
                        style={done.has(sel.id)
                          ? { color: "var(--t-good)", background: "rgba(56,208,127,.12)",
                              border: "1px solid rgba(56,208,127,.3)" }
                          : { background: "var(--t-gold)", color: "#0b0b0c" }}>
                  <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                  {done.has(sel.id) ? "Topladım" : "Topladım olarak işaretle"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--t-dim)" }}>
              Haritadan bir nokta seç. İçi dolu daireler henüz toplanmadı, içi boş olanlar
              senin işaretlediklerin.
            </p>
          )}
        </Card>
      </div>

      {/* ── Oyun modu penceresi ────────────────────────────────────── */}
      <PipGuide open={pipOpen} onClose={() => setPipOpen(false)} width={340} height={620}>
        {(() => {
          const stops = route ?? [];
          if (stops.length === 0) {
            return (
              <div style={{ padding: 16, color: PIP.dim, fontFamily: "sans-serif", fontSize: 13 }}>
                Toplanacak durak kalmadı.
              </div>
            );
          }
          const idx = Math.min(stopIdx, stops.length - 1);
          const stop = points.find((p) => p.id === stops[idx].id);
          if (!stop) return null;
          const shots = shotsOf(stop);
          const meta = categoryMeta(stop.category);

          return (
            <div style={{
              fontFamily: "sans-serif", color: PIP.text, background: PIP.bg,
              height: "100vh", display: "flex", flexDirection: "column",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderBottom: `1px solid ${PIP.line}`,
              }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: meta.color }} />
                <strong style={{ fontSize: 13 }}>{stop.title}</strong>
                <span style={{ marginLeft: "auto", fontSize: 11, color: PIP.faint }}>
                  {idx + 1} / {stops.length}
                </span>
              </div>

              <MiniMap nx={stop.mapX} ny={stop.mapY} width={340} height={170}
                       markers={[
                         // Hedef durak ortada, halkalı
                         { nx: stop.mapX, ny: stop.mapY, color: PIP.gold, ring: true, label: stop.title },
                         // Yakındaki diğer duraklar yön duygusu versin
                         ...stops.filter((sp) => sp.id !== stop.id).map((sp) => ({
                           nx: sp.nx, ny: sp.ny,
                           color: sp.id === stops[idx + 1]?.id ? "#6b93ff" : PIP.faint,
                         })),
                       ]} />

              <div style={{ flex: 1, overflow: "auto", background: PIP.deep }}>
                {shots.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shots[0]} alt="" style={{ width: "100%", display: "block" }} />
                ) : (
                  <div style={{ padding: 16, fontSize: 12, color: PIP.faint }}>Konum görseli yok.</div>
                )}
                {stop.description && (
                  <div style={{ padding: "6px 12px", fontSize: 11, color: PIP.dim }}>
                    {stop.description}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, padding: 10, borderTop: `1px solid ${PIP.line}` }}>
                <button onClick={() => setStopIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}
                        style={{
                          padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${PIP.line}`, background: "#141416",
                          color: idx === 0 ? PIP.faint : PIP.dim, fontSize: 12,
                        }}>‹</button>
                <button onClick={() => toggleDone(stop.id)}
                        style={{
                          flex: 1, padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${PIP.gold}55`, background: `${PIP.gold}22`,
                          color: PIP.gold, fontSize: 12, fontWeight: 700,
                        }}>✓ Topladım</button>
                <button onClick={() => setStopIdx((i) => Math.min(stops.length - 1, i + 1))}
                        disabled={idx >= stops.length - 1}
                        style={{
                          padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                          border: `1px solid ${PIP.line}`, background: "#141416",
                          color: idx >= stops.length - 1 ? PIP.faint : PIP.dim, fontSize: 12,
                        }}>›</button>
              </div>
            </div>
          );
        })()}
      </PipGuide>

      {/* ── Büyütülmüş görsel ──────────────────────────────────────── */}
      {lightbox && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
             style={{ background: "rgba(0,0,0,.92)" }}
             onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <button type="button" onClick={() => setLightbox(null)} aria-label="Kapat"
                  className="absolute top-4 right-4 p-2 rounded-lg text-white transition-colors"
                  style={{ background: "rgba(255,255,255,.10)" }}>
            <X className="w-5 h-5" strokeWidth={2} />
          </button>

          {lightbox.shots.length > 1 && (
            <>
              <button type="button" aria-label="Önceki"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightbox((l) => (l ? { ...l, i: (l.i - 1 + l.shots.length) % l.shots.length } : l));
                      }}
                      className="absolute left-4 p-2 rounded-lg text-white transition-colors"
                      style={{ background: "rgba(255,255,255,.10)" }}>
                <ChevronLeft className="w-6 h-6" strokeWidth={2} />
              </button>
              <button type="button" aria-label="Sonraki"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightbox((l) => (l ? { ...l, i: (l.i + 1) % l.shots.length } : l));
                      }}
                      className="absolute right-4 p-2 rounded-lg text-white transition-colors"
                      style={{ background: "rgba(255,255,255,.10)" }}>
                <ChevronRight className="w-6 h-6" strokeWidth={2} />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox.shots[lightbox.i]} alt="" onClick={(e) => e.stopPropagation()}
               className="max-w-full max-h-[90vh] object-contain rounded-lg cursor-default" />

          {lightbox.shots.length > 1 && (
            <div className="absolute bottom-4 text-[12px]" style={{ color: "rgba(255,255,255,.7)" }}>
              {lightbox.i + 1} / {lightbox.shots.length}
            </div>
          )}
        </div>
      )}

      <div className="pb-6" />
    </TestShell>
  );
}

function Tool({ onClick, icon: Icon, on, children }: {
  onClick: () => void; icon: React.ElementType; on?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
            className="text-[12px] font-semibold px-2.5 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 whitespace-nowrap"
            style={on
              ? { color: "var(--t-gold)", background: "var(--t-gold-soft)", border: "1px solid rgba(232,180,81,.3)" }
              : { color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}
