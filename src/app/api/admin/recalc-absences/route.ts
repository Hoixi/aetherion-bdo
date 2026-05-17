export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Önce herkesi sıfırla
  await prisma.user.updateMany({ data: { absenceCount: 0 } });

  // Hasar raporu olan tüm savaşları al
  const wars = await prisma.war.findMany({
    where: { performances: { some: {} } },
    include: {
      performances: { select: { inGameName: true } },
      parties: {
        include: { members: { include: { user: { select: { id: true, familyName: true } } } } },
      },
    },
  });

  let totalAbsences = 0;
  const absentMap = new Map<number, number>(); // userId -> count

  for (const war of wars) {
    const perfNames = new Set(
      war.performances.map((p) => p.inGameName.toLowerCase().trim())
    );

    for (const party of war.parties) {
      for (const member of party.members) {
        if (!perfNames.has(member.user.familyName.toLowerCase().trim())) {
          absentMap.set(member.userId, (absentMap.get(member.userId) ?? 0) + 1);
          totalAbsences++;
        }
      }
    }
  }

  // Toplu güncelle
  for (const [userId, count] of absentMap.entries()) {
    await prisma.user.update({
      where: { id: userId },
      data: { absenceCount: count },
    });
  }

  return NextResponse.json({
    warsProcessed: wars.length,
    totalAbsences,
    affectedUsers: absentMap.size,
  });
}
