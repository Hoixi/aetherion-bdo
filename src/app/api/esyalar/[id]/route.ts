export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getItem, type Locale } from "@/lib/gamedata";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // URL'de sade sayi (10010) ya da tam urn gelebilir.
  const raw = decodeURIComponent(params.id);
  const urn = raw.startsWith("urn::") ? raw : `urn::item:${raw}`;
  if (!/^urn::item:\d+$/.test(urn)) {
    return NextResponse.json({ error: "Geçersiz eşya kimliği." }, { status: 400 });
  }

  const locale = (new URL(req.url).searchParams.get("locale") === "en" ? "en" : "tr") as Locale;

  try {
    const item = await getItem(urn, locale);
    if (!item) return NextResponse.json({ error: "Eşya bulunamadı." }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[esyalar] detay hatasi:", message);
    return NextResponse.json({ error: "Eşya getirilemedi." }, { status: 500 });
  }
}
