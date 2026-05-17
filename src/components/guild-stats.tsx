"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BDO_CLASSES } from "@/lib/classes";

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
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "Mn";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function getClassName2(id: string): string {
  return BDO_CLASSES.find((c) => c.id === id)?.name ?? id;
}

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
      setCountdown(`${d > 0 ? d + "g " : ""}${h}sa ${m}dk`);
    }

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [stats?.upcomingWar]);

  if (!stats) return null;

  const maxClassCount = Math.max(...stats.classDistribution.map((c) => c.count), 1);
  const winRate = stats.warStats.totalWars > 0
    ? Math.round((stats.warStats.wins / (stats.warStats.wins + stats.warStats.losses + stats.warStats.draws || 1)) * 100)
    : 0;

  const classColors = [
    "#d4a853", "#e8b960", "#c9963f", "#dbb24e", "#b8892e",
    "#a67c28", "#f0c566", "#d9ac45", "#c4952e", "#e0b850",
  ];

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Toplam Üye" value={stats.totalMembers} icon="👥" />
        <StatCard label="Ortalama GS" value={stats.avgGs} icon="⚔️" />
        <StatCard label="Win Rate" value={`%${winRate}`} sub={`${stats.warStats.wins}W ${stats.warStats.losses}L ${stats.warStats.draws}D`} icon="🏆" />
        <StatCard label="Toplam Savaş" value={stats.warStats.totalWars} icon="🗡️" />
      </div>

      {/* Upcoming War Countdown */}
      {stats.upcomingWar && (
        <Link href={`/wars/${stats.upcomingWar.id}`} className="block">
          <div className="bg-gradient-to-r from-bdo-gold/10 via-bdo-gold/5 to-transparent border border-bdo-gold/20 rounded-xl p-4 hover:border-bdo-gold/40 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase text-bdo-gold/70 tracking-wider">Yaklaşan Etkinlik</div>
                <div className="text-sm font-semibold text-bdo-text-primary mt-0.5">{stats.upcomingWar.title}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase text-bdo-gold/70 tracking-wider">Kalan Süre</div>
                <div className="text-lg font-bold font-mono text-bdo-gold">{countdown || "..."}</div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Last 3 Wars Report Averages */}
      {stats.warReportAverages?.length > 0 && (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
          <h3 className="text-xs uppercase text-bdo-text-muted mb-3">Son 3 Savaş Raporu Ortalaması</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-bdo-border text-bdo-text-muted">
                  <th className="text-left py-2 px-2">Savaş</th>
                  <th className="text-center py-2 px-2">Oyuncu</th>
                  <th className="text-center py-2 px-2" title="Ort. Kill">💀</th>
                  <th className="text-center py-2 px-2" title="Ort. Ölüm">🪦</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Ort. Hasar</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Ort. HP Yenile</th>
                  <th className="text-center py-2 px-2" title="Ort. CC">CC</th>
                </tr>
              </thead>
              <tbody>
                {stats.warReportAverages.map((w) => (
                  <tr key={w.warId} className="border-b border-bdo-border/50 hover:bg-bdo-gold/5 transition-colors">
                    <td className="py-2 px-2">
                      <Link href={`/wars/${w.warId}`} className="text-bdo-text-primary hover:text-bdo-gold transition-colors">
                        {w.title}
                      </Link>
                      <div className="text-[10px] text-bdo-text-muted">
                        {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                      </div>
                    </td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{w.players}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{w.avgKills}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{w.avgDeaths}</td>
                    <td className="text-right py-2 px-2 text-bdo-gold font-mono">{fmtNum(w.avgDamageDealt)}</td>
                    <td className="text-right py-2 px-2 text-green-400/80 font-mono">{fmtNum(w.avgHpHeal)}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{w.avgCcCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 items-start">
        {/* Left column: Class Distribution + GS Donut */}
        <div className="space-y-4">
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <h3 className="text-xs uppercase text-bdo-text-muted mb-3">Class Dağılımı</h3>
            <div className="space-y-1.5">
              {stats.classDistribution
                .sort((a, b) => b.count - a.count)
                .map((c, i) => (
                  <div key={c.class} className="flex items-center gap-2 text-xs">
                    <span className="text-bdo-text-muted w-20 truncate">{getClassName2(c.class)}</span>
                    <div className="flex-1 bg-bdo-bg rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(c.count / maxClassCount) * 100}%`,
                          backgroundColor: classColors[i % classColors.length],
                          opacity: 0.75,
                        }}
                      />
                    </div>
                    <span className="text-bdo-text-muted font-mono w-5 text-right">{c.count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* GS Bracket Donut Chart */}
          {stats.gsBrackets && (() => {
            const brackets = stats.gsBrackets;
            const total = brackets.reduce((s, b) => s + b.count, 0) || 1;
            const COLORS = ["#e84545", "#f07f3c", "#f5c842", "#4ab3f4", "#5b6ef5"];
            const R = 38;
            const CIRC = 2 * Math.PI * R;
            let offset = 0;

            return (
              <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
                <h3 className="text-xs uppercase text-bdo-text-muted mb-4">GS Dağılımı</h3>
                <div className="flex items-center gap-6">
                  {/* Donut */}
                  <div className="relative flex-shrink-0">
                    <svg width="120" height="120" viewBox="0 0 100 100">
                      {/* Track */}
                      <circle cx="50" cy="50" r={R} fill="none" stroke="#1e2028" strokeWidth="18" />
                      {/* Segments */}
                      {brackets.map((b, i) => {
                        const dash = (b.count / total) * CIRC;
                        const gap = CIRC - dash;
                        const segOffset = CIRC * 0.25 - offset;
                        const el = (
                          <circle
                            key={b.label}
                            cx="50" cy="50" r={R}
                            fill="none"
                            stroke={COLORS[i % COLORS.length]}
                            strokeWidth="18"
                            strokeDasharray={`${dash} ${gap}`}
                            strokeDashoffset={segOffset}
                            strokeLinecap="butt"
                          />
                        );
                        offset += dash;
                        return el;
                      })}
                      {/* Gap ring */}
                      <circle cx="50" cy="50" r={R} fill="none" stroke="#0f1117" strokeWidth="2" />
                      {/* Center label */}
                      <text x="50" y="47" textAnchor="middle" fill="#d4a853" fontSize="14" fontWeight="bold" fontFamily="monospace">{total}</text>
                      <text x="50" y="58" textAnchor="middle" fill="#6b7280" fontSize="7">üye</text>
                    </svg>
                  </div>
                  {/* Legend */}
                  <div className="flex-1 space-y-2">
                    {brackets.map((b, i) => {
                      const pct = Math.round((b.count / total) * 100);
                      return (
                        <div key={b.label} className="flex items-center gap-2 text-xs">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-bdo-text-muted flex-1">{b.label}</span>
                          <span className="font-mono text-bdo-text-secondary">{b.count}</span>
                          <span className="font-mono text-bdo-gold w-9 text-right">%{pct}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right column: Leaderboards */}
        <div className="space-y-4">
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <h3 className="text-xs uppercase text-bdo-text-muted mb-3">En Yüksek GS</h3>
            <div className="space-y-2">
              {stats.topGs.map((u, i) => (
                <Link key={u.id} href={`/members/${u.id}`} className="flex items-center gap-2 hover:bg-bdo-gold/5 rounded-lg px-2 py-1 -mx-2 transition-colors">
                  <span className={`text-xs font-bold font-mono w-5 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : "text-amber-600"}`}>
                    #{i + 1}
                  </span>
                  {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full" />}
                  <span className="text-sm text-bdo-text-primary flex-1">{u.familyName}</span>
                  <span className="text-sm font-mono font-bold text-bdo-gold">{u.gs}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <h3 className="text-xs uppercase text-bdo-text-muted mb-3">En Aktif Üyeler</h3>
            <div className="space-y-2">
              {stats.topAttendance.map((u, i) => (
                <Link key={u.id} href={`/members/${u.id}`} className="flex items-center gap-2 hover:bg-bdo-gold/5 rounded-lg px-2 py-1 -mx-2 transition-colors">
                  <span className={`text-xs font-bold font-mono w-5 ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : "text-amber-600"}`}>
                    #{i + 1}
                  </span>
                  {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full" />}
                  <span className="text-sm text-bdo-text-primary flex-1">{u.familyName}</span>
                  <span className="text-sm font-mono text-bdo-gold">⚔️ {u.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: string; sub?: string }) {
  return (
    <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase text-bdo-text-muted tracking-wider">{label}</span>
        <span className="text-sm">{icon}</span>
      </div>
      <div className="text-xl font-bold font-mono text-bdo-gold">{value}</div>
      {sub && <div className="text-[10px] text-bdo-text-muted mt-0.5">{sub}</div>}
    </div>
  );
}
