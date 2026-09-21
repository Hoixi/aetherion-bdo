export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { yayinIzniAyarla } from "@/lib/livekit";

/**
 * Konuşma kısıtlı odada yetki ver / al (yönetici).
 *  PUT { roomId, userId, allow }
 * Kişi o an odadaysa izin LiveKit'te anında değişir; sonraki girişlerde
 * anahtar zaten buna göre kesilir.
 */
export async function PUT(req: Request) {
  return withApp(req, async (me) => {
    if (!(me.isAdmin || me.isGuildAdmin)) return appError("Yetki vermek yöneticiye özel.", 403);
    const b = (await req.json().catch(() => ({}))) as { roomId?: number; userId?: number; allow?: boolean };
    const roomId = Number(b.roomId), userId = Number(b.userId);
    if (!Number.isInteger(roomId) || !Number.isInteger(userId)) return appError("roomId ve userId gerekli.", 400);
    const oda = await prisma.voiceRoom.findUnique({ where: { id: roomId }, select: { slug: true, speakRestricted: true } });
    if (!oda) return appError("Oda yok.", 404);
    if (!oda.speakRestricted) return appError("Bu oda kısıtlı değil; herkes konuşabiliyor.", 400);
    if (b.allow) await prisma.voiceRoomSpeaker.upsert({ where: { roomId_userId: { roomId, userId } }, update: {}, create: { roomId, userId } });
    else await prisma.voiceRoomSpeaker.deleteMany({ where: { roomId, userId } });
    await yayinIzniAyarla(`oda-${oda.slug}`, userId, !!b.allow);
    return NextResponse.json({ ok: true, allow: !!b.allow }, { headers: APP_HEADERS });
  });
}
