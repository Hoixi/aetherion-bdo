export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";

const KARAKTER_MAX = 40, SINIF_MAX = 30;

/**
 * Oturum aç. Kullanıcının açık kalmış eski oturumu varsa (uygulama çöktü,
 * kapanış gelmedi) son nabzıyla kapatılır: bir kişinin aynı anda iki canlı
 * oturumu olmaz.
 */
export async function POST(req: Request) {
  return withApp(req, async (me) => {
    const b = (await req.json().catch(() => ({}))) as { spotId?: number; character?: string; class?: string };
    const spotId = Number.isInteger(b.spotId) ? Number(b.spotId) : null;
    if (spotId !== null) {
      const spot = await prisma.grindSpot.findFirst({ where: { id: spotId, active: true } });
      if (!spot) return appError("Spot bulunamadı.", 400);
    }
    const acik = await prisma.grindSession.findMany({
      where: { userId: me.id, endedAt: null }, select: { id: true, lastSeenAt: true },
    });
    for (const o of acik) await prisma.grindSession.update({ where: { id: o.id }, data: { endedAt: o.lastSeenAt } });

    const row = await prisma.grindSession.create({
      data: {
        userId: me.id, spotId,
        character: String(b.character ?? "").trim().slice(0, KARAKTER_MAX),
        class: String(b.class ?? me.class ?? "").trim().slice(0, SINIF_MAX),
      },
    });
    return NextResponse.json({ id: row.id, startedAt: row.startedAt }, { headers: APP_HEADERS });
  });
}
