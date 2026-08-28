/**
 * Kuşanım ekranı için ortak tanımlar.
 *
 * Eşya kimlikleri ve basma aralığı kendi `gamedata` şemamızdan geliyor.
 * Seviye başına AP/DP değerleri ORADA YOK — 6956 kuşanım eşyasının
 * hiçbirinde stat alanı bulunmuyor, yalnızca `enhancement` referansı var.
 * O yüzden statlar bdocodex'ten çekiliyor (bkz. api/gear/stats), tıpkı
 * grind tracker'daki fiyatlar gibi.
 */

/** equipInfo.slot -> ekrandaki yuva */
export const SLOTS = [
  { key: "main",      slot: 0,  label: "Ana Silah" },
  { key: "sub",       slot: 1,  label: "Yardımcı Silah" },
  { key: "awakening", slot: 29, label: "Uyanış Silahı" },
  { key: "helmet",    slot: 6,  label: "Miğfer" },
  { key: "armor",     slot: 3,  label: "Zırh" },
  { key: "gloves",    slot: 4,  label: "Eldiven" },
  { key: "shoes",     slot: 5,  label: "Ayakkabı" },
  { key: "necklace",  slot: 7,  label: "Kolye" },
  { key: "earring1",  slot: 10, label: "Küpe I" },
  { key: "earring2",  slot: 10, label: "Küpe II" },
  { key: "ring1",     slot: 8,  label: "Yüzük I" },
  { key: "ring2",     slot: 8,  label: "Yüzük II" },
  { key: "belt",      slot: 12, label: "Kemer" },
  { key: "stone",     slot: 27, label: "Kimya Taşı" },
] as const;

export type SlotKey = (typeof SLOTS)[number]["key"];

/**
 * Test ekranında yalnızca bu aileler var (istenen kapsam).
 * Desenler SQL `like` icin; `!` ile baslayanlar dislaniyor.
 */
export const FAMILIES = {
  armor:  ["Edana - %", "Ölen Tanrının Zırhı"],
  weapon: ["Yanan Hükümran %", "KaraYıldız %"],
  acc:    ["Ekleta %", "Kharazad %", "Apeiron %"],
} as const;

/** Gecici / bolgesel varyantlar listeyi kirletiyor */
export const EXCLUDE = ["%(Geçici)%", "Obsidiyen %", "Çınlayan %"];

/** Aileler yuva grubuna bagli: zirh yuvasinda silah ailesi cikmasin. */
export const WEAPON_SLOTS = [0, 1, 29];
export const ARMOR_SLOTS = [3, 4, 5, 6];
export const ACC_SLOTS = [7, 8, 10, 12];
export const STONE_SLOT = 27;

/**
 * Basma seviyesi etiketleri. Aralik esyaya gore degisiyor:
 * KaraYildiz 20 (+1..+15 sonra PRI..PEN), Edana/Hukumran/aksesuar 10,
 * Olen Tanri 5 (yalnizca PRI..PEN).
 */
export function levelLabels(maxEnhance: number): string[] {
  const roman = ["PRI", "DUO", "TRI", "TET", "PEN"];
  if (maxEnhance === 20) {
    return ["Temel", ...Array.from({ length: 15 }, (_, i) => `+${i + 1}`), ...roman];
  }
  if (maxEnhance === 5) return ["Temel", ...roman];
  return ["Temel", ...Array.from({ length: maxEnhance }, (_, i) => `+${i + 1}`)];
}

export interface LevelStats {
  level: number;
  label: string;
  ap: number;
  dp: number;
  accuracy: number;
  evasion: number;
  damageReduction: number;
}

export interface GearItem {
  id: string;          // urn::item:930601
  itemId: number;
  name: string;
  grade: number;
  icon: string | null;
  slot: number;
  maxEnhance: number;
  classes: string[] | null;   // null = her sinif
}

/**
 * Ekran görüntüsündeki kitap/bilgi bonusları. Klanda herkes bu
 * kitapları bitirdiği için sabit taban olarak ekleniyor; asıl önemlisi
 * +10 AP ve +10 DP.
 */
export const BOOK_BASELINE = {
  hp: 1000,
  breath: 438,
  ap: 10,
  accuracy: 29,
  inventory: 4,
  dp: 10,
  damageReduction: 10,
  evasion: 8,
  weight: 28,
} as const;

export const BOOK_ROWS: Array<{ label: string; value: number }> = [
  { label: "Sağlık Puanı", value: BOOK_BASELINE.hp },
  { label: "Nefes", value: BOOK_BASELINE.breath },
  { label: "AP", value: BOOK_BASELINE.ap },
  { label: "İsabet", value: BOOK_BASELINE.accuracy },
  { label: "Envanter Yuvaları", value: BOOK_BASELINE.inventory },
  { label: "DP", value: BOOK_BASELINE.dp },
  { label: "Hasar Azaltma", value: BOOK_BASELINE.damageReduction },
  { label: "Kaçınma", value: BOOK_BASELINE.evasion },
  { label: "Ağırlık Limiti", value: BOOK_BASELINE.weight },
];
