export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participants = await prisma.warParticipant.findMany({
    where: { warId: Number(params.id) },
    include: { user: true },
    orderBy: { respondedAt: "asc" },
  });

  return NextResponse.json(participants);
}
