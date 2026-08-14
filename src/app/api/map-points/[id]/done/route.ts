export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

/** "Topladım" işaretini aç/kapat — kullanıcıya özel */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pointId = Number(params.id);
  if (isNaN(pointId)) return NextResponse.json({ error: "Geçersiz nokta." }, { status: 400 });

  const existing = await prisma.mapPointDone.findUnique({
    where: { pointId_userId: { pointId, userId: scope.userId } },
  });

  if (existing) {
    await prisma.mapPointDone.delete({ where: { id: existing.id } });
    return NextResponse.json({ done: false });
  }

  await prisma.mapPointDone.create({ data: { pointId, userId: scope.userId } });
  return NextResponse.json({ done: true });
}
