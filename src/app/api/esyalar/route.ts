export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { searchItems, itemFacets, type Locale } from "@/lib/gamedata";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const num = (k: string) => {
    const v = url.searchParams.get(k);
    return v === null || v === "" ? undefined : Number(v);
  };
  const str = (k: string) => url.searchParams.get(k) || undefined;

  const locale = (str("locale") === "en" ? "en" : "tr") as Locale;

  try {
    const [result, facets] = await Promise.all([
      searchItems({
        q: str("q"),
        grade: num("grade"),
        slot: str("slot"),
        marketCategory: str("kategori"),
        locale,
        limit: num("limit") ?? 60,
        offset: num("offset") ?? 0,
      }),
      // Facet'ler sabit; sadece ilk sayfada gonderiliyor.
      (num("offset") ?? 0) === 0 ? itemFacets(locale) : Promise.resolve(null),
    ]);

    return NextResponse.json({ ...result, facets });
  } catch (err) {
    // gamedata semasi henuz yuklenmemis olabilir - bunu 500 yerine acikca soyle.
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    if (/relation .*gamedata/.test(message)) {
      return NextResponse.json(
        { error: "Eşya veritabanı henüz yüklenmemiş (gamedata şeması yok)." },
        { status: 503 },
      );
    }
    console.error("[esyalar] arama hatasi:", message);
    return NextResponse.json({ error: "Eşyalar getirilemedi." }, { status: 500 });
  }
}
