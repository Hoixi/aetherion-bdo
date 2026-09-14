export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import type { OturumEsya } from "@/lib/grind";

const ESYA_MAX = 200, AD_MAX = 120, IKON_MAX = 300;

/**
 * Nabız / kapanış: uygulama eşya toplamlarını bütün olarak yollar, satırlar
 * baştan yazılır. Artımlı değil: uygulama kaynağı, bir isteğin kaybolması
 * toplamı bozmasın.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  return withApp(req, async (me) => {
    const id = Number(params.id);
    if (!Number.isInteger(id)) return appError("Geçersiz oturum.", 400);
    const oturum = await prisma.grindSession.findFirst({ where: { id, userId: me.id } });
    if (!oturum) return appError("Oturum bulunamadı.", 404);
    if (oturum.endedAt) return appError("Oturum kapanmış.", 409);

    const b = (await req.json().catch(() => ({}))) as {
      durationSec?: number; drops?: number; ended?: boolean; items?: Partial<OturumEsya>[];
    };
    const durationSec = Math.max(0, Math.min(24 * 3600, Math.floor(Number(b.durationSec) || 0)));
    const drops = Math.max(0, Math.floor(Number(b.drops) || 0));
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, ESYA_MAX)
      .filter((i) => Number.isInteger(i.itemId) && typeof i.name === "string")
      .map((i) => ({
        sessionId: id, itemId: Number(i.itemId),
        name: String(i.name).slice(0, AD_MAX),
        grade: Math.max(0, Math.min(9, Math.floor(Number(i.grade) || 0))),
        icon: String(i.icon ?? "").slice(0, IKON_MAX),
        quantity: Math.max(0, Math.floor(Number(i.quantity) || 0)),
        drops: Math.max(0, Math.floor(Number(i.drops) || 0)),
      }));
    // Aynı eşya iki kez gelirse birincil anahtar patlamasın
    const tekil = Array.from(new Map(items.map((i) => [i.itemId, i])).values());

    const simdi = new Date();
    await prisma.$transaction([
      prisma.grindSessionItem.deleteMany({ where: { sessionId: id } }),
      ...(tekil.length ? [prisma.grindSessionItem.createMany({ data: tekil })] : []),
      prisma.grindSession.update({
        where: { id },
        data: { durationSec, drops, lastSeenAt: simdi, endedAt: b.ended ? simdi : null },
      }),
    ]);
    return NextResponse.json({ ok: true, ended: !!b.ended }, { headers: APP_HEADERS });
  });
}
