export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { BDO_CLASSES, hasClassVariants } from "@/lib/classes";

/**
 * Uygulama içi profil: aile adı, class/spec, AP/DP. Site /api/user/profile
 * ile aynı kurallar — AP/DP değişince gear geçmişine (GsHistory) satır düşer.
 */

const sec = {
  id: true, familyName: true, class: true, spec: true, ap: true, dp: true, avatarUrl: true,
  guild: { select: { name: true, tag: true, color: true } },
  siteRole: { select: { name: true, color: true } },
  gsHistory: { orderBy: { createdAt: "desc" as const }, take: 8, select: { ap: true, dp: true, createdAt: true } },
};

export async function GET(req: Request) {
  return withApp(req, async (me) => {
    const u = await prisma.user.findUnique({ where: { id: me.id }, select: sec });
    if (!u) return appError("Kullanıcı yok.", 404);
    return NextResponse.json(u, { headers: APP_HEADERS });
  });
}

export async function PUT(req: Request) {
  return withApp(req, async (me) => {
    const b = (await req.json().catch(() => ({}))) as { familyName?: string; ap?: number; dp?: number; class?: string; spec?: string };
    const data: { familyName?: string; ap?: number; dp?: number; class?: string; spec?: string } = {};
    if (b.familyName !== undefined) {
      const ad = String(b.familyName).trim();
      if (ad.length < 2 || ad.length > 24) return appError("Aile adı 2–24 karakter olmalı.", 400);
      data.familyName = ad;
    }
    if (b.class !== undefined) {
      if (b.class !== "" && !BDO_CLASSES.some((c) => c.id === b.class)) return appError("Geçersiz class.", 400);
      data.class = b.class;
    }
    if (b.spec !== undefined) {
      if (b.spec !== "awakening" && b.spec !== "succession") return appError("Geçersiz spec.", 400);
      data.spec = b.spec;
    }
    for (const k of ["ap", "dp"] as const) {
      if (b[k] === undefined) continue;
      const n = Number(b[k]);
      if (!Number.isInteger(n) || n < 0 || n > 999) return appError(`${k.toUpperCase()} 0–999 arası olmalı.`, 400);
      data[k] = n;
    }
    // Varyantı olmayan class'ta spec awakening'e sabitlenir
    const cur = await prisma.user.findUnique({ where: { id: me.id }, select: { ap: true, dp: true, class: true, spec: true } });
    if (!cur) return appError("Kullanıcı yok.", 404);
    const sinif = data.class ?? cur.class;
    if (sinif && !hasClassVariants(sinif)) data.spec = "awakening";

    const ap = data.ap ?? cur.ap, dp = data.dp ?? cur.dp;
    if (ap !== cur.ap || dp !== cur.dp) await prisma.gsHistory.create({ data: { userId: me.id, ap, dp } });

    const u = await prisma.user.update({ where: { id: me.id }, data, select: sec });
    return NextResponse.json(u, { headers: APP_HEADERS });
  });
}
