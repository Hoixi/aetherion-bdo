/**
 * Savaş performans analizi.
 *
 * Mutlak sayılar savaşlar arasında karşılaştırılamaz — 60 kişilik bir kale
 * kuşatmasıyla 20 kişilik node war'ın hasar ölçekleri bambaşka. Bu yüzden
 * her metrik önce *kendi savaşı içinde* yüzdelik dilime çevrilir, sonra
 * savaşlar arasında ortalanır. Böylece hem ölçek farkı düşer hem de skor
 * katsayı ayarı gerektirmeden 0–100 aralığına oturur.
 */

export type RawPerf = {
  warId: number;
  userId: number | null;
  inGameName: string;
  class: string;
  spec: string;
  kills: number;
  deaths: number;
  killStreak: number;
  damageDealt: number;
  damageTaken: number;
  ccCount: number;
  hpHeal: number;
  allyHpHeal: number;
  castleDamage: number;
};

/** Yüzdelik dilime çevrilen metrikler ve skora katkı ağırlıkları */
export const METRIC_WEIGHTS = {
  damageDealt:  { label: "Hasar",       weight: 0.30, higherIsBetter: true  },
  kills:        { label: "Kill",        weight: 0.20, higherIsBetter: true  },
  deaths:       { label: "Ölüm",        weight: 0.15, higherIsBetter: false },
  castleDamage: { label: "Kale Hasarı", weight: 0.15, higherIsBetter: true  },
  ccCount:      { label: "CC",          weight: 0.10, higherIsBetter: true  },
  support:      { label: "Destek",      weight: 0.10, higherIsBetter: true  },
} as const;

export type MetricKey = keyof typeof METRIC_WEIGHTS;
export const METRIC_KEYS = Object.keys(METRIC_WEIGHTS) as MetricKey[];

/** Ham kayıttan metrik değerini çıkarır — destek iki şifa alanının toplamı */
function valueOf(p: RawPerf, key: MetricKey): number {
  if (key === "support") return p.hpHeal + p.allyHpHeal;
  return p[key];
}

/**
 * Bir değerin dizi içindeki yüzdelik dilimi (0–100).
 * Eşit değerler aynı dilimi alır; herkes sıfırsa nötr 50 döner.
 */
function percentile(sorted: number[], value: number): number {
  if (sorted.length <= 1) return 50;
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return 50;

  // Değerden küçük olanların oranı + eşit olanların yarısı
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return ((below + equal / 2) / sorted.length) * 100;
}

export type PlayerMetric = {
  /** Savaşlar boyunca ortalama yüzdelik dilim (0–100) */
  pct: number;
  /** Savaş başına ham ortalama */
  avg: number;
  total: number;
};

export type PlayerAnalysis = {
  userId: number | null;
  name: string;
  class: string;
  spec: string;
  guildTag: string | null;
  wars: number;
  metrics: Record<MetricKey, PlayerMetric>;
  /** 0–100 bileşik puan */
  rating: number;
  /** Kendi class'ı içindeki sırası (yeterli örnek varsa) */
  classRank: { rank: number; of: number } | null;
  /** Ortalamanın belirgin altında kalan metrikler */
  weaknesses: MetricKey[];
  /** Ortalamanın belirgin üstündeki metrikler */
  strengths: MetricKey[];
};

/** Bir metrikte güçlü/zayıf saymak için dilim eşiği */
const WEAK_BELOW = 30;
const STRONG_ABOVE = 70;

export function analyzeWars(
  perfs: RawPerf[],
  meta: Map<number, { guildTag: string | null }> = new Map(),
): PlayerAnalysis[] {
  if (perfs.length === 0) return [];

  // Savaş bazında metrik dağılımları — yüzdelik dilim bunlardan çıkar
  const byWar = new Map<number, RawPerf[]>();
  for (const p of perfs) {
    const list = byWar.get(p.warId);
    if (list) list.push(p);
    else byWar.set(p.warId, [p]);
  }

  const sortedPerWar = new Map<number, Record<MetricKey, number[]>>();
  byWar.forEach((list, warId) => {
    const cols = {} as Record<MetricKey, number[]>;
    for (const key of METRIC_KEYS) {
      cols[key] = list.map((p) => valueOf(p, key)).sort((a, b) => a - b);
    }
    sortedPerWar.set(warId, cols);
  });

  // Oyuncu bazında topla — userId yoksa isimle grupla
  const keyOf = (p: RawPerf) => (p.userId != null ? "u" + p.userId : "n" + p.inGameName.toLowerCase());
  const groups = new Map<string, RawPerf[]>();
  for (const p of perfs) {
    const k = keyOf(p);
    const list = groups.get(k);
    if (list) list.push(p);
    else groups.set(k, [p]);
  }

  const players: PlayerAnalysis[] = [];

  groups.forEach((list) => {
    const last = list[list.length - 1];
    const metrics = {} as Record<MetricKey, PlayerMetric>;

    for (const key of METRIC_KEYS) {
      let pctSum = 0;
      let total = 0;
      for (const p of list) {
        const cols = sortedPerWar.get(p.warId)!;
        const v = valueOf(p, key);
        const raw = percentile(cols[key], v);
        // Ölüm gibi az olması iyi olan metriklerde dilim ters çevrilir
        pctSum += METRIC_WEIGHTS[key].higherIsBetter ? raw : 100 - raw;
        total += v;
      }
      metrics[key] = {
        pct: pctSum / list.length,
        avg: total / list.length,
        total,
      };
    }

    const rating = METRIC_KEYS.reduce(
      (sum, key) => sum + metrics[key].pct * METRIC_WEIGHTS[key].weight,
      0,
    );

    players.push({
      userId: last.userId,
      name: last.inGameName,
      class: last.class,
      spec: last.spec,
      guildTag: last.userId != null ? meta.get(last.userId)?.guildTag ?? null : null,
      wars: list.length,
      metrics,
      rating: Math.round(rating * 10) / 10,
      classRank: null,
      weaknesses: METRIC_KEYS.filter((k) => metrics[k].pct < WEAK_BELOW),
      strengths: METRIC_KEYS.filter((k) => metrics[k].pct > STRONG_ABOVE),
    });
  });

  // Class içi sıralama — tek kişilik class'ta sıralamanın anlamı yok
  const byClass = new Map<string, PlayerAnalysis[]>();
  for (const pl of players) {
    if (!pl.class) continue;
    const list = byClass.get(pl.class);
    if (list) list.push(pl);
    else byClass.set(pl.class, [pl]);
  }
  byClass.forEach((list) => {
    if (list.length < 3) return;
    list.sort((a, b) => b.rating - a.rating);
    list.forEach((pl, i) => { pl.classRank = { rank: i + 1, of: list.length }; });
  });

  return players.sort((a, b) => b.rating - a.rating);
}

/** Class ortalamaları — bir oyuncuyu kendi class'ıyla kıyaslamak için */
export function classAverages(players: PlayerAnalysis[]): Map<string, { rating: number; count: number }> {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const p of players) {
    if (!p.class) continue;
    const cur = acc.get(p.class) ?? { sum: 0, count: 0 };
    cur.sum += p.rating;
    cur.count++;
    acc.set(p.class, cur);
  }
  const out = new Map<string, { rating: number; count: number }>();
  acc.forEach((v, k) => out.set(k, { rating: v.sum / v.count, count: v.count }));
  return out;
}
