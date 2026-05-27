import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST → oy gönder (upsert)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { discordId: session.user.id } });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const list = await prisma.tierList.findUnique({ where: { id: Number(id) } });
  if (!list) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (!list.isVoting) return NextResponse.json({ error: "Bu tier list oylamalı değil" }, { status: 400 });

  const body = await req.json();
  const { tierId, classId, spec, note } = body;

  if (!tierId || !classId || !spec) {
    return NextResponse.json({ error: "tierId, classId ve spec zorunlu" }, { status: 400 });
  }

  const vote = await prisma.tierVote.upsert({
    where: {
      tierListId_userId_classId_spec: {
        tierListId: Number(id),
        userId: user.id,
        classId,
        spec,
      },
    },
    update: { tierId: Number(tierId), note: note || null },
    create: {
      tierListId: Number(id),
      userId: user.id,
      classId,
      spec,
      tierId: Number(tierId),
      note: note || null,
    },
  });

  return NextResponse.json(vote);
}

// DELETE → oyumu geri al
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { discordId: session.user.id } });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const { classId, spec } = await req.json();
  await prisma.tierVote.deleteMany({
    where: { tierListId: Number(id), userId: user.id, classId, spec },
  });

  return NextResponse.json({ ok: true });
}
