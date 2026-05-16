export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateActivityMessage } from "@/app/api/activities/route";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activityId = parseInt(params.id);

  const member = await prisma.activityMember.findFirst({
    where: { activityId, userId: session.user.id },
  });
  if (!member) return NextResponse.json({ error: "Katılım bulunamadı" }, { status: 404 });

  // Get activity before delete for Discord update
  const activity = await prisma.activity.findUnique({ where: { id: activityId } });

  await prisma.activityMember.delete({ where: { id: member.id } });

  // Update Discord message
  if (activity?.discordMessageId) {
    const updated = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        creator: { select: { id: true, familyName: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, familyName: true, avatarUrl: true, ap: true, dp: true } } } },
      },
    });
    if (updated) {
      await updateActivityMessage(activity.discordMessageId, {
        ...updated,
        members: updated.members.map((m) => ({ user: m.user })),
      });
    }
  }

  return NextResponse.json({ success: true });
}
