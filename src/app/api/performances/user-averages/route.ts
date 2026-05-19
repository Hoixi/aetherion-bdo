export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Kullanıcı bazlı toplu ortalama performans
  const grouped = await prisma.warPerformance.groupBy({
    by: ["userId"],
    where: { userId: { not: null } },
    _count: { warId: true },
    _avg: {
      kills: true,
      deaths: true,
      killStreak: true,
      damageDealt: true,
      damageTaken: true,
      ccCount: true,
      hpHeal: true,
      allyHpHeal: true,
    },
    _max: {
      kills: true,
      killStreak: true,
      damageDealt: true,
    },
  });

  // userId → stats map olarak döndür
  const result: Record<number, {
    wars: number;
    avgKills: number;
    avgDeaths: number;
    avgKillStreak: number;
    avgDamage: number;
    avgDamageTaken: number;
    avgCc: number;
    avgHeal: number;
    avgAllyHeal: number;
    maxKills: number;
    maxKillStreak: number;
    maxDamage: number;
    kdr: number;
    score: number;
  }> = {};

  for (const row of grouped) {
    if (!row.userId) continue;
    const avgKills  = row._avg.kills        ?? 0;
    const avgDeaths = row._avg.deaths       ?? 0;
    const avgDamage = row._avg.damageDealt  ?? 0;
    const avgCc     = row._avg.ccCount      ?? 0;
    const avgHeal   = (row._avg.hpHeal ?? 0) + (row._avg.allyHpHeal ?? 0);
    const wars      = row._count.warId;

    // Skor: öldürmeler + hasar etkisi + CC katkısı - ölümler
    const scoreDamage = avgDamage / 1_000_000; // milyon bazında
    const score = Math.round(avgKills * 3 + scoreDamage * 1.5 + avgCc * 0.5 - avgDeaths * 0.25);

    result[row.userId] = {
      wars,
      avgKills:      Math.round(avgKills * 10) / 10,
      avgDeaths:     Math.round(avgDeaths * 10) / 10,
      avgKillStreak: Math.round((row._avg.killStreak ?? 0) * 10) / 10,
      avgDamage,
      avgDamageTaken: row._avg.damageTaken ?? 0,
      avgCc:         Math.round(avgCc * 10) / 10,
      avgHeal:       avgHeal,
      avgAllyHeal:   row._avg.allyHpHeal ?? 0,
      maxKills:      row._max.kills        ?? 0,
      maxKillStreak: row._max.killStreak   ?? 0,
      maxDamage:     row._max.damageDealt  ?? 0,
      kdr: avgDeaths > 0 ? Math.round((avgKills / avgDeaths) * 100) / 100 : avgKills,
      score,
    };
  }

  return NextResponse.json(result);
}
