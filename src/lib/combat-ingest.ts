import { createHash } from "node:crypto";

export const COMBAT_VERSION = "bdo-nodewar-11e1-v2";
const GAME_NAME = new RegExp("^[\\p{L}\\p{N}_]+$", "u");
export class CombatInputError extends Error {}
function fail(message: string): never { throw new CombatInputError(message); }
function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) fail("Nesne bekleniyor.");
  return v as Record<string, unknown>;
}
function integer(v: unknown, min: number, max: number): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max) fail("Geçersiz sayı/zaman.");
  return v as number;
}
function text(v: unknown, max: number): string {
  if (typeof v !== "string" || !v.trim() || Array.from(v).length > max) fail("Geçersiz metin.");
  return v as string;
}
export function decodeCombatFrame(raw: unknown) {
  const rawBase64 = text(raw, 480);
  const b = Buffer.from(rawBase64, "base64");
  if (b.length !== 359 || b.toString("base64") !== rawBase64 || !b.subarray(0, 5).equals(Buffer.from([0x67, 1, 0, 0xe1, 0x11]))) fail("Desteklenmeyen feed paketi.");
  function name(off: number) {
    let end = off;
    while (end < off + 62 && b.readUInt16LE(end) !== 0) end += 2;
    if (end === off + 62) fail("Sonlandırılmamış isim.");
    const s = b.subarray(off, end).toString("utf16le");
    if (Array.from(s).length < 2 || Array.from(s).length > 30 || !GAME_NAME.test(s)) fail("Geçersiz oyun ismi.");
    return s;
  }
  const ourCharacter = name(5), opponentGuild = name(72), opponentCharacter = name(134);
  const ourFamily = name(201), opponentFamily = name(263);
  if (ourFamily === opponentFamily) fail("Aynı aile.");
  const ourKill = b.subarray(196, 201).equals(Buffer.from([1, 0, 0, 0, 0]));
  if (!ourKill && b[196] !== 0) fail("Bilinmeyen kill/ölüm yönü.");
  const [gameX, gameY, gameZ] = [334, 338, 342].map(off => b.readFloatLE(off));
  if (![gameX, gameY, gameZ].every(n => Number.isFinite(n) && Math.abs(n) < 10_000_000)) fail("Geçersiz konum.");
  return { rawBase64, rawHash: createHash("sha256").update(b).digest("hex"),
    ourCharacter, opponentGuild, opponentCharacter, ourFamily, opponentFamily, ourKill,
    killerFamily: ourKill ? ourFamily : opponentFamily, victimFamily: ourKill ? opponentFamily : ourFamily,
    gameX, gameY, gameZ, positionVerified: false as const,
    directionFlagHex: b.subarray(196, 201).toString("hex"), tailHex: b.subarray(325).toString("hex") };
}
export function parseCombatBatch(value: unknown, now = Date.now()) {
  const v = object(value);
  const id = text(v.id, 80);
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(id) || v.parserVersion !== COMBAT_VERSION) fail("Geçersiz oturum/parser sürümü.");
  const warId = integer(v.warId, 1, 2147483647);
  const allianceName = text(v.allianceName, 60).trim();
  const startedAtMs = integer(v.startedAtMs, 1_000_000_000_000, now + 300_000);
  if (typeof v.final !== "boolean") fail("Final bayrağı gerekli.");
  const final = v.final;
  const endedAtMs = final ? integer(v.endedAtMs, startedAtMs, Math.min(now + 300_000, startedAtMs + 5 * 3600_000)) : null;
  if (!final && v.endedAtMs !== null) fail("Açık oturumda bitiş zamanı olamaz.");
  const phase = final ? text(v.phase, 20) : "listening";
  if (final && !["stopped", "error", "interrupted"].includes(phase)) fail("Geçersiz bitiş durumu.");
  const throughSeq = integer(v.throughSeq, 0, 5000);
  if (!Array.isArray(v.events) || v.events.length > 100 || (!final && !v.events.length)) fail("Parti 1–100 olay içermeli.");
  const events = v.events.map((raw, i) => {
    const e = object(raw), seq = integer(e.seq, 1, 5000);
    if (seq !== throughSeq - (v.events as unknown[]).length + i + 1) fail("Sıra numaraları ardışık değil.");
    const receivedAtMs = integer(e.receivedAtMs, startedAtMs - 60_000, endedAtMs ?? Math.min(now + 300_000, startedAtMs + 5 * 3600_000));
    return { seq, receivedAtMs, ...decodeCombatFrame(e.rawBase64) };
  });
  return { id, warId, allianceName, parserVersion: COMBAT_VERSION, startedAtMs, endedAtMs, phase, final, throughSeq, events };
}
export type CombatBatch = ReturnType<typeof parseCombatBatch>;
export async function readCombatBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) fail("Veri gerekli.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 128 * 1024) { await reader.cancel(); fail("Parti 128 KB sınırını aşıyor."); }
      chunks.push(value);
    }
    return parseCombatBatch(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } finally { reader.releaseLock(); }
}
