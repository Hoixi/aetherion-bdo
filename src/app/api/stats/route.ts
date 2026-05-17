export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [members, wars, classDistribution] = await Promise.all([
    prisma.user.findMany({
      where: { familyName: { not: "" } },
      select: { ap: true, dp: true, familyName: true, id: true, avatarUrl: true },
    }),
    prisma.war.findMany({
      select: { id: true, result: true, date: true },
    }),
    prisma.user.groupBy({
      by: ["class"],
      where: { familyName: { not: "" }, class: { not: "" } },
      _count: true,
    }),
  ]);

  // Top participation
  const topParticipants = await prisma.warParticipant.groupBy({
    by: ["userId"],
    where: { status: "ATTENDING" },
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

  // Last 3 wars with performance data averages (excluding defense party members)
  const last3Wars = await prisma.war.findMany({
    where: { performances: { some: {} } },
    orderBy: { date: "desc" },
    take: 3,
    select: {
      id: true,
      title: true,
      date: true,
      performances: {
        select: {
          userId: true, kills: true, deaths: true, damageDealt: true, damageTaken: true,
          hpHeal: true, allyHpHeal: true, ccCount: true, castleDamage: true,
        },
      },
    },
  });

  // Build defense party userId map per war
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

  const now = new Date();
  const upcomingWar = await prisma.war.findFirst({
    where: { date: { gt: now } },
    orderBy: { date: "asc" },
    select: { id: true, title: true, date: true, type: true },
  });

  return NextResponse.json({
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
      { label: "800-820", count: members.filter((m) => { const gs = m.ap + m.dp; return gs >= 800 && gs < 820; }).length },
      { label: "820+",  count: members.filter((m) => { const gs = m.ap + m.dp; return gs >= 820 && gs < 840; }).length },
      { label: "840+",  count: members.filter((m) => { const gs = m.ap + m.dp; return gs >= 840 && gs < 860; }).length },
      { label: "860+",  count: members.filter((m) => { const gs = m.ap + m.dp; return gs >= 860 && gs < 880; }).length },
      { label: "880+",  count: members.filter((m) => m.ap + m.dp >= 880).length },
    ],
  });
}
