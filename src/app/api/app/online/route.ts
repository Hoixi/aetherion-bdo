export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS } from "@/lib/app-gate";

/**
 * Uygulaması açık üyeler: anahtarı son 3 dakikada kullanılmış olanlar.
 * (Her kimlikli istek lastSeenAt'i dakikada bir tazeliyor; uygulama zaten
 * dakikada bir sorguluyor.)
 */
export async function GET(req: Request) {
  return withApp(req, async () => {
    const esik = new Date(Date.now() - 3 * 60_000);
    const rows = await prisma.appToken.findMany({
      where: { revokedAt: null, lastSeenAt: { gte: esik }, user: { deletedAt: null } },
      select: { user: { select: { id: true, familyName: true, class: true, guild: { select: { tag: true } } } } },
    });
    const uniq = new Map<number, { id: number; familyName: string; class: string; guild: string | null }>();
    for (const r of rows) uniq.set(r.user.id, { id: r.user.id, familyName: r.user.familyName, class: r.user.class, guild: r.user.guild?.tag ?? null });
    return NextResponse.json(Array.from(uniq.values()).sort((a, b) => a.familyName.localeCompare(b.familyName, "tr")), { headers: APP_HEADERS });
  });
}
