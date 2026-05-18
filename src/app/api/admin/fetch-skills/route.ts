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
const BATCH_SIZE = 30;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": "https://bdocodex.com/tr/skillbuilder/",
  "Accept": "text/html,application/json,*/*;q=0.8",
  "Accept-Language": "tr,en;q=0.5",
};

// ─── Fetch all skill IDs for a class (only on first batch) ───────────────────

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

async function fetchSkillNames(skillId: number): Promise<{ id: number; kr: string; tr: string } | null> {
  const [trRes, krRes] = await Promise.all([
    fetch(`${BDOCODEX}/tip.php?id=skill--${skillId}&l=tr&nf=on`, { headers: HEADERS }),
    fetch(`${BDOCODEX}/tip.php?id=skill--${skillId}&l=kr&nf=on`, { headers: HEADERS }),
  ]);
  if (!trRes.ok || !krRes.ok) return null;

  const [trHtml, krHtml] = await Promise.all([trRes.text(), krRes.text()]);

  const extractName = (html: string) =>
    html.match(/class="tag_skill_name"[^>]*>\s*([^<\n]+?)\s*<\//)?.[1]?.trim() ?? "";

  const tr = extractName(trHtml);
  const kr = extractName(krHtml);

  if (!tr) return null;
  return { id: skillId, kr, tr };
}

// ─── Batch upsert via raw SQL (one round-trip) ───────────────────────────────

async function batchUpsert(rows: { id: number; kr: string; tr: string }[], classId: number) {
  if (rows.length === 0) return;
  const placeholders = rows.map(() => "(?, ?, ?, ?)").join(", ");
  const values = rows.flatMap((r) => [r.id, classId, r.kr, r.tr]);
  await db.$executeRawUnsafe(
    `INSERT INTO skill_translations (skillId, classId, kr, tr)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE kr = VALUES(kr), tr = VALUES(tr)`,
    ...values,
  );
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
    byClass: byClass.map((r: { classId: number; _count: { skillId: number } }) => ({
      classId: r.classId,
      count: r._count.skillId,
    })),
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────
// Body: { classId, offset, skillIds? }
// - offset=0 & no skillIds → fetch skill list, return it with results
// - offset>0 & skillIds provided → skip skill list fetch (reuse from frontend)
// Returns: { ok, added, skipped, total, nextOffset, done, skillIds? }

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const classId: number = body.classId;
  const offset: number = body.offset ?? 0;
  const providedIds: number[] | undefined = body.skillIds;

  if (classId === undefined || !SKILL_CLASS_IDS.includes(classId)) {
    return NextResponse.json({ error: "Geçersiz classId" }, { status: 400 });
  }

  try {
    // Fetch skill list only on first batch (or if not provided by client)
    const allIds: number[] = providedIds ?? await fetchSkillIds(classId);
    const total = allIds.length;

    if (total === 0) {
      return NextResponse.json({ ok: true, classId, added: 0, skipped: 0, total: 0, nextOffset: 0, done: true });
    }

    const batch = allIds.slice(offset, offset + BATCH_SIZE);

    // Skip skills already in DB with a valid KR name
    const existing = await db.skillTranslation.findMany({
      where: { classId, skillId: { in: batch }, kr: { not: "" } },
      select: { skillId: true },
    });
    const existingIds = new Set(existing.map((r: { skillId: number }) => r.skillId));
    const toFetch = batch.filter((id) => !existingIds.has(id));

    const skipped = existingIds.size;
    let added = 0;

    if (toFetch.length > 0) {
      const results = await Promise.allSettled(toFetch.map(fetchSkillNames));
      const rows = results
        .filter((r): r is PromiseFulfilledResult<{ id: number; kr: string; tr: string }> =>
          r.status === "fulfilled" && r.value !== null)
        .map((r) => r.value);

      await batchUpsert(rows, classId);
      added = rows.length;
    }

    const nextOffset = offset + BATCH_SIZE;
    const done = nextOffset >= total;

    return NextResponse.json({
      ok: true,
      classId,
      added,
      skipped,
      total,
      nextOffset,
      done,
      // Return skillIds only on first batch so frontend can reuse them
      ...(offset === 0 ? { skillIds: allIds } : {}),
    });
  } catch (err) {
    console.error("fetch-skills error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
