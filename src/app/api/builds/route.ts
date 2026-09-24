export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Kayıtlı kurulumlar (kristal / eser).
 *  GET  ?kind=kristal|eser|build → benimkiler + herkese açık olanlar
 *  POST { kind, name, code, isPublic, id? } → kaydet / güncelle
 *  DELETE ?id=               → kendi kaydını sil (admin hepsini)
 */

const KINDS = ["kristal", "eser", "build"];
const SEC = {
  id: true, kind: true, name: true, code: true, isPublic: true, updatedAt: true,
  user: { select: { id: true, familyName: true, class: true } },
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Geçersiz tür." }, { status: 400 });

  const [mine, shared] = await Promise.all([
    prisma.build.findMany({ where: { kind, userId: session.user.id }, orderBy: { updatedAt: "desc" }, select: SEC }),
    prisma.build.findMany({
      where: { kind, isPublic: true, NOT: { userId: session.user.id } },
      orderBy: { updatedAt: "desc" }, take: 60, select: SEC,
    }),
  ]);
  return NextResponse.json({ mine, shared });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { id?: number; kind?: string; name?: string; code?: string; isPublic?: boolean };
  const kind = String(b.kind ?? "");
  if (!KINDS.includes(kind)) return NextResponse.json({ error: "Geçersiz tür." }, { status: 400 });
  const name = String(b.name ?? "").trim().slice(0, 60);
  const code = String(b.code ?? "").trim().slice(0, 4000);
  if (!name) return NextResponse.json({ error: "Kurulum adı gerekli." }, { status: 400 });
  if (!code) return NextResponse.json({ error: "Boş kurulum kaydedilmez." }, { status: 400 });

  if (b.id) {
    const mevcut = await prisma.build.findUnique({ where: { id: Number(b.id) }, select: { userId: true } });
    if (!mevcut) return NextResponse.json({ error: "Kayıt yok." }, { status: 404 });
    if (mevcut.userId !== session.user.id && !session.user.isAdmin) return NextResponse.json({ error: "Bu kayıt senin değil." }, { status: 403 });
    const row = await prisma.build.update({ where: { id: Number(b.id) }, data: { name, code, isPublic: !!b.isPublic }, select: SEC });
    return NextResponse.json(row);
  }

  // Aynı isimde kendi kaydı varsa üstüne yazılır — "kaydet" iki kayıt üretmesin
  const ayni = await prisma.build.findFirst({ where: { kind, userId: session.user.id, name }, select: { id: true } });
  const row = ayni
    ? await prisma.build.update({ where: { id: ayni.id }, data: { code, isPublic: !!b.isPublic }, select: SEC })
    : await prisma.build.create({ data: { kind, name, code, isPublic: !!b.isPublic, userId: session.user.id }, select: SEC });
  return NextResponse.json(row);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  const row = await prisma.build.findUnique({ where: { id }, select: { userId: true } });
  if (!row) return NextResponse.json({ ok: true });
  if (row.userId !== session.user.id && !session.user.isAdmin) return NextResponse.json({ error: "Bu kayıt senin değil." }, { status: 403 });
  await prisma.build.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
