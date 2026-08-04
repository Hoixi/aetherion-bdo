"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BDO_CLASSES } from "@/lib/classes";
import { Users, Shield, Trophy, Swords, Timer, Handshake } from "lucide-react";
import { StatTile, Card, CardHeader } from "./ui";

interface WarReportAverage {
  warId: number;
  title: string;
  date: string;
  players: number;
  avgKills: number;
  avgDeaths: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  avgHpHeal: number;
  avgCcCount: number;
}

interface StatsData {
  guild: { id: number; name: string; tag: string; color: string } | null;
  totalMembers: number;
  avgGs: number;
  topGs: { id: number; familyName: string; avatarUrl: string; gs: number }[];
  topAttendance: { id: number; familyName: string; avatarUrl: string; count: number }[];
  classDistribution: { class: string; count: number }[];
  warStats: { totalWars: number; wins: number; losses: number; draws: number };
  upcomingWar: { id: number; title: string; date: string; type: string } | null;
  warReportAverages: WarReportAverage[];
  gsBrackets: { label: string; count: number }[];
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function getClassName2(id: string): string {
  return BDO_CLASSES.find((c) => c.id === id)?.name ?? id;
}

const BRACKET_COLORS = ["#e05252", "#e09832", "#e0c832", "#4a7cf5", "#2bca6e"];
const CLASS_COLORS = ["#d4a030", "#c9963f", "#dbb24e", "#b8892e", "#a67c28", "#f0c566", "#d9ac45", "#c4952e", "#e0b850", "#d4a853"];

export function GuildStats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    fetch("/api/stats").then((r) => r.ok ? r.json() : null).then(setStats);
  }, []);

  useEffect(() => {
    if (!stats?.upcomingWar) return;
    const target = new Date(stats.upcomingWar.date).getTime();
    function update() {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("Başladı!"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${d > 0 ? d + "g " : ""}${h}s ${m}dk`);
    }
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, [stats?.upcomingWar]);

  if (!stats) return null;

  const winRate = stats.warStats.totalWars > 0
    ? Math.round((stats.warStats.wins / (stats.warStats.wins + stats.warStats.losses + stats.warStats.draws || 1)) * 100)
    : 0;
  const maxClassCount = Math.max(...stats.classDistribution.map((c) => c.count), 1);

  return (
    <div className="space-y-4">
      {/* Kapsam göstergesi — verilerin hangi klana ait olduğu */}
      {stats.guild && (
        <div className="flex items-center gap-2 text-[11px] text-bdo-text-secondary">
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
            style={{
              color: stats.guild.color,
              borderColor: `${stats.guild.color}38`,
              backgroundColor: `${stats.guild.color}14`,
            }}
          >
            {stats.guild.tag}
          </span>
          <span>
            Aşağıdaki tüm veriler <span className="text-bdo-text-muted font-medium">{stats.guild.name}</span> klanına aittir.
          </span>
          <Link href="/ally" className="ml-auto text-bdo-gold hover:underline flex items-center gap-1">
            Ortak veriler
            <Handshake className="w-3 h-3" strokeWidth={2} />
          </Link>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Toplam Üye" value={stats.totalMembers} sub="kayıtlı" icon={Users} />
        <StatTile label="Ortalama GS" value={stats.avgGs} sub="klan ort." icon={Shield} tone="text-bdo-gold" accent />
        <StatTile label="Win Rate" value={`%${winRate}`} sub={`${stats.warStats.wins}G ${stats.warStats.losses}M`} icon={Trophy} tone={winRate >= 50 ? "text-emerald-400" : "text-bdo-text-primary"} />
        <StatTile label="Toplam Savaş" value={stats.warStats.totalWars} sub="tüm zamanlar" icon={Swords} />
      </div>

      {/* Upcoming war */}
      {stats.upcomingWar && (
        <Link href={`/wars/${stats.upcomingWar.id}`} className="block">
          <div className="card card-accent p-4 hover:border-bdo-gold/35 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bdo-gold opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-bdo-gold" />
                </span>
                <div>
                  <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">Yaklaşan Savaş</p>
                  <p className="text-sm font-semibold text-bdo-text-primary mt-0.5">{stats.upcomingWar.title}</p>
                </div>
              </div>
              <div className="text-right flex items-center gap-2.5">
                <Timer className="w-4 h-4 text-bdo-text-secondary/50" strokeWidth={1.75} />
                <div>
                  <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">Kalan Süre</p>
                  <p className="text-lg font-bold font-mono text-bdo-gold mt-0.5 leading-none">{countdown || "..."}</p>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Main grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Son savaş raporları */}
        {stats.warReportAverages?.length > 0 && (
          <div className="card md:col-span-2">
            <div className="card-header">
              <span className="card-title">Son Savaş Raporları</span>
              <span className="card-meta">ort. performans</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-bdo-border">
                    <th className="text-left py-2 px-4 text-bdo-text-secondary font-medium">Savaş</th>
                    <th className="text-center py-2 px-2 text-bdo-text-secondary font-medium">Kill</th>
                    <th className="text-center py-2 px-2 text-bdo-text-secondary font-medium">Ölüm</th>
                    <th className="text-right py-2 px-4 text-bdo-text-secondary font-medium">Hasar</th>
                    <th className="text-center py-2 px-2 text-bdo-text-secondary font-medium">CC</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.warReportAverages.map((w) => (
                    <tr key={w.warId} className="border-b border-bdo-border/40 hover:bg-bdo-surface-2/50 transition-colors">
                      <td className="py-2.5 px-4">
                        <Link href={`/wars/${w.warId}`} className="text-bdo-text-primary hover:text-bdo-gold transition-colors font-medium">
                          {w.title}
                        </Link>
                        <p className="text-[10px] text-bdo-text-secondary mt-0.5">
                          {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} · {w.players} oyuncu
                        </p>
                      </td>
                      <td className="text-center py-2.5 px-2 text-bdo-text-primary">{w.avgKills}</td>
                      <td className="text-center py-2.5 px-2 text-bdo-text-muted">{w.avgDeaths}</td>
                      <td className="text-right py-2.5 px-4 text-bdo-gold font-mono font-semibold">{fmtNum(w.avgDamageDealt)}</td>
                      <td className="text-center py-2.5 px-2 text-bdo-text-muted">{w.avgCcCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* GS Leaderboard */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">GS Sıralaması</span>
            <Link href="/members" className="card-meta hover:text-bdo-gold transition-colors">Tümü →</Link>
          </div>
          {stats.topGs.map((u, i) => (
            <Link key={u.id} href={`/members/${u.id}`} className="card-row gap-3">
              <span className={`text-[11px] font-bold font-mono w-4 flex-shrink-0 ${
                i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-bdo-text-secondary"
              }`}>{i + 1}</span>
              {u.avatarUrl
                ? <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-bdo-surface-2 flex-shrink-0" />
              }
              <span className="text-[13px] text-bdo-text-primary flex-1 truncate">{u.familyName}</span>
              <span className="text-[12px] font-mono font-semibold text-bdo-gold flex-shrink-0">{u.gs}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom grid: class dist + GS brackets + attendance */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Class distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Class Dağılımı</span>
          </div>
          <div className="p-4 space-y-2">
            {stats.classDistribution.sort((a, b) => b.count - a.count).map((c, i) => (
              <div key={c.class} className="flex items-center gap-2">
                <span className="text-[11px] text-bdo-text-muted w-20 truncate flex-shrink-0">{getClassName2(c.class)}</span>
                <div className="flex-1 bg-bdo-bg rounded-full h-1.5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(c.count / maxClassCount) * 100}%`, backgroundColor: CLASS_COLORS[i % CLASS_COLORS.length] }} />
                </div>
                <span className="text-[11px] text-bdo-text-secondary font-mono w-4 text-right flex-shrink-0">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* GS Brackets */}
        {stats.gsBrackets && (() => {
          const total = stats.gsBrackets.reduce((s, b) => s + b.count, 0) || 1;
          return (
            <div className="card">
              <div className="card-header">
                <span className="card-title">GS Dağılımı</span>
                <span className="card-meta">{total} üye</span>
              </div>
              <div className="p-4 space-y-3">
                {stats.gsBrackets.map((b, i) => {
                  const pct = Math.round((b.count / total) * 100);
                  return (
                    <div key={b.label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: BRACKET_COLORS[i] }} />
                          <span className="text-[11px] text-bdo-text-muted">{b.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-bdo-text-secondary font-mono">{b.count}</span>
                          <span className="text-[10px] font-bold text-bdo-text-muted w-7 text-right">%{pct}</span>
                        </div>
                      </div>
                      <div className="h-1 bg-bdo-bg rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: BRACKET_COLORS[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* En Aktif */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">En Aktif Üyeler</span>
          </div>
          {stats.topAttendance.map((u, i) => (
            <Link key={u.id} href={`/members/${u.id}`} className="card-row gap-3">
              <span className={`text-[11px] font-bold font-mono w-4 flex-shrink-0 ${
                i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-bdo-text-secondary"
              }`}>{i + 1}</span>
              {u.avatarUrl
                ? <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                : <div className="w-6 h-6 rounded-full bg-bdo-surface-2 flex-shrink-0" />
              }
              <span className="text-[13px] text-bdo-text-primary flex-1 truncate">{u.familyName}</span>
              <span className="text-[11px] text-bdo-text-muted flex-shrink-0">{u.count} savaş</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
