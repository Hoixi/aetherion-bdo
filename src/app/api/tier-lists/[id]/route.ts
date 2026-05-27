import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const list = await prisma.tierList.findUnique({
      where: { id: Number(id) },
      include: {
        creator: { select: { id: true, familyName: true, avatarUrl: true } },
        tiers: {
          orderBy: { order: "asc" },
          include: {
            entries: { orderBy: { order: "asc" } },
            votes: true,
          },
        },
        votes: {
          include: {
            user: { select: { id: true, familyName: true, avatarUrl: true } },
          },
        },
      },
    });
    if (!list) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
    return NextResponse.json(list);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { id } = await params;
  const userId = Number(session.user.id);
  const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin ?? false;

  const list = await prisma.tierList.findUnique({ where: { id: Number(id) } });
  if (!list) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (list.createdBy !== userId && !isAdmin) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = await req.json();
  const { title, description, tags, tiers } = body;

  const updated = await prisma.tierList.update({
    where: { id: Number(id) },
    data: {
      title: title?.trim() || list.title,
      description: description !== undefined ? description?.trim() || null : list.description,
      tags: Array.isArray(tags) ? tags.join(",") : list.tags,
    },
  });

  if (tiers && Array.isArray(tiers)) {
    for (const t of tiers) {
      if (t.id) {
        await prisma.tier.update({
          where: { id: t.id },
          data: { name: t.name, color: t.color, order: t.order ?? 0 },
        });
      }
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const { id } = await params;
  const userId = Number(session.user.id);
  const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin ?? false;

  const list = await prisma.tierList.findUnique({ where: { id: Number(id) } });
  if (!list) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (list.createdBy !== userId && !isAdmin) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  await prisma.tierList.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
