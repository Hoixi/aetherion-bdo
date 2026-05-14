"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

interface War {
  id: number;
  title: string;
  date: string;
}

interface Performance {
  id: number;
  inGameName: string;
  kills: number;
  deaths: number;
  killStreak: number;
  damageDealt: number;
  damageTaken: number;
  ccCount: number;
  hpHeal: number;
  allyHpHeal: number;
  castleDamage: number;
  cannonHits: number;
  cannonDestroys: number;
  cannonMaxRange: number;
  trapExplosions: number;
  user: { id: number; familyName: string; avatarUrl: string; class: string } | null;
  war: { id: number; title: string; date: string };
}

interface DisplayRow {
  key: string;
  inGameName: string;
  user: { id: number; familyName: string; avatarUrl: string; class: string } | null;
  kills: number;
  deaths: number;
  killStreak: number;
  damageDealt: number;
  damageTaken: number;
  ccCount: number;
  hpHeal: number;
  allyHpHeal: number;
  castleDamage: number;
  cannonHits: number;
  cannonDestroys: number;
  cannonMaxRange: number;
  trapExplosions: number;
  // single war mode
  warId?: number;
  warTitle?: string;
  // aggregate mode
  warCount?: number;
}

type SortDir = "asc" | "desc";

const COLUMNS = [
  { key: "inGameName", label: "Aile Adı", emoji: "" },
  { key: "kills", label: "Kill", emoji: "💀" },
  { key: "deaths", label: "Ölüm", emoji: "🪦" },
  { key: "killStreak", label: "Seri", emoji: "🔥" },
  { key: "damageDealt", label: "Ver. Hasar", emoji: "⚔️" },
  { key: "damageTaken", label: "Al. Hasar", emoji: "🛡️" },
  { key: "ccCount", label: "CC", emoji: "🔒" },
  { key: "hpHeal", label: "HP Yenile", emoji: "💚" },
  { key: "allyHpHeal", label: "Mütt. HP", emoji: "🤝" },
  { key: "castleDamage", label: "Kale Hasar", emoji: "🏰" },
  { key: "cannonHits", label: "Top İsabet", emoji: "🏹" },
  { key: "cannonDestroys", label: "Top Yok", emoji: "💣" },
  { key: "cannonMaxRange", label: "Top Mesafe", emoji: "📏" },
  { key: "trapExplosions", label: "Tuzak", emoji: "⚙️" },
] as const;

type ColKey = (typeof COLUMNS)[number]["key"];

// These columns take the MAX instead of average (they represent peak values)
const MAX_COLS: ColKey[] = ["killStreak", "cannonMaxRange"];

const DEFAULT_VISIBLE: ColKey[] = ["inGameName", "kills", "deaths", "damageDealt", "damageTaken", "ccCount", "castleDamage"];

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 100_000) return Math.round(n / 1_000) + "B";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

function fmtVal(key: ColKey, val: number | string): string {
  if (typeof val === "string") return val;
  const numericFmt: ColKey[] = ["damageDealt", "damageTaken", "hpHeal", "allyHpHeal", "castleDamage"];
  return numericFmt.includes(key) ? fmt(val) : String(Math.round(val));
}

export default function HasarRaporuPage() {
  const [wars, setWars] = useState<War[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [selectedWarId, setSelectedWarId] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE));
  const [sortCol, setSortCol] = useState<ColKey>("damageDealt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    setLoading(true);
    fetch("/api/performances")
      .then((r) => r.json())
      .then((data) => {
        setWars(data.wars ?? []);
        setPerformances(data.performances ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedWarId === "") {
      setLoading(true);
      fetch("/api/performances")
        .then((r) => r.json())
        .then((data) => setPerformances(data.performances ?? []))
        .finally(() => setLoading(false));
    } else {
      setLoading(true);
      fetch(`/api/performances?warId=${selectedWarId}`)
        .then((r) => r.json())
        .then((data) => setPerformances(data.performances ?? []))
        .finally(() => setLoading(false));
    }
  }, [selectedWarId]);

  const isAggregateMode = selectedWarId === "";

  // Group by player and compute averages when in aggregate mode
  const displayRows = useMemo((): DisplayRow[] => {
    if (!isAggregateMode) {
      return performances.map((p) => ({
        key: String(p.id),
        inGameName: p.inGameName,
        user: p.user,
        kills: p.kills,
        deaths: p.deaths,
        killStreak: p.killStreak,
        damageDealt: p.damageDealt,
        damageTaken: p.damageTaken,
        ccCount: p.ccCount,
        hpHeal: p.hpHeal,
        allyHpHeal: p.allyHpHeal,
        castleDamage: p.castleDamage,
        cannonHits: p.cannonHits,
        cannonDestroys: p.cannonDestroys,
        cannonMaxRange: p.cannonMaxRange,
        trapExplosions: p.trapExplosions,
        warId: p.war.id,
        warTitle: p.war.title,
      }));
    }

    // Aggregate: group by userId (if matched) or normalized inGameName
    const groups = new Map<string, Performance[]>();
    for (const p of performances) {
      const groupKey = p.user ? `user_${p.user.id}` : `name_${p.inGameName.toLowerCase().trim()}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(p);
    }

    return Array.from(groups.entries()).map(([groupKey, rows]) => {
      const count = rows.length;
      const first = rows[0];

      const avg = (key: keyof Performance) =>
        rows.reduce((sum, r) => sum + (r[key] as number), 0) / count;
      const max = (key: keyof Performance) =>
        Math.max(...rows.map((r) => r[key] as number));

      return {
        key: groupKey,
        inGameName: first.user?.familyName ?? first.inGameName,
        user: first.user,
        kills: avg("kills"),
        deaths: avg("deaths"),
        killStreak: max("killStreak"),
        damageDealt: avg("damageDealt"),
        damageTaken: avg("damageTaken"),
        ccCount: avg("ccCount"),
        hpHeal: avg("hpHeal"),
        allyHpHeal: avg("allyHpHeal"),
        castleDamage: avg("castleDamage"),
        cannonHits: avg("cannonHits"),
        cannonDestroys: avg("cannonDestroys"),
        cannonMaxRange: max("cannonMaxRange"),
        trapExplosions: avg("trapExplosions"),
        warCount: count,
      };
    });
  }, [performances, isAggregateMode]);

  const sorted = useMemo(() => {
    return [...displayRows].sort((a, b) => {
      const av = a[sortCol as keyof DisplayRow] as number | string;
      const bv = b[sortCol as keyof DisplayRow] as number | string;
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [displayRows, sortCol, sortDir]);

  function toggleCol(key: ColKey) {
    if (key === "inGameName") return;
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSort(key: ColKey) {
    if (sortCol === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(key); setSortDir("desc"); }
  }

  const visibleColDefs = COLUMNS.filter((c) => visibleCols.has(c.key));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-bdo-gold">Hasar Raporu</h1>
      </div>

      <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-xs text-bdo-text-muted mb-1">Savaş</label>
          <select
            value={selectedWarId}
            onChange={(e) => setSelectedWarId(e.target.value ? Number(e.target.value) : "")}
            className="w-full md:w-72 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
          >
            <option value="">— Tüm savaşlar (ortalama) —</option>
            {wars.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} ({new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })})
              </option>
            ))}
          </select>
          {isAggregateMode && (
            <p className="text-[11px] text-bdo-text-muted mt-1">
              Değerler oyuncunun göründüğü savaş sayısı üzerinden ortalamadır.
              <span className="text-bdo-gold/70 ml-1">Seri ve Top Mesafe → en yüksek değer</span>
            </p>
          )}
        </div>

        <div>
          <p className="text-xs text-bdo-text-muted mb-2">Gösterilecek sütunlar</p>
          <div className="flex flex-wrap gap-2">
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                onClick={() => toggleCol(col.key)}
                disabled={col.key === "inGameName"}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  visibleCols.has(col.key)
                    ? "bg-bdo-gold/20 border-bdo-gold/50 text-bdo-gold"
                    : "bg-bdo-bg border-bdo-border text-bdo-text-muted hover:border-bdo-gold/30"
                } disabled:opacity-50 disabled:cursor-default`}
              >
                {col.emoji ? `${col.emoji} ${col.label}` : col.label}
                {isAggregateMode && MAX_COLS.includes(col.key) && visibleCols.has(col.key) && (
                  <span className="ml-1 text-[9px] opacity-60">max</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <p className="text-bdo-text-muted text-sm">Yükleniyor...</p>}

      {!loading && sorted.length === 0 && (
        <p className="text-bdo-text-muted text-sm">Henüz hasar raporu verisi bulunmuyor.</p>
      )}

      {!loading && sorted.length > 0 && (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-bdo-border flex items-center justify-between">
            <span className="text-xs text-bdo-text-muted">{sorted.length} oyuncu</span>
            <span className="text-xs text-bdo-text-muted">
              Sıralama: <span className="text-bdo-gold">{COLUMNS.find((c) => c.key === sortCol)?.label}</span>{" "}
              {sortDir === "desc" ? "↓" : "↑"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-bdo-border text-bdo-text-muted bg-bdo-bg/50">
                  {visibleColDefs.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`py-2 px-3 cursor-pointer hover:text-bdo-gold transition-colors whitespace-nowrap select-none ${
                        col.key === "inGameName" ? "text-left" : "text-right"
                      } ${sortCol === col.key ? "text-bdo-gold" : ""}`}
                    >
                      {col.emoji ? `${col.emoji} ` : ""}
                      {col.label}
                      {isAggregateMode && MAX_COLS.includes(col.key) && (
                        <span className="ml-0.5 text-[9px] opacity-50">max</span>
                      )}
                      {sortCol === col.key && (
                        <span className="ml-1">{sortDir === "desc" ? "↓" : "↑"}</span>
                      )}
                    </th>
                  ))}
                  <th className="text-right py-2 px-3 text-bdo-text-muted whitespace-nowrap">
                    {isAggregateMode ? "Rapor" : "Savaş"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.key}
                    className={`border-b border-bdo-border/50 hover:bg-bdo-gold/5 transition-colors ${
                      !row.user ? "opacity-75" : ""
                    }`}
                  >
                    {visibleColDefs.map((col) => {
                      if (col.key === "inGameName") {
                        return (
                          <td key="inGameName" className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {row.user?.avatarUrl && (
                                <img src={row.user.avatarUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                              )}
                              {row.user ? (
                                <Link
                                  href={`/members/${row.user.id}`}
                                  className="text-bdo-text-primary hover:text-bdo-gold transition-colors"
                                >
                                  {row.inGameName}
                                </Link>
                              ) : (
                                <span className="text-bdo-text-muted">{row.inGameName}</span>
                              )}
                              {!row.user && (
                                <span className="text-yellow-500 font-bold" title="Sitede kayıtlı üye ile eşleşmedi">⚠</span>
                              )}
                            </div>
                          </td>
                        );
                      }
                      const val = row[col.key as keyof DisplayRow] as number;
                      const isHighlight = col.key === "damageDealt";
                      const isRed = col.key === "damageTaken";
                      const isGreen = col.key === "hpHeal" || col.key === "allyHpHeal";
                      const isOrange = col.key === "castleDamage";
                      return (
                        <td
                          key={col.key}
                          className={`py-2 px-3 text-right font-mono ${
                            isHighlight ? "text-bdo-gold font-semibold" :
                            isRed ? "text-red-400/80" :
                            isGreen ? "text-green-400/80" :
                            isOrange ? "text-orange-400/80" :
                            "text-bdo-text-secondary"
                          }`}
                        >
                          {fmtVal(col.key, val)}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right">
                      {isAggregateMode ? (
                        <span className="text-bdo-text-muted">{row.warCount} savaş</span>
                      ) : (
                        <Link
                          href={`/wars/${row.warId}`}
                          className="text-bdo-text-muted hover:text-bdo-gold transition-colors text-[11px]"
                        >
                          {row.warTitle}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
