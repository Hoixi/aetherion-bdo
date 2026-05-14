"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface WarPerf {
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
  war: { id: number; title: string; date: string };
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 100_000) return Math.round(n / 1_000) + "B";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

export function UserPerformanceStats({ userId }: { userId: number }) {
  const [perfs, setPerfs] = useState<WarPerf[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/performances?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => setPerfs(data.performances ?? []))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="text-bdo-text-muted text-sm">Yükleniyor...</p>;
  if (!perfs || perfs.length === 0) {
    return <p className="text-bdo-text-muted text-sm">Henüz kayıtlı hasar verisi yok.</p>;
  }

  const warCount = perfs.length;

  const totals = perfs.reduce(
    (acc, p) => ({
      kills: acc.kills + p.kills,
      damageDealt: acc.damageDealt + p.damageDealt,
      castleDamage: acc.castleDamage + p.castleDamage,
    }),
    { kills: 0, damageDealt: 0, castleDamage: 0 }
  );

  const avgs = {
    kills: totals.kills / warCount,
    damageDealt: totals.damageDealt / warCount,
    castleDamage: totals.castleDamage / warCount,
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bdo-bg border border-bdo-border rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">Toplam Kill</div>
          <div className="text-lg font-bold font-mono text-bdo-gold mt-1">{totals.kills}</div>
          <div className="text-[10px] text-bdo-text-muted mt-0.5">ort. {avgs.kills.toFixed(1)} / savaş</div>
        </div>
        <div className="bg-bdo-bg border border-bdo-border rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">Ver. Hasar</div>
          <div className="text-lg font-bold font-mono text-bdo-gold mt-1">{fmt(totals.damageDealt)}</div>
          <div className="text-[10px] text-bdo-text-muted mt-0.5">ort. {fmt(avgs.damageDealt)} / savaş</div>
        </div>
        <div className="bg-bdo-bg border border-bdo-border rounded-lg p-3 text-center">
          <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">Kale Hasar</div>
          <div className="text-lg font-bold font-mono text-bdo-gold mt-1">{fmt(totals.castleDamage)}</div>
          <div className="text-[10px] text-bdo-text-muted mt-0.5">ort. {fmt(avgs.castleDamage)} / savaş</div>
        </div>
      </div>

      {/* Per-war breakdown */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-bdo-border text-bdo-text-muted">
              <th className="text-left py-2 px-2">Savaş</th>
              <th className="text-center py-2 px-2">💀</th>
              <th className="text-right py-2 px-2">Ver. Hasar</th>
              <th className="text-right py-2 px-2">Kale Hasar</th>
            </tr>
          </thead>
          <tbody>
            {perfs.map((p) => (
              <tr key={p.id} className="border-b border-bdo-border/50 hover:bg-bdo-gold/5 transition-colors">
                <td className="py-2 px-2">
                  <Link href={`/wars/${p.war.id}`} className="text-bdo-text-primary hover:text-bdo-gold transition-colors">
                    {p.war.title}
                  </Link>
                  <div className="text-[10px] text-bdo-text-muted">
                    {new Date(p.war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </td>
                <td className="text-center py-2 px-2 text-bdo-text-secondary">{p.kills}</td>
                <td className="text-right py-2 px-2 text-bdo-gold font-mono">{fmt(p.damageDealt)}</td>
                <td className="text-right py-2 px-2 text-bdo-text-secondary font-mono">{fmt(p.castleDamage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
