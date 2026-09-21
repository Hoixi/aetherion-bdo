export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BDO_CLASSES, hasClassVariants } from "@/lib/classes";

/**
 * Oynayabildiğim alternatif karakterler (ana karakter profilde).
 *  GET → sıralı liste
 *  PUT { characters: [{ class, spec, pickable }] } → listeyi olduğu gibi yazar (sıra = dizi sırası)
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.userCharacter.findMany({ where: { userId: session.user.id }, orderBy: { order: "asc" }, select: { class: true, spec: true, pickable: true } });
  return NextResponse.json(rows);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { characters?: Array<{ class?: string; spec?: string; pickable?: boolean }> };
  if (!Array.isArray(b.characters) || b.characters.length > 12) return NextResponse.json({ error: "Geçersiz liste." }, { status: 400 });

  const temiz: Array<{ class: string; spec: string; pickable: boolean }> = [];
  for (const c of b.characters) {
    const cls = String(c.class ?? "");
    if (!BDO_CLASSES.some((x) => x.id === cls)) return NextResponse.json({ error: `Geçersiz class: ${cls}` }, { status: 400 });
    const spec = hasClassVariants(cls) && c.spec === "succession" ? "succession" : "awakening";
    if (temiz.some((t) => t.class === cls && t.spec === spec)) continue;
    temiz.push({ class: cls, spec, pickable: c.pickable !== false });
  }
  await prisma.$transaction([
    prisma.userCharacter.deleteMany({ where: { userId: session.user.id } }),
    ...(temiz.length ? [prisma.userCharacter.createMany({ data: temiz.map((t, i) => ({ ...t, userId: session.user.id, order: i })) })] : []),
  ]);
  return NextResponse.json(temiz);
}
