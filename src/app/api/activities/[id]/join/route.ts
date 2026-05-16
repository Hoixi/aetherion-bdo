export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activity = await prisma.activity.findUnique({
    where: { id: parseInt(params.id) },
    include: { members: true },
  });
  if (!activity) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (activity.expiresAt < new Date()) return NextResponse.json({ error: "Etkinlik süresi dolmuş" }, { status: 400 });
  if (activity.members.length >= activity.maxSize) return NextResponse.json({ error: "Etkinlik dolu" }, { status: 400 });
  if (activity.members.some((m) => m.userId === session.user.id))
    return NextResponse.json({ error: "Zaten katıldınız" }, { status: 400 });

  await prisma.activityMember.create({ data: { activityId: activity.id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}
