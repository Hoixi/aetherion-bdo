export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const members = await prisma.user.findMany({
    where: { familyName: { not: "" }, deletedAt: null },
    orderBy: [{ ap: "desc" }, { dp: "desc" }],
    include: {
      siteRole: { select: { name: true, color: true } },
      _count: { select: { participations: { where: { status: "ATTENDING" } } } },
    },
  });

  return NextResponse.json(members);
}
