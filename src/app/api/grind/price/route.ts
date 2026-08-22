import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Eşyanın pazar fiyatı.
 *
 * bdocodex fiyatı artık sayfaya gömmüyor: sayfada yalnızca bir token
 * duruyor, fiyat onunla `/ajax.php`ye ikinci bir istek atılarak alınıyor.
 * Eski kod sayfadaki `real_item_prices.prices.MENA` alanını okuyordu; o
 * alan kalktığı için grind tracker'daki bütün fiyatlar sıfır görünüyordu.
 *
 * Bir de dil tuzağı var: `l=tr` boş dizi döndürüyor (MENA verisi yok),
 * `l=us` NA ve EU'yu birlikte veriyor. Bu yüzden istek her zaman `us`
 * üzerinden gidiyor ve EU tercih ediliyor.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0";

/** Tercih sırası: klan EU'da oynuyor, NA yalnızca yedek */
const BOLGELER = ["EU", "NA", "KR"];

type Kayit = { type: "market" | "npc" | "unknown"; price: number; region?: string };

/**
 * Fiyatlar dakikalar içinde kayda değer oynamıyor ama tek bir grind
 * listesi 25 eşya × 2 istek demek. Aynı konteyner içinde kısa süre
 * saklamak hem bdocodex'e hem sayfaya iyi geliyor.
 */
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: Kayit }>();

export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId || !/^\d+$/.test(itemId)) {
    return NextResponse.json({ error: "Geçerli bir itemId gerekli." }, { status: 400 });
  }

  const hit = cache.get(itemId);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.data);

  const sonuc = await fiyatiBul(itemId);
  cache.set(itemId, { at: Date.now(), data: sonuc });
  return NextResponse.json(sonuc);
}

async function fiyatiBul(itemId: string): Promise<Kayit> {
  try {
    const sayfa = await fetch(`https://bdocodex.com/us/item/${itemId}/`, {
      headers: { "User-Agent": UA, Accept: "text/html", Referer: "https://bdocodex.com/us/" },
    });
    if (!sayfa.ok) return { type: "unknown", price: 0 };
    const html = await sayfa.text();

    const ham = html.match(/real_item_prices\s*=\s*(\{[^;]+\})/);
    if (!ham) return npcFiyati(html);

    let bilgi: { id?: number; token?: string; prices?: Record<string, [string, string][]> };
    try {
      bilgi = JSON.parse(ham[1]);
    } catch {
      return npcFiyati(html);
    }

    // Fiyatlar hâlâ sayfada gömülü geliyorsa ikinci isteğe gerek yok
    let fiyatlar = bilgi.prices;

    if (!fiyatlar && bilgi.token && bilgi.id !== undefined) {
      const res = await fetch("https://bdocodex.com/ajax.php", {
        method: "POST",
        headers: {
          "User-Agent": UA,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
          Referer: `https://bdocodex.com/us/item/${itemId}/`,
        },
        body: new URLSearchParams({
          a: "real_price",
          token: bilgi.token,
          id: String(bilgi.id),
          l: "us",
        }),
      });
      if (res.ok) {
        // Yanıt BOM ile geliyor
        const j = JSON.parse((await res.text()).replace(/^﻿/, ""));
        // Veri yoksa sunucu dizi döndürüyor, nesne değil
        if (j?.result === 1 && j.data && !Array.isArray(j.data)) fiyatlar = j.data;
      }
    }

    if (fiyatlar) {
      const bolge =
        BOLGELER.find((b) => fiyatlar![b]?.[0]?.[0]) ??
        Object.keys(fiyatlar).find((b) => fiyatlar![b]?.[0]?.[0]);
      if (bolge) {
        // Her bölge büyütme seviyesine göre dizi; taban seviye 0
        const fiyat = parseInt(fiyatlar[bolge][0][0], 10);
        if (Number.isFinite(fiyat) && fiyat > 0) {
          return { type: "market", price: fiyat, region: bolge };
        }
      }
    }

    return npcFiyati(html);
  } catch {
    return { type: "unknown", price: 0 };
  }
}

/** Pazarda listelenmeyen eşyalar için NPC satış bedeli */
function npcFiyati(html: string): Kayit {
  const m = html.match(/sellprice[^\d]*(\d+)/i) ?? html.match(/"sell_price"[^\d]*(\d+)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return { type: "npc", price: n };
  }
  return { type: "unknown", price: 0 };
}
