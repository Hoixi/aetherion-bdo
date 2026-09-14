export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sonOturumlar, spotIstatistigi, canliMi } from "@/lib/grind";

/** /grind sayfasının canlı yenilemesi: son oturumlar + spot istatistiği */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const spotParam = url.searchParams.get("spot");
  const spotId = spotParam && Number.isInteger(Number(spotParam)) ? Number(spotParam) : null;
  const simdi = Date.now();
  const [oturumlar, istatistik] = await Promise.all([
    sonOturumlar(spotId),
    spotId ? spotIstatistigi(spotId) : null,
  ]);
  return NextResponse.json({
    serverTime: new Date(simdi).toISOString(),
    sessions: oturumlar.map((o) => ({ ...o, live: canliMi(o, simdi) })),
    stats: istatistik,
  }, { headers: { "Cache-Control": "no-store" } });
}

/** Kendi oturumunu sil (yanlış başlatma, deneme). Adminler herkesinkini. */
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  const o = await prisma.grindSession.findUnique({ where: { id }, select: { userId: true } });
  if (!o) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 404 });
  if (o.userId !== session.user.id && !session.user.isAdmin) {
    return NextResponse.json({ error: "Sadece kendi oturumunu silebilirsin." }, { status: 403 });
  }
  await prisma.grindSession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
