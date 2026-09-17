export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";
import data from "@/data/edania-points.json";

/** Yeni eklenen noktaların başlıkları — veri dosyasındaki `isNew` bayrağından */
const YENI = new Set((data as { points: Array<{ title: string; isNew?: boolean }> }).points.filter((p) => p.isNew).map((p) => p.title));

/** Bütün noktalar + giriş yapan kullanıcının topladıkları */
export async function GET() {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [points, done] = await Promise.all([
    prisma.mapPoint.findMany({
      select: {
        id: true, title: true, description: true, category: true,
        mapX: true, mapY: true, imageUrl: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.mapPointDone.findMany({
      where: { userId: scope.userId },
      select: { pointId: true },
    }),
  ]);

  return NextResponse.json({ points: points.map((p) => ({ ...p, isNew: YENI.has(p.title) })), done: done.map((d) => d.pointId) });
}
