export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_EMOJIS = ["👍", "❤️", "🔥", "⚔️", "😂"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { emoji } = await req.json();
  if (!ALLOWED_EMOJIS.includes(emoji)) return NextResponse.json({ error: "Geçersiz emoji" }, { status: 400 });

  const postId = parseInt(params.id);

  // Toggle: varsa sil, yoksa ekle
  const existing = await prisma.forumReaction.findUnique({
    where: { postId_userId_emoji: { postId, userId: session.user.id, emoji } },
  });

  if (existing) {
    await prisma.forumReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.forumReaction.create({ data: { postId, userId: session.user.id, emoji } });
  }

  // Tüm reaksiyonları say ve dön
  const reactions = await prisma.forumReaction.groupBy({
    by: ["emoji"],
    where: { postId },
    _count: true,
  });

  const myReactions = await prisma.forumReaction.findMany({
    where: { postId, userId: session.user.id },
    select: { emoji: true },
  });

  return NextResponse.json({
    reactions: reactions.map((r) => ({ emoji: r.emoji, count: r._count })),
    mine: myReactions.map((r) => r.emoji),
  });
}
