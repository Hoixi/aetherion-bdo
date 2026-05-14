export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = Number(searchParams.get("year") || new Date().getFullYear());
  const month = Number(searchParams.get("month") || new Date().getMonth() + 1);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const wars = await prisma.war.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
    select: {
      id: true,
      title: true,
      type: true,
      date: true,
      result: true,
      _count: { select: { participants: { where: { status: "ATTENDING" } } } },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(wars);
}
