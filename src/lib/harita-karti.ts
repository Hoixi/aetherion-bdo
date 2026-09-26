import sharp, { type OverlayOptions } from "sharp";

/**
 * Oyunun kendi haritasından bir kesit + üstüne olay ısısı — PNG.
 *
 * Sitedeki Leaflet haritasının sunucu tarafındaki karşılığı: aynı karo
 * piramidinden (bkz. `bdo-harita.ts`) gerekli karolar indirilip
 * birleştiriliyor, üstüne ölüm/kill lekeleri basılıyor. Discord'a giden
 * savaş özeti kartı bunu kullanıyor; tarayıcı yok, canvas yok.
 *
 * Karo satırları yukarı doğru numaralı (TMS): dosya adındaki satır
 * `-y - 1`. Bu istemcideki `karoSatiri` ile aynı kural.
 */

const KARO_PX = 128;
const MAX_KARO_ZOOM = 8;
/** 8. seviyede bir piksel kaç oyun birimi */
const BIRIM_Z8 = 100;

const KARO_TABAN =
  process.env.HARITA_KARO ??
  process.env.NEXT_PUBLIC_HARITA_KARO ??
  "https://aetheri.online/karo";

export interface IsiNoktasi {
  x: number;
  z: number;
  /** true → bizim kill (yeşil), false → ölümümüz (kırmızı) */
  kill: boolean;
}

/** Bir zoom seviyesinde bir pikselin kaç oyun birimi olduğu */
const birimBoyu = (zoom: number) => BIRIM_Z8 * 2 ** (MAX_KARO_ZOOM - zoom);

/**
 * Noktaların hepsi çerçeveye sığsın diye en yakın zoom: kayıt dar bir
 * alanda geçtiyse yakınlaşıyor, dağınıksa uzaklaşıyor.
 */
function zoomSec(noktalar: IsiNoktasi[], genislik: number, yukseklik: number) {
  const xs = noktalar.map((n) => n.x), zs = noktalar.map((n) => n.z);
  const enX = Math.max(...xs) - Math.min(...xs);
  const enZ = Math.max(...zs) - Math.min(...zs);
  // Kenarlarda nefes payı: yayılımın 1.6 katı sığsın
  const gerekX = Math.max(enX * 1.6, 8000) / genislik;
  const gerekZ = Math.max(enZ * 1.6, 8000) / yukseklik;
  const gerek = Math.max(gerekX, gerekZ);
  for (let z = MAX_KARO_ZOOM; z >= 2; z--) if (birimBoyu(z) >= gerek) return z;
  return 2;
}

const ort = (v: number[]) => v.reduce((s, n) => s + n, 0) / v.length;

/**
 * Kesiti üretir. Karo sunucusu kapalıysa harita yerine düz zemin döner —
 * ısı yine okunur, kart hiç üretilememektense yarım üretilsin.
 */
export async function isiKesiti(
  noktalar: IsiNoktasi[],
  { genislik = 520, yukseklik = 340 }: { genislik?: number; yukseklik?: number } = {},
): Promise<Buffer | null> {
  if (noktalar.length === 0) return null;

  const zoom = zoomSec(noktalar, genislik, yukseklik);
  const birim = birimBoyu(zoom);
  const merkezX = ort(noktalar.map((n) => n.x));
  const merkezZ = ort(noktalar.map((n) => n.z));
  // Ekran pikseli: y aşağı doğru, yani dünya Z'sinin tersi
  const sol = merkezX / birim - genislik / 2;
  const ust = -merkezZ / birim - yukseklik / 2;

  const parcalar: OverlayOptions[] = [];
  const k0 = Math.floor(sol / KARO_PX), k1 = Math.floor((sol + genislik) / KARO_PX);
  const s0 = Math.floor(ust / KARO_PX), s1 = Math.floor((ust + yukseklik) / KARO_PX);
  const istekler: Array<Promise<OverlayOptions | null>> = [];
  for (let kx = k0; kx <= k1; kx++) {
    for (let ky = s0; ky <= s1; ky++) {
      const url = `${KARO_TABAN}/world/${zoom}/${kx}/${-ky - 1}.webp`;
      const left = Math.round(kx * KARO_PX - sol);
      const top = Math.round(ky * KARO_PX - ust);
      istekler.push(
        fetch(url, { signal: AbortSignal.timeout(6000) })
          .then(async (r) => (r.ok
            ? { input: Buffer.from(await r.arrayBuffer()), left, top } as OverlayOptions
            : null))
          // Deniz karoları yok, 404 normal
          .catch(() => null),
      );
    }
  }
  for (const p of await Promise.all(istekler)) if (p) parcalar.push(p);

  const ekranX = (x: number) => x / birim - sol;
  const ekranY = (z: number) => -z / birim - ust;

  /*
    Isı, nokta nokta değil hücre hücre çiziliyor.

    600 olayın her biri için ayrı leke basınca üst üste binenler beyaza
    doyuyor ve harita okunmaz oluyordu. Bunun yerine ekran ızgaraya
    bölünüyor, her hücrede kaç ölüm kaç kill olduğu sayılıyor; hücrenin
    rengi bu dengeden (kırmızı ölüm ↔ yeşil kill), koyuluğu da olay
    sayısından geliyor. Sitedeki ısı katmanıyla aynı kural.
  */
  const HUCRE = 11;
  const hucreler = new Map<string, { x: number; y: number; olum: number; kill: number }>();
  for (const n of noktalar) {
    const px = ekranX(n.x), py = ekranY(n.z);
    if (px < -20 || py < -20 || px > genislik + 20 || py > yukseklik + 20) continue;
    const gx = Math.floor(px / HUCRE), gy = Math.floor(py / HUCRE);
    const anahtar = `${gx}:${gy}`;
    const h = hucreler.get(anahtar) ?? { x: gx * HUCRE + HUCRE / 2, y: gy * HUCRE + HUCRE / 2, olum: 0, kill: 0 };
    if (n.kill) h.kill++; else h.olum++;
    hucreler.set(anahtar, h);
  }
  if (hucreler.size === 0) return null;
  const enYogun = Math.max(...Array.from(hucreler.values()).map((h) => h.olum + h.kill));

  const lekeler = Array.from(hucreler.values()).map((h, i) => {
    const toplam = h.olum + h.kill;
    // Denge: 0 = tamamen bizim kill, 1 = tamamen ölümümüz
    const denge = h.olum / toplam;
    const r = Math.round(56 + (239 - 56) * denge);
    const g = Math.round(208 + (95 - 208) * denge);
    const b = Math.round(127 + (95 - 127) * denge);
    // Koyuluk olay sayısıyla, ama karekökle: tek olay da görünsün, yığın
    // da haritayı tamamen örtmesin
    const guc = Math.min(1, Math.sqrt(toplam / enYogun));
    const yaricap = 13 + guc * 17;
    return `<radialGradient id="h${i}" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="rgb(${r},${g},${b})" stop-opacity="${(0.25 + 0.5 * guc).toFixed(2)}"/>
        <stop offset="60%" stop-color="rgb(${r},${g},${b})" stop-opacity="${(0.08 + 0.2 * guc).toFixed(2)}"/>
        <stop offset="100%" stop-color="rgb(${r},${g},${b})" stop-opacity="0"/>
      </radialGradient>
      <circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="${yaricap.toFixed(1)}" fill="url(#h${i})"/>`;
  });

  // Çekirdekler hücre merkezinden değil olayın kendi yerinden: hücre
  // merkezine basınca ekranda kafes gibi bir nokta ızgarası çıkıyor.
  const cekirdekler = noktalar.map((n) =>
    `<circle cx="${ekranX(n.x).toFixed(1)}" cy="${ekranY(n.z).toFixed(1)}" r="1.1"
             fill="${n.kill ? "#8ff5bb" : "#ff9c9c"}" fill-opacity="0.6"/>`);

  const isiSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${genislik}" height="${yukseklik}">
    ${lekeler.join("")}
    ${cekirdekler.join("")}
  </svg>`;

  try {
    // Önce harita: karolar birleşiyor ve kısılıyor (ısı öne çıksın),
    // sonra ısı üstüne biniyor. Tek geçişte yapılamıyor çünkü kısma
    // ısıyı da soluklaştırırdı.
    // sharp işlemleri çağrı sırasına göre değil sabit bir sıraya göre
    // uyguluyor: aynı zincirde modulate, composite'ten önce çalışıp
    // yalnız boş zemini karartıyordu. Karartma ayrı geçişte.
    const karolar = await sharp({
      create: { width: genislik, height: yukseklik, channels: 3, background: "#07080a" },
    }).composite(parcalar).png().toBuffer();
    const taban = await sharp(karolar)
      .modulate({ brightness: 0.45, saturation: 0.8 })
      .png().toBuffer();

    return await sharp(taban)
      .composite([{ input: Buffer.from(isiSvg) }])
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    return null;
  }
}
