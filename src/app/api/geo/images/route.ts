import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/geo/images — list all images (admin only)
export async function GET(_req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const images = await prisma.geoImage.findMany({
    orderBy: { createdAt: "desc" },
    include: { creator: { select: { familyName: true } } },
  });

  return NextResponse.json(images);
}

// POST /api/geo/images — add a new image (admin only)
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { imageUrl, mapX, mapY, hint } = await req.json();

  if (!imageUrl || mapX == null || mapY == null) {
    return NextResponse.json({ error: "imageUrl, mapX, mapY required" }, { status: 400 });
  }

  const image = await prisma.geoImage.create({
    data: {
      imageUrl,
      mapX: Number(mapX),
      mapY: Number(mapY),
      hint: hint || null,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json(image);
}
