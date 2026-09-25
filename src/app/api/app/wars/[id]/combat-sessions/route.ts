import { NextResponse } from "next/server";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { prisma } from "@/lib/prisma";
import { readCombatBody } from "@/lib/combat-ingest";
import { canAccessCombat, storeCombatBatch, CombatConflict } from "@/lib/combat-session-store";
export { OPTIONS } from "@/lib/app-gate";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: { id: string } };

export async function POST(req: Request, { params }: Context) {
  if (process.env.ENABLE_COMBAT_SYNC !== "1") return appError("Kill-feed aktarımı henüz açılmadı; kayıt yerel kuyrukta korunuyor.", 503);
  return withApp(req, async me => {
    const warId = Number(params.id);
    if (!await canAccessCombat(me, warId)) return appError("Bu savaşa kayıt yükleme yetkiniz yok.", 403);
    let b;
    try { b = await readCombatBody(req); } catch (e) { return appError(e instanceof Error ? e.message : "Geçersiz parti.", 400); }
    if (b.warId !== warId) return appError("Savaş kimliği uyuşmuyor.", 409);
    try { return NextResponse.json(await storeCombatBatch(me, b), { headers: APP_HEADERS }); }
    catch (e) { return appError(e instanceof CombatConflict ? e.message : "Kayıt saklanamadı; yerel kuyruk korunmalı.", e instanceof CombatConflict ? 409 : 500); }
  });
}
export async function GET(req: Request, { params }: Context) {
  if (process.env.ENABLE_COMBAT_SYNC !== "1") return appError("Kill-feed aktarımı kapalı.", 503);
  return withApp(req, async me => {
    const warId = Number(params.id);
    if (!await canAccessCombat(me, warId)) return appError("Bu savaşı inceleme yetkiniz yok.", 403);
    const after = new URL(req.url).searchParams.get("after");
    if (after && (after.length > 100 || !await prisma.combatSession.findFirst({ where: { id: after, warId }, select: { id: true } }))) return appError("Geçersiz sayfa imleci.", 400);
    const rows = await prisma.combatSession.findMany({ where: { warId }, orderBy: { id: "asc" }, take: 51,
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      select: { id: true, clientSessionId: true, warId: true, allianceName: true, recordedGuildId: true,
        parserVersion: true, startedAt: true, endedAt: true, phase: true, lastSeq: true, updatedAt: true,
        uploader: { select: { id: true, familyName: true } } } });
    return NextResponse.json({ sessions: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null }, { headers: APP_HEADERS });
  });
}
