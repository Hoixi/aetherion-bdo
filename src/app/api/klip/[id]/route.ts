export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { videoGetir, videoSil } from "@/lib/bunny";
import { klipOzet } from "../route";

/** Tek klip: bilgi güncelleme, silme ve kodlama durumunu tazeleme. */

const SECIM = {
  id: true, bunnyId: true, baslik: true, aciklama: true, durum: true, saniye: true,
  izlenme: true, etiket: true, createdAt: true,
  yukleyen: { select: { id: true, familyName: true, avatarUrl: true } },
  war: { select: { id: true, title: true } },
} as const;

/**
 * Kodlama durumunu Bunny'den tazeler.
 *
 * Normalde webhook haber veriyor; gelmezse (ağ, yeniden kurulum) klip
 * sonsuza kadar "işleniyor" görünmesin diye arşiv açılırken bekleyen
 * kliplerde bu çağrılıyor.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const id = Number(params.id);
  const klip = await prisma.klip.findUnique({ where: { id }, select: SECIM });
  if (!klip) return NextResponse.json({ error: "Klip yok" }, { status: 404 });

  if (klip.durum < 4) {
    try {
      const v = await videoGetir(klip.bunnyId);
      if (v.status !== klip.durum || v.length !== klip.saniye) {
        const guncel = await prisma.klip.update({
          where: { id },
          data: { durum: v.status, saniye: Math.round(v.length ?? 0) },
          select: SECIM,
        });
        return NextResponse.json({ klip: klipOzet(guncel) });
      }
    } catch {
      // Bunny'ye ulaşılamadıysa elimizdekini döndür
    }
  }
  return NextResponse.json({ klip: klipOzet(klip) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const id = Number(params.id);
  const klip = await prisma.klip.findUnique({ where: { id }, select: { yukleyenId: true } });
  if (!klip) return NextResponse.json({ error: "Klip yok" }, { status: 404 });
  // Kendi klibini düzenleyebilirsin; yönetici hepsini
  if (klip.yukleyenId !== session.user.id && !session.user.canManageWars) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { baslik, aciklama, warId, etiket, izlendi } = await req.json().catch(() => ({}));

  // Oynatma sayacı: kimlik doğrulaması dışında bir şey değiştirmiyor
  if (izlendi) {
    await prisma.klip.update({ where: { id }, data: { izlenme: { increment: 1 } } });
    return NextResponse.json({ ok: true });
  }

  const guncel = await prisma.klip.update({
    where: { id },
    data: {
      ...(baslik !== undefined ? { baslik: String(baslik).trim().slice(0, 120) || "Klip" } : {}),
      ...(aciklama !== undefined ? { aciklama: String(aciklama).trim().slice(0, 600) || null } : {}),
      ...(etiket !== undefined ? { etiket: String(etiket).trim().slice(0, 60) || null } : {}),
      ...(warId !== undefined
        ? { warId: Number.isSafeInteger(Number(warId)) && Number(warId) > 0 ? Number(warId) : null }
        : {}),
    },
    select: SECIM,
  });
  return NextResponse.json({ klip: klipOzet(guncel) });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const id = Number(params.id);
  const klip = await prisma.klip.findUnique({ where: { id }, select: { bunnyId: true, yukleyenId: true } });
  if (!klip) return NextResponse.json({ error: "Klip yok" }, { status: 404 });
  if (klip.yukleyenId !== session.user.id && !session.user.canManageWars) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  /*
    Önce Bunny'den, sonra kayıttan. Ters sırada silseydik Bunny çağrısı
    patladığında video orada öksüz kalır, kimse bulamaz ama depolama
    ücreti işlemeye devam ederdi.
  */
  try {
    await videoSil(klip.bunnyId);
  } catch {
    return NextResponse.json({ error: "Video servisinden silinemedi." }, { status: 502 });
  }
  await prisma.klip.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

/** Oynatma sayacı — giriş yapan herkes artırabilir */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });
  await prisma.klip.update({
    where: { id: Number(params.id) },
    data: { izlenme: { increment: 1 } },
  }).catch(() => {});
  return NextResponse.json({ ok: true });
}
