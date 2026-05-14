export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json();
  if (!["ATTENDING", "DECLINED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const warId = Number(params.id);

  const war = await prisma.war.findUnique({ where: { id: warId } });
  if (!war) return NextResponse.json({ error: "War not found" }, { status: 404 });

  if (war.deadline && new Date() > war.deadline) {
    return NextResponse.json({ error: "Deadline passed" }, { status: 400 });
  }

  const participant = await prisma.warParticipant.upsert({
    where: { warId_userId: { warId, userId: session.user.id } },
    update: { status, respondedAt: new Date() },
    create: { warId, userId: session.user.id, status, respondedAt: new Date() },
  });

  // Katılmıyorum seçildiyse, bu savaşın tüm partilerinden kullanıcıyı çıkart
  if (status === "DECLINED") {
    await prisma.partyMember.deleteMany({
      where: {
        userId: session.user.id,
        party: { warId },
      },
    });
  }

  return NextResponse.json(participant);
}
