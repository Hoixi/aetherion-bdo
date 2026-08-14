"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { MapPin, Check, Eye, EyeOff, DownloadCloud } from "lucide-react";
import { PageHeader, Card, Loading, Button } from "@/components/ui";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/map-categories";
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

  useEffect(() => {
    fetch("/api/map-points")
      .then((r) => (r.ok ? r.json() : { points: [], done: [] }))
      .then((d: { points: Point[]; done: number[] }) => {
        setPoints(d.points);
        setDone(new Set(d.done));
      })
      .finally(() => setLoading(false));
  }, []);

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

  const visible = useMemo(
    () => points.filter((p) => active.has(p.category) && !(hideDone && done.has(p.id))),
    [points, active, hideDone, done],
  );

  const markers: EdaniaMarker[] = useMemo(
    () =>
      visible.map((p) => ({
        id: p.id,
        nx: p.mapX,
        ny: p.mapY,
        color: categoryMeta(p.category).color,
        label: p.title,
        done: done.has(p.id),
      })),
    [visible, done],
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

      <Card className="p-3">
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

          <div className="ml-auto">
            <Button
              variant={hideDone ? "primary" : "ghost"}
              size="sm"
              icon={hideDone ? EyeOff : Eye}
              onClick={() => setHideDone((v) => !v)}
            >
              {hideDone ? "Toplananlar gizli" : "Hepsi görünür"}
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <Card className="overflow-hidden p-0">
          <EdaniaMap
            markers={markers}
            selectedId={selected}
            onMarkerClick={setSelected}
            className="w-full h-[70vh] min-h-[420px]"
          />
        </Card>

        <Card className="p-4 h-fit lg:sticky lg:top-4">
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
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={sel.title + " konumu " + (i + 1)}
                  loading="lazy"
                  className="w-full rounded-lg border border-bdo-border"
                />
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
    </div>
  );
}
