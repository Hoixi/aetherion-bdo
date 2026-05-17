export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from "@/lib/prisma";
const db = prisma as any;
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { StructuredPatchNote } from "@/lib/patch-notes-types";

const BASE = "https://blackdesert.pearlabyss.com";
const LIST_URL = `${BASE}/GlobalLab/en-US/News/Notice?_categoryNo=2`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function parseWithGemini(
  html: string,
  title: string,
  boardNo: number,
): Promise<{ titleTr: string; contentTr: string; structured: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Step 1: Translate the full HTML (for fallback rendering)
  const translatePrompt = `You are a professional game translator. Translate the following Black Desert Online Global Lab patch note HTML from English to Turkish.

Rules:
- Keep all HTML tags exactly as they are, only translate the TEXT content inside tags
- Keep game terms, skill names, item names in their original English form (e.g. "Succession", "Awakening", "Black Spirit", "Silver", "AP", "DP", "Accuracy", "Evasion")
- Keep numbers, percentages, symbols as-is
- Return ONLY the translated HTML, no explanation
- First line must be: TITLE: <translated title>

Title: ${title}

HTML:
${html.slice(0, 12000)}`;

  const translateResult = await model.generateContent(translatePrompt);
  const translateText = translateResult.response.text();

  const titleMatch = translateText.match(/^TITLE:\s*(.+)$/m);
  const titleTr = titleMatch ? titleMatch[1].trim() : title;
  const contentTr = translateText.replace(/^TITLE:.*$/m, "").trim();

  // Step 2: Extract structured data from the HTML
  // Strip HTML tags for cleaner parsing
  const plainText = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<img[^>]*src="([^"]+)"[^>]*>/gi, "[IMG:$1]")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s{2,}/g, " ")
    .trim();

  const structurePrompt = `You are analyzing a Black Desert Online Global Lab patch note. Extract structured data and return ONLY valid JSON.

Patch note title: "${title}"
Board number: ${boardNo}

Content:
${plainText.slice(0, 10000)}

Return a JSON object with this exact shape:
{
  "titleTr": "Turkish translation of the title",
  "summary": "1-2 sentence Turkish summary of what this patch changes overall",
  "summaryEn": "1-2 sentence English summary",
  "sections": [
    {
      "id": "section-slug-lowercase-no-spaces",
      "heading": "Original English section heading (e.g. class name or category)",
      "headingTr": "Turkish translation of heading",
      "emoji": "single relevant emoji (⚔️ for combat classes, 🛡 for tank/defense, 🏹 for ranged, 🧙 for magic, 🔧 for system/UI, 🌟 for general improvements, ⚡ for new content, 🐛 for bug fixes)",
      "changes": [
        {
          "en": "Original English change description (concise, 1-2 sentences)",
          "tr": "Turkish translation of the change",
          "type": "BUFF or NERF or FIX or NEW or CHANGE",
          "imageUrl": "include only if there was an [IMG:url] right before or after this change, otherwise omit"
        }
      ]
    }
  ]
}

Type guide:
- BUFF: stat increase, damage increase, cooldown decrease, recovery improvement
- NERF: stat decrease, damage decrease, cooldown increase
- FIX: bug fix, correction, unintended behavior fixed
- NEW: new feature, new skill, new item, new system
- CHANGE: neutral modification, rework, visual change, description update

Rules:
- Group changes by class or category section
- If there is no clear section, use "general" as id and "Genel" as headingTr
- Keep game terms in English (skill names, class names, AP, DP, etc.)
- Return ONLY the JSON, no markdown code blocks, no explanation`;

  const structureResult = await model.generateContent(structurePrompt);
  let structureText = structureResult.response.text().trim();

  // Strip markdown code blocks if present
  structureText = structureText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Validate JSON
  let structured: StructuredPatchNote;
  try {
    structured = JSON.parse(structureText);
  } catch {
    // Fallback: minimal structure
    structured = {
      titleTr,
      summary: "Bu yama notu işlenirken bir hata oluştu.",
      summaryEn: "An error occurred while processing this patch note.",
      sections: [],
    };
  }

  return {
    titleTr: structured.titleTr || titleTr,
    contentTr,
    structured: JSON.stringify(structured),
  };
}

// ─── Scraping ─────────────────────────────────────────────────────────────────

async function fetchPatchList(count = 5): Promise<{ boardNo: number; title: string; thumbnail: string; date: string }[]> {
  const res = await fetch(LIST_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });
  const html = await res.text();

  const items: { boardNo: number; title: string; thumbnail: string; date: string }[] = [];

  // Pattern 1: full item parsing
  const linkRegex = /href="[^"]*[\?&]_boardNo=(\d+)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[\s\S]*?class="title"[^>]*>([\s\S]*?)<\/p>[\s\S]*?class="info_item date"[^>]*>([\s\S]*?)<\/span>/g;
  let match;
  while ((match = linkRegex.exec(html)) !== null && items.length < count) {
    const boardNo = parseInt(match[1]);
    const thumbnail = match[2].replace(/\\/g, "");
    const title = match[3].replace(/<[^>]+>/g, "").trim();
    const date = match[4].replace(/<[^>]+>/g, "").trim();
    if (boardNo && title) items.push({ boardNo, title, thumbnail, date });
  }

  // Pattern 2: just collect all unique boardNos from _boardNo= links on the page
  if (items.length === 0) {
    const seen = new Set<number>();
    const allBoardNos = Array.from(html.matchAll(/[?&]_boardNo=(\d+)/g))
      .map((m) => parseInt(m[1]))
      .filter((v) => { if (seen.has(v)) return false; seen.add(v); return true; });
    // Heuristic: patch note boardNos tend to be large numbers (> 10000)
    const candidates = allBoardNos.filter((n) => n > 1000).slice(0, count);
    candidates.forEach((boardNo) => items.push({ boardNo, title: "", thumbnail: "", date: "" }));
    console.log("[patch-notes] fallback boardNos:", candidates);
  }

  return items;
}

async function fetchPatchDetail(boardNo: number): Promise<{ title: string; content: string; thumbnail: string; publishedAt: Date; debug: string[] }> {
  const url = `${BASE}/GlobalLab/en-US/News/Detail?_boardNo=${boardNo}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });
  const html = await res.text();
  const debug: string[] = [`html_len:${html.length}`, `status:${res.status}`];

  // Title — try multiple patterns
  const titlePatterns = [
    /class="detail_top_title"[^>]*>([\s\S]*?)<\/h[1-6]>/,
    /class="[^"]*detail[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h[1-6]>/,
    /<h1[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h1>/,
    /<title>([\s\S]*?)<\/title>/,
  ];
  let title = `Patch Note #${boardNo}`;
  for (const p of titlePatterns) {
    const m = html.match(p);
    if (m) { title = m[1].replace(/<[^>]+>/g, "").trim(); debug.push("title:ok"); break; }
  }

  // Date
  const datePatterns = [
    /class="info_item date"[^>]*>([\s\S]*?)<\/span>/,
    /class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p|div)>/,
  ];
  let publishedAt = new Date();
  for (const p of datePatterns) {
    const m = html.match(p);
    if (m) { const d = new Date(m[1].replace(/<[^>]+>/g, "").trim()); if (!isNaN(d.getTime())) { publishedAt = d; debug.push("date:ok"); } break; }
  }

  // Thumbnail
  const thumbPatterns = [
    /class="detail_top_thumbnail"[\s\S]*?<img[^>]*src="([^"]+)"/,
    /class="[^"]*thumbnail[^"]*"[\s\S]*?<img[^>]*src="([^"]+)"/,
    /property="og:image"[^>]*content="([^"]+)"/,
    /<meta[^>]*name="thumbnail"[^>]*content="([^"]+)"/,
  ];
  let thumbnail = "";
  for (const p of thumbPatterns) {
    const m = html.match(p);
    if (m) { thumbnail = m[1]; debug.push("thumb:ok"); break; }
  }

  // Content — try many patterns, most specific to least specific
  const contentPatterns = [
    /class="[^"]*contents_area[^"]*editor_area[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/,
    /class="[^"]*editor_area[^"]*contents_area[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/,
    /class="[^"]*editor_area[^"]*"[^>]*>([\s\S]{200,}?)<\/div>\s*<\/div>/,
    /class="[^"]*contents_area[^"]*"[^>]*>([\s\S]{200,}?)<\/div>\s*<\/div>/,
    /class="[^"]*view_content[^"]*"[^>]*>([\s\S]{200,}?)<\/div>/,
    /class="[^"]*article[^"]*content[^"]*"[^>]*>([\s\S]{200,}?)<\/div>/,
    /class="[^"]*news[^"]*content[^"]*"[^>]*>([\s\S]{200,}?)<\/div>/,
    /<article[^>]*>([\s\S]{200,}?)<\/article>/,
    /<main[^>]*>([\s\S]{200,}?)<\/main>/,
  ];
  let content = "";
  for (const p of contentPatterns) {
    const m = html.match(p);
    if (m && m[1].length > 100) {
      content = m[1];
      debug.push(`content:ok(pattern${contentPatterns.indexOf(p)})`);
      break;
    }
  }

  if (!content) debug.push("content:FAILED");

  // Fix relative URLs
  content = content
    .replace(/src="\/\//g, 'src="https://')
    .replace(/src="\//g, `src="${BASE}/`);

  return { title, content, thumbnail, publishedAt, debug };
}

// ─── Debug route ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const boardNo = searchParams.get("boardNo");

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
  };

  if (boardNo) {
    // Test a specific detail URL
    const urlsToTry = [
      `${BASE}/GlobalLab/en-US/News/Detail?_boardNo=${boardNo}`,
      `${BASE}/en-US/News/Detail?_boardNo=${boardNo}`,
      `${BASE}/GlobalLab/en-US/News/${boardNo}`,
    ];
    const results: Record<string, { status: number; len: number; snippet: string }> = {};
    for (const url of urlsToTry) {
      const r = await fetch(url, { headers });
      const text = await r.text();
      results[url] = { status: r.status, len: text.length, snippet: text.slice(0, 500) };
    }
    return Response.json(results);
  }

  // Dump list page HTML snippet + all _boardNo links found
  const r = await fetch(LIST_URL, { headers });
  const html = await r.text();
  const boardNos = Array.from(html.matchAll(/[?&]_boardNo=(\d+)/g)).map((m) => m[1]);
  const hrefs = Array.from(html.matchAll(/href="([^"]*_boardNo[^"]*)"/g)).map((m) => m[1]).slice(0, 20);
  return Response.json({
    status: r.status,
    html_len: html.length,
    snippet: html.slice(0, 2000),
    boardNos: Array.from(new Set(boardNos)).slice(0, 20),
    hrefs,
  });
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const specificBoardNo: number | undefined = body.boardNo;

  try {
    let toFetch: number[] = [];

    if (specificBoardNo) {
      toFetch = [specificBoardNo];
    } else {
      const list = await fetchPatchList(3);
      // Skip notes that are already fetched AND already have structured data
      const existing = await db.patchNote.findMany({
        where: { boardNo: { in: list.map((l) => l.boardNo) } },
        select: { boardNo: true, structured: true },
      });
      const fullyProcessed = new Set(
        existing
          .filter((e: { boardNo: number; structured: string | null }) => e.structured !== null)
          .map((e: { boardNo: number }) => e.boardNo)
      );
      toFetch = list.map((l) => l.boardNo).filter((n: number) => !fullyProcessed.has(n));
    }

    if (toFetch.length === 0) {
      return NextResponse.json({ ok: true, message: "Yeni yama notu yok, tümü zaten mevcut.", added: 0 });
    }

    const added: number[] = [];
    const debugInfo: Record<number, string[]> = {};

    for (const boardNo of toFetch) {
      const detail = await fetchPatchDetail(boardNo);
      debugInfo[boardNo] = detail.debug;
      if (!detail.content) {
        console.error(`[patch-notes] boardNo=${boardNo} content boş. Debug:`, detail.debug);
        continue;
      }

      const { titleTr, contentTr, structured } = await parseWithGemini(detail.content, detail.title, boardNo);

      await db.patchNote.upsert({
        where: { boardNo },
        create: {
          boardNo,
          title: detail.title,
          titleTr,
          content: detail.content,
          contentTr,
          structured,
          thumbnail: detail.thumbnail,
          publishedAt: detail.publishedAt,
        },
        update: {
          title: detail.title,
          titleTr,
          content: detail.content,
          contentTr,
          structured,
          thumbnail: detail.thumbnail,
          publishedAt: detail.publishedAt,
          fetchedAt: new Date(),
        },
      });
      added.push(boardNo);
    }

    return NextResponse.json({
      ok: true,
      added: added.length,
      boardNos: added,
      attempted: toFetch,
      debug: debugInfo,
      message: `${added.length} yama notu çekildi, çevrildi ve yapılandırıldı.`,
    });
  } catch (err) {
    console.error("Patch note fetch error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
