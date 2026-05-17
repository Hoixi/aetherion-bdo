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
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

  // Single call: structured JSON only (avoids timeout from 2 Gemini calls)
  // "Tam Metin" view shows the original English HTML — translation skipped.
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

  const prompt = `You are analyzing a Black Desert Online Global Lab patch note. Extract structured data and return ONLY valid JSON — no markdown, no explanation.

Title: "${title}"
Board: ${boardNo}

Content:
${plainText.slice(0, 15000)}

Return this exact JSON shape:
{
  "titleTr": "Turkish title",
  "summary": "1-2 sentence Turkish summary of overall changes",
  "summaryEn": "1-2 sentence English summary",
  "sections": [
    {
      "id": "slug-lowercase-hyphens",
      "heading": "Top-level English section heading (usually the class name, e.g. Maehwa, Warrior, or a category)",
      "headingTr": "Turkish section heading",
      "emoji": "⚔️ combat class | 🛡 defense/tank | 🏹 ranged | 🧙 magic | 🔧 system/UI | 🌟 general | ⚡ new content | 🐛 bug fix",
      "changes": [
        {
          "skillName": "Original skill name or sub-heading if present (e.g. 'Shadow Explosion', 'Fox Claw'). Omit if no sub-heading.",
          "skillNameTr": "Turkish translation of the skill name. Omit if no sub-heading.",
          "skillImageUrl": "The [IMG:url] that appears immediately before the skill sub-heading in the content. This is the skill icon. Omit if none.",
          "en": "Concise English description of this change (1-2 sentences)",
          "tr": "Turkish translation of the change",
          "type": "BUFF|NERF|FIX|NEW|CHANGE"
        }
      ]
    }
  ]
}

CRITICAL LANGUAGE RULES:
- "heading" field = always English (class/category name in English)
- "headingTr" field = always Turkish. For BDO class names use these: Warrior→Savaşçı, Ranger→Okçu, Sorceress→Büyücü, Berserker→Berserker, Tamer→Evcil Hayvan Ustası, Musa→Musa, Maehwa→Maehwa, Valkyrie→Valkiri, Kunoichi→Kunoichi, Ninja→Ninja, Wizard→Büyücü, Witch→Cadı, Dark Knight→Karanlık Şövalye, Striker→Dövüşçü, Mystic→Mistik, Lahn→Lahn, Archer→Okçu, Shai→Shai, Guardian→Gardiyan, Hashashin→Hashaşin, Nova→Nova, Sage→Bilge, Corsair→Korsar, Drakania→Drakania, Woosa→Woosa, Maegu→Maegu, Scholar→Alim. If unknown keep same as English.
- If you see Korean/Hangul text (e.g. 매화, 흑마법사), convert it to its English equivalent first, then apply the rule above.
- "skillName" = English skill name (keep as-is, these are proper nouns)
- "skillNameTr" = ALWAYS provide Turkish translation. For BDO skills: Flow:→Akış:, Succession→Uyanış Devamı, Awakening→Uyanış, translate descriptive words (Pierce→Delme, Claw→Pençe, Step→Adım, Slash→Kesme, Strike→Vuruş, Burst→Patlama, Dash→Atılış, Guard→Savunma, Heal→İyileşme etc.) but keep proper names. If unsure, keep English.

IMPORTANT: BDO patch notes have a 2-level structure:
- Top level: class name (Maehwa, Warrior, etc.) → becomes a section
- Second level: skill name with icon (e.g. [IMG:url] Shadow Explosion) → goes into skillName/skillImageUrl of each change
- Bullet points under a skill → individual change items, all share the same skillName/skillImageUrl

So if the content looks like:
  Maehwa
    [IMG:icon1.png] Flow: Cloud Pierce
      - Cooldown removed
      - HP recovery removed
    [IMG:icon2.png] Frostbite
      - HP recovery on hit 150 → 300

Then generate:
  section heading="Maehwa", headingTr="Maehwa", changes=[
    { skillName:"Flow: Cloud Pierce", skillNameTr:"Akış: Bulut Delme", skillImageUrl:"icon1.png", en:"Cooldown removed", tr:"Yeniden kullanım süresi kaldırıldı.", type:"CHANGE" },
    { skillName:"Flow: Cloud Pierce", skillNameTr:"Akış: Bulut Delme", skillImageUrl:"icon1.png", en:"HP recovery removed", tr:"HP iyileşmesi kaldırıldı.", type:"NERF" },
    { skillName:"Frostbite", skillNameTr:"Buz Isırması", skillImageUrl:"icon2.png", en:"HP recovery on hit 150→300", tr:"Vuruşta HP iyileşmesi 150→300'e çıkarıldı.", type:"BUFF" }
  ]

Type guide: BUFF=stat/damage increase or cooldown decrease, NERF=stat/damage decrease or cooldown increase, FIX=bug fix, NEW=new feature/item/skill, CHANGE=neutral rework or description update.
Group changes by class or category section. If no clear grouping exists: id="general", headingTr="Genel".
Keep all game terms in English (class names, skill names, AP, DP, Accuracy, Evasion, Silver, Succession, Awakening, etc.).`;

  const result = await model.generateContent(prompt);
  let text = result.response.text().trim()
    .replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let structured: StructuredPatchNote;
  try {
    structured = JSON.parse(text);
  } catch {
    structured = {
      titleTr: title,
      summary: "Bu yama notu işlenirken bir hata oluştu.",
      summaryEn: "An error occurred while processing this patch note.",
      sections: [],
    };
  }

  return {
    titleTr: structured.titleTr || title,
    contentTr: html, // original English HTML — no translation to avoid timeout
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

  // Content — find the opening tag then extract until a known end marker
  let content = "";

  // Find where the content div starts
  const contentStartPatterns = [
    /class="[^"]*contents_area[^"]*editor_area[^"]*"[^>]*>/,
    /class="[^"]*editor_area[^"]*contents_area[^"]*"[^>]*>/,
    /class="[^"]*editor_area[^"]*"[^>]*>/,
    /class="[^"]*contents_area[^"]*"[^>]*>/,
  ];

  for (const p of contentStartPatterns) {
    const startMatch = p.exec(html);
    if (!startMatch) continue;

    const startIdx = startMatch.index + startMatch[0].length;
    const rest = html.slice(startIdx);

    // Walk forward counting div depth until we're back to 0 (closing the content div)
    let depth = 1;
    let i = 0;
    while (i < rest.length && depth > 0) {
      const openIdx = rest.indexOf("<div", i);
      const closeIdx = rest.indexOf("</div", i);
      if (closeIdx === -1) break;
      if (openIdx !== -1 && openIdx < closeIdx) {
        depth++;
        i = openIdx + 4;
      } else {
        depth--;
        if (depth === 0) {
          content = rest.slice(0, closeIdx);
          break;
        }
        i = closeIdx + 6;
      }
    }

    if (content.length > 200) break;
    content = ""; // reset and try next pattern
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
