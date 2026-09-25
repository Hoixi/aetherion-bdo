import { NextResponse } from "next/server";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { prisma } from "@/lib/prisma";
import { canAccessCombat } from "@/lib/combat-session-store";
export { OPTIONS } from "@/lib/app-gate";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { id: string; sessionId: string } }) {
  if (process.env.ENABLE_COMBAT_SYNC !== "1") return appError("Kill-feed aktarımı kapalı.", 503);
  return withApp(req, async me => {
    const warId = Number(params.id);
    if (!await canAccessCombat(me, warId)) return appError("Bu savaşı inceleme yetkiniz yok.", 403);
    if (params.sessionId.length > 100) return appError("Geçersiz oturum.", 400);
    const s = await prisma.combatSession.findFirst({ where: { id: params.sessionId, warId }, select: { id: true, lastSeq: true, phase: true } });
    if (!s) return appError("Kayıt bulunamadı.", 404);
    const query = new URL(req.url).searchParams, after = Number(query.get("after") ?? 0);
    if (!Number.isSafeInteger(after) || after < 0 || after > 5000) return appError("Geçersiz olay imleci.", 400);
    const rows = await prisma.combatEvent.findMany({ where: { sessionId: s.id, seq: { gt: after } }, orderBy: { seq: "asc" }, take: 251 });
    // Raw packet is opt-in; rawHash permits comparison across recorders without assuming equivalence.
    const events = rows.slice(0, 250).map(({ rawBase64, ...e }) => ({ ...e,
      ...(query.get("raw") === "1" ? { rawBase64 } : {}),
      mapRow: { time: e.receivedAt.toISOString(), fields: [
        { off: 5, text: e.ourCharacter }, { off: 72, text: e.opponentGuild },
        { off: 134, text: e.opponentCharacter }, { off: 201, text: e.ourFamily }, { off: 263, text: e.opponentFamily },
      ], flags: { at196: e.directionFlagHex }, floatCandidates: [e.gameX, e.gameY, e.gameZ], tailHex: e.tailHex, positionVerified: false },
    }));
    return NextResponse.json({ session: s, events, nextCursor: rows.length > 250 ? rows[249].seq : null }, { headers: APP_HEADERS });
  });
}
