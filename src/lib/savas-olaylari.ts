/**
 * Savaş olayları — oyun içi kill akışının haritaya inmesi.
 *
 * Kaynak, kayıt incelemesinin bastığı satırlar (bir savaş çerçevesi =
 * bir olay). Çerçevedeki beş ad alanının ne olduğu 24 Eylül 2026 gecesi
 * Bartali savaşında doğrulandı:
 *
 *   off 5   → bizim oyuncunun karakter adı
 *   off 72  → karşı klanın adı
 *   off 134 → karşı oyuncunun karakter adı
 *   off 201 → bizim oyuncunun aile adı
 *   off 263 → karşı oyuncunun aile adı
 *
 * Yön, 196'daki beş bayttan geliyor: `0100000000` ise kill bizde, başka
 * bir değer ise ölen biziz — o değer karşı klanın amblem rengi (aynı
 * savaşta KAWGADAOLUR `0014ff221f`, Eclipse `0047ff7760`). Yön, o savaşın
 * resmî raporuyla çapraz kontrol edildi: ölüm işaretlenen satırların
 * hepsi raporda ölümü olan oyunculara, kill işaretlenenler de kill'i
 * olanlara düştü (raporda 0 kill'i olan Estorea'nın iki satırı da ölüm).
 *
 * Konumun kime ait olduğu (öldüren mi, ölen mi) doğrulanmadı; ekranda
 * "olay yeri" diye duruyor.
 */

/** Dünya koordinatı → garmoth koordinatı; kale haritasıyla aynı dönüşüm */
const BOLEN = 6400;
const PIVOT_X = 282.5081;
const PIVOT_Y = 182.8254;

/** Approximate fit to reference nodes; not a verified death-location calibration. */
export function dunyaToGarmoth(x: number, z: number): [number, number] {
  return [x / BOLEN + PIVOT_X, z / BOLEN + PIVOT_Y];
}

export interface SavasOlayi {
  /** Paketin bu bilgisayara ulaştığı an */
  at: number;
  bizimKarakter: string;
  bizimAile: string;
  rakipKarakter: string;
  rakipAile: string;
  rakipKlan: string;
  /** true → kill bizde, false → ölen biz */
  bizimKill: boolean;
  /** Garmoth koordinatı (kale haritasıyla aynı uzay) */
  x: number;
  y: number;
  /** Ham dünya koordinatı — kalibrasyon bozulursa geri dönülebilsin */
  dunya: [number, number, number];
}

/** Klan amblemi yok → satır bizim kill'imiz */
const KILL_BAYRAGI = "0100000000";

interface HamSatir {
  time?: unknown;
  fields?: Array<{ off?: unknown; text?: unknown }>;
  flags?: { at196?: unknown };
  floatCandidates?: unknown;
}

function ad(satir: HamSatir, off: number): string {
  const alan = (satir.fields ?? []).find((f) => f.off === off);
  const metin = typeof alan?.text === "string" ? alan.text.trim() : "";
  return metin;
}

/**
 * İnceleme çıktısını olaylara çevirir.
 *
 * Girdi tek bir JSON dizisi olabilir ya da satır satır JSON (araç böyle
 * basıyor; aradaki `key`/`chainFrames` satırları sessizce atlanıyor).
 */
export function olaylariCoz(metin: string): { olaylar: SavasOlayi[]; atilan: number } {
  const ham: HamSatir[] = [];
  const govde = metin.trim();
  let dizi: unknown = null;
  if (govde.startsWith("[")) {
    try { dizi = JSON.parse(govde); } catch { dizi = null; }
  }
  if (Array.isArray(dizi)) {
    for (const x of dizi) ham.push(x as HamSatir);
  } else {
    for (const satir of govde.split(/\r?\n/)) {
      const t = satir.trim().replace(/,$/, "");
      if (!t.startsWith("{")) continue;
      try { ham.push(JSON.parse(t) as HamSatir); } catch { /* araç başka satırlar da basıyor */ }
    }
  }

  const olaylar: SavasOlayi[] = [];
  let atilan = 0;
  for (const satir of ham) {
    const f = satir.floatCandidates;
    const koordinat = Array.isArray(f) && f.length >= 3 && f.every((n) => typeof n === "number" && Number.isFinite(n))
      ? (f as number[]) : null;
    const bizimKarakter = ad(satir, 5);
    const bizimAile = ad(satir, 201);
    const rakipAile = ad(satir, 263);
    const at = typeof satir.time === "string" ? Date.parse(satir.time) : NaN;
    if (!koordinat || !bizimAile || !rakipAile || !Number.isFinite(at)) { atilan++; continue; }
    olaylar.push({
      at,
      bizimKarakter, bizimAile,
      rakipKarakter: ad(satir, 134), rakipAile,
      rakipKlan: ad(satir, 72),
      bizimKill: satir.flags?.at196 === KILL_BAYRAGI,
      x: dunyaToGarmoth(koordinat[0], koordinat[2])[0],
      y: dunyaToGarmoth(koordinat[0], koordinat[2])[1],
      dunya: [koordinat[0], koordinat[1], koordinat[2]],
    });
  }
  olaylar.sort((a, b) => a.at - b.at);
  return { olaylar, atilan };
}

export interface OyuncuOzeti { ad: string; kill: number; death: number }

/** Kişi başı kill/ölüm — bizim taraf ve karşı taraf ayrı */
export function olayOzeti(olaylar: SavasOlayi[]) {
  const biz = new Map<string, OyuncuOzeti>();
  const rakip = new Map<string, OyuncuOzeti>();
  const klan = new Map<string, number>();
  const al = (m: Map<string, OyuncuOzeti>, ad: string) => {
    const v = m.get(ad) ?? { ad, kill: 0, death: 0 };
    m.set(ad, v);
    return v;
  };
  for (const o of olaylar) {
    if (o.bizimKill) { al(biz, o.bizimAile).kill++; al(rakip, o.rakipAile).death++; }
    else { al(biz, o.bizimAile).death++; al(rakip, o.rakipAile).kill++; }
    if (o.rakipKlan) klan.set(o.rakipKlan, (klan.get(o.rakipKlan) ?? 0) + 1);
  }
  const sirala = (m: Map<string, OyuncuOzeti>) =>
    Array.from(m.values()).sort((a, b) => b.kill - a.kill || a.death - b.death || a.ad.localeCompare(b.ad, "tr"));
  return {
    biz: sirala(biz),
    rakip: sirala(rakip),
    klanlar: Array.from(klan.entries()).map(([ad, n]) => ({ ad, n })).sort((a, b) => b.n - a.n),
    kill: olaylar.filter((o) => o.bizimKill).length,
    death: olaylar.filter((o) => !o.bizimKill).length,
  };
}

/**
 * Olayların kapladığı koordinat kutusu — harita buna oturuyor.
 *
 * Çatışma tek bir tepede geçiyor olabiliyor; sadece noktalara oturtunca
 * harita öyle yakınlaşıyor ki hangi mevzide olduğu seçilmiyordu. En az
 * `enAz` birimlik bir alan gösteriliyor.
 */
export function olayKutusu(olaylar: SavasOlayi[], pay = 0.6, enAz = 3) {
  if (olaylar.length === 0) return null;
  const xs = olaylar.map((o) => o.x), ys = olaylar.map((o) => o.y);
  const kutu = {
    x0: Math.min(...xs) - pay, x1: Math.max(...xs) + pay,
    y0: Math.min(...ys) - pay, y1: Math.max(...ys) + pay,
  };
  const genislet = (a: number, b: number): [number, number] => {
    const eksik = enAz - (b - a);
    return eksik > 0 ? [a - eksik / 2, b + eksik / 2] : [a, b];
  };
  [kutu.x0, kutu.x1] = genislet(kutu.x0, kutu.x1);
  [kutu.y0, kutu.y1] = genislet(kutu.y0, kutu.y1);
  return kutu;
}
