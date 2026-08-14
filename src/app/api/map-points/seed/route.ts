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

    // Konum kimliği: aynı kategoride aynı yerdeki nokta aynı kayıttır
    const existing = await prisma.mapPoint.findFirst({
      where: {
        category: p.category,
        mapX: { gte: p.nx - 1e-9, lte: p.nx + 1e-9 },
        mapY: { gte: p.ny - 1e-9, lte: p.ny + 1e-9 },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.mapPoint.update({
        where: { id: existing.id },
        data: { title, description, imageUrl },
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

  return NextResponse.json({ ok: true, total: points.length, created, updated });
}
