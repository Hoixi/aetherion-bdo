import { prisma } from "@/lib/prisma";
import type { AppActor } from "@/lib/app-auth";
import { canImportReports, reportWarScope } from "@/lib/bdo-report-import";
import type { CombatBatch } from "./combat-ingest";

export class CombatConflict extends Error {}
export async function canAccessCombat(me: AppActor, warId: number) {
  if (!Number.isSafeInteger(warId) || warId < 1 || warId > 2147483647 || !await canImportReports(me)) return false;
  return !!await prisma.war.findFirst({ where: { id: warId, ...await reportWarScope(me) }, select: { id: true } });
}
export async function storeCombatBatch(me: AppActor, b: CombatBatch) {
  const id = `${me.id}:${b.id}`;
  return prisma.$transaction(async tx => {
    // Also serializes first inserts. Never replace another recorder's session or a report.
    await tx.$queryRaw`SELECT id FROM wars WHERE id = ${b.warId} FOR UPDATE`;
    let s = await tx.combatSession.findUnique({ where: { id } });
    if (s && (s.warId !== b.warId || s.startedAt.getTime() !== b.startedAtMs || s.allianceName !== b.allianceName || s.parserVersion !== b.parserVersion)) throw new CombatConflict("Oturum başka veriyle zaten kayıtlı.");
    if (!s) {
      if ((b.events[0]?.seq ?? b.throughSeq + 1) !== 1) throw new CombatConflict("Oturum ilk sıradan başlamalı.");
      s = await tx.combatSession.create({ data: { id, clientSessionId: b.id, warId: b.warId,
        uploadedBy: me.id, recordedGuildId: me.guildId, allianceName: b.allianceName,
        parserVersion: b.parserVersion, startedAt: new Date(b.startedAtMs) } });
    }
    const previous = b.events.length ? await tx.combatEvent.findMany({ where: { sessionId: id, seq: { gte: b.events[0].seq, lte: b.throughSeq } }, select: { seq: true, rawBase64: true, receivedAt: true } }) : [];
    const known = new Map(previous.map(e => [e.seq, e]));
    for (const e of b.events) {
      const old = known.get(e.seq);
      if (e.seq <= s.lastSeq && (!old || old.rawBase64 !== e.rawBase64 || old.receivedAt.getTime() !== e.receivedAtMs)) throw new CombatConflict("Aynı sıra numarası farklı olay içeriyor.");
    }
    const fresh = b.events.filter(e => e.seq > s.lastSeq);
    if (fresh.length && (s.endedAt || fresh[0].seq !== s.lastSeq + 1)) throw new CombatConflict("Kayıt kapalı veya sıra eksik.");
    if (!fresh.length && b.throughSeq > s.lastSeq) throw new CombatConflict("Eksik olaylar var.");
    if (b.final && (b.throughSeq < s.lastSeq || (s.endedAt && (s.endedAt.getTime() !== b.endedAtMs || s.phase !== b.phase)))) throw new CombatConflict("Bitiş verisi uyuşmuyor.");
    if (b.final) {
      const latest = await tx.combatEvent.aggregate({ where: { sessionId: id }, _max: { receivedAt: true } });
      if (latest._max.receivedAt && latest._max.receivedAt.getTime() > b.endedAtMs!) throw new CombatConflict("Bitiş zamanı olaylardan önce.");
    }
    if (fresh.length) await tx.combatEvent.createMany({ data: fresh.map(({ receivedAtMs, ...e }) => ({ ...e, sessionId: id, receivedAt: new Date(receivedAtMs) })) });
    if (fresh.length || b.final) await tx.combatSession.update({ where: { id }, data: {
      lastSeq: Math.max(s.lastSeq, b.throughSeq),
      ...(b.final ? { endedAt: new Date(b.endedAtMs!), phase: b.phase } : {}),
    } });
    return { sessionId: id, id: b.id, throughSeq: b.throughSeq, final: b.final };
  }, { maxWait: 10000, timeout: 20000 });
}
