import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_TIERS = [
  { name: "S", color: "#ef4444", order: 0 },
  { name: "A", color: "#f97316", order: 1 },
  { name: "B", color: "#eab308", order: 2 },
  { name: "C", color: "#22c55e", order: 3 },
  { name: "D", color: "#3b82f6", order: 4 },
];

export async function GET() {
  try {
    const lists = await prisma.tierList.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, familyName: true, avatarUrl: true } },
        _count: { select: { votes: true } },
        tiers: {
          orderBy: { order: "asc" },
          include: { _count: { select: { entries: true } } },
        },
      },
    });
    return NextResponse.json(lists);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Giriş gerekli" }, { status: 401 });

  const userId = Number(session.user.id);
  const isAdmin = (session.user as { isAdmin?: boolean })?.isAdmin ?? false;

  const body = await req.json();
  const { title, description, tags, isVoting, customTiers } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Başlık zorunlu" }, { status: 400 });

  if (isVoting && !isAdmin) {
    return NextResponse.json({ error: "Sadece adminler oylamalı tier list oluşturabilir" }, { status: 403 });
  }

  const tierDefs = (customTiers && customTiers.length > 0) ? customTiers : DEFAULT_TIERS;

  const list = await prisma.tierList.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      tags: Array.isArray(tags) ? tags.join(",") : "",
      isVoting: isVoting ?? false,
      createdBy: userId,
      tiers: {
        create: tierDefs.map((t: { name: string; color: string; order: number }) => ({
          name: t.name,
          color: t.color,
          order: t.order,
        })),
      },
    },
    include: { tiers: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(list, { status: 201 });
}
