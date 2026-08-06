"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BarChart3, Swords, Skull, Flame, Shield, Lock, Heart, HandHeart,
  Castle, Crosshair, Bomb, Ruler, Zap, AlertTriangle, FileX,
  ArrowUpDown, LayoutGrid, LayoutList, Trophy, LucideIcon,
} from "lucide-react";
import { PageHeader, Empty, Loading, Avatar, GuildTag, type GuildInfo } from "@/components/ui";
import { getClassByID, getPortraitUrl, getClassIconUrl } from "@/lib/classes";

interface War { id: number; title: string; date: string }
interface GuildRow { id: number; name: string; tag: string; color: string }

interface Performance {
  id: number;
  inGameName: string;
  class: string;
  spec: string;
  kills: number; deaths: number; killStreak: number;
  damageDealt: number; damageTaken: number; ccCount: number;
  hpHeal: number; allyHpHeal: number; castleDamage: number;
  cannonHits: number; cannonDestroys: number; cannonMaxRange: number;
  trapExplosions: number;
  user: { id: number; familyName: string; avatarUrl: string; class: string; guild?: GuildInfo | null } | null;
  war: { id: number; title: string; date: string };
}

interface Row {
  key: string;
  name: string;
  classId: string;
  spec: string;
  user: Performance["user"];
  guild?: GuildInfo | null;
  kills: number; deaths: number; killStreak: number;
  damageDealt: number; damageTaken: number; ccCount: number;
  hpHeal: number; allyHpHeal: number; castleDamage: number;
  cannonHits: number; cannonDestroys: number; cannonMaxRange: number;
  trapExplosions: number;
  warCount: number;
  warId?: number;
  warTitle?: string;
}

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

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

/** Kartta gösterilen istatistik satırı */
function Stat({
  icon: Icon, label, value, tone = "text-bdo-text-primary", big,
}: { icon: LucideIcon; label: string; value: string | number; tone?: string; big?: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 ${big ? "" : "min-w-0"}`}>
      <Icon className="w-3 h-3 text-bdo-text-secondary/70 flex-shrink-0" strokeWidth={1.75} />
      <span className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">{label}</span>
      <span className={`ml-auto font-mono font-semibold ${big ? "text-[15px]" : "text-[12px]"} ${tone}`}>
        {value}
      </span>
    </div>
  );
}

export default function HasarRaporuPage() {
  const [wars, setWars] = useState<War[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [selectedWarId, setSelectedWarId] = useState<number | "">("");
  const [guilds, setGuilds] = useState<GuildRow[]>([]);
  const [guildFilter, setGuildFilter] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("damageDealt");
  const [dense, setDense] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch("/api/performances")
      .then((r) => r.json())
      .then((data) => {
        setWars(data.wars ?? []);
        setGuilds(data.guilds ?? []);
        setPerformances(data.performances ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (selectedWarId !== "") qs.set("warId", String(selectedWarId));
    if (guildFilter !== "") qs.set("guild", String(guildFilter));
    fetch(`/api/performances${qs.toString() ? `?${qs}` : ""}`)
      .then((r) => r.json())
      .then((d) => setPerformances(d.performances ?? []))
      .finally(() => setLoading(false));
  }, [selectedWarId, guildFilter]);

  const isAggregate = selectedWarId === "";

  const rows = useMemo((): Row[] => {
    if (!isAggregate) {
      return performances.map((p) => ({
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

    const groups = new Map<string, Performance[]>();
    for (const p of performances) {
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
  }, [performances, isAggregate]);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b[sortKey] - a[sortKey]),
    [rows, sortKey],
  );

  const topValue = sorted[0]?.[sortKey] ?? 0;

  // Klan bazlı özet — sadece birden fazla klan varken anlamlı
  const guildSummary = useMemo(() => {
    if (guilds.length < 2) return [];
    return guilds.map((g) => {
      const rs = rows.filter((r) => r.guild?.id === g.id);
      const avg = (f: (r: Row) => number) =>
        rs.length ? rs.reduce((s, r) => s + f(r), 0) / rs.length : 0;
      return {
        ...g,
        count: rs.length,
        avgDamage: avg((r) => r.damageDealt),
        avgKills: avg((r) => r.kills),
        avgDeaths: avg((r) => r.deaths),
      };
    }).filter((g) => g.count > 0);
  }, [rows, guilds]);

  if (loading) return <Loading />;

  return (
    <div>
      <PageHeader
        title="Hasar Raporu"
        desc={isAggregate
          ? "Tüm klanların savaş ortalamaları — oyuncu bazlı performans kartları."
          : "Seçili savaşın performans kartları."}
        icon={BarChart3}
      />

      {/* Kontroller */}
      <div className="card p-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedWarId}
            onChange={(e) => setSelectedWarId(e.target.value ? Number(e.target.value) : "")}
            className="bg-bdo-bg border border-bdo-border rounded-lg px-3 py-1.5 text-[13px] text-bdo-text-primary focus:border-bdo-gold/40 focus:outline-none max-w-xs"
          >
            <option value="">Tüm savaşlar (ortalama)</option>
            {wars.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} · {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
              </option>
            ))}
          </select>

          {guilds.length > 1 && (
            <div className="flex items-center gap-0.5 bg-bdo-bg border border-bdo-border rounded-lg p-0.5">
              <button
                onClick={() => setGuildFilter("")}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  guildFilter === "" ? "bg-bdo-surface-2 text-bdo-gold" : "text-bdo-text-secondary hover:text-bdo-text-muted"
                }`}
              >
                Tümü
              </button>
              {guilds.map((g) => {
                const active = guildFilter === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setGuildFilter(g.id)}
                    title={g.name}
                    className="px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors"
                    style={active
                      ? { color: g.color, backgroundColor: `${g.color}18` }
                      : { color: "#4d5c73" }}
                  >
                    {g.tag}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-0.5 bg-bdo-bg border border-bdo-border rounded-lg p-0.5">
            <ArrowUpDown className="w-3 h-3 text-bdo-text-secondary ml-1.5 mr-0.5" strokeWidth={1.75} />
            {SORTS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  sortKey === s.key ? "bg-bdo-surface-2 text-bdo-gold" : "text-bdo-text-secondary hover:text-bdo-text-muted"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-bdo-text-secondary">{sorted.length} oyuncu</span>
            <div className="flex gap-0.5 bg-bdo-bg border border-bdo-border rounded-lg p-0.5">
              {([[false, LayoutGrid], [true, LayoutList]] as const).map(([d, Icon]) => (
                <button
                  key={String(d)}
                  onClick={() => setDense(d)}
                  className={`p-1.5 rounded-md transition-colors ${
                    dense === d ? "bg-bdo-surface-2 text-bdo-gold" : "text-bdo-text-secondary hover:text-bdo-text-muted"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {isAggregate && (
          <p className="text-[11px] text-bdo-text-secondary mt-2">
            Değerler oyuncunun katıldığı savaş sayısına göre ortalamadır ·
            <span className="text-bdo-text-muted"> Seri ve Top Mesafe en yüksek değeri gösterir</span>
          </p>
        )}
      </div>

      {/* Klan bazlı özet */}
      {guildSummary.length > 1 && guildFilter === "" && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {guildSummary.map((g) => (
            <div key={g.id} className="card px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                  style={{ color: g.color, borderColor: `${g.color}38`, backgroundColor: `${g.color}14` }}
                >
                  {g.tag}
                </span>
                <span className="text-[12px] text-bdo-text-muted truncate">{g.name}</span>
                <span className="ml-auto text-[11px] font-mono text-bdo-text-secondary">
                  {g.count} oyuncu
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { l: "Ort. Hasar", v: fmt(g.avgDamage), t: "text-bdo-gold" },
                  { l: "Ort. Kill", v: Math.round(g.avgKills * 10) / 10, t: "text-bdo-text-primary" },
                  { l: "Ort. Ölüm", v: Math.round(g.avgDeaths * 10) / 10, t: "text-bdo-text-muted" },
                ].map((x) => (
                  <div key={x.l} className="bg-bdo-bg border border-bdo-border rounded-lg px-2 py-1.5">
                    <p className="text-[9px] uppercase tracking-wider text-bdo-text-secondary">{x.l}</p>
                    <p className={`text-[14px] font-bold font-mono ${x.t}`}>{x.v}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="card"><Empty icon={FileX} text="Henüz hasar raporu verisi yok." /></div>
      ) : (
        <div className={dense
          ? "grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"}>
          {sorted.map((r, i) => {
            const cls = getClassByID(r.classId);
            const portrait = r.classId ? getPortraitUrl(r.classId, r.spec) : "";
            const icon = r.classId ? getClassIconUrl(r.classId) : "";
            const rank = i + 1;
            const pct = topValue > 0 ? Math.round((r[sortKey] / topValue) * 100) : 0;
            const medal = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-gray-300" : rank === 3 ? "text-amber-600" : "text-bdo-text-secondary";

            return (
              <div key={r.key} className={`card relative overflow-hidden ${rank <= 3 ? "card-accent" : ""}`}>
                {/* Class portresi — sağda yumuşak geçişli fon */}
                {portrait && (
                  <div className="absolute right-0 top-0 bottom-0 w-[72%] pointer-events-none select-none">
                    <Image
                      src={portrait}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="card-portrait object-cover object-top opacity-[0.16]"
                    />
                  </div>
                )}

                <div className="relative p-3">
                  {/* Başlık */}
                  <div className="flex items-start gap-2.5 mb-3">
                    <span className={`text-[13px] font-bold font-mono w-5 flex-shrink-0 pt-0.5 ${medal}`}>
                      {rank}
                    </span>

                    {portrait ? (
                      <Image
                        src={portrait}
                        alt=""
                        width={44}
                        height={44}
                        className="w-11 h-11 rounded-lg object-cover object-top ring-1 ring-bdo-border flex-shrink-0"
                      />
                    ) : (
                      <Avatar src={r.user?.avatarUrl} size={44} />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {r.user ? (
                          <Link href={`/members/${r.user.id}`} className="text-[14px] font-bold text-bdo-text-primary hover:text-bdo-gold transition-colors truncate">
                            {r.name}
                          </Link>
                        ) : (
                          <span className="text-[14px] font-bold text-bdo-text-muted truncate">{r.name}</span>
                        )}
                        <GuildTag guild={r.guild} size="xs" />
                        {!r.user && (
                          <AlertTriangle className="w-3 h-3 text-yellow-500/70 flex-shrink-0" strokeWidth={2} />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        {icon && <img src={icon} alt="" className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />}
                        <span className="text-[11px] text-bdo-text-muted truncate">
                          {cls?.name ?? "—"}
                        </span>
                        {cls && (
                          <span className="text-[9px] font-bold uppercase text-bdo-text-secondary border border-bdo-border rounded px-1 py-px leading-none">
                            {r.spec === "succession" ? "SUC" : "AWK"}
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-bdo-text-secondary mt-0.5">
                        {isAggregate
                          ? `${r.warCount} savaş ortalaması`
                          : r.warTitle}
                      </p>
                    </div>
                  </div>

                  {/* Sıralama metriği — büyük */}
                  <div className="bg-bdo-bg/60 border border-bdo-border rounded-lg px-3 py-2 mb-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase tracking-wider text-bdo-text-secondary">
                        {SORTS.find((s) => s.key === sortKey)?.label}
                      </span>
                      <span className="text-[18px] font-bold font-mono text-bdo-gold leading-none">
                        {sortKey === "damageDealt" || sortKey === "hpHeal" || sortKey === "castleDamage"
                          ? fmt(r[sortKey])
                          : Math.round(r[sortKey] * 10) / 10}
                      </span>
                    </div>
                    <div className="h-1 bg-bdo-bg rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-bdo-gold/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {/* Ana istatistikler */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <Stat icon={Swords} label="Kill" value={Math.round(r.kills * 10) / 10} />
                    <Stat icon={Skull} label="Ölüm" value={Math.round(r.deaths * 10) / 10} tone="text-bdo-text-muted" />
                    <Stat icon={Shield} label="Al. Hasar" value={fmt(r.damageTaken)} tone="text-red-400/80" />
                    <Stat icon={Lock} label="CC" value={Math.round(r.ccCount * 10) / 10} />
                    <Stat icon={Flame} label="Seri" value={Math.round(r.killStreak)} />
                    <Stat icon={Castle} label="Kale" value={fmt(r.castleDamage)} tone="text-orange-400/80" />
                  </div>

                  {/* Detaylar */}
                  {!dense && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pt-2 border-t border-bdo-border">
                      <Stat icon={Heart} label="HP Yenile" value={fmt(r.hpHeal)} tone="text-emerald-400/80" />
                      <Stat icon={HandHeart} label="Mütt. HP" value={fmt(r.allyHpHeal)} tone="text-emerald-400/70" />
                      <Stat icon={Crosshair} label="Top İsabet" value={Math.round(r.cannonHits * 10) / 10} />
                      <Stat icon={Bomb} label="Top Yok" value={Math.round(r.cannonDestroys * 10) / 10} />
                      <Stat icon={Ruler} label="Top Mesafe" value={Math.round(r.cannonMaxRange)} />
                      <Stat icon={Zap} label="Tuzak" value={Math.round(r.trapExplosions * 10) / 10} />
                    </div>
                  )}

                  {/* Savaş linki */}
                  {!isAggregate && r.warId && (
                    <Link
                      href={`/wars/${r.warId}`}
                      className="flex items-center gap-1.5 mt-2 pt-2 border-t border-bdo-border text-[11px] text-bdo-text-secondary hover:text-bdo-gold transition-colors"
                    >
                      <Trophy className="w-3 h-3" strokeWidth={1.75} />
                      Savaş detayına git
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
