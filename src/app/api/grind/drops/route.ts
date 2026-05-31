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

  try {
    const res = await fetch(
      `https://bdocodex.com/query.php?a=items&type=nodedrop&id=${nodeId}&l=tr`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0",
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": "https://bdocodex.com/tr/",
        },
      }
    );

    const text = await res.text();
    // Remove BOM if present
    const clean = text.replace(/^﻿/, "");
    const data = JSON.parse(clean);

    const items = (data.aaData as any[]).map((row) => {
      const hasMarket = row[6]?.startsWith("[1") ?? false;
      return {
        id: row[0],
        icon: parseIconUrl(row[1]),
        name: parseName(row[2]),
        grade: row[5] as number, // 0=gray,1=white,2=green,3=blue,4=yellow
        hasMarket,
      };
    });

    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch drops" }, { status: 500 });
  }
}
