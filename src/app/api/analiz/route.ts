export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";
import { analyzeWars, classAverages, type RawPerf, type PartyRole } from "@/lib/war-analysis";

/**
 * Seçilen savaşların analizi.
 *
 * Yönetici görüşü olduğu için her iki klanı da kapsar — guild filtresi
 * isteğe bağlı, varsayılan olarak hepsi.
 */
export async function GET(req: NextRequest) {
  const scope = await getGuildScope();
  if (!scope?.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const warIds = (url.searchParams.get("wars") ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (warIds.length === 0) {
    return NextResponse.json({ error: "Savaş seçilmedi." }, { status: 400 });
  }

  // Savunmadakiler ölçüye girmez — farklı iş yaparlar, hasarları kıyaslanamaz
  const excludeDefense = url.searchParams.get("defense") !== "include";

  const [wars, perfs] = await Promise.all([
    prisma.war.findMany({
      where: { id: { in: warIds } },
      select: { id: true, title: true, type: true, date: true, result: true },
      orderBy: { date: "asc" },
    }),
    prisma.warPerformance.findMany({
      where: { warId: { in: warIds } },
      select: {
        warId: true, userId: true, inGameName: true, class: true, spec: true,
        kills: true, deaths: true, killStreak: true,
        damageDealt: true, damageTaken: true, ccCount: true,
        hpHeal: true, allyHpHeal: true, castleDamage: true,
        user: { select: { class: true, guild: { select: { tag: true } } } },
      },
    }),
  ]);

  if (perfs.length === 0) {
    return NextResponse.json({ error: "Seçilen savaşlarda rapor yok." }, { status: 404 });
  }

  // Rol, warId+userId çiftine bağlı — aynı kişi bir savaşta savunmada,
  // başkasında saldırıda olabilir
  const allParties = await prisma.party.findMany({
    where: { warId: { in: warIds } },
    select: { warId: true, name: true, isDefense: true, members: { select: { userId: true } } },
  });

  const roleOf = new Map<string, PartyRole>();
  for (const party of allParties) {
    // FLANK şemada yok; parti adından okunur, alan eklenince buradan kalkacak
    const role: PartyRole = party.isDefense
      ? "DEFENSE"
      : /flank|kanat/i.test(party.name) ? "FLANK" : "MAIN";
    for (const m of party.members) roleOf.set(party.warId + ":" + m.userId, role);
  }

  const usable = excludeDefense
    ? perfs.filter((p) => p.userId == null || roleOf.get(p.warId + ":" + p.userId) !== "DEFENSE")
    : perfs;
  const excludedCount = perfs.length - usable.length;

  // Klan etiketi ve class boşsa kullanıcının güncel class'ına düş
  const meta = new Map<number, { guildTag: string | null }>();
  const raw: RawPerf[] = usable.map((p) => {
    if (p.userId != null) meta.set(p.userId, { guildTag: p.user?.guild?.tag ?? null });
    return {
      warId: p.warId,
      role: (p.userId != null ? roleOf.get(p.warId + ":" + p.userId) : undefined) ?? "MAIN",
      userId: p.userId, inGameName: p.inGameName,
      class: p.class || p.user?.class || "", spec: p.spec,
      kills: p.kills, deaths: p.deaths, killStreak: p.killStreak,
      damageDealt: p.damageDealt, damageTaken: p.damageTaken, ccCount: p.ccCount,
      hpHeal: p.hpHeal, allyHpHeal: p.allyHpHeal, castleDamage: p.castleDamage,
    };
  });

  const players = analyzeWars(raw, meta);
  const classAvg = Array.from(classAverages(players).entries())
    .map(([cls, v]) => ({ class: cls, rating: Math.round(v.rating * 10) / 10, count: v.count }))
    .sort((a, b) => b.rating - a.rating);

  const totals = {
    damageDealt: raw.reduce((s, p) => s + p.damageDealt, 0),
    castleDamage: raw.reduce((s, p) => s + p.castleDamage, 0),
    kills: raw.reduce((s, p) => s + p.kills, 0),
    deaths: raw.reduce((s, p) => s + p.deaths, 0),
  };

  const roleCounts = players.reduce((m, p) => {
    m[p.role] = (m[p.role] ?? 0) + 1;
    return m;
  }, {} as Record<string, number>);

  return NextResponse.json({ wars, players, classAvg, totals, excludedCount, roleCounts });
}
