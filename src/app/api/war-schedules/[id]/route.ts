export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, type, dayOfWeek, hour, minute, createDaysBefore, deadlineHours, maxParticipants, notes, sendToDiscord, isActive } = body;

  const schedule = await prisma.warSchedule.update({
    where: { id: Number(params.id) },
    data: {
      name:             name             !== undefined ? name             : undefined,
      type:             type             !== undefined ? type             : undefined,
      dayOfWeek:        dayOfWeek        !== undefined ? Number(dayOfWeek): undefined,
      hour:             hour             !== undefined ? Number(hour)     : undefined,
      minute:           minute           !== undefined ? Number(minute)   : undefined,
      createDaysBefore: createDaysBefore !== undefined ? Number(createDaysBefore) : undefined,
      deadlineHours:    deadlineHours    !== undefined ? (deadlineHours ? Number(deadlineHours) : null) : undefined,
      maxParticipants:  maxParticipants  !== undefined ? (maxParticipants ? Number(maxParticipants) : null) : undefined,
      notes:            notes            !== undefined ? (notes || null)  : undefined,
      sendToDiscord:    sendToDiscord    !== undefined ? Boolean(sendToDiscord) : undefined,
      isActive:         isActive         !== undefined ? Boolean(isActive): undefined,
    },
  });

  return NextResponse.json(schedule);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.warSchedule.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
