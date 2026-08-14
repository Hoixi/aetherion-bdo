/**
 * Toplama rotası planlama.
 *
 * Gezgin satıcı problemi — kesin çözümü pahalı, ama en yakın komşu ile
 * başlayıp 2-opt ile düzeltmek pratikte fazlasıyla iyi sonuç veriyor.
 * Mesafe kuş uçuşu; yol ağı hesaba katılmıyor, sıralama için yeterli.
 */

export type RoutePoint = { id: number; nx: number; ny: number };

function dist(a: RoutePoint, b: RoutePoint): number {
  const dx = a.nx - b.nx;
  const dy = a.ny - b.ny;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Rotanın toplam uzunluğu — normalize birimde */
export function routeLength(route: RoutePoint[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) total += dist(route[i - 1], route[i]);
  return total;
}

/** En yakın komşu: her adımda ziyaret edilmemiş en yakını seç */
function nearestNeighbour(points: RoutePoint[], startIdx: number): RoutePoint[] {
  const left = points.slice();
  const [start] = left.splice(startIdx, 1);
  const order = [start];

  let current = start;
  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = dist(current, left[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    current = left.splice(best, 1)[0];
    order.push(current);
  }
  return order;
}

/**
 * 2-opt: kesişen iki kenar bulunca aradaki parçayı ters çevir.
 * Rota açık uçlu olduğu için başlangıç sabit, son serbest.
 */
function twoOpt(route: RoutePoint[], maxPasses = 30): RoutePoint[] {
  const r = route.slice();
  const n = r.length;
  if (n < 4) return r;

  for (let pass = 0; pass < maxPasses; pass++) {
    let improved = false;

    for (let i = 1; i < n - 2; i++) {
      for (let k = i + 1; k < n - 1; k++) {
        // Yalnızca değişen iki kenarı karşılaştırmak yeterli
        const before = dist(r[i - 1], r[i]) + dist(r[k], r[k + 1]);
        const after = dist(r[i - 1], r[k]) + dist(r[i], r[k + 1]);
        if (after < before - 1e-12) {
          let a = i, b = k;
          while (a < b) { const t = r[a]; r[a] = r[b]; r[b] = t; a++; b--; }
          improved = true;
        }
      }
    }

    if (!improved) break;
  }
  return r;
}

/**
 * Verilen noktalar için kısa bir toplama sırası üretir.
 *
 * `from` verilirse rota oradan başlar (oyuncunun bulunduğu yer);
 * verilmezse birkaç farklı başlangıç denenip en kısası seçilir.
 */
export function planRoute(points: RoutePoint[], from?: { nx: number; ny: number }): RoutePoint[] {
  if (points.length < 2) return points.slice();

  if (from) {
    // Başlangıca en yakın noktadan başla
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => {
      const d = dist(p, { id: -1, ...from });
      if (d < bestD) { bestD = d; best = i; }
    });
    return twoOpt(nearestNeighbour(points, best));
  }

  // Büyük kümelerde her başlangıcı denemek pahalı — örnekleyerek tara
  const tries = Math.min(points.length, 12);
  const step = Math.max(1, Math.floor(points.length / tries));

  let bestRoute: RoutePoint[] | null = null;
  let bestLen = Infinity;

  for (let i = 0; i < points.length; i += step) {
    const candidate = twoOpt(nearestNeighbour(points, i));
    const len = routeLength(candidate);
    if (len < bestLen) { bestLen = len; bestRoute = candidate; }
  }

  return bestRoute ?? points.slice();
}
