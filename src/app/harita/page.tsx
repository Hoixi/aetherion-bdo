"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  MapPin, Check, Eye, EyeOff, DownloadCloud, X, ChevronLeft, ChevronRight,
  Maximize2, Minimize2, Route as RouteIcon, Search,
} from "lucide-react";
import { PageHeader, Card, Loading, Button, Input } from "@/components/ui";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/map-categories";
import { planRoute, routeLength } from "@/lib/route";
import type { EdaniaMarker } from "@/components/edania-map";

// Leaflet yalnızca tarayıcıda çalışır
const EdaniaMap = dynamic(() => import("@/components/edania-map"), {
  ssr: false,
  loading: () => (
    <div className="grid place-items-center" style={{ height: "70vh" }}>
      <Loading />
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

export default function HaritaPage() {
  const { data: session } = useSession();
  const [points, setPoints] = useState<Point[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Set<string>>(new Set(CATEGORY_ORDER));
  const [selected, setSelected] = useState<number | null>(null);
  const [hideDone, setHideDone] = useState(false);
  // Büyütülmüş görsel: hangi noktanın kaçıncı karesi
  const [lightbox, setLightbox] = useState<{ shots: string[]; i: number } | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const [query, setQuery] = useState("");

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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
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
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function toggleDone(id: number) {
    // İyimser güncelleme — istek başarısız olursa geri alınır
    setDone((prev) => flip(prev, id));

    const res = await fetch("/api/map-points/" + id + "/done", { method: "POST" });
    if (!res.ok) {
      setDone((prev) => flip(prev, id));
      return;
    }

    const data = (await res.json()) as { done: boolean };
    setDone((prev) => {
      const next = new Set(prev);
      if (data.done) next.add(id);
      else next.delete(id);
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
        setSeedMsg(data.created + " nokta eklendi, " + data.updated + " güncellendi.");
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
    // Türkçe büyük/küçük harf eşlemesi doğru olsun diye locale duyarlı karşılaştırma
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

  /**
   * Rota yalnızca gerçekten toplanacak duraklardan kurulur: görünür,
   * toplanabilir ve henüz işaretlenmemiş olanlar. 173 nokta için
   * hesap birkaç milisaniye, ama filtre her değiştiğinde tekrarlamasın.
   */
  const route = useMemo(() => {
    if (!showRoute) return null;
    const stops = visible
      .filter((p) => categoryMeta(p.category).countable && !done.has(p.id))
      .map((p) => ({ id: p.id, nx: p.mapX, ny: p.mapY }));
    if (stops.length < 2) return null;
    return planRoute(stops);
  }, [showRoute, visible, done]);

  const orderOf = useMemo(() => {
    const m = new Map<number, number>();
    route?.forEach((p, i) => m.set(p.id, i + 1));
    return m;
  }, [route]);

  const markers: EdaniaMarker[] = useMemo(
    () =>
      visible.map((p) => ({
        id: p.id,
        nx: p.mapX,
        ny: p.mapY,
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

  if (loading) return <Loading />;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={MapPin}
        title="Edania Haritası"
        desc="Tachyon mirasları, izleri ve bilgi noktaları. Topladığını işaretle, ilerlemeni takip et."
      />

      {session?.user?.isAdmin && (
        <Card className="card-accent p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-[13px] text-bdo-text-muted flex-1 min-w-[200px]">
              {points.length === 0
                ? "Haritada henüz nokta yok. Edania verisini içeri al — 244 nokta eklenecek."
                : "Edania verisini yeniden içeri al. Başlık, açıklama ve konum görselleri güncellenir; kopya oluşmaz."}
            </p>
            {points.length > 0 && (
              <span className="text-[11px] text-bdo-text-secondary">
                {points.filter((p) => shotsOf(p).length > 0).length} noktada görsel var
              </span>
            )}
            {seedMsg && <span className="text-[12px] text-bdo-gold">{seedMsg}</span>}
            <Button variant="primary" size="sm" icon={DownloadCloud}
                    onClick={seed} disabled={seeding}>
              {seeding ? "Alınıyor..." : "Noktaları içeri al"}
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wider text-bdo-text-secondary">
            Toplama İlerlemesi
          </span>
          <span className="text-[13px] font-bold text-bdo-gold">
            {collected} / {countable.length}
            <span className="text-bdo-text-secondary font-normal"> · %{pct}</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-bdo-surface-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-bdo-gold/70 to-bdo-gold transition-all"
            style={{ width: pct + "%" }}
          />
        </div>
      </Card>

      <Card className={fullscreen ? "fixed top-3 left-3 right-3 z-50 p-3 shadow-2xl" : "p-3"}>
        <div className="flex items-center gap-2 mb-2">
          <Input
            value={query}
            onChange={setQuery}
            icon={Search}
            placeholder="Nokta ara — isim, bölge veya kategori"
            className="flex-1"
          />
          {query && (
            <span className="text-[11px] text-bdo-text-secondary whitespace-nowrap">
              {visible.length} sonuç
            </span>
          )}
          {query && (
            <Button variant="ghost" size="sm" icon={X} onClick={() => setQuery("")}>
              Temizle
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_ORDER.map((c) => {
            const meta = categoryMeta(c);
            const on = active.has(c);
            const total = points.filter((p) => p.category === c).length;
            const got = points.filter((p) => p.category === c && done.has(p.id)).length;

            return (
              <button
                key={c}
                onClick={() =>
                  setActive((prev) => {
                    const next = new Set(prev);
                    if (next.has(c)) next.delete(c);
                    else next.add(c);
                    return next;
                  })
                }
                className={
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[12px] transition-colors " +
                  (on ? "bg-bdo-surface-2" : "border-bdo-border bg-bdo-bg opacity-45")
                }
                style={on ? { borderColor: meta.color + "55" } : undefined}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: meta.color }}
                />
                <span className="text-bdo-text-primary">{meta.label}</span>
                <span className="text-bdo-text-secondary">
                  {meta.countable ? got + "/" + total : total}
                </span>
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-2">
            {route && (
              <span className="text-[11px] text-bdo-text-secondary">
                {route.length} durak
              </span>
            )}
            <Button
              variant={showRoute ? "primary" : "ghost"}
              size="sm"
              icon={RouteIcon}
              onClick={() => setShowRoute((v) => !v)}
            >
              {showRoute ? "Rota açık" : "Rota çiz"}
            </Button>
            <Button
              variant={hideDone ? "primary" : "ghost"}
              size="sm"
              icon={hideDone ? EyeOff : Eye}
              onClick={() => setHideDone((v) => !v)}
            >
              {hideDone ? "Toplananlar gizli" : "Hepsi görünür"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={fullscreen ? Minimize2 : Maximize2}
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? "Küçült" : "Tam ekran"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <Card className={
          fullscreen
            ? "fixed inset-0 z-40 rounded-none border-0 overflow-hidden p-0"
            : "overflow-hidden p-0"
        }>
          <EdaniaMap
            markers={markers}
            route={route ?? undefined}
            selectedId={selected}
            onMarkerClick={setSelected}
            className={fullscreen ? "w-full h-full" : "w-full h-[70vh] min-h-[420px]"}
          />
        </Card>

        <Card className={
          fullscreen
            ? "fixed top-24 right-3 w-[300px] max-h-[calc(100vh-8rem)] overflow-y-auto z-50 p-4 shadow-2xl"
            : "p-4 h-fit lg:sticky lg:top-4"
        }>
          {sel ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <span
                  className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                  style={{ backgroundColor: categoryMeta(sel.category).color }}
                />
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-bdo-text-primary break-words">
                    {sel.title}
                  </h3>
                  <p className="text-[11px] text-bdo-text-secondary">
                    {categoryMeta(sel.category).label}
                    {sel.description ? " · " + sel.description : ""}
                  </p>
                </div>
              </div>

              {shotsOf(sel).map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setLightbox({ shots: shotsOf(sel), i })}
                  className="block w-full rounded-lg overflow-hidden border border-bdo-border hover:border-bdo-gold/50 transition-colors cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={sel.title + " konumu " + (i + 1)}
                    loading="lazy"
                    className="w-full block"
                  />
                </button>
              ))}

              {shotsOf(sel).length > 0 && (
                <p className="text-[10px] text-bdo-text-secondary leading-relaxed">
                  Görseller{" "}
                  <a href="https://korbdo.co.kr" target="_blank" rel="noreferrer"
                     className="text-bdo-gold hover:underline">korbdo.co.kr</a>{" "}
                  izniyle kullanılıyor.
                </p>
              )}

              {categoryMeta(sel.category).countable && (
                <Button
                  variant={done.has(sel.id) ? "ghost" : "primary"}
                  size="sm"
                  icon={Check}
                  onClick={() => toggleDone(sel.id)}
                  className="w-full"
                >
                  {done.has(sel.id) ? "Topladım ✓" : "Topladım olarak işaretle"}
                </Button>
              )}
            </div>
          ) : (
            <p className="text-[12px] text-bdo-text-muted leading-relaxed">
              Haritadan bir nokta seç. İçi dolu daireler henüz toplanmadı, içi boş
              olanlar senin işaretlediklerin.
            </p>
          )}
        </Card>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Kapat"
            className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>

          {lightbox.shots.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Önceki"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((l) => (l ? { ...l, i: (l.i - 1 + l.shots.length) % l.shots.length } : l));
                }}
                className="absolute left-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronLeft className="w-6 h-6" strokeWidth={2} />
              </button>
              <button
                type="button"
                aria-label="Sonraki"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((l) => (l ? { ...l, i: (l.i + 1) % l.shots.length } : l));
                }}
                className="absolute right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <ChevronRight className="w-6 h-6" strokeWidth={2} />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.shots[lightbox.i]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[90vh] object-contain rounded-lg cursor-default"
          />

          {lightbox.shots.length > 1 && (
            <div className="absolute bottom-4 text-[12px] text-white/70">
              {lightbox.i + 1} / {lightbox.shots.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
