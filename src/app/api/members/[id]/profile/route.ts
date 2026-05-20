import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = Number(params.id);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      siteRole: { select: { name: true, color: true } },
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

  // Sadece üyenin kayıt tarihinden sonraki savaşları say
  const totalWars = await prisma.war.count({
    where: { date: { gte: user.createdAt } },
  });
  const attended = user.participations.filter((p) => p.status === "ATTENDING").length;
  const attendanceRate = totalWars > 0 ? Math.round((attended / totalWars) * 100) : 0;

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
    createdAt: user.createdAt,
    stats: {
      totalWars,
      attended,
      attendanceRate,
    },
    wars: user.participations
      .filter((p) => p.status === "ATTENDING")
      .map((p) => p.war)
      .slice(0, 20),
    gsHistory,
  };

  // Sadece admin görebilsin
  if (session.user?.isAdmin) {
    response.absenceCount = user.absenceCount;
  }

  return NextResponse.json(response);
}
