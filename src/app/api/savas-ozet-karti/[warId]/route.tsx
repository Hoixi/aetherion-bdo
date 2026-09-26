import { prisma } from "@/lib/prisma";
import { savasOzeti } from "@/lib/savas-ozeti";
import { isiKesiti } from "@/lib/harita-karti";
import { ozetKarti } from "@/lib/savas-ozet-karti";

export const dynamic = "force-dynamic";
// Prisma ve sharp Edge'de çalışmaz
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Savaş özeti kartı — kill akışından, hasar raporundan bağımsız.
 *
 * Hasar raporu kartı "kim ne kadar vurdu" diyor; bu kart savaşın kendisini
 * anlatıyor: kaç aldık kaç verdik, hangi dakikada dağıldık, hangi klana ve
 * hangi sınıfa öldük, kavga haritanın neresinde geçti.
 */
export async function GET(_req: Request, { params }: { params: { warId: string } }) {
  const warId = Number(params.warId);
  if (isNaN(warId)) return new Response("Invalid ID", { status: 400 });

  const war = await prisma.war.findUnique({
    where: { id: warId },
    select: { id: true, title: true, date: true },
  });
  if (!war) return new Response("Not found", { status: 404 });

  const o = await savasOzeti(warId);
  if (!o) return new Response("Bu savaşta kayıt yok", { status: 404 });

  const isi = await isiKesiti(o.noktalar, { genislik: 520, yukseklik: 320 });
  return await ozetKarti({
    baslik: war.title,
    tarih: war.date,
    o,
    isiUrl: isi ? `data:image/png;base64,${isi.toString("base64")}` : null,
  });
}
