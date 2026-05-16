export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete expired activities
  await prisma.activity.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const activities = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, familyName: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, familyName: true, avatarUrl: true } } },
      },
    },
  });

  return NextResponse.json(activities);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, maxSize } = await req.json();

  const validTypes = ["KARA_TAPINAK", "KAN_ALTARI", "PARTI_SLOTLARI"];
  if (!validTypes.includes(type)) return NextResponse.json({ error: "Geçersiz tip" }, { status: 400 });

  const size =
    type === "KARA_TAPINAK" ? 5 :
    type === "KAN_ALTARI" ? 3 :
    [3, 5].includes(maxSize) ? maxSize : 5;

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  const activity = await prisma.activity.create({
    data: {
      type,
      maxSize: size,
      creatorId: session.user.id,
      expiresAt,
      members: { create: { userId: session.user.id } }, // creator auto-joins
    },
    include: {
      creator: { select: { id: true, familyName: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, familyName: true, avatarUrl: true } } },
      },
    },
  });

  return NextResponse.json(activity, { status: 201 });
}
