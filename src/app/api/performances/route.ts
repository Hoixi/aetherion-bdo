export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const warId = searchParams.get("warId");
  const userId = searchParams.get("userId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (warId) where.warId = parseInt(warId);
  if (userId) where.userId = parseInt(userId);

  const performances = await prisma.warPerformance.findMany({
    where,
    orderBy: { damageDealt: "desc" },
    include: {
      user: { select: { id: true, familyName: true, avatarUrl: true, class: true } },
      war: { select: { id: true, title: true, date: true } },
    },
  });

  // Also fetch wars that have performances for the selector
  const wars = await prisma.war.findMany({
    where: { performances: { some: {} } },
    orderBy: { date: "desc" },
    select: { id: true, title: true, date: true },
  });

  return NextResponse.json({ performances, wars });
}
