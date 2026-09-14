export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/**
 * Companion kurulum dosyası — GitHub Release'ten üyeye aktarılır.
 *
 * Depo özel (kaynak dışarı açık değil); release dosyaları da yetkisiz
 * indirilemez. Sunucu, salt okunur bir GitHub token'ıyla (env
 * `COMPANION_GITHUB_TOKEN`, yalnızca o deponun içeriğini okur) en son
 * sürümün `.exe`'sini alıp giriş yapmış üyeye akıtır. Böylece indirme
 * bağlantısı da üyelere özel kalır.
 */

const REPO = "Hoixi/aetherion-companion";
const UA = "aetheri.online (companion download)";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.COMPANION_GITHUB_TOKEN;
  if (!token) return NextResponse.json({ error: "İndirme henüz açılmadı (sunucu anahtarı yok)." }, { status: 503 });

  const gh = { Authorization: `Bearer ${token}`, "User-Agent": UA, "X-GitHub-Api-Version": "2022-11-28" };
  const rel = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { ...gh, Accept: "application/vnd.github+json" },
    next: { revalidate: 300 },
  });
  if (!rel.ok) return NextResponse.json({ error: "Sürüm bilgisi alınamadı." }, { status: 502 });
  const r = (await rel.json()) as { tag_name: string; assets: Array<{ id: number; name: string; size: number }> };
  const asset = r.assets.find((a) => /-setup\.exe$/i.test(a.name)) ?? r.assets.find((a) => a.name.endsWith(".exe"));
  if (!asset) return NextResponse.json({ error: "Sürümde kurulum dosyası yok." }, { status: 404 });

  const bin = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`, {
    headers: { ...gh, Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if (!bin.ok || !bin.body) return NextResponse.json({ error: "Dosya alınamadı." }, { status: 502 });

  return new Response(bin.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="Aetherion-Companion-${r.tag_name}-setup.exe"`,
      "Content-Length": String(asset.size),
      "Cache-Control": "private, no-store",
    },
  });
}
