export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bunnyHazir, videoOlustur, yuklemeIzni, oynatici, gorseller } from "@/lib/bunny";

/**
 * Klip arşivi.
 *
 * GET  — arşivi listeler.
 * POST — Bunny'de boş bir video açar, kaydı oluşturur ve tarayıcıya
 *        imzalı yükleme izni döndürür. Dosyanın kendisi buradan
 *        geçmiyor; tarayıcı doğrudan Bunny'ye yüklüyor.
 */

export type KlipOzet = {
  id: number;
  baslik: string;
  aciklama: string | null;
  durum: number;
  saniye: number;
  izlenme: number;
  etiket: string | null;
  tarih: string;
  kapak: string;
  oynatici: string;
  yukleyen: { id: number; familyName: string; avatarUrl: string };
  savas: { id: number; title: string } | null;
};

const SECIM = {
  id: true, bunnyId: true, baslik: true, aciklama: true, durum: true, saniye: true,
  izlenme: true, etiket: true, createdAt: true,
  yukleyen: { select: { id: true, familyName: true, avatarUrl: true } },
  war: { select: { id: true, title: true } },
} as const;

type Satir = {
  id: number; bunnyId: string; baslik: string; aciklama: string | null; durum: number;
  saniye: number; izlenme: number; etiket: string | null; createdAt: Date;
  yukleyen: { id: number; familyName: string; avatarUrl: string };
  war: { id: number; title: string } | null;
};

export function klipOzet(k: Satir): KlipOzet {
  return {
    id: k.id, baslik: k.baslik, aciklama: k.aciklama, durum: k.durum, saniye: k.saniye,
    izlenme: k.izlenme, etiket: k.etiket, tarih: k.createdAt.toISOString(),
    kapak: gorseller(k.bunnyId).kapak,
    oynatici: oynatici(k.bunnyId),
    yukleyen: k.yukleyen,
    savas: k.war,
  };
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const warId = Number(q.get("savas"));
  const etiket = q.get("etiket");

  const klipler = await prisma.klip.findMany({
    where: {
      ...(Number.isSafeInteger(warId) && warId > 0 ? { warId } : {}),
      ...(etiket ? { etiket } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: SECIM,
  });

  // Etiket süzgeci için mevcut etiketler
  const etiketler = await prisma.klip.groupBy({
    by: ["etiket"],
    _count: { etiket: true },
    orderBy: { _count: { etiket: "desc" } },
  });

  return NextResponse.json({
    klipler: klipler.map(klipOzet),
    etiketler: etiketler.filter((e) => e.etiket).map((e) => ({ ad: e.etiket!, adet: e._count.etiket })),
  });
}

/** Yüklemeye başlamadan önce: Bunny'de yer aç, imzayı ver */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });
  if (!bunnyHazir()) {
    return NextResponse.json({ error: "Video servisi henüz ayarlanmadı." }, { status: 503 });
  }

  const { baslik, aciklama, warId, etiket } = await req.json().catch(() => ({}));
  const ad = String(baslik ?? "").trim();
  if (ad.length < 2) return NextResponse.json({ error: "Başlık gerekli." }, { status: 400 });

  /*
    Günlük yükleme sınırı: arşiv paylaşılan bir depolama alanı ve
    maliyeti gigabayt başına. Tek kişinin bir gecede doldurmasını
    engelliyor, normal kullanımda kimseye değmiyor.
  */
  const bugun = new Date(Date.now() - 24 * 3600 * 1000);
  const sonGun = await prisma.klip.count({
    where: { yukleyenId: session.user.id, createdAt: { gt: bugun } },
  });
  if (sonGun >= 10 && !session.user.canManageWars) {
    return NextResponse.json({ error: "Günde en fazla 10 klip yükleyebilirsin." }, { status: 429 });
  }

  let guid: string;
  try {
    guid = await videoOlustur(ad);
  } catch {
    return NextResponse.json({ error: "Video servisine ulaşılamadı." }, { status: 502 });
  }

  const klip = await prisma.klip.create({
    data: {
      bunnyId: guid,
      baslik: ad.slice(0, 120),
      aciklama: aciklama ? String(aciklama).trim().slice(0, 600) || null : null,
      etiket: etiket ? String(etiket).trim().slice(0, 60) || null : null,
      warId: Number.isSafeInteger(Number(warId)) && Number(warId) > 0 ? Number(warId) : null,
      yukleyenId: session.user.id,
    },
    select: SECIM,
  });

  return NextResponse.json({ klip: klipOzet(klip), izin: yuklemeIzni(guid) });
}
