export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Bunny Stream kodlama bildirimi.
 *
 * Video yüklendikten sonra kodlama birkaç dakika sürüyor; bittiğinde
 * Bunny buraya POST atıyor ve klip arşivde "hazır" oluyor. Adres
 * Bunny panelinde tanımlı ve içinde yalnız bizim bildiğimiz bir
 * anahtar var — uç herkese açık olmak zorunda, kimlik o anahtarla
 * doğrulanıyor.
 *
 * Bildirim gelmezse klip sonsuza kadar "işleniyor" kalmıyor: arşiv
 * açılırken bekleyen klipler Bunny'ye tek tek sorulup tazeleniyor
 * (bkz. `/api/klip/[id]` GET).
 */
export async function POST(req: NextRequest) {
  const beklenen = process.env.BUNNY_WEBHOOK_SECRET;
  const gelen = new URL(req.url).searchParams.get("s");
  if (!beklenen || gelen !== beklenen) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const g = await req.json().catch(() => null) as
    | { VideoGuid?: string; VideoLibraryId?: number; Status?: number }
    | null;
  const guid = g?.VideoGuid;
  const durum = g?.Status;
  if (!guid || typeof durum !== "number") {
    return NextResponse.json({ error: "Eksik gövde" }, { status: 400 });
  }

  await prisma.klip.updateMany({ where: { bunnyId: guid }, data: { durum } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
