export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";

/**
 * Tek günlük: olaylar + kişi başı özet için ham liste.
 *  GET    → günlük + olaylar
 *  DELETE → yükleyen ya da yönetici siler
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApp(req, async () => {
    const log = await prisma.combatLog.findUnique({
      where: { id: Number(params.id) },
      select: {
        id: true, warId: true, title: true, source: true, startedAt: true, endedAt: true, createdAt: true,
        uploader: { select: { id: true, familyName: true } },
        war: { select: { id: true, title: true, date: true } },
        kills: {
          orderBy: { at: "asc" },
          select: { id: true, at: true, killerName: true, victimName: true, guildName: true, killerUserId: true, victimUserId: true },
        },
      },
    });
    if (!log) return appError("Günlük bulunamadı.", 404);
    return NextResponse.json(log, { headers: APP_HEADERS });
  });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  return withApp(req, async (me) => {
    const log = await prisma.combatLog.findUnique({ where: { id: Number(params.id) }, select: { uploadedBy: true } });
    if (!log) return NextResponse.json({ ok: true }, { headers: APP_HEADERS });
    if (log.uploadedBy !== me.id && !me.isAdmin && !me.isGuildAdmin) return appError("Bu günlük senin değil.", 403);
    await prisma.combatLog.delete({ where: { id: Number(params.id) } });
    return NextResponse.json({ ok: true }, { headers: APP_HEADERS });
  });
}
