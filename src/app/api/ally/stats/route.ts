export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

/**
 * Ally sayfası — klanlar arası ORTAK veriler.
 * Bireysel üye verisi (kim ne kadar hasar vurmuş) paylaşılmaz;
 * sadece klan bazında toplu/anonim özetler döner.
 */
export async function GET() {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guilds = await prisma.guild.findMany({
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: { id: true, name: true, tag: true, color: true, isPrimary: true },
  });

  const members = await prisma.user.findMany({
    where: { familyName: { not: "" }, deletedAt: null, guildId: { not: null } },
    select: { id: true, ap: true, dp: true, guildId: true, class: true },
  });

  // ── Klan bazlı özet (toplu, bireysel isim yok) ──
  const guildSummaries = guilds.map((g) => {
    const gm = members.filter((m) => m.guildId === g.id);
    const gsList = gm.map((m) => m.ap + m.dp).sort((a, b) => b - a);
    const avgGs = gsList.length ? Math.round(gsList.reduce((s, v) => s + v, 0) / gsList.length) : 0;
    return {
      ...g,
      memberCount: gm.length,
      avgGs,
      topGs: gsList[0] ?? 0,
      // GS dağılımı — klanın gücünü gösterir, kimlik açığa çıkmaz
      brackets: [
        { label: "< 800", count: gsList.filter((v) => v < 800).length },
        { label: "800-820", count: gsList.filter((v) => v >= 800 && v < 820).length },
        { label: "820-840", count: gsList.filter((v) => v >= 820 && v < 840).length },
        { label: "840-860", count: gsList.filter((v) => v >= 840 && v < 860).length },
        { label: "860+", count: gsList.filter((v) => v >= 860).length },
      ],
    };
  });

  // ── Ortak savaşlar: her klandan kaç kişi katıldı ──
  const wars = await prisma.war.findMany({
    orderBy: { date: "desc" },
    take: 12,
    select: {
      id: true, title: true, type: true, date: true, result: true,
      participants: {
        where: { status: "ATTENDING" },
        select: { user: { select: { guildId: true } } },
      },
    },
  });

  const warBreakdown = wars.map((w) => {
    const counts = new Map<number, number>();
    for (const p of w.participants) {
      const gid = p.user.guildId;
      if (gid != null) counts.set(gid, (counts.get(gid) ?? 0) + 1);
    }
    return {
      id: w.id,
      title: w.title,
      type: w.type,
      date: w.date,
      result: w.result,
      total: w.participants.length,
      byGuild: guilds
        .map((g) => ({ guildId: g.id, tag: g.tag, color: g.color, count: counts.get(g.id) ?? 0 }))
        .filter((x) => x.count > 0),
    };
  });

  // ── Yaklaşan savaş ──
  const upcomingWar = await prisma.war.findFirst({
    where: { date: { gt: new Date() } },
    orderBy: { date: "asc" },
    select: {
      id: true, title: true, date: true, type: true,
      participants: {
        where: { status: "ATTENDING" },
        select: { user: { select: { guildId: true } } },
      },
    },
  });

  const upcoming = upcomingWar
    ? {
        id: upcomingWar.id,
        title: upcomingWar.title,
        date: upcomingWar.date,
        type: upcomingWar.type,
        byGuild: guilds
          .map((g) => ({
            guildId: g.id, tag: g.tag, color: g.color, name: g.name,
            count: upcomingWar.participants.filter((p) => p.user.guildId === g.id).length,
          }))
          .filter((x) => x.count > 0),
      }
    : null;

  // ── Birleşik class dağılımı (klan bazında) ──
  const classByGuild = guilds.map((g) => {
    const gm = members.filter((m) => m.guildId === g.id && m.class);
    const counts = new Map<string, number>();
    for (const m of gm) counts.set(m.class, (counts.get(m.class) ?? 0) + 1);
    return {
      guildId: g.id,
      tag: g.tag,
      color: g.color,
      classes: Array.from(counts.entries())
        .map(([cls, count]) => ({ class: cls, count }))
        .sort((a, b) => b.count - a.count),
    };
  });

  return NextResponse.json({
    myGuildId: scope.guildId,
    guilds: guildSummaries,
    totals: {
      guildCount: guilds.length,
      memberCount: members.length,
      avgGs: members.length
        ? Math.round(members.reduce((s, m) => s + m.ap + m.dp, 0) / members.length)
        : 0,
    },
    warBreakdown,
    upcoming,
    classByGuild,
  });
}
