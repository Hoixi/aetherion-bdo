import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROUNDS_PER_GAME = 5;

// POST /api/geo/game — start a new game
export async function POST(_req: Request) {
  const session = await getServerSession(authOptions);

  // Pick ROUNDS_PER_GAME random images
  const allImages = await prisma.geoImage.findMany({ select: { id: true } });

  if (allImages.length < ROUNDS_PER_GAME) {
    return NextResponse.json(
      { error: `En az ${ROUNDS_PER_GAME} resim gerekli` },
      { status: 400 }
    );
  }

  // Shuffle and take first ROUNDS_PER_GAME
  const shuffled = allImages.sort(() => Math.random() - 0.5).slice(0, ROUNDS_PER_GAME);

  const game = await prisma.geoGame.create({
    data: {
      userId: session?.user?.id ?? null,
      rounds: {
        create: shuffled.map((img, i) => ({
          imageId: img.id,
          roundNum: i + 1,
        })),
      },
    },
    include: {
      rounds: {
        orderBy: { roundNum: "asc" },
        include: { image: { select: { id: true, imageUrl: true } } },
      },
    },
  });

  return NextResponse.json(game);
}
