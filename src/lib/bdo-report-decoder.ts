/** Savaş raporu paketi — iki biçim.
 *
 * Ofsetler aile adı alanına göre; satırın başındaki bayt(lar) adın
 * önünde duruyor.
 *
 * v1 (2026-09-24 TR): opcode 0x1a50, 32 baytlık başlık, 333 baytlık
 * satır, ad satırın 1. baytında.
 *
 * v2 (2026-10-08 yaması): opcode 0x146c, 29 baytlık başlık, 323 baytlık
 * satır, ad satırın 8. baytında. Ad ile sayılar arasındaki boşluk 10
 * bayt kısaldığı için bütün sayaçlar **ada göre 14 bayt geri** kaydı.
 * Sınıf baytı ada göre 62'de; spec baytı bu yapıda bulunamadı, bilinmiyor
 * olarak geçiyor (sunucu zaten profildeki spec'e düşüyor). Kalibrasyon
 * 11 Ekim 2026 savaşının ham kaydıyla yapıldı: 22 satırın hepsinde
 * ölü saniye + yaşam saniyesi = 2579 (savaşın süresi) çıkıyor.
 */
export const REPORT_VERSION = "bdo-report-1a50-v1";
export const REPORT_VERSION_V2 = "bdo-report-146c-v2";
/** Companion bu sürümlerden birini gönderebilir */
export const REPORT_VERSIONS = [REPORT_VERSION, REPORT_VERSION_V2];

type Bicim = {
  surum: string;
  opcode: number;
  baslik: number;
  satir: number;
  /** Adın satır içindeki yeri */
  ad: number;
  /** Sayaçların ada göre kayması (v2'de -14) */
  kay: number;
  /** Satır sayısının çerçeve içindeki yeri */
  sayi: number;
  /** Sınıf baytının ada göre yeri */
  sinif: number;
  /** Spec baytının ada göre yeri; yoksa null */
  spec: number | null;
};

const BICIMLER: Bicim[] = [
  { surum: REPORT_VERSION,    opcode: 0x1a50, baslik: 32, satir: 333, ad: 1, kay: 0,   sayi: 24, sinif: 76, spec: 77 },
  { surum: REPORT_VERSION_V2, opcode: 0x146c, baslik: 29, satir: 323, ad: 8, kay: -14, sayi: 23, sinif: 62, spec: null },
];

const invalidNameCharacters = new RegExp("[\\p{Cc}\\p{Cs}]", "u");
export const nameKey = (name: string) => name.normalize("NFC").trim().toLowerCase();

export function decodeReport(frameBase64: unknown, version: unknown) {
  const bicim = BICIMLER.find((b) => b.surum === version);
  if (!bicim) throw new Error("Rapor sürümü desteklenmiyor. Companion'ı güncelleyin.");
  if (typeof frameBase64 !== "string" || frameBase64.length > 90_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(frameBase64)) throw new Error("Geçersiz rapor verisi.");
  const frame = Buffer.from(frameBase64, "base64");
  if (frame.toString("base64") !== frameBase64 || frame.length < bicim.baslik || frame[2] !== 0 || frame.readUInt16LE(3) !== bicim.opcode) throw new Error("Savaş raporu paketi tanınmadı.");
  const count = frame.readUInt32LE(bicim.sayi);
  if (!count || count > 190 || frame.length !== bicim.baslik + count * bicim.satir || frame.readUInt16LE(0) !== frame.length) throw new Error("Rapor eksik veya oyun sürümü farklı.");
  const names = new Set<string>();
  const rows = Array.from({ length: count }, (_, i) => {
    const raw = frame.subarray(bicim.baslik + i * bicim.satir, bicim.baslik + (i + 1) * bicim.satir);
    const b = raw.subarray(bicim.ad);
    const familyName = b.subarray(0, 62).toString("utf16le").split("\0")[0];
    if (!familyName || Array.from(familyName).length > 30 || invalidNameCharacters.test(familyName) || names.has(nameKey(familyName))) throw new Error("Geçersiz veya tekrarlanan oyuncu adı.");
    names.add(nameKey(familyName));
    const q = (offset: number) => {
      // Sayaç ofsetleri v1'e göre yazılı; v2'de hepsi 14 bayt geride.
      const v = b.readBigUInt64LE(offset + bicim.kay);
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Rapor sayısı güvenli aralığın dışında.");
      return Number(v);
    };
    const counters = Object.fromEntries(Array.from({ length: 31 }, (_, i) => [String(80 + i * 8), q(80 + i * 8)]));
    const kills = q(112) + q(128) + q(136);
    const deaths = q(80), deathSeconds = q(312), survivalSeconds = q(320);
    if (kills > 1_000_000 || deaths > 1_000_000 || deathSeconds > 604800 || survivalSeconds > 604800 || [240,264,280].some(o => q(o) > 2_147_483_647)) throw new Error("Rapor alanları beklenen aralıkta değil.");
    return {
      familyName, classKey: b[bicim.sinif], specKey: bicim.spec === null ? 0 : b[bicim.spec],
      stats: { kills, deaths, killStreak: q(264), damageDealt: q(224), damageTaken: q(232),
        ccCount: q(240), hpHeal: q(248), allyHpHeal: q(256), castleDamage: q(272),
        trapExplosions: q(280), deathSeconds, survivalSeconds },
      // Cannon columns 288/296/304 were all zero in calibration; do not guess
      // their order or overwrite existing mapped cannon values with guesses.
      rawRecordBase64: raw.toString("base64"), counters,
    };
  });
  return { rows, headerBase64: frame.subarray(0, bicim.baslik).toString("base64"), version: bicim.surum };
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
