export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAllMembers } from "@/lib/notifications";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wars = await prisma.war.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: { select: { participants: { where: { status: "ATTENDING" } } } },
      participants: {
        where: { userId: session.user.id },
        select: { status: true },
      },
    },
  });

  return NextResponse.json(wars);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, type, date, notes, deadline, maxParticipants } = body;

  const war = await prisma.war.create({
    data: {
      title,
      type,
      date: new Date(date),
      notes: notes || null,
      deadline: deadline ? new Date(deadline) : null,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      createdBy: session.user.id,
    },
  });

  // Tüm üyelere bildirim gönder
  await notifyAllMembers(
    "NEW_WAR",
    "Yeni Etkinlik",
    `"${war.title}" etkinliği oluşturuldu. Katılım durumunu bildir!`,
    `/wars/${war.id}`
  );

  return NextResponse.json(war, { status: 201 });
}
