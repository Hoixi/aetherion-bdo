import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { id } = await params;
  const userId = Number(session.user.id);
  const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin ?? false;

  const list = await prisma.tierList.findUnique({
    where: { id: Number(id) },
    include: { tiers: true },
  });
  if (!list) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (list.createdBy !== userId && !isAdmin) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = await req.json();
  const { tierId, classId, spec, note } = body;

  if (!tierId || !classId || !spec) {
    return NextResponse.json({ error: "tierId, classId ve spec zorunlu" }, { status: 400 });
  }

  // Aynı class+spec başka tiere yerleştirilmişse sil
  const existingTierIds = list.tiers.map((t) => t.id);
  await prisma.tierEntry.deleteMany({
    where: { tierId: { in: existingTierIds }, classId, spec },
  });

  const entry = await prisma.tierEntry.create({
    data: { tierId: Number(tierId), classId, spec, note: note || null, order: 0 },
  });

  return NextResponse.json(entry, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { id } = await params;
  const userId = Number(session.user.id);
  const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin ?? false;

  const list = await prisma.tierList.findUnique({
    where: { id: Number(id) },
    include: { tiers: true },
  });
  if (!list) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (list.createdBy !== userId && !isAdmin) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const { classId, spec } = await req.json();
  const tierIds = list.tiers.map((t) => t.id);
  await prisma.tierEntry.deleteMany({
    where: { tierId: { in: tierIds }, classId, spec },
  });

  return NextResponse.json({ ok: true });
}
