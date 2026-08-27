import { RECENT_WAR_WINDOW } from "./perf-window";

/**
 * Savaş performans puanı.
 *
 * Tek kaynak: hem parti builder'daki form puanı hem panelin sıralaması
 * buradan geçiyor. İki yerde ayrı hesaplanınca aynı kişi iki farklı sayı
 * gösteriyordu.
 *
 * Katsayılar üretim verisine bakılarak seçildi (son 5 savaş, 140 kayıt):
 * oyuncu hasarı medyanı ~171K, kale hasarı ~2,0M, kill ~7, CC ~38,
 * ölüm ~16. Bu yüzden hasar ile kale ayrı bölene sahip — aynı bölenle
 * kale hasarı geri kalan her şeyi eziyordu.
 */

/** Puanı oluşturan bileşenler; arayüz de bu listeyi gösteriyor */
export const SCORE_TERMS = [
  { key: "damage", label: "Hasar",       birim: "100K hasar", katsayi: 8,    isaret: 1 },
  { key: "kills",  label: "Kill",        birim: "kill",        katsayi: 1.5,  isaret: 1 },
  { key: "castle", label: "Kale hasarı", birim: "1M kale",     katsayi: 3,    isaret: 1 },
  { key: "cc",     label: "CC",          birim: "CC",          katsayi: 0.15, isaret: 1 },
  { key: "deaths", label: "Ölüm",        birim: "ölüm",        katsayi: 0.5,  isaret: -1 },
] as const;

/** Savaş başına ortalamalar */
export type ScoreInput = {
  damage: number;
  kills: number;
  castle: number;
  cc: number;
  deaths: number;
};

export function warScore(a: ScoreInput): number {
  return Math.round(
    (a.damage / 100_000) * 8
    + a.kills * 1.5
    + (a.castle / 1_000_000) * 3
    + a.cc * 0.15
    - a.deaths * 0.5,
  );
}

/** Toplamlardan puan — panel savaş başına değil, pencere toplamı tutuyor */
export function warScoreFromTotals(t: ScoreInput & { wars: number }): number {
  if (t.wars <= 0) return 0;
  return warScore({
    damage: t.damage / t.wars,
    kills: t.kills / t.wars,
    castle: t.castle / t.wars,
    cc: t.cc / t.wars,
    deaths: t.deaths / t.wars,
  });
}

/**
 * Kartlarda ve sıralamada kullanılan renk.
 *
 * Eşikler üretimdeki dağılımdan: son 5 savaşta 48 oyuncunun çeyreklikleri
 * 17 / 28 / 46. Eski eşikler (20/8/0) 48 kişinin 29'unu yeşil yapıyordu,
 * yani renk hiçbir şey söylemiyordu; bunlarla ayrım 14/19/11/4.
 */
export function scoreColor(score: number): string {
  if (score >= 42) return "#38d07f";
  if (score >= 20) return "#e8b451";
  if (score >= 0) return "#f0a03c";
  return "#ef5f5f";
}

/** Ekranda gösterilen tek satırlık açıklama */
export const SCORE_SUMMARY =
  `Son ${RECENT_WAR_WINDOW} savaşın ortalaması: ` +
  SCORE_TERMS.map((t) => `${t.isaret < 0 ? "−" : ""}${t.katsayi} × ${t.birim}`).join("  ");
