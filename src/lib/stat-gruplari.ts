/**
 * İstatistikleri oyundaki gibi başlıklara ayırır (Saldırı, Savunma, Temel…).
 *
 * Toplam etki listesi düz bir yığın olunca okunmuyor; garmoth'un karakter
 * ekranındaki gruplama alışılmış olduğu için aynı sırayı kullanıyoruz.
 * Eşleşmeyen her şey "Diğer" başlığına düşer — yeni bir stat çıktığında
 * kaybolmasın.
 */

export const STAT_GRUPLARI: Array<{ ad: string; anahtarlar: string[] }> = [
  { ad: "Saldırı", anahtarlar: ["AP", "Gizli AP", "Ek AP", "Tüm AP", "İsabet", "Uyanış AP", "Ana El AP"] },
  { ad: "Savunma (Hasar Azaltma)", anahtarlar: ["DP", "Hasar Azaltma", "Gizli Hasar Azaltma", "Canavar Hasar Azaltma", "Kaçınma", "Gizli Kaçınma", "Tüm Savunma"] },
  { ad: "Temel", anahtarlar: ["Sağlık Puanı", "MP/WP/SP", "Nefes", "Taşıma Ağırlığı", "Ağırlık", "MP", "WP", "SP"] },
  { ad: "Direnç", anahtarlar: ["Tüm Direnç", "Düşürme/Yıkma Direnci", "Geri İtme/Püskürtme Direnci", "Sersemletme/Donma/Bayıltma Direnci", "Hareketsizleştirme Direnci", "Yavaşlatma Direnci", "Direnç"] },
  { ad: "Ek Hasar", anahtarlar: ["Kritik Vuruş Hasarı", "Ek Arkadan Darbe Hasarı", "Tüm Özel Saldırı Ek Hasarı", "Canavarlara Karşı Ekstra AP", "İnsanlara Karşı Ekstra AP", "Ek Hasar", "Havadaki Hedefe Ek Hasar", "Yere Düşmüş Hedefe Ek Hasar"] },
  { ad: "Ekipman Yükseltmesi", anahtarlar: ["Saldırı Hızı", "Büyü Hızı", "Hareket Seviyesi", "Kritik Vuruş Seviyesi", "Kritik Vuruş", "Hareket Hızı", "Şans"] },
  { ad: "Yaşam", anahtarlar: ["Savaş EXP", "Beceri EXP", "Yaşam EXP", "İşleme Başarı Oranı", "Toplama Seviyesi", "Balıkçılık Seviyesi"] },
  { ad: "Diğer", anahtarlar: ["Eşya Düşürme Oranı", "Gümüş", "Enerji"] },
];

/** Sıra: gruptaki yeri; bulunamazsa sona (Diğer) */
export function statGrubu(label: string): { ad: string; sira: number } {
  for (let g = 0; g < STAT_GRUPLARI.length; g++) {
    const i = STAT_GRUPLARI[g].anahtarlar.findIndex((k) => label === k);
    if (i >= 0) return { ad: STAT_GRUPLARI[g].ad, sira: g * 100 + i };
    // Tam eşleşme yoksa içerme: "Ek AP (Canavar)" gibi türevler grubunda kalsın
    const j = STAT_GRUPLARI[g].anahtarlar.findIndex((k) => label.includes(k));
    if (j >= 0) return { ad: STAT_GRUPLARI[g].ad, sira: g * 100 + 50 + j };
  }
  return { ad: "Diğer", sira: STAT_GRUPLARI.length * 100 };
}
