export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = await db.patchNote.findMany({
    orderBy: { publishedAt: "desc" },
    select: { id: true, boardNo: true, title: true, titleTr: true, thumbnail: true, publishedAt: true, fetchedAt: true, structured: true },
  });

  // Extract summary from structured JSON without sending full structured data
  const notes = raw.map((n: { id: number; boardNo: number; title: string; titleTr: string; thumbnail: string | null; publishedAt: Date; fetchedAt: Date; structured: string | null }) => {
    let summary: string | null = null;
    let summaryEn: string | null = null;
    let hasStructured = false;
    if (n.structured) {
      try {
        const parsed = JSON.parse(n.structured);
        summary = parsed.summary ?? null;
        summaryEn = parsed.summaryEn ?? null;
        hasStructured = Array.isArray(parsed.sections) && parsed.sections.length > 0;
      } catch { /* ignore */ }
    }
    const { structured: _, ...rest } = n;
    void _;
    return { ...rest, summary, summaryEn, hasStructured };
  });

  return NextResponse.json(notes);
}
