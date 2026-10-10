import crypto from "node:crypto";

/**
 * Bunny Stream — klip arşivinin depolama katmanı.
 *
 * Dosya bizim sunucumuza hiç uğramıyor: biz Bunny'de boş bir video
 * kaydı açıp tarayıcıya imzalı bir yükleme izni veriyoruz, tarayıcı
 * dosyayı doğrudan Bunny'ye gönderiyor. Böylece 2 çekirdekli VPS'in
 * bant genişliği ve Next'in gövde sınırı devreye girmiyor, bir de
 * kopan yükleme TUS sayesinde kaldığı yerden devam ediyor.
 *
 * API anahtarı yalnızca burada, sunucu tarafında okunuyor.
 */

const API = "https://video.bunnycdn.com";

function ayar() {
  const kutuphane = process.env.BUNNY_STREAM_LIBRARY_ID;
  const anahtar = process.env.BUNNY_STREAM_API_KEY;
  const cdn = process.env.BUNNY_STREAM_CDN;
  if (!kutuphane || !anahtar || !cdn) return null;
  return { kutuphane, anahtar, cdn };
}

/** Bunny tanımlı mı — uçlar buna bakıp düzgün hata veriyor */
export const bunnyHazir = () => ayar() !== null;

export type BunnyVideo = {
  guid: string;
  title: string;
  /** 0 oluşturuldu · 1 yüklendi · 2 işleniyor · 3 kodlanıyor · 4 hazır · 5 hata · 6 yükleme başarısız */
  status: number;
  length: number;
  views: number;
};

async function istek<T>(yol: string, secenek: RequestInit = {}): Promise<T> {
  const a = ayar();
  if (!a) throw new Error("Bunny Stream ayarlı değil");
  const r = await fetch(`${API}/library/${a.kutuphane}${yol}`, {
    ...secenek,
    headers: { Accept: "application/json", AccessKey: a.anahtar, ...(secenek.headers ?? {}) },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Bunny ${r.status}: ${await r.text().catch(() => "")}`);
  return (r.status === 204 ? null : await r.json()) as T;
}

/** Boş video kaydı açar; dosya henüz yok, yalnız kimlik üretiliyor */
export async function videoOlustur(baslik: string): Promise<string> {
  const v = await istek<{ guid: string }>("/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: baslik.slice(0, 120) }),
  });
  return v.guid;
}

export const videoGetir = (guid: string) => istek<BunnyVideo>(`/videos/${guid}`);

export const videoSil = (guid: string) => istek<unknown>(`/videos/${guid}`, { method: "DELETE" });

/**
 * Tarayıcının TUS ile yükleyebilmesi için imza.
 *
 * İmza = sha256(kütüphane + apiKey + sonKullanma + videoId). Bunny
 * başlıklardaki değerlerle imzayı birebir karşılaştırdığı için dördünü
 * birlikte döndürüyoruz.
 */
export function yuklemeIzni(guid: string, saniye = 6 * 3600) {
  const a = ayar();
  if (!a) throw new Error("Bunny Stream ayarlı değil");
  const biter = Math.floor(Date.now() / 1000) + saniye;
  const imza = crypto.createHash("sha256")
    .update(`${a.kutuphane}${a.anahtar}${biter}${guid}`)
    .digest("hex");
  return { kutuphaneId: a.kutuphane, videoId: guid, biter, imza, uc: `${API}/tusupload` };
}

/** Oynatıcı adresi — iframe ile gömülüyor */
export function oynatici(guid: string) {
  const a = ayar();
  return a ? `https://iframe.mediadelivery.net/embed/${a.kutuphane}/${guid}` : "";
}

/** Küçük resim ve önizleme, pull zone üzerinden */
export function gorseller(guid: string) {
  const a = ayar();
  if (!a) return { kapak: "", onizleme: "" };
  return {
    kapak: `https://${a.cdn}/${guid}/thumbnail.jpg`,
    onizleme: `https://${a.cdn}/${guid}/preview.webp`,
  };
}
