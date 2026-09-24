/**
 * BDO dünya haritası — oyunun kendi karoları, oyunun kendi koordinatı.
 *
 * Karolar istemciden çıkarıldı (`bdo-data-extractor worldmap-files`) ve
 * çıktının `meta.json`'ı dönüşümü tanımlıyor:
 *
 *   tilePx 128 · unitsPerPixel 100 · unitsPerTile 12800 · zoom 0..8
 *
 * Yani en yakın seviyede bir piksel tam 100 oyun birimi, bir karo tam bir
 * sektör (12800 birim). Bu yüzden burada kalibrasyon yok: garmoth
 * karolarında yapmak zorunda kaldığımız "12 kaleye uydurulmuş dönüşüm"
 * yerine doğrudan bölme işlemi var, kayma diye bir mesele kalmıyor.
 *
 * CRS birimi = dünya / 25600 seçildi: Leaflet zoom z'de koordinatı 2^z ile
 * çarpıp 128'e bölerek karo indeksini buluyor; bu bölen ile karo indeksi
 * dosya düzenindeki `<z>/<x>/<y>.webp` ile örtüşüyor.
 *
 * Dikey yön: çıkarıcı karo satırlarını YUKARI doğru numaralandırıyor (TMS
 * düzeni) ve oyun Z ekseni kuzeye artıyor. Komşu karoların kenar pikselleri
 * karşılaştırılarak ölçüldü: (x, y) karosunun üst satırı, (x, y+1) karosunun
 * alt satırıyla uyuşuyor (ortalama fark 13.8'e karşı 34.4). Bu yüzden ekran
 * koordinatı -Z üzerinden kuruluyor ve karo adresinde satır ters çevriliyor
 * (bkz. `karoSatiri`); aksi hâlde harita dikeyde şeritler hâlinde karışıyor.
 */

export const KARO_PX = 128;
/** En yakın seviyede bir piksel kaç oyun birimi */
export const BIRIM_PX = 100;
export const KARO_DUNYA = 12800;
export const MIN_ZOOM = 0;
/** Karo piramidinin son seviyesi — ötesi son karo büyütülerek gösteriliyor */
export const MAX_KARO_ZOOM = 8;
export const MAX_ZOOM = 11;
/** Dünya birimi → CRS birimi */
export const CRS_BOLEN = 25600;

/** Karo kökü — sunucuda ayrı bir nginx servis ediyor */
export const KARO_TABAN = process.env.NEXT_PUBLIC_HARITA_KARO ?? "/karo";
export const KARO_URL = `${KARO_TABAN}/world/{z}/{x}/{y}.webp`;

/** Karo ızgarasının kapsadığı alan (meta.json grid'i) */
export const IZGARA = { xmin: -128, xmax: 111, ymin: -64, ymax: 126 };

/** Oyun koordinatı → Leaflet [lat, lng]; kuzey (+Z) yukarıda kalsın diye lat = -Z */
export function dunyaToProj(x: number, z: number): [number, number] {
  return [-z / CRS_BOLEN, x / CRS_BOLEN];
}
/** Leaflet [lat, lng] → oyun koordinatı */
export function projToDunya(lat: number, lng: number): [number, number] {
  return [lng * CRS_BOLEN, -lat * CRS_BOLEN];
}
/** Leaflet'in istediği satır → dosyadaki satır (piramit yukarı sayıyor) */
export const karoSatiri = (y: number) => -y - 1;
/** Oyun birimi cinsinden yarıçap → CRS yarıçapı */
export const projYaricap = (birim: number) => birim / CRS_BOLEN;

/**
 * Haritanın dışına çıkılamayacak sınır.
 *
 * Izgara satırları dosya numaralarıyla verilmiş; ekran satırı ters
 * olduğundan dikey sınır da çevrilerek hesaplanıyor.
 */
export function sinirlar(): [[number, number], [number, number]] {
  const birim = KARO_DUNYA / CRS_BOLEN;
  const lat0 = karoSatiri(IZGARA.ymax) * birim;
  const lat1 = (karoSatiri(IZGARA.ymin) + 1) * birim;
  return [
    [Math.min(lat0, lat1), IZGARA.xmin * birim],
    [Math.max(lat0, lat1), (IZGARA.xmax + 1) * birim],
  ];
}

export type HaritaNode = {
  key: number;
  ad: string;
  adEn: string;
  /** Ham oyun koordinatı */
  x: number;
  z: number;
  /** Düğümün oyun içi yarıçapı (oyun birimi) */
  r: number;
  /** 1–5; şehirlerde 0 */
  tier: number;
  kale: boolean;
  bolge: string;
  tur: "savas" | "sehir";
};

/** Kale haritasındaki kademe renkleriyle aynı */
export const TIER_RENK: Record<number, string> = {
  1: "#e8b451", 2: "#9a9aa2", 3: "#b87333", 4: "#6aa9e0", 5: "#c86fd8",
};

/** İki nokta arası oyun birimi uzaklığı */
export const uzaklik = (ax: number, az: number, bx: number, bz: number) =>
  Math.hypot(ax - bx, az - bz);

/** Bir noktaya en yakın düğüm — "kavga nerede geçti" sorusunun cevabı */
export function enYakinNode(nodlar: HaritaNode[], x: number, z: number) {
  let en: { node: HaritaNode; d: number } | null = null;
  for (const n of nodlar) {
    const d = uzaklik(n.x, n.z, x, z);
    if (!en || d < en.d) en = { node: n, d };
  }
  return en;
}
