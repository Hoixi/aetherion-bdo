export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";

/**
 * Genel sohbet — tek kanal.
 *  GET  ?after=<id>   → o kimlikten sonraki mesajlar (ilk açılışta son 50)
 *  POST { text }      → mesaj yaz (≤ 1000 karakter)
 */
const SECIM = { id: true, text: true, createdAt: true, user: { select: { id: true, familyName: true, class: true } } };

export async function GET(req: Request) {
  return withApp(req, async () => {
    const after = Number(new URL(req.url).searchParams.get("after"));
    const rows = Number.isInteger(after) && after > 0
      ? await prisma.chatMessage.findMany({ where: { id: { gt: after } }, orderBy: { id: "asc" }, take: 200, select: SECIM })
      : (await prisma.chatMessage.findMany({ orderBy: { id: "desc" }, take: 50, select: SECIM })).reverse();
    return NextResponse.json(rows, { headers: APP_HEADERS });
  });
}

export async function POST(req: Request) {
  return withApp(req, async (me) => {
    const b = (await req.json().catch(() => ({}))) as { text?: string };
    const text = String(b.text ?? "").trim().slice(0, 1000);
    if (!text) return appError("Boş mesaj.", 400);
    const row = await prisma.chatMessage.create({ data: { userId: me.id, text }, select: SECIM });
    return NextResponse.json(row, { headers: APP_HEADERS });
  });
}
