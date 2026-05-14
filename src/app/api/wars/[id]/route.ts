export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyWarParticipants } from "@/lib/notifications";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const war = await prisma.war.findUnique({
    where: { id: Number(params.id) },
    include: {
      participants: { include: { user: true } },
      parties: { include: { members: { include: { user: true }, orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
    },
  });

  if (!war) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(war);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, type, date, notes, deadline, result, maxParticipants } = body;

  const war = await prisma.war.update({
    where: { id: Number(params.id) },
    data: {
      title: title ?? undefined,
      type: type ?? undefined,
      date: date ? new Date(date) : undefined,
      notes: notes !== undefined ? notes : undefined,
      deadline: deadline !== undefined ? (deadline ? new Date(deadline) : null) : undefined,
      result: result !== undefined ? result : undefined,
      maxParticipants: maxParticipants !== undefined ? (maxParticipants ? parseInt(maxParticipants) : null) : undefined,
    },
  });

  // Sonuç açıklandıysa katılımcılara bildirim gönder
  if (result && ["WIN", "LOSS", "DRAW"].includes(result)) {
    const resultText = result === "WIN" ? "Kazandık! 🎉" : result === "LOSS" ? "Kaybettik" : "Berabere";
    await notifyWarParticipants(
      war.id,
      "WAR_RESULT",
      "Savaş Sonucu",
      `"${war.title}" sonucu: ${resultText}`,
      `/wars/${war.id}`
    );
  }

  return NextResponse.json(war);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.war.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
