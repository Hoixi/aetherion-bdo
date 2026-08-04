export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getGuildScope } from "@/lib/guild-scope";

/**
 * Hasar raporu.
 *
 * Toplu rapor (warId veya filtresiz) SADECE oturum sahibinin klanını döner —
 * bir klan diğerinin performans tablosunu göremez.
 *
 * Tek kişilik sorgu (?userId=) her klana açıktır: üye profilleri ortak
 * olduğu için kişinin kendi istatistikleri profilinde görünür.
 */
export async function GET(req: NextRequest) {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warId = searchParams.get("warId");
  const userId = searchParams.get("userId");

  const guildMembers = await prisma.user.findMany({
    where: { guildId: scope.guildId, deletedAt: null },
    select: { id: true },
  });
  const memberIds = guildMembers.map((m) => m.id);

  const where: { warId?: number; userId: number | { in: number[] } } = userId
    ? { userId: parseInt(userId) }          // bireysel profil — klan sınırı yok
    : { userId: { in: memberIds } };        // toplu rapor — kendi klanı
  if (warId) where.warId = parseInt(warId);

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
      war: { select: { id: true, title: true, date: true } },
    },
  });

  const wars = await prisma.war.findMany({
    where: { performances: { some: { userId: { in: memberIds } } } },
    orderBy: { date: "desc" },
    select: { id: true, title: true, date: true },
  });

  return NextResponse.json({ performances, wars });
}
