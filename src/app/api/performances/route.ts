export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getGuildScope } from "@/lib/guild-scope";

/**
 * Hasar raporu — tüm klanlar görünür.
 *
 * Müttefikler aynı savaşa birlikte girdiği için performans tablosu ortak
 * tutulur; kimin ne yaptığı savaş sonunda zaten oyun içi raporda görünüyor.
 * ?guild=<id> ile tek bir klana daraltılabilir, ?warId= ile tek savaşa,
 * ?userId= ile tek oyuncuya, ?lastWars=N ile son N savaşa.
 *
 * Pencere olmadan bütün geçmiş dönüyordu; kayıt sayısı her savaşta ~25
 * artıyor ve "genel ortalama" aylar öncesini bugünle aynı ağırlıkta
 * sayıyordu.
 */
export async function GET(req: NextRequest) {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warId = searchParams.get("warId");
  const userId = searchParams.get("userId");
  const guildId = searchParams.get("guild");
  const lastWars = Number(searchParams.get("lastWars"));

  const where: {
    warId?: number | { in: number[] };
    userId?: number;
    user?: { guildId: number };
  } = {};

  if (warId) {
    where.warId = parseInt(warId);
  } else if (Number.isFinite(lastWars) && lastWars > 0) {
    // Rapor girilmemiş savaşlar pencereden yer kapmasın
    const son = await prisma.war.findMany({
      where: { performances: { some: {} } },
      orderBy: { date: "desc" },
      take: Math.min(lastWars, 100),
      select: { id: true },
    });
    where.warId = { in: son.map((w) => w.id) };
  }

  if (userId) where.userId = parseInt(userId);
  if (guildId) where.user = { guildId: Number(guildId) };

  const performances = await prisma.warPerformance.findMany({
    where,
    orderBy: { damageDealt: "desc" },
    include: {
      user: {
        select: {
          id: true, familyName: true, avatarUrl: true, class: true,
          guild: { select: { id: true, name: true, tag: true, color: true } },
        },
      },
      war: { select: { id: true, title: true, date: true, type: true } },
    },
  });

  const wars = await prisma.war.findMany({
    where: { performances: { some: {} } },
    orderBy: { date: "desc" },
    select: { id: true, title: true, date: true },
  });

  const guilds = await prisma.guild.findMany({
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: { id: true, name: true, tag: true, color: true },
  });

  return NextResponse.json({ performances, wars, guilds });
}
