export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { getGuildScope } from "@/lib/guild-scope";

/**
 * Hasar raporu — SADECE oturum sahibinin klanı.
 * Siteye kayıtlı olmayan (eşleşmemiş) oyuncular hiçbir klana ait olmadığı için gizlenir.
 * Klanlar arası ortak rapor için /api/ally/performances kullanılır.
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

  const where: { warId?: number; userId: number | { in: number[] } } = {
    userId: { in: memberIds },
  };
  if (warId) where.warId = parseInt(warId);
  if (userId) {
    const uid = parseInt(userId);
    // Başka klandan bir üyenin verisi istenirse boş döner
    where.userId = memberIds.includes(uid) ? uid : -1;
  }

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
