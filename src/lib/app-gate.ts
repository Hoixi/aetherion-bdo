import { NextResponse } from "next/server";
import { authenticateApp, type AppActor } from "@/lib/app-auth";

/**
 * Uygulama uçlarının ortak kapısı: Bearer anahtarı çözer, yoksa 401.
 * `/api/app/*` altındaki her uç bunu kullanıyor ki kimlik denetimi tek
 * yerde dursun.
 */
export async function withApp<T>(
  req: Request,
  fn: (actor: AppActor) => Promise<T>,
): Promise<T | NextResponse> {
  const actor = await authenticateApp(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return fn(actor);
}

/** Uygulama uçları önbelleğe alınmasın */
export const APP_HEADERS = { "Cache-Control": "no-store" };
