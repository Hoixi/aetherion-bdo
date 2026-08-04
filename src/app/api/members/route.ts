export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

export async function GET(req: Request) {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Adminler ?all=1 ile tüm klanları çekebilir (parti kurma, ally savaşı yönetimi)
  const all = new URL(req.url).searchParams.get("all") === "1" && scope.isAdmin;

  const members = await prisma.user.findMany({
    where: {
      familyName: { not: "" },
      deletedAt: null,
      ...(all ? {} : { guildId: scope.guildId }),
    },
    orderBy: [{ ap: "desc" }, { dp: "desc" }],
    include: {
      siteRole: { select: { name: true, color: true } },
      guild: { select: { id: true, name: true, tag: true, color: true } },
      _count: { select: { participations: { where: { status: "ATTENDING" } } } },
    },
  });

  return NextResponse.json(members);
}
