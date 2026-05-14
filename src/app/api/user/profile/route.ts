export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      participations: {
        where: { status: "ATTENDING" },
        include: { war: { select: { id: true, title: true, type: true, date: true } } },
        orderBy: { war: { date: "desc" } },
      },
    },
  });

  return NextResponse.json(user);
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { familyName, ap, dp, class: bdoClass, spec } = body;

  // AP/DP değiştiyse GS history kaydı oluştur
  if (ap !== undefined || dp !== undefined) {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { ap: true, dp: true },
    });
    const newAp = ap !== undefined ? Number(ap) : current!.ap;
    const newDp = dp !== undefined ? Number(dp) : current!.dp;

    if (current && (newAp !== current.ap || newDp !== current.dp)) {
      await prisma.gsHistory.create({
        data: { userId: session.user.id, ap: newAp, dp: newDp },
      });
    }
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      familyName: familyName ?? undefined,
      ap: ap !== undefined ? Number(ap) : undefined,
      dp: dp !== undefined ? Number(dp) : undefined,
      class: bdoClass ?? undefined,
      spec: spec ?? undefined,
    },
  });

  return NextResponse.json(user);
}
