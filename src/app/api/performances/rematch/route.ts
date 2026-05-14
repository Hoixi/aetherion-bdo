export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function normalizeTr(s: string): string {
  return s
    .toLowerCase()
    .replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u")
    .replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ç/g, "c")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/ı/g, "i")
    .trim();
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const unmatched = await prisma.warPerformance.findMany({
    where: { userId: null },
    select: { id: true, inGameName: true },
  });

  const allUsers = await prisma.user.findMany({ select: { id: true, familyName: true } });
  const userMap = new Map(
    allUsers.filter((u) => u.familyName).map((u) => [normalizeTr(u.familyName!), u.id])
  );

  let matched = 0;
  for (const record of unmatched) {
    const userId = userMap.get(normalizeTr(record.inGameName)) ?? null;
    if (userId) {
      await prisma.warPerformance.update({ where: { id: record.id }, data: { userId } });
      matched++;
    }
  }

  return NextResponse.json({ total: unmatched.length, matched });
}
