export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const schedules = await prisma.warSchedule.findMany({ orderBy: { dayOfWeek: "asc" } });
  return NextResponse.json(schedules);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, type, dayOfWeek, hour, minute, createDaysBefore, deadlineHours, maxParticipants, notes, sendToDiscord } = body;

  if (!name || dayOfWeek === undefined || hour === undefined) {
    return NextResponse.json({ error: "name, dayOfWeek ve hour zorunludur" }, { status: 400 });
  }

  const schedule = await prisma.warSchedule.create({
    data: {
      name,
      type: type || "NODE_WAR",
      dayOfWeek: Number(dayOfWeek),
      hour: Number(hour),
      minute: Number(minute ?? 0),
      createDaysBefore: Number(createDaysBefore ?? 1),
      deadlineHours: deadlineHours ? Number(deadlineHours) : null,
      maxParticipants: maxParticipants ? Number(maxParticipants) : null,
      notes: notes || null,
      sendToDiscord: sendToDiscord !== false,
    },
  });

  return NextResponse.json(schedule, { status: 201 });
}
