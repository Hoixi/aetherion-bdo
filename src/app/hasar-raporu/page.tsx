"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Swords, Skull, Flame, Shield, Lock, Heart, HandHeart, Castle, Crosshair,
  Bomb, Ruler, Zap, AlertTriangle, ArrowUpDown, LayoutGrid, LayoutList,
  Trophy, Send, Image as ImageIcon, ChevronRight,
} from "lucide-react";
import { getClassByID, getPortraitUrl, getClassIconUrl, getClassBannerUrl } from "@/lib/classes";
import {
  TestShell, Card, Bar, GuildTag, Empty, fmt, loadJson, type Guild,
} from "@/components/app-shell";

/**
 * Hasar raporu.
 *
 * İki mod var: tek savaş ya da bütün savaşların ortalaması. Ortalamada
 * seri ve top mesafesi ortalanmıyor — o ikisi "en iyi ne yaptı" sorusunun
 * cevabı, ortalaması bir şey anlatmıyor.
 */

type War = { id: number; title: string; date: string };
type GuildRow = { id: number; name: string; tag: string; color: string };

type Performance = {
  id: number;
  inGameName: string;
  class: string;
  spec: string;
  kills: number; deaths: number; killStreak: number;
  damageDealt: number; damageTaken: number; ccCount: number;
  hpHeal: number; allyHpHeal: number; castleDamage: number;
  cannonHits: number; cannonDestroys: number; cannonMaxRange: number;
  trapExplosions: number;
  user: { id: number; familyName: string; avatarUrl: string; class: string; guild?: (Guild & { id: number }) | null } | null;
  war: { id: number; title: string; date: string };
};

type Row = {
  key: string;
  name: string;
  classId: string;
  spec: string;
  user: Performance["user"];
  guild?: (Guild & { id: number }) | null;
  kills: number; deaths: number; killStreak: number;
  damageDealt: number; damageTaken: number; ccCount: number;
  hpHeal: number; allyHpHeal: number; castleDamage: number;
  cannonHits: number; cannonDestroys: number; cannonMaxRange: number;
  trapExplosions: number;
  warCount: number;
  warId?: number;
  warTitle?: string;
};

type SortKey = "damageDealt" | "kills" | "deaths" | "ccCount" | "hpHeal" | "castleDamage" | "killStreak";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "damageDealt", label: "Hasar" },
  { key: "kills", label: "Kill" },
  { key: "deaths", label: "Ölüm" },
  { key: "ccCount", label: "CC" },
  { key: "hpHeal", label: "İyileştirme" },
  { key: "castleDamage", label: "Kale" },
  { key: "killStreak", label: "Seri" },
];

/**
 * Ortalama alınacak pencereler.
 *
 * Eskiden tek seçenek "tüm savaşlar"dı: aylar öncesini bugünle aynı
 * ağırlıkta sayıyor ve kim form tutuyor sorusunu gölgeliyordu.
 */
const PENCERELER = [5, 10, 20] as const;

/** Kısaltılarak gösterilecek metrikler — geri kalanı ondalıklı sayı */
const BIG: SortKey[] = ["damageDealt", "hpHeal", "castleDamage"];

const MEDAL = ["#e8b451", "#c8ccd4", "#b87333"];

export default function HasarRaporuPage() {
  const { data: session } = useSession();

  const [wars, setWars] = useState<War[]>([]);
  const [guilds, setGuilds] = useState<GuildRow[]>([]);
  const [perfs, setPerfs] = useState<Performance[]>([]);
  /** "last:N" (pencere), "all" (tüm geçmiş) ya da tek savaşın id'si */
  const [secim, setSecim] = useState<string>("last:5");
  const [guildId, setGuildId] = useState<number | "">("");
  const [sortKey, setSortKey] = useState<SortKey>("damageDealt");
  const [dense, setDense] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  // İlk yükleme savaş ve klan listesini de getiriyor; filtre değişince
  // sadece performanslar tazeleniyor
  useEffect(() => {
    loadJson<{ wars: War[]; guilds: GuildRow[]; performances: Performance[] }>("/api/performances?lastWars=5")
      .then((d) => {
        setWars(d.wars ?? []);
        setGuilds(d.guilds ?? []);
        setPerfs(d.performances ?? []);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const warId = /^\d+$/.test(secim) ? Number(secim) : null;
  const pencere = secim.startsWith("last:") ? Number(secim.slice(5)) : null;
  const isAggregate = warId === null;

  useEffect(() => {
    const qs = new URLSearchParams();
    if (warId !== null) qs.set("warId", String(warId));
    else if (pencere) qs.set("lastWars", String(pencere));
    if (guildId !== "") qs.set("guild", String(guildId));
    setLoading(true);
    loadJson<{ performances: Performance[] }>(`/api/performances${qs.toString() ? `?${qs}` : ""}`)
      .then((d) => setPerfs(d.performances ?? []))
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [warId, pencere, guildId]);

  const rows = useMemo((): Row[] => {
    if (!isAggregate) {
      return perfs.map((p) => ({
        key: String(p.id),
        name: p.user?.familyName || p.inGameName,
        classId: p.class || p.user?.class || "",
        spec: p.spec || "awakening",
        user: p.user,
        guild: p.user?.guild,
        kills: p.kills, deaths: p.deaths, killStreak: p.killStreak,
        damageDealt: p.damageDealt, damageTaken: p.damageTaken, ccCount: p.ccCount,
        hpHeal: p.hpHeal, allyHpHeal: p.allyHpHeal, castleDamage: p.castleDamage,
        cannonHits: p.cannonHits, cannonDestroys: p.cannonDestroys,
        cannonMaxRange: p.cannonMaxRange, trapExplosions: p.trapExplosions,
        warCount: 1, warId: p.war.id, warTitle: p.war.title,
      }));
    }

    // Site hesabı olmayanlar oyun içi adla gruplanıyor
    const groups = new Map<string, Performance[]>();
    for (const p of perfs) {
      const k = p.user ? `u${p.user.id}` : `n${p.inGameName.toLowerCase().trim()}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }

    return Array.from(groups.entries()).map(([k, list]) => {
      const n = list.length;
      const first = list[0];
      const avg = (f: (p: Performance) => number) => list.reduce((s, p) => s + f(p), 0) / n;
      const max = (f: (p: Performance) => number) => Math.max(...list.map(f));
      return {
        key: k,
        name: first.user?.familyName || first.inGameName,
        classId: first.class || first.user?.class || "",
        spec: first.spec || "awakening",
        user: first.user,
        guild: first.user?.guild,
        kills: avg((p) => p.kills), deaths: avg((p) => p.deaths), killStreak: max((p) => p.killStreak),
        damageDealt: avg((p) => p.damageDealt), damageTaken: avg((p) => p.damageTaken),
        ccCount: avg((p) => p.ccCount), hpHeal: avg((p) => p.hpHeal),
        allyHpHeal: avg((p) => p.allyHpHeal), castleDamage: avg((p) => p.castleDamage),
        cannonHits: avg((p) => p.cannonHits), cannonDestroys: avg((p) => p.cannonDestroys),
        cannonMaxRange: max((p) => p.cannonMaxRange), trapExplosions: avg((p) => p.trapExplosions),
        warCount: n,
      };
    });
  }, [perfs, isAggregate]);

  const sorted = useMemo(() => [...rows].sort((a, b) => b[sortKey] - a[sortKey]), [rows, sortKey]);
  const top = sorted[0]?.[sortKey] ?? 0;

  /** Klan karşılaştırması — tek klan varken anlamsız */
  const guildSummary = useMemo(() => {
    if (guilds.length < 2) return [];
    return guilds.map((g) => {
      const rs = rows.filter((r) => r.guild?.id === g.id);
      const avg = (f: (r: Row) => number) => (rs.length ? rs.reduce((s, r) => s + f(r), 0) / rs.length : 0);
      return {
        ...g, count: rs.length,
        avgDamage: avg((r) => r.damageDealt),
        avgKills: avg((r) => r.kills),
        avgDeaths: avg((r) => r.deaths),
      };
    }).filter((g) => g.count > 0);
  }, [rows, guilds]);

  // Görselde yalnızca dört metrik var; diğer sıralamalarda hasara düşüyor
  const cardSort: SortKey =
    (["damageDealt", "kills", "deaths", "castleDamage"] as SortKey[]).includes(sortKey)
      ? sortKey : "damageDealt";
  const cardUrl = warId === null
    ? null
    : `/api/war-report-card/${warId}?sort=${cardSort}&limit=10${guildId ? `&guild=${guildId}` : ""}`;

  async function publish() {
    if (warId === null) return;
    setPublishing(true);
    setPublishMsg(null);
    const res = await fetch(`/api/wars/${warId}/publish-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sort: sortKey, limit: 10, guild: guildId || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setPublishMsg(res.ok ? `Gönderildi (${data.sent} kanal).` : data.error ?? "Gönderilemedi.");
    setPublishing(false);
    setTimeout(() => setPublishMsg(null), 6000);
  }

  const sortLabel = SORTS.find((s) => s.key === sortKey)?.label ?? "";

  return (
    <TestShell
      title="Hasar Raporu"
      subtitle={!isAggregate
        ? wars.find((w) => w.id === warId)?.title ?? "Seçili savaşın raporu."
        : pencere
        ? `Son ${pencere} savaşın oyuncu bazlı ortalaması.`
        : "Bütün savaşların oyuncu bazlı ortalaması."}
      aside={<span className="t-chip hidden sm:inline">{sorted.length} oyuncu</span>}
    >
      {/* ── Kontroller ─────────────────────────────────────────────── */}
      <Card className="p-3.5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Pencereler önde: en sık sorulan "son n savaşta kim ne yaptı" */}
          <Segment>
            {PENCERELER.map((n) => (
              <SegBtn key={n} on={secim === `last:${n}`} onClick={() => setSecim(`last:${n}`)}>
                Son {n}
              </SegBtn>
            ))}
            <SegBtn on={secim === "all"} onClick={() => setSecim("all")}>Tümü</SegBtn>
          </Segment>

          <select value={warId ?? ""}
                  onChange={(e) => setSecim(e.target.value || "last:5")}
                  className="h-[34px] px-3 rounded-[var(--t-r-sm)] text-[12.5px] outline-none max-w-xs"
                  style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }}>
            <option value="">Tek savaş seç…</option>
            {wars.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} · {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
              </option>
            ))}
          </select>

          {guilds.length > 1 && (
            <Segment>
              <SegBtn on={guildId === ""} onClick={() => setGuildId("")}>Tümü</SegBtn>
              {guilds.map((g) => (
                <SegBtn key={g.id} on={guildId === g.id} onClick={() => setGuildId(g.id)}
                        color={g.color} title={g.name}>
                  {g.tag}
                </SegBtn>
              ))}
            </Segment>
          )}

          <Segment>
            <ArrowUpDown className="w-3 h-3 ml-1.5 mr-0.5 flex-shrink-0" strokeWidth={1.9}
                         style={{ color: "var(--t-faint)" }} />
            {SORTS.map((s) => (
              <SegBtn key={s.key} on={sortKey === s.key} onClick={() => setSortKey(s.key)}>
                {s.label}
              </SegBtn>
            ))}
          </Segment>

          <div className="ml-auto">
            <Segment>
              {([[false, LayoutGrid], [true, LayoutList]] as const).map(([d, Icon]) => (
                <button key={String(d)} onClick={() => setDense(d)}
                        className="p-1.5 rounded-md transition-colors"
                        style={{
                          color: dense === d ? "var(--t-gold)" : "var(--t-faint)",
                          background: dense === d ? "var(--t-gold-soft)" : "transparent",
                        }}>
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.9} />
                </button>
              ))}
            </Segment>
          </div>
        </div>

        {isAggregate && (
          <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
            {pencere
              ? `Son ${pencere} savaş içinde, oyuncunun katıldığı savaş sayısına göre ortalama`
              : "Bütün geçmiş, oyuncunun katıldığı savaş sayısına göre ortalama"}
            {" · Seri ve top mesafesi en yüksek değeri gösterir."}
          </p>
        )}
      </Card>

      {/* ── Discord'a gönder ───────────────────────────────────────── */}
      {cardUrl && session?.user.canManageWars && (
        <Card className="p-3.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <ImageIcon className="w-4 h-4 flex-shrink-0" strokeWidth={1.9} style={{ color: "var(--t-gold)" }} />
            <p className="text-[12.5px] flex-1 min-w-[200px]" style={{ color: "var(--t-dim)" }}>
              Bu savaşın raporunu görsel olarak Discord&apos;a gönder
              <span style={{ color: "var(--t-faint)" }}>
                {" "}— ilk 10 oyuncu, {SORTS.find((s) => s.key === cardSort)?.label} sıralı
              </span>
            </p>

            {publishMsg && <span className="text-[11.5px]" style={{ color: "var(--t-gold)" }}>{publishMsg}</span>}

            <GhostBtn onClick={() => setPreview(!preview)} icon={ImageIcon}>
              {preview ? "Önizlemeyi kapat" : "Önizle"}
            </GhostBtn>
            <button onClick={publish} disabled={publishing}
                    className="text-[12px] font-semibold px-3 h-[34px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                             border: "1px solid rgba(232,180,81,.3)" }}>
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
              {publishing ? "Gönderiliyor…" : "Discord'a gönder"}
            </button>
          </div>

          {preview && (
            <div className="mt-3 rounded-[var(--t-r-sm)] overflow-hidden"
                 style={{ border: "1px solid var(--t-line)", background: "var(--t-canvas)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cardUrl} alt="Rapor önizlemesi" className="w-full h-auto" />
            </div>
          )}
        </Card>
      )}

      {/* ── Klan karşılaştırması ───────────────────────────────────── */}
      {guildSummary.length > 1 && guildId === "" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guildSummary.map((g) => (
            <Card key={g.id} className="px-4 py-3.5">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                      style={{ color: g.color, borderColor: g.color + "38", background: g.color + "14" }}>
                  {g.tag}
                </span>
                <span className="text-[12.5px] truncate" style={{ color: "var(--t-dim)" }}>{g.name}</span>
                <span className="t-num text-[11px] ml-auto" style={{ color: "var(--t-faint)" }}>
                  {g.count} oyuncu
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "Ort. Hasar", v: fmt(g.avgDamage), c: "var(--t-gold)" },
                  { l: "Ort. Kill", v: Math.round(g.avgKills * 10) / 10, c: "var(--t-text)" },
                  { l: "Ort. Ölüm", v: Math.round(g.avgDeaths * 10) / 10, c: "var(--t-dim)" },
                ].map((x) => (
                  <div key={x.l} className="px-2 py-1.5 rounded-[var(--t-r-sm)]"
                       style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                    <p className="text-[9px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{x.l}</p>
                    <p className="t-num text-[14px] font-bold" style={{ color: x.c }}>{x.v}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Kartlar ────────────────────────────────────────────────── */}
      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
      {loading && sorted.length === 0 && <Empty>Rapor geliyor…</Empty>}
      {!loading && sorted.length === 0 && !err && <Empty>Bu filtreye uyan hasar raporu yok.</Empty>}

      {sorted.length > 0 && (
        <div className={dense
          ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
          {sorted.map((r, i) => (
            <PerfCard key={r.key} r={r} rank={i + 1} sortKey={sortKey} sortLabel={sortLabel}
                      top={top} dense={dense} aggregate={isAggregate} />
          ))}
        </div>
      )}

      <div className="pb-6" />
    </TestShell>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function Segment({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-[var(--t-r-sm)]"
         style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      {children}
    </div>
  );
}

function SegBtn({ on, onClick, children, color, title }: {
  on: boolean; onClick: () => void; children: React.ReactNode; color?: string; title?: string;
}) {
  const tone = color ?? "var(--t-gold)";
  return (
    <button onClick={onClick} title={title}
            className="px-2 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap"
            style={on
              ? { color: tone, background: color ? color + "18" : "var(--t-gold-soft)" }
              : { color: "var(--t-faint)" }}>
      {children}
    </button>
  );
}

function GhostBtn({ onClick, icon: Icon, children }: {
  onClick: () => void; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
            className="text-[12px] font-semibold px-3 h-[34px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5"
            style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
      {children}
    </button>
  );
}

/** Kart içi istatistik satırı */
function Stat({ icon: Icon, label, value, tone = "var(--t-text)" }: {
  icon: React.ElementType; label: string; value: string | number; tone?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <Icon className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
      <span className="text-[10px] uppercase tracking-[0.05em] truncate" style={{ color: "var(--t-faint)" }}>
        {label}
      </span>
      <span className="t-num text-[12px] font-semibold ml-auto" style={{ color: tone }}>{value}</span>
    </div>
  );
}

function PerfCard({ r, rank, sortKey, sortLabel, top, dense, aggregate }: {
  r: Row; rank: number; sortKey: SortKey; sortLabel: string;
  top: number; dense: boolean; aggregate: boolean;
}) {
  const cls = getClassByID(r.classId);
  const portrait = r.classId ? getPortraitUrl(r.classId, r.spec) : "";
  const icon = r.classId ? getClassIconUrl(r.classId) : "";
  const banner = cls ? getClassBannerUrl(cls.classType) : "";
  const pct = top > 0 ? Math.round((r[sortKey] / top) * 100) : 0;
  const medal = MEDAL[rank - 1];
  const value = BIG.includes(sortKey) ? fmt(r[sortKey]) : Math.round(r[sortKey] * 10) / 10;

  return (
    <Card hi={rank <= 3} className="relative overflow-hidden">
      {/* Banner tam opak; okunurluk gradyanla sağlanıyor — üye kartlarıyla
          aynı işlem, kartlar yan yana durduğunda dil bozulmasın */}
      {banner && (
        <div className="absolute inset-x-0 top-0 h-[92px] pointer-events-none" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="w-full h-full object-cover select-none"
               style={{ objectPosition: "center 24%" }} />
          <div className="absolute inset-0"
               style={{ background: "linear-gradient(180deg, rgba(11,11,12,.35) 0%, rgba(11,11,12,.82) 62%, var(--t-surface) 100%)" }} />
        </div>
      )}

      <div className="relative p-3.5">
        {/* Başlık */}
        <div className="flex items-start gap-2.5 mb-3" style={{ textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
          <span className="t-num text-[13px] font-bold w-5 flex-shrink-0 pt-0.5"
                style={{ color: medal ?? "var(--t-faint)" }}>
            {rank}
          </span>

          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0"
               style={{ background: "var(--t-raised)", outline: "1px solid rgba(255,255,255,.14)",
                        boxShadow: "0 4px 14px rgba(0,0,0,.6)" }}>
            {portrait && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portrait} alt="" className="w-full h-full object-cover object-top" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {r.user ? (
                <Link href={`/uyeler/${r.user.id}`}
                      className="text-[14px] font-bold truncate transition-colors hover:opacity-80">
                  {r.name}
                </Link>
              ) : (
                <span className="text-[14px] font-bold truncate" style={{ color: "var(--t-dim)" }}>{r.name}</span>
              )}
              <GuildTag g={r.guild ?? null} />
              {!r.user && (
                <AlertTriangle className="w-3 h-3 flex-shrink-0" strokeWidth={2}
                               style={{ color: "var(--t-gold)" }}
                               aria-label="Site hesabıyla eşleşmedi" />
              )}
            </div>

            <div className="flex items-center gap-1.5 mt-0.5">
              {icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon} alt="" className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
              )}
              <span className="text-[11px] truncate" style={{ color: "var(--t-dim)" }}>{cls?.name ?? "—"}</span>
              {cls && (
                <span className="text-[9px] font-bold uppercase rounded px-1 py-px leading-none"
                      style={{ color: "var(--t-faint)", border: "1px solid var(--t-line-strong)" }}>
                  {r.spec === "succession" ? "SUC" : "AWK"}
                </span>
              )}
            </div>

            <p className="text-[10px] mt-0.5" style={{ color: "var(--t-faint)" }}>
              {aggregate ? `${r.warCount} savaş ortalaması` : r.warTitle}
            </p>
          </div>
        </div>

        {/* Sıralanan metrik */}
        <div className="px-3 py-2 mb-2.5 rounded-[var(--t-r-sm)]"
             style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
              {sortLabel}
            </span>
            <span className="t-num text-[18px] font-bold leading-none" style={{ color: "var(--t-gold)" }}>
              {value}
            </span>
          </div>
          <Bar pct={pct} />
        </div>

        {/* Ana ölçüler */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <Stat icon={Swords} label="Kill" value={Math.round(r.kills * 10) / 10} />
          <Stat icon={Skull} label="Ölüm" value={Math.round(r.deaths * 10) / 10} tone="var(--t-dim)" />
          <Stat icon={Flame} label="Ver. Hasar" value={fmt(r.damageDealt)} tone="var(--t-gold)" />
          <Stat icon={Shield} label="Al. Hasar" value={fmt(r.damageTaken)} tone="#ef8080" />
          <Stat icon={Lock} label="CC" value={Math.round(r.ccCount * 10) / 10} />
          <Stat icon={Castle} label="Kale" value={fmt(r.castleDamage)} tone="#f0994c" />
        </div>

        {!dense && (
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2.5 pt-2.5"
               style={{ borderTop: "1px solid var(--t-line)" }}>
            <Stat icon={Heart} label="HP Yenile" value={fmt(r.hpHeal)} tone="#5fd39a" />
            <Stat icon={HandHeart} label="Mütt. HP" value={fmt(r.allyHpHeal)} tone="#5fd39a" />
            <Stat icon={Crosshair} label="Top İsabet" value={Math.round(r.cannonHits * 10) / 10} />
            <Stat icon={Bomb} label="Top Yok" value={Math.round(r.cannonDestroys * 10) / 10} />
            <Stat icon={Ruler} label="Top Mesafe" value={Math.round(r.cannonMaxRange)} />
            <Stat icon={Zap} label="Tuzak" value={Math.round(r.trapExplosions * 10) / 10} />
            <Stat icon={Flame} label="Seri" value={Math.round(r.killStreak)} />
          </div>
        )}

        {!aggregate && r.warId && (
          <Link href={`/savaslar/${r.warId}`}
                className="flex items-center gap-1.5 mt-2.5 pt-2.5 text-[11px] transition-colors hover:opacity-80"
                style={{ borderTop: "1px solid var(--t-line)", color: "var(--t-faint)" }}>
            <Trophy className="w-3 h-3" strokeWidth={1.8} />
            Savaş detayına git
            <ChevronRight className="w-3 h-3 ml-auto" strokeWidth={2} />
          </Link>
        )}
      </div>
    </Card>
  );
}
