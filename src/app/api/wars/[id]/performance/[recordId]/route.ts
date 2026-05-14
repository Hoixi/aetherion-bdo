export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function normalizeTr(s: string): string {
  return s
    .toLowerCase()
    .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
    .replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/ı/g, "i")
    .trim();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; recordId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const warId = parseInt(params.id);
  const recordId = parseInt(params.recordId);
  if (isNaN(warId) || isNaN(recordId))
    return NextResponse.json({ error: "Geçersiz ID" }, { status: 400 });

  const { inGameName } = await req.json();
  if (!inGameName?.trim())
    return NextResponse.json({ error: "Aile adı boş olamaz" }, { status: 400 });

  const newName = inGameName.trim();

  const allUsers = await prisma.user.findMany({ select: { id: true, familyName: true } });
  const userMap = new Map(
    allUsers.filter((u) => u.familyName).map((u) => [normalizeTr(u.familyName!), u.id])
  );
  const userId = userMap.get(normalizeTr(newName)) ?? null;

  try {
    const record = await prisma.warPerformance.update({
      where: { id: recordId },
      data: { inGameName: newName, userId },
      include: { user: { select: { familyName: true, avatarUrl: true, class: true } } },
    });
    return NextResponse.json({ ...record, matched: userId !== null });
  } catch {
    return NextResponse.json({ error: "Bu isim bu savaşta zaten mevcut" }, { status: 409 });
  }
}
