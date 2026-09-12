import { NextRequest, NextResponse } from "next/server";
import { getMarketPrice } from "@/lib/market-price";

export const dynamic = "force-dynamic";

/** Fiyat mantığı `lib/market-price.ts`e taşındı; uygulama da aynı önbelleği kullanıyor. */
export async function GET(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId");
  if (!itemId || !/^\d+$/.test(itemId)) {
    return NextResponse.json({ error: "Geçerli bir itemId gerekli." }, { status: 400 });
  }
  return NextResponse.json(await getMarketPrice(itemId));
}
