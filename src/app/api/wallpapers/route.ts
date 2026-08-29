export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

/**
 * Panelden yapilan degisiklik aninda gorunsun.
 * Bu uclar hic cache-control gondermiyordu; tarayici kendi
 * kestirimiyle onbellege aliyor ve slogan/metin degismis gibi
 * gorunmuyordu.
 */
const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/**
 * Karşılama ekranının arka plan görselleri.
 *
 * Klasör çalışma anında okunuyor ki yeni duvar kâğıdı eklemek kod
 * değişikliği gerektirmesin — dosyayı `public/wallpapers/` içine koymak
 * yetiyor. Uç oturumsuz, çünkü ekranın kendisi de öyle.
 */

const UZANTI = /\.(webp|jpe?g|png|avif)$/i;

let bellek: { at: number; files: string[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function GET() {
  if (bellek && Date.now() - bellek.at < CACHE_MS) {
    return NextResponse.json({ files: bellek.files }, { headers: NO_STORE });
  }

  try {
    const dizin = path.join(process.cwd(), "public", "wallpapers");
    const hepsi = await readdir(dizin);
    const files = hepsi
      .filter((f) => UZANTI.test(f))
      .sort()
      .map((f) => `/wallpapers/${encodeURIComponent(f)}`);

    bellek = { at: Date.now(), files };
    return NextResponse.json({ files }, { headers: NO_STORE });
  } catch {
    // Klasör yoksa ekran düz zeminle açılsın, hata vermesin
    return NextResponse.json({ files: [] }, { headers: NO_STORE });
  }
}
