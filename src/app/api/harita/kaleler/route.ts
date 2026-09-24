export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Mevzi kalelerinin elle düzeltilmiş konumu.
 *
 * Varsayılan konumlar garmoth kurulum haritalarından türetildi; oyundaki
 * yerinden birkaç yüz metre kayabiliyor. Yöneticiler haritadan doğru noktaya
 * tıklayıp kaydediyor, kayıt yoksa türetilmiş konum kullanılıyor.
 *
 * Sorgular ham SQL: tablo eklemeli SQL ile açılıyor ve şema istemcisi
 * yeniden üretilmeden de çalışması gerekiyor.
 */

type Satir = { nodeKey: number; x: number; z: number; updatedBy: number; updatedAt: Date };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });
  try {
    const kaleler = await prisma.$queryRaw<Satir[]>`SELECT "nodeKey", "x", "z" FROM "node_forts"`;
    return NextResponse.json({ kaleler });
  } catch {
    // Tablo henüz açılmadıysa harita varsayılanlarla çalışsın
    return NextResponse.json({ kaleler: [] });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.canManageWars) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { nodeKey, x, z } = await req.json().catch(() => ({}));
  if (!Number.isSafeInteger(nodeKey) || nodeKey <= 0 || !Number.isFinite(x) || !Number.isFinite(z)) {
    return NextResponse.json({ error: "Geçersiz konum" }, { status: 400 });
  }
  // Dünya karesinin dışına düşen bir nokta kaza eseri tıklamadır
  if (Math.abs(x) > 2_000_000 || Math.abs(z) > 2_000_000) {
    return NextResponse.json({ error: "Konum haritanın dışında" }, { status: 400 });
  }

  await prisma.$executeRaw`
    INSERT INTO "node_forts" ("nodeKey", "x", "z", "updatedBy", "updatedAt")
    VALUES (${nodeKey}, ${x}, ${z}, ${session.user.id}, NOW())
    ON CONFLICT ("nodeKey") DO UPDATE
      SET "x" = EXCLUDED."x", "z" = EXCLUDED."z",
          "updatedBy" = EXCLUDED."updatedBy", "updatedAt" = NOW()`;
  return NextResponse.json({ ok: true, nodeKey, x, z });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.canManageWars) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  const nodeKey = Number(new URL(req.url).searchParams.get("nodeKey"));
  if (!Number.isSafeInteger(nodeKey) || nodeKey <= 0) {
    return NextResponse.json({ error: "Geçersiz düğüm" }, { status: 400 });
  }
  await prisma.$executeRaw`DELETE FROM "node_forts" WHERE "nodeKey" = ${nodeKey}`;
  return NextResponse.json({ ok: true });
}
