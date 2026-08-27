export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RECENT_WAR_WINDOW } from "@/lib/perf-window";
import { warScore } from "@/lib/score";

/**
 * Parti kurarken kullanılan performans puanı.
 *
 * Ortalamalar bütün geçmişten değil, rapor girilmiş son birkaç savaştan
 * çıkıyor — gerekçesi `@/lib/perf-window` içinde. Pencere `?wars=` ile
 * değiştirilebiliyor; savaş sonrası "bu sefer ne oldu" diye bakmak için
 * 1 vermek işe yarıyor.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const asked = Number(new URL(req.url).searchParams.get("wars"));
  const window = Number.isFinite(asked) && asked > 0 ? Math.min(asked, 50) : RECENT_WAR_WINDOW;

  // Penceredeki savaşlar: rapor girilmemiş savaşlar sırayı yemesin diye
  // yalnızca performans kaydı olanlar sayılıyor
  const recent = await prisma.war.findMany({
    where: { performances: { some: {} } },
    orderBy: { date: "desc" },
    take: window,
    select: { id: true },
  });

  if (recent.length === 0) return NextResponse.json({});

  const warIds = recent.map((w) => w.id);

  const grouped = await prisma.warPerformance.groupBy({
    by: ["userId"],
    where: { userId: { not: null }, warId: { in: warIds } },
    _avg: {
      kills: true,
      deaths: true,
      killStreak: true,
      damageDealt: true,
      damageTaken: true,
      ccCount: true,
      hpHeal: true,
      allyHpHeal: true,
      castleDamage: true,
      survivalSeconds: true,
    },
    _count: { warId: true, survivalSeconds: true },
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
    avgCastle: number;
    /** Saniyede hasar — süre kolonu okunmuş savaşlardan. Yoksa null. */
    dps: number | null;
    /** Penceredeki kaç savaşta süre verisi vardı */
    dpsWars: number;
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
    const avgCastle = row._avg.castleDamage ?? 0;
    const avgCc     = row._avg.ccCount      ?? 0;
    const avgHeal   = (row._avg.hpHeal ?? 0) + (row._avg.allyHpHeal ?? 0);
    const wars      = row._count.warId;

    /*
     * DPS yalnızca süre okunabilmiş savaşlardan çıkıyor. Prisma
     * ortalamayı null olmayanlar üzerinden alıyor; hasar ortalaması ise
     * bütün savaşları kapsıyor. İkisi farklı kümeye dayanacağı için
     * yalnızca süre bütün pencerede varsa hesaplanıyor — eksik veriden
     * üretilmiş bir DPS, yok olandan daha yanıltıcı.
     */
    const dpsWars   = row._count.survivalSeconds;
    const avgSurv   = row._avg.survivalSeconds ?? 0;
    const dps = dpsWars === wars && avgSurv > 0
      ? Math.round((avgDamage / avgSurv) * 10) / 10
      : null;

    // Formül ve gerekçesi @/lib/score içinde — panel de aynısını kullanıyor
    const score = warScore({
      damage: avgDamage, kills: avgKills, castle: avgCastle,
      cc: avgCc, deaths: avgDeaths,
    });

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
      avgCastle,
      dps,
      dpsWars,
      maxKills:      row._max.kills        ?? 0,
      maxKillStreak: row._max.killStreak   ?? 0,
      maxDamage:     row._max.damageDealt  ?? 0,
      kdr: avgDeaths > 0 ? Math.round((avgKills / avgDeaths) * 100) / 100 : avgKills,
      score,
    };
  }

  return NextResponse.json(result);
}
