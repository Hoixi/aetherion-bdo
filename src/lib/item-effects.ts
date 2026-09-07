/**
 * Eşya etkilerinin aranabilir hâli.
 *
 * `gamedata` içinde etkiler `data->effects->stats->stats[]` altında duruyor
 * ve her satır `{op, stat, statId, value, unit}` taşıyor. Ham hâliyle
 * aranamıyor, çünkü aynı stat üç ayrı biçimde geliyor:
 *
 *  1. Kimlikli ve İngilizce adlı  → "Extra AP Against Monsters" / monsterAp
 *  2. Kimliksiz ve Türkçe adlı    → "Canavarlara Karşı Ek AP"    / null
 *  3. Stat bile olmayan satırlar  → "9 sn. boyunca 3 defa, her defasında HP"
 *
 * Üretimde ölçüldü (3.418 eşya, 7.279 etki satırı):
 *  - 152 satır aslında stat değil, süreli iyileşme cümlesi; elenmezse
 *    arama yüzündeki etki listesine düşüyorlar.
 *  - Kimliği hiç olmayan 5 gerçek stat var (kritik/arkadan darbede sabit
 *    hasar gibi); ad üzerinden kimlik türetiliyor, +41 eşya kazanılıyor.
 *  - Türkçe satırların çoğu kimlikli satırın KOPYASI: aynı eşya etkiyi iki
 *    kez listeliyor. Yani takma ad eşlemesi yeni eşya kazandırmıyor, ama
 *    aynı etkinin ekranda iki kez görünmesini engelliyor.
 *
 * DİKKAT — birleştirilmemesi gerekenler: `attackSpeedLevel` (birim `-`,
 * düz seviye) ile `attackSpeed` (birim `%`) AYNI stat değil. Aynısı
 * casting ve movement için de geçerli. Adları benzediği için ilk bakışta
 * kopya sanılıyor; ölçüm ayrı olduklarını gösterdi.
 */

/** Türkçe (kimliksiz) ad -> kanonik statId */
const TAKMA_AD: Record<string, string> = {
  "tüm ap": "hiddenAp",
  "tüm hasar azaltma": "damageReduction",
  "canavarlara karşı ek ap": "monsterAp",
  "canavarlara karşı ap": "monsterAp",
  "canavar hasarı azaltma": "monsterDamageReduction",
  "maceracılara karşı ek ap": "adventurerAp",
  "maks. hp": "maxHp",
  "tüm isabet": "accuracy",
  "tüm kaçınma": "evasion",
  "kritik vuruş": "critLevel",
  "enerji yenileme": "energyRecovery",
  "hareket hızı": "movementSpeedLevel",
  "toplama hızı": "gatheringSpeed",
  "balıkçılık hızı": "fishingSpeed",
  "yaşam becerileri": "allMastery",
  "balıkçılık becerisi": "fishingSkill",
  "denizcilik becerisi": "sailingSkill",
};

/** Kimliği hiç olmayan ama gerçek stat olan İngilizce adlar */
const AD_TURETME: Record<string, string> = {
  "fixed damage on critical hits": "critFixedDamage",
  "fixed damage on back attack hits": "backAttackFixedDamage",
  "isabetli arkadan darbede sabit hasar": "backAttackFixedDamage",
  "retaliation fixed damage when struck": "retaliationFixedDamage",
};

/**
 * Stat olmayan satırlar. Bunlar aslında süreli iyileşme cümleleri
 * ("9 sn. boyunca 3 defa, her defasında HP"); extractor onları stat adı
 * sanıp listeye koymuş. Filtreye takılmazlarsa arama yüzündeki etki
 * listesine düşüyorlar ve ekran amatör görünüyor.
 */
const ZAMAN_IFADESI = /(\d+\s*(sn|saniye|dk|dakika)\b|^saniyede\b|boyunca|defasında|bir mevcut)/i;

export interface HamEtki {
  op?: string | null;
  stat?: string | null;
  statId?: string | null;
  value?: number | string | null;
  unit?: string | null;
}

export interface Etki {
  statId: string;
  /** Kaynaktaki ad — etiket bulunamazsa ekranda bu kullanılıyor */
  stat: string;
  value: number;
  /** "%", "LT", "sec" ya da düz sayı için null */
  unit: string | null;
  op: string;
}

/**
 * Ham satırı kanonik hâle getirir. Stat değilse `null` döner.
 */
export function normalizeEtki(ham: HamEtki): Etki | null {
  const ad = (ham.stat ?? "").trim();
  if (ad === "") return null;
  if (ZAMAN_IFADESI.test(ad)) return null;

  const anahtar = ad.toLocaleLowerCase("tr");
  const statId =
    (ham.statId && ham.statId.trim() !== "" ? ham.statId : null) ??
    TAKMA_AD[anahtar] ??
    AD_TURETME[anahtar] ??
    null;

  if (!statId) return null;

  const deger = typeof ham.value === "number" ? ham.value : Number(ham.value);
  if (!Number.isFinite(deger)) return null;

  const birim = ham.unit && ham.unit !== "-" ? ham.unit : null;
  return { statId, stat: ad, value: deger, unit: birim, op: ham.op ?? "+" };
}

/**
 * Bir eşyanın bütün etkilerini çıkarır; aynı statId birden çok kez
 * geçerse en yükseği kalır (oyunda da en yüksek olan görünür).
 */
export function esyaEtkileri(data: unknown): Etki[] {
  const govde = data as { effects?: { stats?: { stats?: HamEtki[] } } } | null;
  const ham = govde?.effects?.stats?.stats;
  if (!Array.isArray(ham)) return [];

  const enIyi = new Map<string, Etki>();
  for (const satir of ham) {
    const e = normalizeEtki(satir);
    if (!e) continue;
    const mevcut = enIyi.get(e.statId);
    if (!mevcut || e.value > mevcut.value) enIyi.set(e.statId, e);
  }
  return Array.from(enIyi.values());
}

/**
 * Arama yüzünde gösterilecek Türkçe etiketler.
 *
 * `bdo-stats.ts` İngilizce ada göre çeviriyor; burası statId'ye göre,
 * çünkü arama kimlik üzerinden yapılıyor. Haritada olmayan kimlik için
 * kaynaktaki ad basılıyor — ekranda İngilizce görürsen buraya eklenecek
 * demektir.
 */
export const STAT_ETIKET: Record<string, string> = {
  hiddenAp: "Tüm AP",
  monsterAp: "Canavarlara Karşı AP",
  humanAp: "İnsanlara Karşı AP",
  adventurerAp: "Maceracılara Karşı AP",
  demihumanAp: "Yarı İnsanlara Karşı AP",
  accuracy: "Tüm İsabet",
  evasion: "Tüm Kaçınma",
  damageReduction: "Tüm Hasar Azaltma",
  monsterDamageReduction: "Canavar Hasar Azaltma",
  monsterDamageReductionRate: "Canavar Hasar Azaltma Oranı",
  maxHp: "Maks. HP",
  maxStamina: "Maks. Dayanıklılık",
  maxResource: "Maks. MP/WP/SP",
  hpRecovery: "HP Yenilenmesi",
  hpRecoveryOnHit: "Vuruşta HP Yenilenmesi",
  resourceRecovery: "MP/WP/SP Yenilenmesi",
  energyRecovery: "Enerji Yenilenmesi",
  critLevel: "Kritik Vuruş",
  critDamage: "Kritik Vuruş Ek Hasarı",
  critFixedDamage: "Kritik Vuruşta Sabit Hasar",
  backAttackDamage: "Arkadan Darbe Ek Hasarı",
  backAttackFixedDamage: "Arkadan Darbede Sabit Hasar",
  downAttackDamage: "Yerden Darbe Ek Hasarı",
  specialAttackDamage: "Özel Darbe Ek Hasarı",
  retaliationFixedDamage: "Darbe Alınca Sabit Hasar",
  attackSpeed: "Saldırı Hızı (%)",
  attackSpeedLevel: "Saldırı Hızı",
  castingSpeed: "Büyü Hızı (%)",
  castingSpeedLevel: "Büyü Hızı",
  moveSpeed: "Hareket Hızı (%)",
  movementSpeedLevel: "Hareket Hızı",
  weightLimit: "Ağırlık Limiti",
  luck: "Şans",
  itemDropRate: "Eşya Düşürme Oranı",
  allResistance: "Tüm Direnç",
  knockdownResistance: "Yere Serme/Bağlama Direnci",
  knockbackResistance: "Geri İtme/Havalandırma Direnci",
  stunResistance: "Sersemletme/Donma Direnci",
  hypothermiaResistance: "Hipotermi Direnci",
  heatstrokeResistance: "Sıcak Çarpması Direnci",
  allMastery: "Yaşam Becerisi Ustalığı",
  gatheringSpeed: "Toplama Hızı",
  gatheringDropRate: "Toplama Düşürme Oranı",
  fishingSpeed: "Balıkçılık Hızı",
  fishingSkill: "Balıkçılık Becerisi",
  sailingSkill: "Denizcilik Becerisi",
  autoFishingTime: "Otomatik Balıkçılık Süresi",
  processingSuccessRate: "İşleme Başarı Oranı",
  cookingTime: "Yemek Süresi",
  alchemyTime: "Simya Süresi",
  knowledgeChance: "Bilgi Kazanma Şansı",
  higherGradeKnowledgeChance: "Üst Kademe Bilgi Şansı",
  combatExp: "Savaş EXP",
  skillExp: "Beceri EXP",
  lifeExp: "Yaşam EXP",
  healthExp: "Sağlık EXP",
  huntingExp: "Avcılık EXP",
  fishingExp: "Balıkçılık EXP",
  sailingExp: "Denizcilik EXP",
  strengthExp: "Güç EXP",
  breathExp: "Nefes EXP",
  trainingExp: "Eğitim EXP",
  processingExp: "İşleme EXP",
  mountExp: "Binek EXP",
};

/**
 * Bir kanonik kimligin Turkce takma adlari.
 *
 * Arama SQL'i hem `statId` hem de kimliksiz Turkce ad satirlarini
 * yakalamali: ayni etki bazi esyalarda iki satir halinde duruyor ve
 * yalnizca birinde kimlik var.
 */
export function takmaAdlar(statId: string): string[] {
  const out: string[] = [];
  for (const [ad, sid] of Object.entries(TAKMA_AD)) if (sid === statId) out.push(ad);
  for (const [ad, sid] of Object.entries(AD_TURETME)) if (sid === statId) out.push(ad);
  return out;
}

export const statEtiket = (statId: string, yedek?: string): string =>
  STAT_ETIKET[statId] ?? yedek ?? statId;

/** Ekranda "+30", "+%20", "20 LT" gibi */
export function etkiDeger(e: Etki): string {
  const isaret = e.op === "-" ? "-" : "+";
  if (e.unit === "%") return `${isaret}%${e.value}`;
  if (e.unit) return `${isaret}${e.value} ${e.unit}`;
  return `${isaret}${e.value}`;
}

/**
 * Öne çıkan etkiler: arama yüzünde ilk gösterilecek kısa liste.
 * Savaş odaklı bir klan sitesi olduğu için PvP/PvE statları başta.
 */
export const ONE_CIKAN: string[] = [
  "monsterAp", "hiddenAp", "humanAp", "adventurerAp",
  "accuracy", "evasion", "damageReduction",
  "critLevel", "maxHp", "attackSpeedLevel", "castingSpeedLevel",
  "itemDropRate", "luck", "weightLimit", "allMastery",
];
