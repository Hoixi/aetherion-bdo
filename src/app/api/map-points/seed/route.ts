export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";
import data from "@/data/edania-points.json";
import images from "@/data/edania-images.json";

type RawPoint = {
  category: string; categoryLabel: string; title: string;
  nameKo: string | null; area: string | null;
  gameX: number; gameZ: number; nx: number; ny: number;
};

/**
 * Edania noktalarını içeri alır.
 *
 * Koordinatlar oyunun regionclientdata dosyasından geliyor; nx/ny 256
 * sektörlük dünya karesinde normalize edilmiş değerler. Aynı başlık +
 * konum tekrar tohumlanırsa güncellenir, kopya oluşmaz.
 */
export async function POST() {
  const scope = await getGuildScope();
  if (!scope?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const points = (data as { points: RawPoint[] }).points;
  let created = 0;
  let updated = 0;
  let moved = 0;

  const shots = images as Record<string, string[]>;

  for (const p of points) {
    // Görsel eşleşmesi konum üzerinden — kategori + normalize koordinat
    const shotKey = p.category + "|" + p.nx.toFixed(9) + "|" + p.ny.toFixed(9);
    const shotList = shots[shotKey];
    // Birden çok kare olabiliyor; dizi olarak saklanır
    const imageUrl = shotList?.length ? JSON.stringify(shotList) : null;

    const title = p.nameKo && p.category !== "relic" && p.category !== "trace"
      ? p.nameKo
      : p.title;
    const description = p.area ?? null;

    /*
     * Kimlik konumdan geliyor, kategoriden değil.
     *
     * Oyun bir noktayı yeniden sınıflandırabiliyor — Angavu Öncüsü
     * "üs yöneticisi"yken "görev" oldu. Kategori de eşleşme şartı olsaydı
     * aynı yer iki kayıt hâline gelir, haritada üst üste iki nokta
     * çizilirdi. Böylece kaydın kendisi taşınıyor ve kimin topladığı
     * bilgisi de korunuyor.
     */
    const existing = await prisma.mapPoint.findFirst({
      where: {
        mapX: { gte: p.nx - 1e-9, lte: p.nx + 1e-9 },
        mapY: { gte: p.ny - 1e-9, lte: p.ny + 1e-9 },
      },
      select: { id: true, category: true },
    });

    if (existing) {
      if (existing.category !== p.category) moved++;
      await prisma.mapPoint.update({
        where: { id: existing.id },
        data: { title, description, imageUrl, category: p.category },
      });
      updated++;
    } else {
      await prisma.mapPoint.create({
        data: {
          title, description, category: p.category,
          mapX: p.nx, mapY: p.ny, imageUrl, createdBy: scope.userId,
        },
      });
      created++;
    }
  }

  /*
   * Veride kalmayan noktalar silinmiyor: birileri onları toplamış
   * olabilir ve kayıt silinince tamamlama bilgisi de gidiyor. Bunun
   * yerine sayılıp bildiriliyor, kararı yönetici veriyor.
   */
  const kalanlar = await prisma.mapPoint.count();
  const artik = kalanlar - points.length;

  return NextResponse.json({
    ok: true, total: points.length, created, updated, moved,
    stale: artik > 0 ? artik : 0,
  });
}
