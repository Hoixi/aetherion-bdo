/**
 * Garmoth kale haritaları — koordinat uzayı ve katalog.
 *
 * Garmoth'un gömülü haritalarındaki şekiller kendi "koordinat" uzayında
 * duruyor. Ekrana nasıl düştüklerini kaynak sayfanın DOM'undan ölçtük:
 *
 *   dünya_pikseli(z) = 2^z * ( origin + scale * flip * (koordinat - pivot) )
 *
 * Ölçüm: z=5, karo x=16 ekranda -39'da, karo boyu 200px, ölçek 1, panel
 * kayması 0 → karo 16'nın dünya pikseli 3200, yani dünya = ekran + 3239.
 * İşaretçi (145, 68) → dünya (3384, 3274). Aynı işaretçinin koordinatı
 * [284.26, 203.64]:
 *
 *   82.26 + 0.39 * (284.26 - 224) = 105.76   ×32 = 3384.4   ✓
 *   94.38 + 0.39 * (224 - 203.64) = 102.32   ×32 = 3274.4   ✓
 *
 * Yani izdüşüm değeri P, 200 birimlik bir dünya karesini kaplıyor ve
 * zoom z'de 2^z karo (her biri 200 piksel) ediyor. Leaflet CRS.Simple'ı
 * (1,0,1,0) dönüşümüyle kurarsak P doğrudan latlng olarak kullanılabilir:
 * lng = Px, lat = Py.
 *
 * Kaynak: garmoth.com occupation rehberleri, izinleriyle.
 */

const ORIGIN_X = 82.26;
const ORIGIN_Y = 94.38;
const SCALE = 0.39;
const PIVOT = 224;

/** İzdüşüm karesinin kenar uzunluğu — zoom z'de 2^z karo × 200 piksel */
export const WORLD = 200;
export const TILE_SIZE = 200;
export const MIN_ZOOM = 0;
/**
 * Karo piramidi 7'de bitiyor. Harita daha ileri açılabiliyor: Leaflet
 * `maxNativeZoom` ile son karoyu büyüterek gösteriyor, kurulum
 * noktaları da vektör olduğu için net kalıyor.
 */
export const MAX_TILE_ZOOM = 7;
export const MAX_ZOOM = 10;

export const TILE_URL =
  "https://assets.garmoth.com/world-map/v2/tiles/{z}/{x}/{y}.webp";

/**
 * İkon dosyaları `nodeicon_<id>.webp` kalıbında; kale ikonu tek istisna,
 * adı da uzantısı da farklı.
 */
const ICON_FILES: Record<string, string> = {
  nodewarfort: "nodewar_fort.png",
};

export const iconUrl = (id: string) =>
  `https://assets.garmoth.com/icons/map-icons/${ICON_FILES[id] ?? `nodeicon_${id}.webp`}`;

/** Garmoth koordinatı → izdüşüm (Leaflet lat/lng olarak kullanılır) */
export function toProj(cx: number, cy: number): [number, number] {
  return [ORIGIN_Y + SCALE * (PIVOT - cy), ORIGIN_X + SCALE * (cx - PIVOT)];
}

/** İzdüşüm → garmoth koordinatı — haritaya çizim yaparken gerekiyor */
export function toCoord(lat: number, lng: number): [number, number] {
  return [(lng - ORIGIN_X) / SCALE + PIVOT, PIVOT - (lat - ORIGIN_Y) / SCALE];
}

/** Koordinat birimindeki yarıçapı izdüşüm birimine çevirir */
export const toProjRadius = (r: number) => r * SCALE;

// ── Şekiller ────────────────────────────────────────────────────────────
// Garmoth'un kendi şeması. Kendi çizimlerimiz de aynı yapıda tutuluyor,
// böylece tek bir çizim yolu yetiyor.

export type Shape =
  /** daire: [cx, cy], r yarıçap */
  | { t: "c"; p: [number, number]; r: number; k: string }
  /** dikdörtgen: [x1, y1, x2, y2] */
  | { t: "r"; p: [number, number, number, number]; k: string }
  /** ikon: [cx, cy], i ikon kimliği */
  | { t: "i"; p: [number, number]; i: string }
  /** yazı: [cx, cy], x metin */
  | { t: "t"; p: [number, number]; x: string; k: string; z?: number }
  /** çizgi: düz dizi [x1,y1,x2,y2,...] */
  | { t: "l"; p: number[]; k: string };

export type FortMap = {
  id: string;
  region: "Balenos" | "Serendia";
  /** Türkçe ad */
  name: string;
  /** Kaynaktaki başlık — izlenebilirlik için */
  source: string;
  shapes: Shape[];
};

// ── Etiket çevirisi ─────────────────────────────────────────────────────
// Kaynakta yazım tutarsızlıkları var (OLIVA/OLVIA, WESTERN GUARDN CAMP,
// POTENCIAL/POTENICAL/POTENICIAL). Çeviri sırasında düzeltiliyor.
//
// MADPOT olduğu gibi kalıyor: oyuncular arasında yerleşik terim, çevirisi
// kimseye bir şey anlatmaz.

const LABELS: Record<string, string> = {
  "CRON CASTLE": "Cron Kalesi",
  "FOREST OF PLUNDER": "Yağma Ormanı",
  "BARTALI FARM": "Bartali Çiftliği",
  "WESTERN GUARD CAMP": "Batı Muhafız Kampı",
  "WESTERN GUARDN CAMP": "Batı Muhafız Kampı",
  "ALTAR OF AGRIS": "Agris Sunağı",
  "WOLF HILL": "Kurt Tepesi",
  "BIRAGHI DEN": "Biraghi İni",
  "ORC CAMP": "Ork Kampı",
  "ALEJANDRO FARM": "Alejandro Çiftliği",
  "GLISH SWAMP": "Glish Bataklığı",
  "BLOODY MONASTERY": "Kanlı Manastır",
  "CASTLE RUINS": "Kale Harabeleri",
  VELIA: "Velia",
  OLVIA: "Olvia",
  OLIVA: "Olvia",
  HEIDEL: "Heidel",
  GLISH: "Glish",
};

/** Harita üstündeki metni Türkçeleştirir. Numara önekleri korunur. */
export function trLabel(raw: string): string {
  const m = raw.match(/^(\[\d+\]\s*)?(.*)$/);
  const prefix = m?.[1] ?? "";
  const body = (m?.[2] ?? raw).trim();

  if (LABELS[body]) return prefix + LABELS[body];
  if (/^POTEN[A-Z]*\s+SPOT$/.test(body)) return prefix + "OLASI NOKTA";
  if (body === "SPOT") return prefix + "NOKTA";
  return prefix + body;
}

/** İkon kimliği → ne olduğu. Efsane kutusu ve ipucu için. */
export const ICON_LABELS: Record<string, string> = {
  nodewarfort: "Kale",
  notretreatingflag: "Bayrak (kurulum noktası)",
  notretreatingflagstand: "Bayrak menzili",
  firetop: "Ateş kulesi",
  supplystation: "İkmal istasyonu",
  singijeonposition: "Singijeon konumu",
  elephantposition: "Fil konumu",
  elephantbreedingfarm: "Fil ahırı",
};

export const iconLabel = (id: string) => ICON_LABELS[id] ?? id;

// ── Katalog ─────────────────────────────────────────────────────────────
// Kaynaktaki sıraya bağlı kalmak yerine kimlikleri sabitliyoruz: çizimler
// kimliğe göre saklanıyor, başlık değişse de kaybolmasınlar.

export const FORT_IDS: { region: "Balenos" | "Serendia"; ids: string[] }[] = [
  {
    region: "Balenos",
    ids: [
      "balenos-genel", "cron-castle", "forest-plunder", "bartali-farm",
      "western-guard", "altar-agris", "wolf-hill",
    ],
  },
  {
    region: "Serendia",
    ids: [
      "serendia-genel", "biraghi-den", "orc-camp", "alejandro-farm",
      "glish-swamp", "bloody-monastery", "castle-ruins",
    ],
  },
];

export const FORT_NAMES: Record<string, string> = {
  "balenos-genel": "Balenos Geneli",
  "cron-castle": "Cron Kalesi",
  "forest-plunder": "Yağma Ormanı",
  "bartali-farm": "Bartali Çiftliği",
  "western-guard": "Batı Muhafız Kampı",
  "altar-agris": "Agris Sunağı",
  "wolf-hill": "Kurt Tepesi",
  "serendia-genel": "Serendia Geneli",
  "biraghi-den": "Biraghi İni",
  "orc-camp": "Ork Kampı",
  "alejandro-farm": "Alejandro Çiftliği",
  "glish-swamp": "Glish Bataklığı",
  "bloody-monastery": "Kanlı Manastır",
  "castle-ruins": "Kale Harabeleri",
};

type RawMap = { h: string; s: Shape[] };

/** Ham JSON'u kimlikli katalog haline getirir — sıra kaynaktaki sırayla aynı */
export function buildForts(balenos: RawMap[], serendia: RawMap[]): FortMap[] {
  const out: FortMap[] = [];
  for (const { region, ids } of FORT_IDS) {
    const raw = region === "Balenos" ? balenos : serendia;
    ids.forEach((id, i) => {
      const r = raw[i];
      if (!r) return;
      out.push({ id, region, name: FORT_NAMES[id] ?? id, source: r.h, shapes: r.s });
    });
  }
  return out;
}

/**
 * Haritanın açılışta oturacağı kutu.
 *
 * Kale haritalarında Velia/Olvia gibi uzak referans daireleri de var; hepsini
 * kapsayacak şekilde oturtunca kale ekranın köşesinde noktacık kalıyor.
 * Kaynakta kale bölgesi zaten bir dikdörtgenle işaretli — varsa ona
 * odaklanıyoruz. Bölge haritalarında dikdörtgen ya yok (Balenos) ya da
 * bölgenin tamamını çevreliyor (Serendia), ikisi de doğru sonuç veriyor.
 */
export function focusBounds(shapes: Shape[]) {
  const boxes = shapes.filter((s) => s.t === "r");
  return shapeBounds(boxes.length > 0 ? boxes : shapes);
}

/** Şekillerin kapladığı koordinat kutusu */
export function shapeBounds(shapes: Shape[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const put = (x: number, y: number, pad = 0) => {
    x0 = Math.min(x0, x - pad); x1 = Math.max(x1, x + pad);
    y0 = Math.min(y0, y - pad); y1 = Math.max(y1, y + pad);
  };
  for (const s of shapes) {
    if (s.t === "c") put(s.p[0], s.p[1], s.r);
    else if (s.t === "r") { put(s.p[0], s.p[1]); put(s.p[2], s.p[3]); }
    else if (s.t === "l") for (let i = 0; i + 1 < s.p.length; i += 2) put(s.p[i], s.p[i + 1]);
    else put(s.p[0], s.p[1]);
  }
  if (!isFinite(x0)) return null;
  return { x0, y0, x1, y1 };
}

// ── Kale rehberi ────────────────────────────────────────────────────────

/** Rehberdeki ekran görüntüleri garmoth'un guide klasöründen geliyor */
export const guideImg = (file: string) =>
  `https://assets.garmoth.com/guide/${file}`;

/** Bir kurulum noktasının rehber kaydı (bkz. data/forts/spots-tr.json) */
export type FortSpot = {
  n: number;
  dir: string;
  madpot?: boolean;
  tags: string[];
  text: string;
  img: string;
};

/** Kaynaktaki kale etiketi → katalog kimliği */
const LABEL_TO_ID: Record<string, string> = {
  "CRON CASTLE": "cron-castle",
  "FOREST OF PLUNDER": "forest-plunder",
  "BARTALI FARM": "bartali-farm",
  "WESTERN GUARD CAMP": "western-guard",
  "WESTERN GUARDN CAMP": "western-guard",
  "ALTAR OF AGRIS": "altar-agris",
  "WOLF HILL": "wolf-hill",
  "BIRAGHI DEN": "biraghi-den",
  "ORC CAMP": "orc-camp",
  "ALEJANDRO FARM": "alejandro-farm",
  "GLISH SWAMP": "glish-swamp",
  "BLOODY MONASTERY": "bloody-monastery",
  "CASTLE RUINS": "castle-ruins",
};

/**
 * Bölge haritasındaki kale ikonunun hangi kaleye ait olduğunu bulur.
 *
 * Kaynak veride ikon ile adı ayrı şekiller; ikisini bağlayan bir alan yok.
 * En yakın kale etiketine bakmak yetiyor — etiketler ikonların hemen
 * üstünde duruyor ve kaleler birbirinden uzak, karışma ihtimali yok.
 */
export function fortIdAt(shapes: Shape[], x: number, y: number): string | null {
  let best: { id: string; d: number } | null = null;
  for (const s of shapes) {
    if (s.t !== "t") continue;
    const id = LABEL_TO_ID[s.x.trim()];
    if (!id) continue;
    const d = Math.hypot(s.p[0] - x, s.p[1] - y);
    if (!best || d < best.d) best = { id, d };
  }
  // 6 koordinat birimi ~ kale çapı; ötesi başka bir kalenin etiketi
  return best && best.d < 6 ? best.id : null;
}
