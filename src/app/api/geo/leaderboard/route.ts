import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/geo/leaderboard — her oyuncunun en iyi skoru (top 20)
export async function GET() {
  // Tüm tamamlanmış oyunları skora göre yüksekten düşüğe çek.
  // Her kullanıcının ilk (= en yüksek) kaydını al —
  // birden fazla oyun oynayan kişiler listede yalnızca bir kez görünür.
  const games = await prisma.geoGame.findMany({
    where: { completed: true, userId: { not: null } },
    orderBy: { totalScore: "desc" },
    include: {
      user: { select: { familyName: true, avatarUrl: true, class: true } },
    },
  });

  const seen = new Set<number>();
  const best = games.filter((g) => {
    if (!g.userId || seen.has(g.userId)) return false;
    seen.add(g.userId);
    return true;
  }).slice(0, 20);

  return NextResponse.json(best);
}
