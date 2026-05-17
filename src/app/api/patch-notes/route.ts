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

  const notes = await db.patchNote.findMany({
    orderBy: { publishedAt: "desc" },
    select: { id: true, boardNo: true, title: true, titleTr: true, thumbnail: true, publishedAt: true, fetchedAt: true },
  });

  return NextResponse.json(notes);
}
