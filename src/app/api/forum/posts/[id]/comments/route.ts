export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "İçerik boş olamaz" }, { status: 400 });

  const postId = parseInt(params.id);
  const post = await prisma.forumPost.findUnique({ where: { id: postId } });
  if (!post) return NextResponse.json({ error: "Post bulunamadı" }, { status: 404 });

  const comment = await prisma.forumComment.create({
    data: { postId, authorId: session.user.id, content: content.trim() },
    include: { author: { select: { id: true, familyName: true, avatarUrl: true, siteRole: { select: { name: true, color: true } } } } },
  });

  return NextResponse.json(comment, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { commentId } = await req.json();
  const comment = await prisma.forumComment.findUnique({ where: { id: commentId } });
  if (!comment) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (comment.authorId !== session.user.id && !session.user.isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.forumComment.delete({ where: { id: commentId } });
  return NextResponse.json({ success: true });
}
