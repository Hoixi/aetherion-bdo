export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AD_MAX = 60;

async function yetkili() {
  const session = await getServerSession(authOptions);
  return !!(session?.user.isAdmin || session?.user.isGuildAdmin);
}
const yetkisiz = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET() {
  if (!(await yetkili())) return yetkisiz();
  return NextResponse.json(await prisma.grindSpot.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] }));
}

/** Ekle */
export async function POST(req: Request) {
  if (!(await yetkili())) return yetkisiz();
  const b = (await req.json().catch(() => ({}))) as { name?: string; region?: string };
  const name = String(b.name ?? "").trim().slice(0, AD_MAX);
  if (!name) return NextResponse.json({ error: "Spot adı gerekli." }, { status: 400 });
  const son = await prisma.grindSpot.aggregate({ _max: { order: true } });
  const row = await prisma.grindSpot.create({
    data: {
      name,
      region: String(b.region ?? "Edania 2").trim().slice(0, AD_MAX) || "Edania 2",
      order: (son._max.order ?? 0) + 1,
    },
  });
  return NextResponse.json(row);
}

/** Ad / aktiflik / sıra güncelle */
export async function PUT(req: Request) {
  if (!(await yetkili())) return yetkisiz();
  const b = (await req.json().catch(() => ({}))) as { id?: number; name?: string; active?: boolean; order?: number };
  if (!Number.isInteger(b.id)) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  const data: { name?: string; active?: boolean; order?: number } = {};
  if (typeof b.name === "string") {
    const n = b.name.trim().slice(0, AD_MAX);
    if (!n) return NextResponse.json({ error: "Spot adı boş olamaz." }, { status: 400 });
    data.name = n;
  }
  if (typeof b.active === "boolean") data.active = b.active;
  if (Number.isInteger(b.order)) data.order = Number(b.order);
  return NextResponse.json(await prisma.grindSpot.update({ where: { id: Number(b.id) }, data }));
}

/** Sil — oturumlar kalır, spotu boşa düşer (SetNull) */
export async function DELETE(req: Request) {
  if (!(await yetkili())) return yetkisiz();
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  await prisma.grindSpot.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
