/**
 * Stat adlarının Türkçe karşılıkları.
 *
 * Extractor stat adlarını kısmen çözüyor: bir kısmı Türkçe geliyor
 * ("Tüm AP", "Maks. HP", "Kritik Vuruş"), bir kısmı İngilizce kalıyor
 * ("Max HP", "All AP") — aynı stat iki isimle görünebiliyor. Burası ikisini
 * tek Türkçe karşılığa indiriyor.
 *
 * DİKKAT: Türkçe karşılıklar oyunun kendi metinlerinden görülen terimlere
 * dayanıyor ama hepsi client'tan çıkarılmadı; yanlış bulduğun terimi burada
 * düzeltmen yeterli, başka yere dokunmaya gerek yok. Haritada olmayan stat
 * geldiği gibi basılır — ekranda İngilizce bir ad görürsen buraya eklenecek
 * demektir.
 */

const STAT_TR: Record<string, string> = {
  // ── Saldırı ──
  "All AP": "Tüm AP",
  "Melee AP": "Yakın Dövüş AP",
  "Ranged AP": "Menzilli AP",
  "Magic AP": "Büyü AP",
  "Attack Speed": "Saldırı Hızı",
  "Casting Speed": "Büyü Yapma Hızı",
  "All Accuracy": "Tüm İsabet",
  "Critical Hit": "Kritik Vuruş",
  "Critical Hit Chance": "Kritik Vuruş Şansı",
  "Critical Hit Extra Damage": "Kritik Vuruş Ek Hasarı",
  "Back Attack Extra Damage": "Arkadan Darbe Ek Hasarı",
  "Down Attack Extra Damage": "Yerden Darbe Ek Hasarı",
  "Air Attack Extra Damage": "Havadan Darbe Ek Hasarı",
  "Counter Attack Extra Damage": "Karşı Darbe Ek Hasarı",
  "Speed Attack Extra Damage": "Hızlı Darbe Ek Hasarı",
  "All Special Attack Extra Damage": "Tüm Özel Darbe Ek Hasarı",
  "Fixed Damage on Critical Hits": "Kritik Vuruşta Sabit Hasar",
  "Fixed Damage on Back Attack Hits": "Arkadan Darbede Sabit Hasar",
  "Retaliation Fixed Damage when Struck": "Vurulunca Misilleme Sabit Hasarı",

  // ── Savunma ──
  "All Damage Reduction": "Tüm Hasar Azaltma",
  "Melee Damage Reduction": "Yakın Dövüş Hasar Azaltma",
  "Ranged Damage Reduction": "Menzilli Hasar Azaltma",
  "Magic Damage Reduction": "Büyü Hasar Azaltma",
  "Monster Damage Reduction": "Canavar Hasarı Azaltma",
  "Monster Damage Reduction Rate": "Canavar Hasarı Azaltma Oranı",
  "All Evasion": "Tüm Kaçınma",
  "All Resistance": "Tüm Direnç",
  "Stun/Stiffness/Freezing Resistance": "Sersemletme/Kasılma/Donma Direnci",
  "Knockback/Floating Resistance": "Geri İtme/Havalanma Direnci",
  "Knockdown/Bound Resistance": "Yere Serme/Bağlama Direnci",
  "Grapple Resistance": "Tutuş Direnci",
  "Fear Resistance": "Korku Direnci",
  "Death Penalty Resistance": "Ölüm Cezası Direnci",
  "Durability Reduction Resistance": "Dayanıklılık Azalma Direnci",
  "Hypothermia Resistance": "Donma Direnci",
  "Heatstroke Resistance": "Sıcak Çarpması Direnci",

  // ── Canavarlara karşı ──
  "Extra AP Against Monsters": "Canavarlara Karşı Ek AP",
  "Extra AP Against Humans": "İnsanlara Karşı Ek AP",
  "Extra AP Against Demihumans": "Yarı İnsanlara Karşı Ek AP",
  "Extra AP Against Beasts": "Vahşi Hayvanlara Karşı Ek AP",
  "Extra AP Against Adventurers": "Maceracılara Karşı Ek AP",
  "Extra AP Against Kamasylvian Monsters": "Kamasylvia Canavarlarına Karşı Ek AP",
  "Extra AP Against Edanian Monsters": "Edania Canavarlarına Karşı Ek AP",

  // ── Kaynaklar ──
  "Max HP": "Maks. HP",
  "Max MP/WP/SP": "Maks. MP/WP/SP",
  "Max Stamina": "Maks. Dayanıklılık",
  "Max Energy": "Maks. Enerji",
  "HP Recovery": "HP Yenileme",
  "HP Recovery on Hit": "Vuruşta HP Yenileme",
  "HP Recovery on Critical Hit": "Kritik Vuruşta HP Yenileme",
  "MP/WP/SP Recovery": "MP/WP/SP Yenileme",
  "MP/WP/SP Recovery on Hit": "Vuruşta MP/WP/SP Yenileme",
  "Energy Recovery": "Enerji Yenileme",
  "Karma Recovery": "Karma Yenileme",
  "Worker Stamina Recovery": "İşçi Dayanıklılık Yenileme",
  "Weight Limit": "Ağırlık Limiti",
  "Underwater Breathing": "Su Altında Nefes",
  "Self-obtainable Black Spirit's Rage": "Kara Ruh Öfkesi Kazanımı",

  // ── Hareket ──
  "Movement Speed": "Hareket Hızı",
  "Swimming Speed": "Yüzme Hızı",
  "Jump Height": "Zıplama Yüksekliği",

  // ── Deneyim ──
  "Combat EXP": "Savaş EXP",
  "Skill EXP": "Beceri EXP",
  "Life EXP": "Yaşam EXP",
  "Health EXP": "Sağlık EXP",
  "Breath EXP": "Nefes EXP",
  "Strength EXP": "Güç EXP",
  "Gathering EXP": "Toplama EXP",
  "Fishing EXP": "Balıkçılık EXP",
  "Hunting EXP": "Avcılık EXP",
  "Cooking EXP": "Yemek EXP",
  "Alchemy EXP": "Kimya EXP",
  "Processing EXP": "İşleme EXP",
  "Training EXP": "Eğitim EXP",
  "Trading EXP": "Ticaret EXP",
  "Farming EXP": "Çiftçilik EXP",
  "Sailing EXP": "Denizcilik EXP",
  "Bartering EXP": "Takas EXP",
  "Mount EXP": "Binek EXP",
  "Mount Skill EXP": "Binek Beceri EXP",

  // ── Ustalık ──
  "Life Skill Mastery": "Yaşam Becerileri Ustalığı",
  "Gathering Mastery": "Toplama Ustalığı",
  "Fishing Mastery": "Balıkçılık Ustalığı",
  "Hunting Mastery": "Avcılık Ustalığı",
  "Cooking Mastery": "Yemek Ustalığı",
  "Alchemy Mastery": "Kimya Ustalığı",
  "Processing Mastery": "İşleme Ustalığı",
  "Training Mastery": "Eğitim Ustalığı",
  "Sailing Mastery": "Denizcilik Ustalığı",

  // ── Yaşam becerileri ──
  "Gathering Speed": "Toplama Hızı",
  "Fishing Speed": "Balıkçılık Hızı",
  "Auto-fishing Time": "Otomatik Balıkçılık Süresi",
  "Chance to Catch Rare Fish": "Nadir Balık Yakalama Şansı",
  "Cooking Time": "Yemek Süresi",
  "Alchemy Time": "Kimya Süresi",
  "Processing Success Rate": "İşleme Başarı Oranı",
  "Gathering Item Drop Rate": "Toplama Eşya Düşme Oranı",
  "Horse Capture Rate": "At Yakalama Oranı",

  // ── Kazanım ──
  "Item Drop Rate": "Eşya Düşme Oranı",
  "Item Drop Amount": "Eşya Düşme Miktarı",
  "Knowledge Gain Chance": "Bilgi Kazanma Şansı",
  "Higher Grade Knowledge Gain Chance": "Yüksek Kalite Bilgi Kazanma Şansı",
  "Amity": "Yakınlık",
  "Luck": "Şans",
};

/** İngilizce stat adını Türkçeye çevirir; haritada yoksa olduğu gibi döner. */
export const statTr = (stat: string): string => STAT_TR[stat] ?? stat;

export interface StatEffect {
  stat: string;
  value?: number;
  unit?: string;
  op?: string;
  statId?: string;
}

/** "Tüm AP +10" / "Yaşam EXP +%3" — oyun içi yazım düzeni. */
export function formatStat(e: StatEffect): { label: string; value: string } {
  const op = e.op ?? "+";
  const percent = e.unit === "%";
  const n = e.value ?? 0;
  return {
    label: statTr(e.stat),
    value: percent ? `${op}%${n}` : `${op}${n}`,
  };
}

/**
 * Toplam değerin oyun içi yazımı: işaret her zaman başta.
 * Naif birleştirme ("%" + değer) eksi değerde "%-5" üretiyordu; doğrusu "-%5".
 */
export function formatTotal(value: number, unit: string): string {
  const sign = value < 0 ? "-" : "+";
  const n = Math.abs(value);
  return unit === "%" ? `${sign}%${n}` : `${sign}${n}`;
}
