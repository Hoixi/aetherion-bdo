export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activity = await prisma.activity.findUnique({ where: { id: parseInt(params.id) } });
  if (!activity) return NextResponse.json({ error: "Bulunamadı" }, { status: 404 });
  if (activity.creatorId !== session.user.id && !session.user.isAdmin)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.activity.delete({ where: { id: activity.id } });
  return NextResponse.json({ success: true });
}
