export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { levelLabels, type LevelStats } from "@/lib/gear";

/**
 * Bir eşyanın basma seviyesi başına statları.
 *
 * Kendi `gamedata` şemamızda bu değerler YOK — kuşanım eşyalarının
 * gövdesinde tek bir stat alanı bile bulunmuyor, yalnızca `enhancement`
 * referansı var. bdocodex ise seviye tablosunu sayfaya `enchantment_array`
 * adlı bir JSON olarak gömüyor; buradan okunuyor.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0";

/** Statlar yalnizca yama ile degisiyor; konteyner omru boyunca saklamak yeterli */
const CACHE_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: LevelStats[] }>();

/** "14~14" ya da 14 ya da "3" -> 14 / 3 */
function sayi(v: unknown): number {
  if (typeof v === "number") return v;
  const m = /^\s*(\d+)/.exec(String(v ?? ""));
  return m ? parseInt(m[1], 10) : 0;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");
  const maxEnhance = Number(url.searchParams.get("max") ?? 0);
  if (!itemId || !/^\d+$/.test(itemId)) {
    return NextResponse.json({ error: "Geçerli bir itemId gerekli." }, { status: 400 });
  }

  const anahtar = `${itemId}|${maxEnhance}`;
  const hit = cache.get(anahtar);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json({ levels: hit.data });

  try {
    const res = await fetch(`https://bdocodex.com/us/item/${itemId}/`, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://bdocodex.com/us/" },
    });
    if (!res.ok) return NextResponse.json({ levels: [] });

    const html = await res.text();
    const ham = /enchantment_array\s*=\s*(\{[\s\S]*?\});/.exec(html);
    if (!ham) return NextResponse.json({ levels: [] });

    let tablo: Record<string, Record<string, unknown>>;
    try {
      tablo = JSON.parse(ham[1]);
    } catch {
      return NextResponse.json({ levels: [] });
    }

    // "na" ve "max_enchant" gibi sayisal olmayan anahtarlar seviye degil
    const seviyeler = Object.keys(tablo)
      .filter((k) => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b);

    const etiketler = levelLabels(maxEnhance || seviyeler[seviyeler.length - 1] || 0);

    const levels: LevelStats[] = seviyeler.map((lv) => {
      const v = tablo[String(lv)];
      return {
        level: lv,
        label: etiketler[lv] ?? `+${lv}`,
        ap: sayi(v.damage),
        dp: sayi(v.defense),
        accuracy: sayi(v.accuracy),
        evasion: sayi(v.evasion),
        damageReduction: sayi(v.dreduction),
      };
    });

    cache.set(anahtar, { at: Date.now(), data: levels });
    return NextResponse.json({ levels });
  } catch {
    return NextResponse.json({ levels: [] });
  }
}
