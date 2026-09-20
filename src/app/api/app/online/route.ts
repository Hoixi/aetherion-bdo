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
    const secim = { id: true, familyName: true, class: true, guild: { select: { tag: true } } };
    const [rows, web] = await Promise.all([
      prisma.appToken.findMany({ where: { revokedAt: null, lastSeenAt: { gte: esik }, user: { deletedAt: null } }, select: { user: { select: secim } } }),
      // Tarayıcıdan /ses sayfası açık olanlar (POST ile nabız)
      prisma.user.findMany({ where: { deletedAt: null, webSeenAt: { gte: esik } }, select: secim }),
    ]);
    const uniq = new Map<number, { id: number; familyName: string; class: string; guild: string | null }>();
    for (const u of [...rows.map((r) => r.user), ...web]) uniq.set(u.id, { id: u.id, familyName: u.familyName, class: u.class, guild: u.guild?.tag ?? null });
    return NextResponse.json(Array.from(uniq.values()).sort((a, b) => a.familyName.localeCompare(b.familyName, "tr")), { headers: APP_HEADERS });
  });
}

/** Tarayıcı nabzı: /ses açıkken dakikada bir */
export async function POST(req: Request) {
  return withApp(req, async (me) => {
    await prisma.user.update({ where: { id: me.id }, data: { webSeenAt: new Date() } }).catch(() => {});
    return NextResponse.json({ ok: true }, { headers: APP_HEADERS });
  });
}
