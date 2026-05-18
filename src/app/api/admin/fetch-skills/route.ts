export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SKILL_CLASS_IDS } from "@/lib/skill-class-ids";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const BDOCODEX = "https://bdocodex.com";
const BATCH_SIZE = 20; // skills per API call — keeps response well under 60s

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://bdocodex.com/tr/skillbuilder/",
  "Accept": "text/html,application/json,*/*;q=0.8",
  "Accept-Language": "tr,en;q=0.5",
};

// ─── Fetch all skill IDs for a class ─────────────────────────────────────────

async function fetchSkillIds(classId: number): Promise<number[]> {
  const url = `${BDOCODEX}/ajax.php?a=skill_list&class_id=${classId}&l=kr`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const html: string = data?.data ?? "";
  const ids = Array.from(html.matchAll(/data-skill_id="(\d+)"/g)).map((m) => parseInt(m[1]));
  return Array.from(new Set(ids));
}

// ─── Fetch TR + KR names for a single skill ──────────────────────────────────

async function fetchSkillNames(skillId: number): Promise<{ kr: string; tr: string } | null> {
  const res = await fetch(`${BDOCODEX}/tip.php?id=skill--${skillId}&l=tr&nf=on`, { headers: HEADERS });
  if (!res.ok) return null;
  const html = await res.text();

  const trMatch = html.match(/class="tag_skill_name"[^>]*>\s*([^<\n]+?)\s*<\//);
  if (!trMatch?.[1]?.trim()) return null;
  const tr = trMatch[1].trim();

  const krMatch =
    html.match(/class="item_name"[^>]*>[\s\S]*?<b>\s*([^<]+?)\s*<\/b>/) ??
    html.match(/<b class="[^"]*">\s*([가-힣A-Za-z: ]+?)\s*<\/b>/);
  const kr = krMatch?.[1]?.trim() ?? "";

  return { kr, tr };
}

// ─── GET — status ─────────────────────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const total = await db.skillTranslation.count();
  const byClass: { classId: number; _count: { skillId: number } }[] = await db.skillTranslation.groupBy({
    by: ["classId"],
    _count: { skillId: true },
  });

  return NextResponse.json({
    total,
    classesDone: byClass.length,
    totalClasses: SKILL_CLASS_IDS.length,
    byClass: byClass.map((r: { classId: number; _count: { skillId: number } }) => ({ classId: r.classId, count: r._count.skillId })),
  });
}

// ─── POST — fetch one batch: { classId, offset } ─────────────────────────────
// Returns { ok, added, skipped, nextOffset, total, done }
// Frontend loops: keep calling with nextOffset until done === true

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const classId: number = body.classId;
  const offset: number = body.offset ?? 0;

  if (classId === undefined || !SKILL_CLASS_IDS.includes(classId)) {
    return NextResponse.json({ error: "Geçersiz classId" }, { status: 400 });
  }

  try {
    const allIds = await fetchSkillIds(classId);
    const total = allIds.length;

    if (total === 0) {
      return NextResponse.json({ ok: true, classId, added: 0, skipped: 0, total: 0, nextOffset: 0, done: true });
    }

    const batch = allIds.slice(offset, offset + BATCH_SIZE);

    // Skip skills already in DB for this class
    const existing = await db.skillTranslation.findMany({
      where: { classId, skillId: { in: batch } },
      select: { skillId: true },
    });
    const existingIds = new Set(existing.map((r: { skillId: number }) => r.skillId));
    const toFetch = batch.filter((id) => !existingIds.has(id));

    let added = 0;
    let skipped = existingIds.size;

    if (toFetch.length > 0) {
      const results = await Promise.allSettled(
        toFetch.map((id) => fetchSkillNames(id).then((names) => ({ id, names }))),
      );

      for (const result of results) {
        if (result.status !== "fulfilled" || !result.value.names) { skipped++; continue; }
        const { id, names } = result.value;
        await db.skillTranslation.create({
          data: { skillId: id, classId, kr: names.kr, tr: names.tr },
        });
        added++;
      }
    }

    const nextOffset = offset + BATCH_SIZE;
    const done = nextOffset >= total;

    return NextResponse.json({ ok: true, classId, added, skipped, total, nextOffset, done });
  } catch (err) {
    console.error("fetch-skills error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
