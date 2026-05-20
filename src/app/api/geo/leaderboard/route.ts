import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/geo/leaderboard — top 20 completed games
export async function GET() {
  const games = await prisma.geoGame.findMany({
    where: { completed: true, userId: { not: null } },
    orderBy: { totalScore: "desc" },
    take: 20,
    include: {
      user: { select: { familyName: true, avatarUrl: true, class: true } },
    },
  });

  return NextResponse.json(games);
}
