import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * bdocodex drop listesi.
 *
 * İki numara var ve karıştırılması kolay: adres çubuğundaki node numarası
 * (`/tr/node/2111/`) sayfanın kimliği, drop tablosunun kimliği ise başka
 * (2111 için 1689). Hazır spotlarda ikisi de elimizde; kullanıcı kendi
 * linkini yapıştırdığında `?page=` ile geliyor ve tablo kimliği sayfadan
 * çözülüyor — kimse iki numarayı ayrı ayrı bulmak zorunda kalmasın.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:151.0) Gecko/20100101 Firefox/151.0";

function parseIconUrl(iconHtml: string): string {
  const match = iconHtml.match(/\[img src="([^"]+)"/);
  return match ? `https://bdocodex.com${match[1]}` : "";
}

function parseName(nameHtml: string): string {
  return nameHtml.replace(/<[^>]+>/g, "").trim();
}

/** Sayfadan drop tablosu kimliğini ve bölge adını çıkarır */
async function resolveNodePage(page: string) {
  const res = await fetch(`https://bdocodex.com/tr/node/${page}/`, {
    headers: { "User-Agent": UA, "Accept-Language": "tr,en;q=0.9" },
  });
  if (!res.ok) return null;

  const html = await res.text();
  const drop = html.match(/type=nodedrop&id=(\d+)/);
  if (!drop) return null;

  const title = html.match(/<title>([^<]*?)\s*-\s*BDO Codex<\/title>/);
  return { dropId: drop[1], name: title?.[1]?.trim() || `Node ${page}` };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const page = q.get("page");

  let nodeId = q.get("nodeId");
  let refNodeId = q.get("refNodeId") ?? nodeId;
  let name: string | undefined;

  if (page) {
    if (!/^\d+$/.test(page)) {
      return NextResponse.json({ error: "Node numarası yalnızca rakam olmalı." }, { status: 400 });
    }
    try {
      const resolved = await resolveNodePage(page);
      if (!resolved) {
        return NextResponse.json(
          { error: `Node ${page} bulunamadı ya da drop listesi yok.` },
          { status: 404 },
        );
      }
      nodeId = resolved.dropId;
      refNodeId = page;
      name = resolved.name;
    } catch {
      return NextResponse.json({ error: "bdocodex sayfası okunamadı." }, { status: 502 });
    }
  }

  if (!nodeId) {
    return NextResponse.json({ error: "nodeId ya da page gerekli." }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://bdocodex.com/query.php?a=items&type=nodedrop&id=${nodeId}&l=tr`,
      {
        headers: {
          "User-Agent": UA,
          "Accept": "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "tr,en;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
          // Hotlink koruması sayfanın kendisinden gelmemizi bekliyor
          "Referer": `https://bdocodex.com/tr/node/${refNodeId}/`,
          "Cookie": "bddatabaselang=tr",
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `bdocodex HTTP ${res.status}` }, { status: 502 });
    }

    // Yanıt BOM ile geliyor; JSON.parse onu sindirmiyor
    const data = JSON.parse((await res.text()).replace(/^﻿/, ""));
    if (!data.aaData) {
      return NextResponse.json({ error: "bdocodex boş yanıt verdi." }, { status: 502 });
    }

    const items = (data.aaData as unknown[][]).map((row) => ({
      id: row[0] as number,
      icon: parseIconUrl(String(row[1])),
      name: parseName(String(row[2])),
      grade: row[5] as number,
      hasMarket: String(row[6] ?? "").startsWith("[1"),
    }));

    return NextResponse.json({ items, name });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Drop listesi alınamadı." },
      { status: 500 },
    );
  }
}
