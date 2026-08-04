export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

/**
 * Dashboard istatistikleri — SADECE oturum sahibinin klanı.
 * Klanlar arası ortak veriler için /api/ally/stats kullanılır.
 */
export async function GET() {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { guildId } = scope;
  const memberFilter = { familyName: { not: "" }, deletedAt: null, guildId };

  const [members, wars, classDistribution, guild] = await Promise.all([
    prisma.user.findMany({
      where: memberFilter,
      select: { ap: true, dp: true, familyName: true, id: true, avatarUrl: true },
    }),
    prisma.war.findMany({ select: { id: true, result: true, date: true } }),
    prisma.user.groupBy({
      by: ["class"],
      where: { ...memberFilter, class: { not: "" } },
      _count: true,
    }),
    guildId ? prisma.guild.findUnique({
      where: { id: guildId },
      select: { id: true, name: true, tag: true, color: true },
    }) : null,
  ]);

  const memberIds = members.map((m) => m.id);

  // Katılım sıralaması — sadece kendi klanının üyeleri
  const topParticipants = await prisma.warParticipant.groupBy({
    by: ["userId"],
    where: { status: "ATTENDING", userId: { in: memberIds } },
    _count: true,
    orderBy: { _count: { userId: "desc" } },
    take: 10,
  });

  const topParticipantUsers = await prisma.user.findMany({
    where: { id: { in: topParticipants.map((p) => p.userId) } },
    select: { id: true, familyName: true, avatarUrl: true },
  });

  const totalMembers = members.length;
  const avgGs = totalMembers > 0
    ? Math.round(members.reduce((sum, m) => sum + m.ap + m.dp, 0) / totalMembers)
    : 0;

  const sorted = [...members].sort((a, b) => (b.ap + b.dp) - (a.ap + a.dp));
  const topGs = sorted.slice(0, 10).map((m) => ({
    id: m.id,
    familyName: m.familyName,
    avatarUrl: m.avatarUrl,
    gs: m.ap + m.dp,
  }));

  const topAttendance = topParticipants.map((p) => {
    const user = topParticipantUsers.find((u) => u.id === p.userId);
    return {
      id: p.userId,
      familyName: user?.familyName ?? "",
      avatarUrl: user?.avatarUrl ?? "",
      count: p._count,
    };
  });

  const totalWars = wars.length;
  const wins = wars.filter((w) => w.result === "WIN").length;
  const losses = wars.filter((w) => w.result === "LOSS").length;
  const draws = wars.filter((w) => w.result === "DRAW").length;

  // Son 3 savaş — performanslar kendi klanına filtreli, savunma partisi hariç
  const last3Wars = await prisma.war.findMany({
    where: { performances: { some: { userId: { in: memberIds } } } },
    orderBy: { date: "desc" },
    take: 3,
    select: {
      id: true,
      title: true,
      date: true,
      performances: {
        where: { userId: { in: memberIds } },
        select: {
          userId: true, kills: true, deaths: true, damageDealt: true, damageTaken: true,
          hpHeal: true, allyHpHeal: true, ccCount: true, castleDamage: true,
        },
      },
    },
  });

  const defenseMembers = await prisma.partyMember.findMany({
    where: { party: { warId: { in: last3Wars.map((w) => w.id) }, isDefense: true } },
    select: { userId: true, party: { select: { warId: true } } },
  });
  const defenseMap = new Map<number, Set<number>>();
  for (const dm of defenseMembers) {
    if (!defenseMap.has(dm.party.warId)) defenseMap.set(dm.party.warId, new Set());
    defenseMap.get(dm.party.warId)!.add(dm.userId);
  }

  const warReportAverages = last3Wars.map((w) => {
    const perfs = w.performances.filter((p) => !p.userId || !defenseMap.get(w.id)?.has(p.userId));
    const count = perfs.length || 1;
    const sum = <T extends keyof (typeof perfs)[0]>(key: T) =>
      perfs.reduce((acc, p) => acc + Number(p[key]), 0);
    return {
      warId: w.id,
      title: w.title,
      date: w.date,
      players: perfs.length,
      avgKills: Math.round(sum("kills") / count * 10) / 10,
      avgDeaths: Math.round(sum("deaths") / count * 10) / 10,
      avgDamageDealt: Math.round(sum("damageDealt") / count),
      avgDamageTaken: Math.round(sum("damageTaken") / count),
      avgHpHeal: Math.round(sum("hpHeal") / count),
      avgCcCount: Math.round(sum("ccCount") / count * 10) / 10,
    };
  });

  const upcomingWar = await prisma.war.findFirst({
    where: { date: { gt: new Date() } },
    orderBy: { date: "asc" },
    select: { id: true, title: true, date: true, type: true },
  });

  const gsIn = (min: number, max?: number) =>
    members.filter((m) => {
      const gs = m.ap + m.dp;
      return gs >= min && (max === undefined || gs < max);
    }).length;

  return NextResponse.json({
    guild,
    totalMembers,
    avgGs,
    topGs,
    topAttendance,
    classDistribution: classDistribution.map((c) => ({ class: c.class, count: c._count })),
    warStats: { totalWars, wins, losses, draws },
    upcomingWar,
    warReportAverages,
    gsBrackets: [
      { label: "< 800", count: members.filter((m) => m.ap + m.dp < 800).length },
      { label: "800-820", count: gsIn(800, 820) },
      { label: "820+", count: gsIn(820, 840) },
      { label: "840+", count: gsIn(840, 860) },
      { label: "860+", count: gsIn(860) },
    ],
  });
}
