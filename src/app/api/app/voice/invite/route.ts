export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";

/**
 * Parti sesine misafir çağır. Çağıran kendi partisinde olmalı (ya da
 * yönetici); çağrılan kişi bu savaşta o partide değilse davet yazılır.
 * Davetli, token ucundan o odaya girebilir; olay akışında `voice_invite`
 * olarak görür.
 */
export async function POST(req: Request) {
  return withApp(req, async (me) => {
    const b = (await req.json().catch(() => ({}))) as { warId?: number; userId?: number };
    const warId = Number(b.warId), userId = Number(b.userId);
    if (!Number.isInteger(warId) || !Number.isInteger(userId)) return appError("warId ve userId gerekli.", 400);
    if (userId === me.id) return appError("Kendini davet edemezsin.", 400);

    const war = await prisma.war.findUnique({
      where: { id: warId },
      select: { id: true, date: true, parties: { select: { id: true, name: true, members: { select: { userId: true } } } } },
    });
    if (!war) return appError("Savaş bulunamadı.", 404);
    if (Date.now() - war.date.getTime() > 6 * 3600_000) return appError("Bu savaşın sesi kapandı.", 410);
    const parti = war.parties.find((p) => p.members.some((m) => m.userId === me.id));
    if (!parti) return appError("Bu savaşta bir partide değilsin.", 403);
    if (parti.members.some((m) => m.userId === userId)) return appError("Zaten bu partide.", 400);

    const hedef = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, familyName: true } });
    if (!hedef) return appError("Üye bulunamadı.", 404);

    await prisma.voiceInvite.upsert({
      where: { warId_partyId_userId: { warId, partyId: parti.id, userId } },
      update: { invitedBy: me.id, createdAt: new Date() },
      create: { warId, partyId: parti.id, userId, invitedBy: me.id },
    });
    return NextResponse.json({ ok: true, party: parti.name, user: hedef.familyName }, { headers: APP_HEADERS });
  });
}

/** Daveti geri al */
export async function DELETE(req: Request) {
  return withApp(req, async (me) => {
    const url = new URL(req.url);
    const warId = Number(url.searchParams.get("warId")), userId = Number(url.searchParams.get("userId"));
    if (!Number.isInteger(warId) || !Number.isInteger(userId)) return appError("warId ve userId gerekli.", 400);
    await prisma.voiceInvite.deleteMany({ where: { warId, userId, OR: [{ invitedBy: me.id }, { userId: me.id }] } });
    return NextResponse.json({ ok: true }, { headers: APP_HEADERS });
  });
}
