import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseIconUrl(iconHtml: string): string {
  const match = iconHtml.match(/\[img src="([^"]+)"/);
  return match ? `https://bdocodex.com${match[1]}` : "";
}

function parseName(nameHtml: string): string {
  return nameHtml.replace(/<[^>]+>/g, "").trim();
}

export async function GET(req: NextRequest) {
  const nodeId = req.nextUrl.searchParams.get("nodeId");
  if (!nodeId) return NextResponse.json({ error: "nodeId required" }, { status: 400 });

  const refNodeId = req.nextUrl.searchParams.get("refNodeId") ?? nodeId;

  try {
    const res = await fetch(
      `https://bdocodex.com/query.php?a=items&type=nodedrop&id=${nodeId}&l=tr`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": `https://bdocodex.com/tr/node/${refNodeId}/`,
          "Cookie": "__lhash_=6ea4bbd51bf766995108169dc7119448; bddatabaselang=tr; __js_p_=237,2700,0,0,0",
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: `bdocodex HTTP ${res.status}` }, { status: 502 });
    }

    const text = await res.text();
    // Remove UTF-8 BOM if present
    const clean = text.replace(/^﻿/, "");
    const data = JSON.parse(clean);

    if (!data.aaData) {
      return NextResponse.json({ error: "No data returned from bdocodex" }, { status: 502 });
    }

    const items = (data.aaData as any[]).map((row) => {
      const hasMarket = row[6]?.startsWith("[1") ?? false;
      return {
        id: row[0],
        icon: parseIconUrl(row[1]),
        name: parseName(row[2]),
        grade: row[5] as number,
        hasMarket,
      };
    });

    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed to fetch drops" }, { status: 500 });
  }
}
