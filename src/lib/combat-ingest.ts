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
/**
 * Kill-feed çerçevesinin iki yerleşimi.
 *
 * 8 Ekim 2026 yaması opcode'u 0x11e1'den 0x1bfd'ye, kareyi 359'dan 363
 * bayta çıkardı ve aile alanlarının sırasını değiştirdi (artık önce
 * rakip geliyor). Companion ikisini de çözüyor; sunucu da çözmeli,
 * yoksa yeni sürümün yakaladığı paketler "desteklenmeyen" diye geri
 * çevrilir ve kayıt uygulamanın yerel kuyruğunda kalır.
 *
 * Tablo Companion'daki `combat_capture.rs` ile birebir aynı; biri
 * değişince diğeri de değişmeli.
 */
interface Bicim {
  ad: string; uzunluk: number; imza: number[];
  karakter: number; rakipKarakter: number; rakipKlan: number;
  bizAile: number; rakipAile: number;
  yon: number; yonBayt: number;
  konum: [number, number, number]; kuyruk: number;
}
const BICIMLER: Bicim[] = [
  { ad: "11e1", uzunluk: 359, imza: [0x67, 1, 0, 0xe1, 0x11],
    karakter: 5, rakipKlan: 72, rakipKarakter: 134, yon: 196, yonBayt: 5,
    bizAile: 201, rakipAile: 263, konum: [334, 338, 342], kuyruk: 325 },
  { ad: "1bfd", uzunluk: 363, imza: [0x6b, 1, 0, 0xfd, 0x1b],
    karakter: 9, yon: 77, yonBayt: 1, rakipKarakter: 78, rakipKlan: 140,
    rakipAile: 204, bizAile: 266, konum: [350, 354, 358], kuyruk: 328 },
];
/** 363 bayt base64'te 484 karakter; eski 480'lik sınır yeni kareyi kesiyordu. */
const EN_UZUN_B64 = 496;

export function decodeCombatFrame(raw: unknown) {
  const rawBase64 = text(raw, EN_UZUN_B64);
  const b = Buffer.from(rawBase64, "base64");
  if (b.toString("base64") !== rawBase64) fail("Desteklenmeyen feed paketi.");
  const f = BICIMLER.find(x => b.length === x.uzunluk && b.subarray(0, 5).equals(Buffer.from(x.imza)));
  if (!f) fail("Desteklenmeyen feed paketi.");
  function name(off: number) {
    let end = off;
    while (end < off + 62 && b.readUInt16LE(end) !== 0) end += 2;
    if (end === off + 62) fail("Sonlandırılmamış isim.");
    const s = b.subarray(off, end).toString("utf16le");
    if (Array.from(s).length < 2 || Array.from(s).length > 30 || !GAME_NAME.test(s)) fail("Geçersiz oyun ismi.");
    return s;
  }
  const ourCharacter = name(f.karakter), opponentGuild = name(f.rakipKlan), opponentCharacter = name(f.rakipKarakter);
  const ourFamily = name(f.bizAile), opponentFamily = name(f.rakipAile);
  if (ourFamily === opponentFamily) fail("Aynı aile.");
  const bayrak = b.subarray(f.yon, f.yon + f.yonBayt);
  const ourKill = bayrak.equals(Buffer.from([1, ...Array(f.yonBayt - 1).fill(0)]));
  if (!ourKill && b[f.yon] !== 0) fail("Bilinmeyen kill/ölüm yönü.");
  const [gameX, gameY, gameZ] = f.konum.map(off => b.readFloatLE(off));
  if (![gameX, gameY, gameZ].every(n => Number.isFinite(n) && Math.abs(n) < 10_000_000)) fail("Geçersiz konum.");
  return { rawBase64, rawHash: createHash("sha256").update(b).digest("hex"),
    ourCharacter, opponentGuild, opponentCharacter, ourFamily, opponentFamily, ourKill,
    killerFamily: ourKill ? ourFamily : opponentFamily, victimFamily: ourKill ? opponentFamily : ourFamily,
    gameX, gameY, gameZ, positionVerified: false as const,
    directionFlagHex: bayrak.toString("hex"), tailHex: b.subarray(f.kuyruk).toString("hex") };
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
