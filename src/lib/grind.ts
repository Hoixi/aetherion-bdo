import { prisma } from "@/lib/prisma";

/**
 * Grind oturumları — uygulama yazar, site okur.
 *
 * Oturum "canlı" sayılır: kapanmamış ve son 3 dakikada nabız gelmiş.
 * Uygulama kapanınca/çökünce nabız kesilir; kapanış isteği gelmese de
 * canlı listeden düşer, süre olarak son nabız esas alınır.
 */
export const CANLI_ESIK_MS = 3 * 60_000;
/** İstatistiğe girecek oturum en az bu kadar sürmüş olsun; deneme açılışları ortalamayı bozmasın */
export const ISTATISTIK_MIN_SN = 10 * 60;

export interface OturumEsya { itemId: number; name: string; grade: number; icon: string; quantity: number; drops: number }

export async function aktifSpotlar() {
  return prisma.grindSpot.findMany({ where: { active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
}

const OTURUM_SECIM = {
  id: true, character: true, class: true, startedAt: true, lastSeenAt: true, endedAt: true,
  durationSec: true, drops: true,
  user: { select: { id: true, familyName: true, class: true, avatarUrl: true } },
  spot: { select: { id: true, name: true } },
  items: { orderBy: { quantity: "desc" as const } },
};

export type OturumKaydi = Awaited<ReturnType<typeof sonOturumlar>>[number];

/** Spot bazlı (veya hepsi) son oturumlar */
export async function sonOturumlar(spotId: number | null, limit = 30) {
  return prisma.grindSession.findMany({
    where: spotId ? { spotId } : {},
    orderBy: { startedAt: "desc" },
    take: limit,
    select: OTURUM_SECIM,
  });
}

export const canliMi = (o: { endedAt: Date | null; lastSeenAt: Date }, simdi = Date.now()) =>
  !o.endedAt && simdi - o.lastSeenAt.getTime() < CANLI_ESIK_MS;

/**
 * Spot istatistiği: eşya başına saatlik ortalama (son 30 gün, en az 10
 * dakikalık oturumlar). Oturum toplamları / toplam saat — kısa bir oturumun
 * şanslı düşüşü uzun oturumlarla dengelenir.
 */
export async function spotIstatistigi(spotId: number) {
  const since = new Date(Date.now() - 30 * 24 * 3600_000);
  const oturumlar = await prisma.grindSession.findMany({
    where: { spotId, startedAt: { gte: since }, durationSec: { gte: ISTATISTIK_MIN_SN } },
    select: { durationSec: true, drops: true, userId: true, items: true },
  });
  const saat = oturumlar.reduce((a, o) => a + o.durationSec, 0) / 3600;
  const esya = new Map<number, { itemId: number; name: string; grade: number; icon: string; quantity: number }>();
  for (const o of oturumlar) for (const i of o.items) {
    const e = esya.get(i.itemId) ?? { itemId: i.itemId, name: i.name, grade: i.grade, icon: i.icon, quantity: 0 };
    e.quantity += i.quantity; esya.set(i.itemId, e);
  }
  return {
    oturum: oturumlar.length,
    kisi: new Set(oturumlar.map((o) => o.userId)).size,
    saat,
    esyalar: Array.from(esya.values()).sort((a, b) => b.quantity - a.quantity)
      .map((e) => ({ ...e, saatlik: saat ? e.quantity / saat : 0 })),
  };
}
