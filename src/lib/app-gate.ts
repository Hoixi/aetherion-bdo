import { NextResponse } from "next/server";
import { authenticateApp, type AppActor } from "@/lib/app-auth";

/**
 * Uygulama uçlarının ortak kapısı ve CORS'u.
 *
 * Masaüstü uygulamasının webview'ı `tauri.localhost` (geliştirmede
 * `localhost:1420`) kökeninden istek atıyor; tarayıcı motoru bunu CORS
 * ile kesiyordu ("Failed to fetch"). Köken `*`: anahtar Authorization
 * başlığında, çerez yok — kötü niyetli bir sayfa anahtara ulaşamadığı
 * için açık köken hiçbir şey vermiyor. Yalnızca uygulamanın kullandığı
 * uçlar bunu alıyor; site oturumuyla çalışan pair/tokens almıyor.
 */

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

/** Uygulama uçları önbelleğe alınmasın + CORS */
export const APP_HEADERS = { "Cache-Control": "no-store", ...CORS_HEADERS };

/** Ön uçuş (preflight). Her uygulama ucu bunu yeniden dışa aktarır. */
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function withApp<T>(
  req: Request,
  fn: (actor: AppActor) => Promise<T>,
): Promise<T | NextResponse> {
  const actor = await authenticateApp(req);
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: APP_HEADERS });
  }
  return fn(actor);
}

/** Hata cevapları da CORS taşısın; yoksa uygulama gerçek hatayı göremez */
export const appError = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: APP_HEADERS });
