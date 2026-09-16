export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";

/** Güncelleyicinin indirdiği dosya — release varlığı, uygulama anahtarıyla (bkz. update ucu) */
const REPO = "Hoixi/aetherion-companion";

export async function GET(req: Request) {
  return withApp(req, async () => {
    const token = process.env.COMPANION_GITHUB_TOKEN;
    if (!token) return appError("Güncelleme kaynağı ayarlı değil.", 503);
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return appError("id gerekli.", 400);
    const bin = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${id}`, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "aetheri.online (companion update)", Accept: "application/octet-stream" },
      redirect: "follow",
    });
    if (!bin.ok || !bin.body) return appError("Dosya alınamadı.", 502);
    const len = bin.headers.get("content-length");
    return new Response(bin.body, { headers: { ...APP_HEADERS, "Content-Type": "application/octet-stream", ...(len ? { "Content-Length": len } : {}) } });
  });
}
