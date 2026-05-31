import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  try {
    const res = await fetch(`https://bdocodex.com/tr/item/${itemId}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
        "Accept": "text/html",
        "Referer": "https://bdocodex.com/tr/",
      },
    });

    const html = await res.text();

    // Market price
    const priceMatch = html.match(/real_item_prices\s*=\s*(\{[^;]+\})/);
    if (priceMatch) {
      try {
        const priceData = JSON.parse(priceMatch[1]);
        const entries: [string, string][] = priceData?.prices?.MENA ?? [];
        if (entries.length > 0) {
          const basePrice = parseInt(entries[0][0], 10);
          return NextResponse.json({ type: "market", price: basePrice });
        }
      } catch {}
    }

    // NPC sell price fallback
    const npcMatch = html.match(/sellprice[^\d]*(\d+)/i) || html.match(/"sell_price"[^\d]*(\d+)/i);
    if (npcMatch) {
      return NextResponse.json({ type: "npc", price: parseInt(npcMatch[1], 10) });
    }

    return NextResponse.json({ type: "unknown", price: 0 });
  } catch {
    return NextResponse.json({ type: "unknown", price: 0 });
  }
}
