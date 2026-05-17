export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { prisma } from "@/lib/prisma";
const db = prisma as any;
import { GoogleGenerativeAI } from "@google/generative-ai";

const BASE = "https://blackdesert.pearlabyss.com";
const LIST_URL = `${BASE}/GlobalLab/en-US/News/Notice?_categoryNo=2`;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// HTML'den text/img içeriği temizle ve Türkçe'ye çevir
async function translateWithGemini(html: string, title: string): Promise<{ titleTr: string; contentTr: string }> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are a professional game translator. Translate the following Black Desert Online Global Lab patch note from English to Turkish.

Rules:
- Keep all HTML tags exactly as they are, only translate the TEXT content inside tags
- Keep game terms, skill names, item names in their original English form (e.g. "Succession", "Awakening", "Black Spirit", "Silver")
- Keep numbers, percentages, symbols as-is
- Return ONLY the translated HTML, no explanation
- Translate the title separately first on its own line starting with "TITLE:"

Title to translate: ${title}

HTML content:
${html.slice(0, 15000)}`; // Gemini token limit

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const titleMatch = text.match(/^TITLE:\s*(.+)$/m);
  const titleTr = titleMatch ? titleMatch[1].trim() : title;
  const contentTr = text.replace(/^TITLE:.*$/m, "").trim();

  return { titleTr, contentTr };
}

// Liste sayfasından son N yama notunu al
async function fetchPatchList(count = 5): Promise<{ boardNo: number; title: string; thumbnail: string; date: string }[]> {
  const res = await fetch(LIST_URL, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await res.text();

  const items: { boardNo: number; title: string; thumbnail: string; date: string }[] = [];

  // .board_item_inner href'lerinden boardNo çek
  const linkRegex = /href="[^"]*[\?&]_boardNo=(\d+)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[\s\S]*?class="title"[^>]*>([\s\S]*?)<\/p>[\s\S]*?class="info_item date"[^>]*>([\s\S]*?)<\/span>/g;

  let match;
  while ((match = linkRegex.exec(html)) !== null && items.length < count) {
    const boardNo = parseInt(match[1]);
    const thumbnail = match[2].replace(/\\/g, "");
    const title = match[3].replace(/<[^>]+>/g, "").trim();
    const date = match[4].replace(/<[^>]+>/g, "").trim();
    if (boardNo && title) items.push({ boardNo, title, thumbnail, date });
  }

  // Fallback: simpler regex
  if (items.length === 0) {
    const boardNos = Array.from(html.matchAll(/_boardNo=(\d+)/g)).map((m) => parseInt(m[1])).filter((v, i, a) => a.indexOf(v) === i).slice(0, count);
    boardNos.forEach((boardNo) => items.push({ boardNo, title: "", thumbnail: "", date: "" }));
  }

  return items;
}

// Tekil yama notu içeriğini çek
async function fetchPatchDetail(boardNo: number): Promise<{ title: string; content: string; thumbnail: string; publishedAt: Date }> {
  const url = `${BASE}/GlobalLab/en-US/News/Detail?_boardNo=${boardNo}`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await res.text();

  // Başlık
  const titleMatch = html.match(/class="detail_top_title"[^>]*>([\s\S]*?)<\/h3>/);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : `Patch Note #${boardNo}`;

  // Tarih
  const dateMatch = html.match(/class="info_item date"[^>]*>([\s\S]*?)<\/span>/);
  const dateStr = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, "").trim() : "";
  const publishedAt = dateStr ? new Date(dateStr) : new Date();

  // Thumbnail
  const thumbMatch = html.match(/class="detail_top_thumbnail"[\s\S]*?<img[^>]*src="([^"]+)"/);
  const thumbnail = thumbMatch ? thumbMatch[1] : "";

  // İçerik — .contents_area.editor_area
  const contentMatch = html.match(/class="[^"]*contents_area[^"]*editor_area[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*(?:<!--|\s*<div class="btn_area)/);
  let content = contentMatch ? contentMatch[1] : "";

  // Relative URL'leri absolute yap
  content = content.replace(/src="\/\//g, 'src="https://').replace(/src="\//g, `src="${BASE}/`);

  return { title, content, thumbnail, publishedAt };
}

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
      // En son 3 yamayı çek
      const list = await fetchPatchList(3);
      // Zaten DB'de olanları atla
      const existing = await db.patchNote.findMany({ where: { boardNo: { in: list.map((l) => l.boardNo) } }, select: { boardNo: true } });
      const existingNos = new Set(existing.map((e: { boardNo: number }) => e.boardNo));
      toFetch = list.map((l) => l.boardNo).filter((n) => !existingNos.has(n));
    }

    if (toFetch.length === 0) {
      return NextResponse.json({ ok: true, message: "Yeni yama notu yok, tümü zaten mevcut.", added: 0 });
    }

    const added: number[] = [];

    for (const boardNo of toFetch) {
      const detail = await fetchPatchDetail(boardNo);
      if (!detail.content) continue;

      const { titleTr, contentTr } = await translateWithGemini(detail.content, detail.title);

      await db.patchNote.upsert({
        where: { boardNo },
        create: {
          boardNo,
          title: detail.title,
          titleTr,
          content: detail.content,
          contentTr,
          thumbnail: detail.thumbnail,
          publishedAt: detail.publishedAt,
        },
        update: {
          title: detail.title,
          titleTr,
          content: detail.content,
          contentTr,
          thumbnail: detail.thumbnail,
          publishedAt: detail.publishedAt,
          fetchedAt: new Date(),
        },
      });
      added.push(boardNo);
    }

    return NextResponse.json({ ok: true, added: added.length, boardNos: added, message: `${added.length} yama notu çekildi ve çevrildi.` });
  } catch (err) {
    console.error("Patch note fetch error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
