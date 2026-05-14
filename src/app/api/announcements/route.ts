export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { creator: { select: { familyName: true, avatarUrl: true } } },
  });

  return NextResponse.json(announcements);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, content } = await req.json();

  const announcement = await prisma.announcement.create({
    data: { title, content, createdBy: session.user.id },
    include: { creator: { select: { familyName: true, avatarUrl: true } } },
  });

  return NextResponse.json(announcement, { status: 201 });
}
