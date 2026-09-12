export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { appError, APP_HEADERS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { redeemPairCode } from "@/lib/app-auth";

/**
 * Uygulama kodu sunar, kalıcı anahtar alır. Oturumsuz — uygulamanın
 * henüz kimliği yok. Kod tek kullanımlık ve 5 dakikalık olduğu için
 * kaba kuvvete açık yüzey küçük; yine de yanlış kodda ayrıntı verilmiyor.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { code?: string; label?: string };
  if (!body.code || typeof body.code !== "string") {
    return appError("Kod gerekli.", 400);
  }
  const r = await redeemPairCode(body.code, String(body.label ?? "Bilinmeyen cihaz"));
  if (!r) return appError("Kod geçersiz ya da süresi dolmuş.", 400);
  return NextResponse.json({ token: r.token }, { headers: APP_HEADERS });
}
