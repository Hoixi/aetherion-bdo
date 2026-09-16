export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { islemeRapor, raporuGetir } from "@/lib/performance-report";

export const maxDuration = 60;

/** Uygulamadan hasar raporu: GET liste (herkes), POST görüntü yükle (yönetici) — JSON gövde, base64 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return withApp(req, async () => {
    const warId = Number(params.id);
    if (!Number.isInteger(warId)) return appError("Geçersiz savaş.", 400);
    return NextResponse.json(await raporuGetir(warId), { headers: APP_HEADERS });
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApp(req, async (me) => {
    if (!me.isAdmin && !me.isGuildAdmin) return appError("Rapor yüklemek yöneticiye özel.", 403);
    const warId = Number(params.id);
    if (!Number.isInteger(warId)) return appError("Geçersiz savaş.", 400);
    const b = (await req.json().catch(() => ({}))) as { imageBase64?: string; mimeType?: string; clear?: boolean };
    if (!b.imageBase64 || b.imageBase64.length < 100) return appError("Görüntü gerekli.", 400);
    if (b.imageBase64.length > 12_000_000) return appError("Görüntü çok büyük (≤ 8 MB).", 413);
    try {
      const sonuc = await islemeRapor(warId, b.imageBase64, b.mimeType || "image/png", !!b.clear);
      return NextResponse.json(sonuc, { headers: APP_HEADERS });
    } catch (e) { return appError(e instanceof Error ? e.message : "Rapor işlenemedi.", 500); }
  });
}
