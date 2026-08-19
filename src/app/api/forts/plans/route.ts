export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

/**
 * Kale kurulum planları.
 *
 * Tek bir kalenin tek planı var — node war'a müttefiklerle birlikte
 * giriliyor, kurulum da ortak. Okumak için oturum yeterli, yazmak için
 * savaş yönetme yetkisi gerekiyor.
 */

/** Bir plandaki en fazla şekil sayısı — kazayla dev JSON gönderilmesin */
const MAX_SHAPES = 500;

export async function GET() {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await prisma.fortPlan.findMany({
    select: {
      fortKey: true, shapes: true, updatedAt: true,
      editor: { select: { familyName: true } },
    },
  });

  const out: Record<string, { shapes: unknown; updatedAt: Date; by: string }> = {};
  for (const p of plans) {
    let shapes: unknown = [];
    try { shapes = JSON.parse(p.shapes); }
    catch { /* bozuk kayıt — boş plan gibi davran */ }
    out[p.fortKey] = { shapes, updatedAt: p.updatedAt, by: p.editor.familyName };
  }

  return NextResponse.json({ plans: out, canEdit: scope.canManageWars });
}

export async function PUT(req: Request) {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!scope.canManageWars) {
    return NextResponse.json({ error: "Yetki yok" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const fortKey = typeof body?.fortKey === "string" ? body.fortKey : null;
  const shapes = body?.shapes;

  if (!fortKey || !/^[a-z0-9-]{1,40}$/.test(fortKey)) {
    return NextResponse.json({ error: "Geçersiz kale" }, { status: 400 });
  }
  if (!Array.isArray(shapes) || shapes.length > MAX_SHAPES) {
    return NextResponse.json({ error: "Geçersiz çizim" }, { status: 400 });
  }

  const json = JSON.stringify(shapes);

  // Boş plan kaydı tutmanın anlamı yok — silinince satır da gitsin
  if (shapes.length === 0) {
    await prisma.fortPlan.deleteMany({ where: { fortKey } });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const saved = await prisma.fortPlan.upsert({
    where: { fortKey },
    create: { fortKey, shapes: json, updatedBy: scope.userId },
    update: { shapes: json, updatedBy: scope.userId },
    select: { updatedAt: true, editor: { select: { familyName: true } } },
  });

  return NextResponse.json({
    ok: true,
    updatedAt: saved.updatedAt,
    by: saved.editor.familyName,
  });
}
