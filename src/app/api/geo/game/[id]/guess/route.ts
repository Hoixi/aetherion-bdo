import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PERFECT_RADIUS = 0.005;
const ZERO_SCORE_DISTANCE = 0.625;

function calcScore(dist: number): number {
  if (dist <= PERFECT_RADIUS) return 5000;

  const scoreRange = ZERO_SCORE_DISTANCE - PERFECT_RADIUS;
  const adjustedDist = dist - PERFECT_RADIUS;
  return Math.max(0, Math.round(5000 - (adjustedDist / scoreRange) * 5000));
}

// POST /api/geo/game/[id]/guess
// Body: { roundNum: number, guessX: number, guessY: number }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  await getServerSession(authOptions);

  const gameId = Number(params.id);
  const { roundNum, guessX, guessY } = await req.json();

  if (roundNum == null || guessX == null || guessY == null) {
    return NextResponse.json({ error: "roundNum, guessX, guessY required" }, { status: 400 });
  }

  const game = await prisma.geoGame.findUnique({
    where: { id: gameId },
    include: {
      rounds: {
        where: { roundNum },
        include: { image: true },
      },
    },
  });

  if (!game) return NextResponse.json({ error: "Game not found" }, { status: 404 });
  if (game.completed) return NextResponse.json({ error: "Game already completed" }, { status: 400 });

  const round = game.rounds[0];
  if (!round) return NextResponse.json({ error: "Round not found" }, { status: 404 });
  if (round.completed) return NextResponse.json({ error: "Round already completed" }, { status: 400 });

  const dx = guessX - round.image.mapX;
  const dy = guessY - round.image.mapY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const score = calcScore(distance);

  // Update the round
  await prisma.geoRound.update({
    where: { id: round.id },
    data: {
      guessX,
      guessY,
      distance,
      score,
      completed: true,
    },
  });

  // Check if all rounds are done
  const allRounds = await prisma.geoRound.findMany({ where: { gameId } });
  const allCompleted = allRounds.every((r) => r.id === round.id ? true : r.completed);
  const totalScore = allRounds.reduce(
    (sum, r) => sum + (r.id === round.id ? score : r.score),
    0
  );

  if (allCompleted) {
    await prisma.geoGame.update({
      where: { id: gameId },
      data: { completed: true, totalScore },
    });
  } else {
    await prisma.geoGame.update({
      where: { id: gameId },
      data: { totalScore },
    });
  }

  return NextResponse.json({
    score,
    distance,
    totalScore,
    gameCompleted: allCompleted,
  });
}
