export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS } from "@/lib/app-gate";

/**
 * Kale buff'ı: oyunda tahtı tutan klan bölgeye süreli bir buff bağışlıyor
 * ("Edana Kutsaması", eşya düşürme +%100, ~60 dk). Bir üye görüp bildiriyor,
 * herkes uygulamadan öğreniyor.
 */

const KALE_MAX = 60, BUFF_MAX = 80, ETKI_MAX = 120;
/** Oyundaki buff'lar 1 saat civarı; saçma değer girilmesin */
const SURE_MIN_DK = 1, SURE_MAX_DK = 180;

export async function GET(req: Request) {
  return withApp(req, async () => {
    const aktif = await prisma.castleBuff.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: "asc" },
      include: { reporter: { select: { familyName: true } } },
    });
    return NextResponse.json(aktif.map((b) => ({
      id: b.id, castle: b.castle, buff: b.buff, effect: b.effect,
      expiresAt: b.expiresAt, reportedBy: b.reporter.familyName, createdAt: b.createdAt,
    })), { headers: APP_HEADERS });
  });
}

export async function POST(req: Request) {
  return withApp(req, async (me) => {
    const b = (await req.json().catch(() => ({}))) as {
      castle?: string; buff?: string; effect?: string; minutesLeft?: number;
    };
    const castle = String(b.castle ?? "").trim().slice(0, KALE_MAX);
    const buff = String(b.buff ?? "").trim().slice(0, BUFF_MAX);
    const effect = String(b.effect ?? "").trim().slice(0, ETKI_MAX);
    const dk = Number(b.minutesLeft);

    if (!castle || !buff) return NextResponse.json({ error: "Kale ve buff adı gerekli." }, { status: 400 });
    if (!Number.isFinite(dk) || dk < SURE_MIN_DK || dk > SURE_MAX_DK) {
      return NextResponse.json({ error: `Kalan süre ${SURE_MIN_DK}-${SURE_MAX_DK} dakika arası olmalı.` }, { status: 400 });
    }

    // Aynı kalede aktif bir kayıt varsa üstüne yazma, süresini yenile:
    // iki kişi aynı buff'ı görüp bildirince iki bildirim çıkmasın.
    const mevcut = await prisma.castleBuff.findFirst({
      where: { castle, expiresAt: { gt: new Date() } },
    });
    const expiresAt = new Date(Date.now() + dk * 60_000);
    // Yenilemede bos gelen alan oncekini ezmesin: ikinci kisi yalnizca
    // "Aresion, 55 dk" derse ilk kisinin yazdigi etki metni silinmesin.
    const row = mevcut
      ? await prisma.castleBuff.update({
          where: { id: mevcut.id },
          data: {
            buff: buff || mevcut.buff,
            effect: effect || mevcut.effect,
            expiresAt, reportedBy: me.id,
          } })
      : await prisma.castleBuff.create({
          data: { castle, buff, effect, expiresAt, reportedBy: me.id } });

    return NextResponse.json(
      { id: row.id, castle, buff: row.buff, effect: row.effect, expiresAt, updated: !!mevcut },
                             { headers: APP_HEADERS });
  });
}
