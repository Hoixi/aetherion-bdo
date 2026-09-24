/** Complete 0x1a50 response, calibrated against TR report on 2026-09-24.
 * Offsets below are relative to the family-name field, one byte into each row.
 * Keep all bytes/counters so unlabelled fields can be decoded in later versions.
 */
export const REPORT_VERSION = "bdo-report-1a50-v1";
const invalidNameCharacters = new RegExp("[\\p{Cc}\\p{Cs}]", "u");
export const nameKey = (name: string) => name.normalize("NFC").trim().toLowerCase();
export function decodeReport(frameBase64: unknown, version: unknown) {
  if (version !== REPORT_VERSION) throw new Error("Rapor sürümü desteklenmiyor. Companion'ı güncelleyin.");
  if (typeof frameBase64 !== "string" || frameBase64.length > 90_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(frameBase64)) throw new Error("Geçersiz rapor verisi.");
  const frame = Buffer.from(frameBase64, "base64");
  if (frame.toString("base64") !== frameBase64 || frame.length < 32 || frame[2] !== 0 || frame.readUInt16LE(3) !== 0x1a50) throw new Error("Savaş raporu paketi tanınmadı.");
  const count = frame.readUInt32LE(24);
  if (!count || count > 190 || frame.length !== 32 + count * 333 || frame.readUInt16LE(0) !== frame.length) throw new Error("Rapor eksik veya oyun sürümü farklı.");
  const names = new Set<string>();
  const rows = Array.from({ length: count }, (_, i) => {
    const raw = frame.subarray(32 + i * 333, 32 + (i + 1) * 333);
    const b = raw.subarray(1);
    const familyName = b.subarray(0, 62).toString("utf16le").split("\0")[0];
    if (!familyName || Array.from(familyName).length > 30 || invalidNameCharacters.test(familyName) || names.has(nameKey(familyName))) throw new Error("Geçersiz veya tekrarlanan oyuncu adı.");
    names.add(nameKey(familyName));
    const q = (offset: number) => {
      const v = b.readBigUInt64LE(offset);
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Rapor sayısı güvenli aralığın dışında.");
      return Number(v);
    };
    const counters = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [String(80 + i * 8), q(80 + i * 8)]));
    const kills = q(112) + q(128) + q(136);
    const deaths = q(80), deathSeconds = q(312), survivalSeconds = q(320);
    if (kills > 1_000_000 || deaths > 1_000_000 || deathSeconds > 604800 || survivalSeconds > 604800 || [240,264,280].some(o => q(o) > 2_147_483_647)) throw new Error("Rapor alanları beklenen aralıkta değil.");
    return {
      familyName, classKey: b[76], specKey: b[77],
      stats: { kills, deaths, killStreak: q(264), damageDealt: q(224), damageTaken: q(232),
        ccCount: q(240), hpHeal: q(248), allyHpHeal: q(256), castleDamage: q(272),
        trapExplosions: q(280), deathSeconds, survivalSeconds },
      // Cannon columns 288/296/304 were all zero in calibration; do not guess
      // their order or overwrite existing mapped cannon values with guesses.
      rawRecordBase64: raw.toString("base64"), counters,
    };
  });
  return { rows, headerBase64: frame.subarray(0,32).toString("base64"), version: REPORT_VERSION };
}
export type DecodedReport = ReturnType<typeof decodeReport>;

export class ReportConflict extends Error {}
/** Snapshot merge: replace matching rows, never sum, delete, or penalize absent players. */
export function reportMergePlan(
  incoming: DecodedReport["rows"],
  existing: Array<{ id: number; inGameName: string; reportGuildId: number | null; userId: number | null }>,
  users: Array<{ id: number; familyName: string; guildId: number | null }>,
  actor: { guildId: number | null; isAdmin: boolean },
) {
  const byName = new Map(existing.map(r => [nameKey(r.inGameName), r]));
  if (byName.size !== existing.length) throw new ReportConflict("Mevcut raporda aynı adın farklı yazımları var; önce birleştirilmeliler.");
  return incoming.map(row => {
    const matches = users.filter(u => nameKey(u.familyName) === nameKey(row.familyName));
    if (matches.length > 1) throw new ReportConflict(`Birden fazla hesap eşleşti: ${row.familyName}`);
    const user = matches[0];
    const previous = byName.get(nameKey(row.familyName));
    const previousUser = previous?.userId ? users.find(u => u.id === previous.userId) : undefined;
    if (!actor.isAdmin && ((user && user.guildId !== actor.guildId) || (previousUser && previousUser.guildId !== actor.guildId))) throw new ReportConflict(`Başka klanın oyuncusu güncellenemez: ${row.familyName}`);
    if (previous?.reportGuildId != null && previous.reportGuildId !== actor.guildId) throw new ReportConflict(`Bu oyuncunun raporu başka klan tarafından yüklendi: ${row.familyName}`);
    return { row, previous, user };
  });
}
