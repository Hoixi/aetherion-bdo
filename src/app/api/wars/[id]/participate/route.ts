export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassByID } from "@/lib/classes";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status, asClass, asSpec } = await req.json();
  if (!["ATTENDING", "DECLINED"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const warId = Number(params.id);

  const war = await prisma.war.findUnique({ where: { id: warId } });
  if (!war) return NextResponse.json({ error: "War not found" }, { status: 404 });

  if (war.deadline && new Date() > war.deadline) {
    return NextResponse.json({ error: "Deadline passed" }, { status: 400 });
  }

  // Hangi karakterle geleceği — bildirmezse profilindeki geçerli sayılır
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { class: true, spec: true },
  });
  const pickedClass = asClass && getClassByID(String(asClass)) ? String(asClass) : me?.class ?? null;
  const pickedSpec = asSpec ? String(asSpec) : me?.spec ?? null;

  const participant = await prisma.warParticipant.upsert({
    where: { warId_userId: { warId, userId: session.user.id } },
    update: {
      status,
      respondedAt: new Date(),
      // Katılmıyorsa karakter bilgisi anlamsız
      asClass: status === "ATTENDING" ? pickedClass : null,
      asSpec: status === "ATTENDING" ? pickedSpec : null,
    },
    create: {
      warId, userId: session.user.id, status, respondedAt: new Date(),
      asClass: status === "ATTENDING" ? pickedClass : null,
      asSpec: status === "ATTENDING" ? pickedSpec : null,
    },
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
