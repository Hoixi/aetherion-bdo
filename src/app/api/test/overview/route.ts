export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

/**
 * Test ekranının tüm verisi tek çağrıda.
 *
 * Panelin yedi bölümü var; her biri ayrı istek atsaydı sayfa açılışında
 * yedi gidiş-dönüş olurdu. Sorgular birbirinden bağımsız olduğu için
 * paralel çalışıyorlar.
 */
export async function GET() {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [guilds, members, wars, recentPerfs, me] = await Promise.all([
    prisma.guild.findMany({
      select: { id: true, name: true, tag: true, color: true, isPrimary: true },
      orderBy: { isPrimary: "desc" },
    }),
    prisma.user.findMany({
      where: { deletedAt: null, familyName: { not: "" } },
      select: {
        id: true, familyName: true, class: true, spec: true, ap: true, dp: true,
        avatarUrl: true, createdAt: true,
        guild: { select: { tag: true, color: true } },
      },
    }),
    prisma.war.findMany({
      orderBy: { date: "desc" },
      take: 12,
      select: {
        id: true, title: true, type: true, date: true, result: true,
        _count: { select: { participants: true, performances: true } },
      },
    }),
    // Son 5 savaşın performansları — sıralama ve trend buradan çıkar
    prisma.warPerformance.findMany({
      where: { war: { date: { not: undefined } } },
      orderBy: { war: { date: "desc" } },
      take: 400,
      select: {
        warId: true, userId: true, inGameName: true, class: true, spec: true,
        kills: true, deaths: true, damageDealt: true, castleDamage: true, ccCount: true,
        war: { select: { id: true, date: true, title: true } },
        user: { select: { familyName: true, avatarUrl: true, guild: { select: { tag: true, color: true } } } },
      },
    }),
    // Oturum sahibinin kendi kartı
    prisma.user.findUnique({
      where: { id: scope.userId },
      select: {
        id: true, familyName: true, class: true, spec: true, ap: true, dp: true,
        avatarUrl: true, absenceCount: true,
        guild: { select: { tag: true, color: true } },
        siteRole: { select: { name: true, color: true } },
        _count: { select: { participations: { where: { status: "ATTENDING" } } } },
      },
    }),
  ]);

  // ── Class dağılımı
  const classCount = new Map<string, number>();
  for (const m of members) {
    if (!m.class) continue;
    classCount.set(m.class, (classCount.get(m.class) ?? 0) + 1);
  }
  const classes = Array.from(classCount.entries())
    .map(([cls, n]) => ({ class: cls, n }))
    .sort((a, b) => b.n - a.n);

  // ── Klan dağılımı
  const guildCount = new Map<string, { tag: string; color: string; n: number }>();
  for (const m of members) {
    if (!m.guild) continue;
    const cur = guildCount.get(m.guild.tag) ?? { tag: m.guild.tag, color: m.guild.color, n: 0 };
    cur.n++;
    guildCount.set(m.guild.tag, cur);
  }

  // ── Gear
  const geared = members.filter((m) => m.ap + m.dp > 0);
  const avgGs = geared.length
    ? Math.round(geared.reduce((s, m) => s + m.ap + m.dp, 0) / geared.length)
    : 0;
  const topGear = [...geared]
    .sort((a, b) => (b.ap + b.dp) - (a.ap + a.dp))
    .slice(0, 8)
    .map((m) => ({
      id: m.id, name: m.familyName, class: m.class, spec: m.spec,
      ap: m.ap, dp: m.dp, gs: m.ap + m.dp, avatarUrl: m.avatarUrl,
      guild: m.guild ?? null,
    }));

  // ── Son 5 savaşın oyuncu bazlı toplamı
  const lastWarIds = Array.from(new Set(recentPerfs.map((p) => p.warId))).slice(0, 5);
  const inScope = recentPerfs.filter((p) => lastWarIds.includes(p.warId));

  type Agg = {
    name: string; class: string; spec: string; avatarUrl: string | null;
    guild: { tag: string; color: string } | null;
    wars: number; kills: number; deaths: number; damage: number; castle: number; cc: number;
  };
  const agg = new Map<string, Agg>();
  for (const p of inScope) {
    const key = p.userId != null ? "u" + p.userId : "n" + p.inGameName.toLowerCase();
    const cur = agg.get(key) ?? {
      name: p.user?.familyName || p.inGameName,
      class: p.class || "", spec: p.spec || "",
      avatarUrl: p.user?.avatarUrl ?? null,
      guild: p.user?.guild ?? null,
      wars: 0, kills: 0, deaths: 0, damage: 0, castle: 0, cc: 0,
    };
    cur.wars++;
    cur.kills += p.kills;
    cur.deaths += p.deaths;
    cur.damage += p.damageDealt;
    cur.castle += p.castleDamage;
    cur.cc += p.ccCount;
    agg.set(key, cur);
  }

  // Sıra numarası listeden kırpılmadan önce çıkarılıyor: kendi sıramız
  // ilk 25'in dışında kalabilir
  const ranked = Array.from(agg.entries())
    .map(([key, a]) => ({
      key,
      ...a,
      avgDamage: a.wars ? a.damage / a.wars : 0,
      kd: a.deaths > 0 ? Math.round((a.kills / a.deaths) * 100) / 100 : a.kills,
    }))
    .sort((a, b) => b.damage - a.damage);

  const myRank = ranked.findIndex((p) => p.key === "u" + scope.userId);
  const mine = myRank >= 0 ? ranked[myRank] : null;

  // Anahtar yalnızca sıralamayı bulmak içindi, cevaba girmesin
  const players = ranked.map((r) => {
    const copy: Partial<typeof r> = { ...r };
    delete copy.key;
    return copy;
  });

  // ── Savaşta en çok oynanan class'lar — üye profilinden değil, sahadan
  const playedCount = new Map<string, number>();
  for (const p of inScope) {
    const c = p.class;
    if (!c) continue;
    playedCount.set(c, (playedCount.get(c) ?? 0) + 1);
  }
  const playedClasses = Array.from(playedCount.entries())
    .map(([cls, n]) => ({ class: cls, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 8);

  // ── Katılım eğrisi
  const trend = wars
    .slice(0, 10)
    .reverse()
    .map((w) => ({
      id: w.id, title: w.title,
      date: w.date,
      participants: w._count.participants,
      reported: w._count.performances,
    }));

  const wins = wars.filter((w) => w.result === "WIN").length;
  const losses = wars.filter((w) => w.result === "LOSS").length;

  // GS sıralamasındaki yerimiz — gear girmemiş üyeler sayılmıyor
  const gsRank = me && me.ap + me.dp > 0
    ? geared.filter((m) => m.ap + m.dp > me.ap + me.dp).length + 1
    : null;

  return NextResponse.json({
    me: me && {
      name: me.familyName,
      class: me.class,
      spec: me.spec,
      ap: me.ap,
      dp: me.dp,
      gs: me.ap + me.dp,
      avatarUrl: me.avatarUrl,
      guild: me.guild,
      role: me.siteRole,
      attended: me._count.participations,
      absences: me.absenceCount,
      gsRank,
      gearedCount: geared.length,
      /** Sayılan savaşlardaki kendi toplamımız — hiç oynamadıysak null */
      stats: mine
        ? {
            rank: myRank + 1,
            of: ranked.length,
            wars: mine.wars, kills: mine.kills, deaths: mine.deaths,
            damage: mine.damage, castle: mine.castle, cc: mine.cc,
            avgDamage: mine.avgDamage, kd: mine.kd,
          }
        : null,
    },
    guilds,
    totals: {
      members: members.length,
      geared: geared.length,
      avgGs,
      wins, losses,
      damage: inScope.reduce((s, p) => s + p.damageDealt, 0),
      castle: inScope.reduce((s, p) => s + p.castleDamage, 0),
      kills: inScope.reduce((s, p) => s + p.kills, 0),
      deaths: inScope.reduce((s, p) => s + p.deaths, 0),
      warsCounted: lastWarIds.length,
    },
    guildBreakdown: Array.from(guildCount.values()).sort((a, b) => b.n - a.n),
    classes,
    playedClasses,
    topGear,
    players: players.slice(0, 25),
    wars,
    trend,
  });
}
