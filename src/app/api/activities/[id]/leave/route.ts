export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.activityMember.findFirst({
    where: { activityId: parseInt(params.id), userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Katılım bulunamadı" }, { status: 404 });

  await prisma.activityMember.delete({ where: { id: member.id } });
  return NextResponse.json({ success: true });
}
