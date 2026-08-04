"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { BarChart3, ChevronUp, ChevronDown, AlertTriangle, SlidersHorizontal, FileX } from "lucide-react";
import { PageHeader, Empty, Loading, Avatar } from "@/components/ui";

interface War { id: number; title: string; date: string }

interface Performance {
  id: number;
  inGameName: string;
  kills: number; deaths: number; killStreak: number;
  damageDealt: number; damageTaken: number; ccCount: number;
  hpHeal: number; allyHpHeal: number; castleDamage: number;
  cannonHits: number; cannonDestroys: number; cannonMaxRange: number;
  trapExplosions: number;
  user: { id: number; familyName: string; avatarUrl: string; class: string } | null;
  war: { id: number; title: string; date: string };
}

interface DisplayRow {
  key: string;
  inGameName: string;
  user: { id: number; familyName: string; avatarUrl: string; class: string } | null;
  kills: number; deaths: number; killStreak: number;
  damageDealt: number; damageTaken: number; ccCount: number;
  hpHeal: number; allyHpHeal: number; castleDamage: number;
  cannonHits: number; cannonDestroys: number; cannonMaxRange: number;
  trapExplosions: number;
  warId?: number; warTitle?: string; warCount?: number;
}

type SortDir = "asc" | "desc";

const COLUMNS = [
  { key: "inGameName", label: "Aile Adı", group: "" },
  { key: "kills", label: "Kill", group: "Savaş" },
  { key: "deaths", label: "Ölüm", group: "Savaş" },
  { key: "killStreak", label: "Seri", group: "Savaş" },
  { key: "damageDealt", label: "Ver. Hasar", group: "Hasar" },
  { key: "damageTaken", label: "Al. Hasar", group: "Hasar" },
  { key: "ccCount", label: "CC", group: "Savaş" },
  { key: "hpHeal", label: "HP Yenile", group: "Destek" },
  { key: "allyHpHeal", label: "Mütt. HP", group: "Destek" },
  { key: "castleDamage", label: "Kale Hasar", group: "Kuşatma" },
  { key: "cannonHits", label: "Top İsabet", group: "Kuşatma" },
  { key: "cannonDestroys", label: "Top Yok", group: "Kuşatma" },
  { key: "cannonMaxRange", label: "Top Mesafe", group: "Kuşatma" },
  { key: "trapExplosions", label: "Tuzak", group: "Kuşatma" },
] as const;

type ColKey = (typeof COLUMNS)[number]["key"];

const MAX_COLS: ColKey[] = ["killStreak", "cannonMaxRange"];
const DEFAULT_VISIBLE: ColKey[] = ["inGameName", "kills", "deaths", "damageDealt", "damageTaken", "ccCount", "castleDamage"];

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

function fmtVal(key: ColKey, val: number | string): string {
  if (typeof val === "string") return val;
  const numericFmt: ColKey[] = ["damageDealt", "damageTaken", "hpHeal", "allyHpHeal", "castleDamage"];
  return numericFmt.includes(key) ? fmt(val) : String(Math.round(val));
}

const COL_TONE: Partial<Record<ColKey, string>> = {
  damageDealt: "text-bdo-gold font-semibold",
  damageTaken: "text-red-400/70",
  hpHeal: "text-emerald-400/70",
  allyHpHeal: "text-emerald-400/70",
  castleDamage: "text-orange-400/70",
};

export default function HasarRaporuPage() {
  const [wars, setWars] = useState<War[]>([]);
  const [performances, setPerformances] = useState<Performance[]>([]);
  const [selectedWarId, setSelectedWarId] = useState<number | "">("");
  const [loading, setLoading] = useState(true);
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(new Set(DEFAULT_VISIBLE));
  const [sortCol, setSortCol] = useState<ColKey>("damageDealt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showCols, setShowCols] = useState(false);

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
    setLoading(true);
    const url = selectedWarId === "" ? "/api/performances" : `/api/performances?warId=${selectedWarId}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setPerformances(data.performances ?? []))
      .finally(() => setLoading(false));
  }, [selectedWarId]);

  const isAggregateMode = selectedWarId === "";

  const displayRows = useMemo((): DisplayRow[] => {
    if (!isAggregateMode) {
      return performances.map((p) => ({
        key: String(p.id), inGameName: p.inGameName, user: p.user,
        kills: p.kills, deaths: p.deaths, killStreak: p.killStreak,
        damageDealt: p.damageDealt, damageTaken: p.damageTaken, ccCount: p.ccCount,
        hpHeal: p.hpHeal, allyHpHeal: p.allyHpHeal, castleDamage: p.castleDamage,
        cannonHits: p.cannonHits, cannonDestroys: p.cannonDestroys,
        cannonMaxRange: p.cannonMaxRange, trapExplosions: p.trapExplosions,
        warId: p.war.id, warTitle: p.war.title,
      }));
    }

    const groups = new Map<string, Performance[]>();
    for (const p of performances) {
      const groupKey = p.user ? `user_${p.user.id}` : `name_${p.inGameName.toLowerCase().trim()}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(p);
    }

    return Array.from(groups.entries()).map(([groupKey, rows]) => {
      const count = rows.length;
      const first = rows[0];
      const avg = (key: keyof Performance) => rows.reduce((s, r) => s + (r[key] as number), 0) / count;
      const max = (key: keyof Performance) => Math.max(...rows.map((r) => r[key] as number));

      return {
        key: groupKey,
        inGameName: first.user?.familyName ?? first.inGameName,
        user: first.user,
        kills: avg("kills"), deaths: avg("deaths"), killStreak: max("killStreak"),
        damageDealt: avg("damageDealt"), damageTaken: avg("damageTaken"), ccCount: avg("ccCount"),
        hpHeal: avg("hpHeal"), allyHpHeal: avg("allyHpHeal"), castleDamage: avg("castleDamage"),
        cannonHits: avg("cannonHits"), cannonDestroys: avg("cannonDestroys"),
        cannonMaxRange: max("cannonMaxRange"), trapExplosions: avg("trapExplosions"),
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
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleSort(key: ColKey) {
    if (sortCol === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortCol(key); setSortDir("desc"); }
  }

  const visibleColDefs = COLUMNS.filter((c) => visibleCols.has(c.key));

  return (
    <div>
      <PageHeader
        title="Hasar Raporu"
        desc="Savaş performans verileri — hasar, kill, CC ve kuşatma istatistikleri."
        icon={BarChart3}
      />

      {/* Controls */}
      <div className="card p-3 mb-3">
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

          <button
            onClick={() => setShowCols(!showCols)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] border transition-colors ${
              showCols
                ? "bg-bdo-surface-2 border-bdo-border-2 text-bdo-text-primary"
                : "bg-bdo-bg border-bdo-border text-bdo-text-muted hover:text-bdo-text-primary"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.75} />
            Sütunlar
            <span className="text-[10px] text-bdo-text-secondary font-mono">{visibleCols.size}</span>
          </button>

          <span className="ml-auto text-[11px] text-bdo-text-secondary">
            {sorted.length} oyuncu
          </span>
        </div>

        {showCols && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-bdo-border">
            {COLUMNS.map((col) => (
              <button
                key={col.key}
                onClick={() => toggleCol(col.key)}
                disabled={col.key === "inGameName"}
                className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                  visibleCols.has(col.key)
                    ? "bg-bdo-gold/10 border-bdo-gold/25 text-bdo-gold"
                    : "bg-bdo-bg border-bdo-border text-bdo-text-secondary hover:text-bdo-text-muted"
                } disabled:opacity-40 disabled:cursor-default`}
              >
                {col.label}
                {isAggregateMode && MAX_COLS.includes(col.key) && visibleCols.has(col.key) && (
                  <span className="ml-1 text-[9px] opacity-60">max</span>
                )}
              </button>
            ))}
          </div>
        )}

        {isAggregateMode && (
          <p className="text-[11px] text-bdo-text-secondary mt-2">
            Değerler oyuncunun katıldığı savaş sayısı üzerinden ortalamadır ·
            <span className="text-bdo-text-muted"> Seri ve Top Mesafe en yüksek değeri gösterir</span>
          </p>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <div className="card"><Empty icon={FileX} text="Henüz hasar raporu verisi yok." /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-bdo-border bg-bdo-bg/40">
                  {visibleColDefs.map((col) => {
                    const isActive = sortCol === col.key;
                    return (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`py-2.5 px-3 cursor-pointer transition-colors whitespace-nowrap select-none text-[10px] uppercase tracking-wider font-medium ${
                          col.key === "inGameName" ? "text-left" : "text-right"
                        } ${isActive ? "text-bdo-gold" : "text-bdo-text-secondary hover:text-bdo-text-muted"}`}
                      >
                        <span className="inline-flex items-center gap-0.5">
                          {col.key !== "inGameName" && isActive && (
                            sortDir === "desc"
                              ? <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
                              : <ChevronUp className="w-3 h-3" strokeWidth={2.5} />
                          )}
                          {col.label}
                          {isAggregateMode && MAX_COLS.includes(col.key) && (
                            <span className="text-[8px] opacity-50 ml-0.5">max</span>
                          )}
                          {col.key === "inGameName" && isActive && (
                            sortDir === "desc"
                              ? <ChevronDown className="w-3 h-3" strokeWidth={2.5} />
                              : <ChevronUp className="w-3 h-3" strokeWidth={2.5} />
                          )}
                        </span>
                      </th>
                    );
                  })}
                  <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-bdo-text-secondary whitespace-nowrap">
                    {isAggregateMode ? "Rapor" : "Savaş"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr key={row.key} className="border-b border-bdo-border/40 last:border-0 hover:bg-bdo-surface-2/60 transition-colors">
                    {visibleColDefs.map((col) => {
                      if (col.key === "inGameName") {
                        return (
                          <td key="inGameName" className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <Avatar src={row.user?.avatarUrl} size={20} ring={false} />
                              {row.user ? (
                                <Link href={`/members/${row.user.id}`} className="text-bdo-text-primary hover:text-bdo-gold transition-colors font-medium">
                                  {row.inGameName}
                                </Link>
                              ) : (
                                <span className="text-bdo-text-muted">{row.inGameName}</span>
                              )}
                              {!row.user && (
                                <AlertTriangle
                                  className="w-3 h-3 text-yellow-500/70 flex-shrink-0"
                                  strokeWidth={2}
                                />
                              )}
                            </div>
                          </td>
                        );
                      }
                      const val = row[col.key as keyof DisplayRow] as number;
                      return (
                        <td key={col.key} className={`py-2 px-3 text-right font-mono ${COL_TONE[col.key] ?? "text-bdo-text-muted"}`}>
                          {fmtVal(col.key, val)}
                        </td>
                      );
                    })}
                    <td className="py-2 px-3 text-right">
                      {isAggregateMode ? (
                        <span className="text-[11px] text-bdo-text-secondary font-mono">{row.warCount} savaş</span>
                      ) : (
                        <Link href={`/wars/${row.warId}`} className="text-[11px] text-bdo-text-secondary hover:text-bdo-gold transition-colors">
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
