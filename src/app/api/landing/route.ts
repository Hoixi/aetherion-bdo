export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RECENT_WAR_WINDOW } from "@/lib/perf-window";
import { SETTING_KEYS, getSettings } from "@/lib/settings";

/**
 * Karşılama ekranının verisi.
 *
 * Bu uç bilerek oturumsuz: ekranın tamamı giriş yapmamış ziyaretçi için.
 * Yalnızca toplamlar dönüyor — kimse adıyla, tek tek hasarıyla burada
 * görünmüyor.
 */
export async function GET() {
  try {
    // Ana klan: müttefikler sayıya girmiyor
    const guild = await prisma.guild.findFirst({ where: { isPrimary: true } });

    const uyeler = await prisma.user.findMany({
      where: { deletedAt: null, ...(guild ? { guildId: guild.id } : {}) },
      select: { ap: true, dp: true },
    });

    const gsToplam = uyeler.reduce((s, u) => s + u.ap + u.dp, 0);
    const ortalamaGs = uyeler.length ? Math.round(gsToplam / uyeler.length) : 0;

    /**
     * Son savaşlar: rapor girilmiş olanlar. Rapor girilmemiş bir savaş
     * pencereye girerse toplam düşük görünür, o yüzden performansı olan
     * savaşlar seçiliyor.
     */
    const sonSavaslar = await prisma.war.findMany({
      where: { performances: { some: {} } },
      orderBy: { date: "desc" },
      take: RECENT_WAR_WINDOW,
      select: { id: true, date: true },
    });

    const ids = sonSavaslar.map((w) => w.id);
    const toplam = ids.length
      ? await prisma.warPerformance.aggregate({
          where: { warId: { in: ids } },
          _sum: { damageDealt: true, castleDamage: true, kills: true },
        })
      : null;

    const ayarlar = await getSettings([SETTING_KEYS.discordInvite, SETTING_KEYS.slogan, SETTING_KEYS.manifesto,
      SETTING_KEYS.wallpaperBlur]);

    return NextResponse.json({
      guild: guild ? { name: guild.name, tag: guild.tag } : null,
      memberCount: uyeler.length,
      averageGs: ortalamaGs,
      wars: {
        window: RECENT_WAR_WINDOW,
        counted: ids.length,
        lastDate: sonSavaslar[0]?.date ?? null,
        totalDamage: Math.round(toplam?._sum.damageDealt ?? 0),
        totalCastleDamage: Math.round(toplam?._sum.castleDamage ?? 0),
        totalKills: toplam?._sum.kills ?? 0,
      },
      discordInvite: ayarlar[SETTING_KEYS.discordInvite],
      slogan: ayarlar[SETTING_KEYS.slogan],
      manifesto: ayarlar[SETTING_KEYS.manifesto,
      SETTING_KEYS.wallpaperBlur],
    });
  } catch (err) {
    console.error("[landing] hata:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Veriler getirilemedi." }, { status: 500 });
  }
}
