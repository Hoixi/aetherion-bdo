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
const DETAIL_BASE = `${BASE}/GlobalLab/en-US/News/Notice/Detail`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function parseWithGemini(
  html: string,
  title: string,
  boardNo: number,
): Promise<{ titleTr: string; contentTr: string; structured: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // ── Call 1: Full HTML translation ─────────────────────────────────────────
  const translatePrompt = `You are a professional game translator. Translate the following Black Desert Online Global Lab patch note from English to Turkish.

Rules:
- Keep ALL HTML tags exactly as they are — only translate the TEXT content inside tags
- Keep game terms in English: skill names, class names, AP, DP, Accuracy, Evasion, Silver, Black Spirit, Succession, Awakening, etc.
- Keep numbers, percentages, symbols as-is
- Return ONLY the translated HTML, no explanation
- First line must be exactly: TITLE: <translated title here>

Title: ${title}

HTML:
${html.slice(0, 30000)}`;

  const translateResult = await model.generateContent(translatePrompt);
  const translateText = translateResult.response.text();

  const titleMatch = translateText.match(/^TITLE:\s*(.+)$/m);
  const titleTr = titleMatch ? titleMatch[1].trim() : title;
  const contentTr = translateText.replace(/^TITLE:.*$/m, "").trim();

  // ── Call 2: Structured JSON extraction ────────────────────────────────────
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

  const structurePrompt = `You are analyzing a Black Desert Online Global Lab patch note. Extract structured data and return ONLY valid JSON — no markdown, no explanation.

Title: "${title}"
Board: ${boardNo}

Content:
${plainText.slice(0, 20000)}

Return this exact JSON shape:
{
  "titleTr": "Turkish title",
  "summary": "1-2 sentence Turkish summary",
  "summaryEn": "1-2 sentence English summary",
  "sections": [
    {
      "id": "slug-lowercase",
      "heading": "English heading",
      "headingTr": "Turkish heading",
      "emoji": "⚔️ combat | 🛡 defense | 🏹 ranged | 🧙 magic | 🔧 system | 🌟 general | ⚡ new | 🐛 bugfix",
      "changes": [
        {
          "en": "English description",
          "tr": "Turkish description",
          "type": "BUFF|NERF|FIX|NEW|CHANGE",
          "imageUrl": "url only if [IMG:url] is adjacent"
        }
      ]
    }
  ]
}

BUFF=increase/improve, NERF=decrease/worsen, FIX=bug fix, NEW=new feature, CHANGE=neutral.
Group by class/category. If no sections: id="general", headingTr="Genel".
Keep game terms in English.`;

  const structureResult = await model.generateContent(structurePrompt);
  let structureText = structureResult.response.text().trim()
    .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let structured: StructuredPatchNote;
  try {
    structured = JSON.parse(structureText);
  } catch {
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

async function fetchPatchDetail(boardNo: number): Promise<{ title: string; content: string; thumbnail: string; publishedAt: Date }> {
  const url = `${DETAIL_BASE}?_boardNo=${boardNo}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
    },
  });
  const html = await res.text();

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
    if (m) { title = m[1].replace(/<[^>]+>/g, "").trim(); break; }
  }

  // Date
  const datePatterns = [
    /class="info_item date"[^>]*>([\s\S]*?)<\/span>/,
    /class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/(?:span|p|div)>/,
  ];
  let publishedAt = new Date();
  for (const p of datePatterns) {
    const m = html.match(p);
    if (m) { const d = new Date(m[1].replace(/<[^>]+>/g, "").trim()); if (!isNaN(d.getTime())) { publishedAt = d; } break; }
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
    if (m) { thumbnail = m[1]; break; }
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
      break;
    }
  }

  // Fix relative URLs
  content = content
    .replace(/src="\/\//g, 'src="https://')
    .replace(/src="\//g, `src="${BASE}/`);

  return { title, content, thumbnail, publishedAt };
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  // boardNo: specific note to (re)process
  // listAll: return all available boardNos without processing
  const specificBoardNo: number | undefined = body.boardNo;
  const listAll: boolean = body.listAll === true;

  try {
    // ── list mode: return all pending boardNos so frontend can chain ──
    if (listAll) {
      const list = await fetchPatchList(30);
      const existing = await db.patchNote.findMany({
        where: { boardNo: { in: list.map((l: { boardNo: number }) => l.boardNo) } },
        select: { boardNo: true, structured: true },
      });
      const fullyProcessed = new Set(
        existing
          .filter((e: { boardNo: number; structured: string | null }) => e.structured !== null)
          .map((e: { boardNo: number }) => e.boardNo)
      );
      const pending = list.map((l: { boardNo: number }) => l.boardNo).filter((n: number) => !fullyProcessed.has(n));
      return NextResponse.json({ ok: true, pending, total: list.length });
    }

    // ── single mode: process exactly one note ──
    let boardNoToProcess: number | undefined = specificBoardNo;

    if (!boardNoToProcess) {
      // Pick the most recent unprocessed note
      const list = await fetchPatchList(30);
      const existing = await db.patchNote.findMany({
        where: { boardNo: { in: list.map((l: { boardNo: number }) => l.boardNo) } },
        select: { boardNo: true, structured: true },
      });
      const fullyProcessed = new Set(
        existing
          .filter((e: { boardNo: number; structured: string | null }) => e.structured !== null)
          .map((e: { boardNo: number }) => e.boardNo)
      );
      const pending = list.map((l: { boardNo: number }) => l.boardNo).filter((n: number) => !fullyProcessed.has(n));
      if (pending.length === 0) {
        return NextResponse.json({ ok: true, message: "Tüm yama notları zaten işlenmiş.", added: 0, remaining: 0 });
      }
      boardNoToProcess = pending[0];
    }

    const detail = await fetchPatchDetail(boardNoToProcess);
    if (!detail.content) {
      return NextResponse.json({ ok: false, error: `#${boardNoToProcess} için içerik alınamadı.` }, { status: 500 });
    }

    const { titleTr, contentTr, structured } = await parseWithGemini(detail.content, detail.title, boardNoToProcess);

    await db.patchNote.upsert({
      where: { boardNo: boardNoToProcess },
      create: {
        boardNo: boardNoToProcess,
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

    // Count remaining
    const list2 = await fetchPatchList(30);
    const existing2 = await db.patchNote.findMany({
      where: { boardNo: { in: list2.map((l: { boardNo: number }) => l.boardNo) } },
      select: { boardNo: true, structured: true },
    });
    const processed2 = new Set(
      existing2
        .filter((e: { boardNo: number; structured: string | null }) => e.structured !== null)
        .map((e: { boardNo: number }) => e.boardNo)
    );
    const remaining = list2.filter((l: { boardNo: number }) => !processed2.has(l.boardNo)).length;

    return NextResponse.json({
      ok: true,
      added: 1,
      boardNo: boardNoToProcess,
      remaining,
      message: `#${boardNoToProcess} işlendi. Kalan: ${remaining}`,
    });
  } catch (err) {
    console.error("Patch note fetch error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
