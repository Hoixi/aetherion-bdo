import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(params.id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      siteRole: { select: { name: true, color: true } },
      guild: { select: { id: true, name: true, tag: true, color: true } },
      participations: {
        include: {
          war: { select: { id: true, title: true, type: true, date: true, result: true } },
        },
        orderBy: { war: { date: "desc" } },
      },
    },
  });

  if (!user || !user.familyName) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Profiller tüm klanlara açık — kadro bilgisi ortak tutulur.

  // İlk "ATTENDING" savaşından itibaren hesapla
  const firstAttend = await prisma.warParticipant.findFirst({
    where: { userId, status: "ATTENDING" },
    orderBy: { war: { date: "asc" } },
    include: { war: { select: { date: true } } },
  });

  const attended = user.participations.filter((p) => p.status === "ATTENDING").length;
  const totalWars = firstAttend
    ? await prisma.war.count({ where: { date: { gte: firstAttend.war.date } } })
    : 0;

  // Partiye alınıp gelmediyse çıkar
  const absencePenalty = user.absenceCount ?? 0;
  const effectiveAttended = Math.max(0, attended - absencePenalty);
  const attendanceRate = totalWars > 0 ? Math.round((effectiveAttended / totalWars) * 100) : 0;

  const gsHistory = await prisma.gsHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { ap: true, dp: true, createdAt: true },
  });

  const response: any = {
    id: user.id,
    familyName: user.familyName,
    class: user.class,
    spec: user.spec,
    ap: user.ap,
    dp: user.dp,
    avatarUrl: user.avatarUrl,
    siteRole: user.siteRole,
    guild: user.guild,
    createdAt: user.createdAt,
    stats: {
      totalWars,
      attended: effectiveAttended,
      attendanceRate,
    },
    wars: user.participations
      .filter((p) => p.status === "ATTENDING")
      .map((p) => p.war)
      .slice(0, 20),
    gsHistory,
  };

  // Sadece admin görebilsin
  if (scope.isAdmin) {
    response.absenceCount = user.absenceCount;
  }

  return NextResponse.json(response);
}
