export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const POST_INCLUDE = {
  author: { select: { id: true, familyName: true, avatarUrl: true, siteRole: { select: { name: true, color: true } } } },
  tags: { include: { tag: true } },
  comments: {
    include: { author: { select: { id: true, familyName: true, avatarUrl: true, siteRole: { select: { name: true, color: true } } } } },
    orderBy: { createdAt: "asc" as const },
  },
  reactions: { include: { user: { select: { id: true, familyName: true } } } },
  _count: { select: { comments: true, reactions: true } },
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.forumPost.findUnique({
    where: { id: parseInt(params.id) },
    include: POST_INCLUDE,
  });
  if (!post) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });

  // View count artır
  await prisma.forumPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } });

  return NextResponse.json(post);
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.forumPost.findUnique({ where: { id: parseInt(params.id) } });
  if (!post) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (post.authorId !== session.user.id && !session.user.isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, content, tagIds, pinned } = await req.json();

  // Pinning sadece admin
  const data: Record<string, unknown> = {};
  if (title) data.title = title.trim();
  if (content) data.content = content.trim();
  if (session.user.isAdmin && pinned !== undefined) data.pinned = pinned;

  const updated = await prisma.forumPost.update({
    where: { id: post.id },
    data: {
      ...data,
      ...(tagIds && {
        tags: {
          deleteMany: {},
          create: tagIds.map((id: number) => ({ tagId: id })),
        },
      }),
    },
    include: POST_INCLUDE,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.forumPost.findUnique({ where: { id: parseInt(params.id) } });
  if (!post) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (post.authorId !== session.user.id && !session.user.isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.forumPost.delete({ where: { id: post.id } });
  return NextResponse.json({ success: true });
}
