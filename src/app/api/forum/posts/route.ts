export const dynamic = "force-dynamic";
export const maxDuration = 30;
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const POST_INCLUDE = {
  author: { select: { id: true, familyName: true, avatarUrl: true, siteRole: { select: { name: true, color: true } } } },
  tags: { include: { tag: true } },
  _count: { select: { comments: true, reactions: true } },
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tagSlug = searchParams.get("tag");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;

  const where = tagSlug
    ? { tags: { some: { tag: { slug: tagSlug } } } }
    : {};

  const [posts, total] = await Promise.all([
    prisma.forumPost.findMany({
      where,
      include: POST_INCLUDE,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.forumPost.count({ where }),
  ]);

  return NextResponse.json({ posts, total, page, pages: Math.ceil(total / limit) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Vercel 4.5MB body limit — check content-length before parsing
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 4_000_000) {
    return NextResponse.json({ error: "İçerik çok büyük. Resimleri küçülterek dene (max ~3MB)." }, { status: 413 });
  }

  let body: { title?: string; content?: string; tagIds?: number[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "İstek okunamadı. İçerik çok büyük olabilir." }, { status: 413 });
  }

  const { title, content, tagIds } = body;
  if (!title?.trim() || !content?.trim()) return NextResponse.json({ error: "Başlık ve içerik zorunlu" }, { status: 400 });
  if (!tagIds?.length) return NextResponse.json({ error: "En az bir tag seç" }, { status: 400 });

  try {
    const post = await prisma.forumPost.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        authorId: session.user.id,
        tags: { create: tagIds.map((id: number) => ({ tagId: id })) },
      },
      include: POST_INCLUDE,
    });
    return NextResponse.json(post, { status: 201 });
  } catch (err) {
    console.error("Forum post create error:", err);
    return NextResponse.json({ error: "Gönderi oluşturulamadı. Sunucu hatası." }, { status: 500 });
  }
}
