export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";

/**
 * Tauri güncelleyici bildirimi.
 *
 * Uygulama açılışta buraya bakar (Bearer anahtarıyla). GitHub Release'teki
 * `latest.json` (tauri-action üretir, imzalı) okunur; indirme adresi özel
 * depodan doğrudan çekilemeyeceği için sitenin `asset` ucuna çevrilir —
 * güncelleyici aynı Authorization başlığını oraya da yollar.
 * Sürüm eşitse 204: güncelleme yok.
 */

const REPO = "Hoixi/aetherion-companion";
const UA = "aetheri.online (companion update)";

export async function GET(req: Request) {
  return withApp(req, async () => {
    const token = process.env.COMPANION_GITHUB_TOKEN;
    if (!token) return appError("Güncelleme kaynağı ayarlı değil.", 503);
    const gh = { Authorization: `Bearer ${token}`, "User-Agent": UA, "X-GitHub-Api-Version": "2022-11-28" };

    const rel = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { ...gh, Accept: "application/vnd.github+json" }, next: { revalidate: 300 } });
    if (!rel.ok) return appError("Sürüm bilgisi alınamadı.", 502);
    const r = (await rel.json()) as { tag_name: string; assets: Array<{ id: number; name: string }> };
    const manifest = r.assets.find((a) => a.name === "latest.json");
    if (!manifest) return new NextResponse(null, { status: 204, headers: APP_HEADERS });

    const m = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${manifest.id}`, { headers: { ...gh, Accept: "application/octet-stream" }, redirect: "follow" });
    if (!m.ok) return appError("Bildirim alınamadı.", 502);
    const j = (await m.json()) as { version: string; notes?: string; pub_date?: string; platforms: Record<string, { signature: string; url: string }> };

    const current = new URL(req.url).searchParams.get("current") ?? "";
    if (current && current === j.version) return new NextResponse(null, { status: 204, headers: APP_HEADERS });

    // İndirme adresini sitenin proxy'sine çevir (asset id ile). Konteyner
    // içinde req.url "localhost:3000" — dış adres sabit.
    const kok = (process.env.NEXTAUTH_URL ?? "https://aetheri.online").replace(/\/$/, "");
    const platforms: typeof j.platforms = {};
    for (const [k, v] of Object.entries(j.platforms)) {
      const dosya = decodeURIComponent(v.url.split("/").pop() ?? "");
      const asset = r.assets.find((a) => a.name === dosya);
      if (!asset) continue;
      platforms[k] = { signature: v.signature, url: `${kok}/api/companion/asset?id=${asset.id}` };
    }
    return NextResponse.json({ version: j.version, notes: j.notes ?? "", pub_date: j.pub_date, platforms }, { headers: APP_HEADERS });
  });
}
