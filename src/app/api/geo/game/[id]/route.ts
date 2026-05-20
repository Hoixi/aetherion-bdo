import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/geo/game/[id] — fetch current game state
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await getServerSession(authOptions); // optional auth check

  const gameId = Number(params.id);

  const game = await prisma.geoGame.findUnique({
    where: { id: gameId },
    include: {
      rounds: {
        orderBy: { roundNum: "asc" },
        include: {
          image: {
            select: {
              id: true,
              imageUrl: true,
              // only expose correct coords + hint if round is completed
              mapX: true,
              mapY: true,
              hint: true,
            },
          },
        },
      },
    },
  });

  if (!game) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Hide correct coordinates for incomplete rounds
  const sanitizedRounds = game.rounds.map((r) => ({
    ...r,
    image: r.completed
      ? r.image
      : { id: r.image.id, imageUrl: r.image.imageUrl, mapX: null, mapY: null, hint: null },
  }));

  return NextResponse.json({ ...game, rounds: sanitizedRounds });
}
