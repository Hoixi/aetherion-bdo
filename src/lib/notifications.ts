import { prisma } from "@/lib/prisma";

type NotifType = "NEW_WAR" | "PARTY_ASSIGNED" | "DEADLINE_SOON" | "WAR_RESULT";

export async function createNotification(
  userId: number,
  type: NotifType,
  title: string,
  message: string,
  link?: string
) {
  return prisma.notification.create({
    data: { userId, type, title, message, link },
  });
}

export async function notifyAllMembers(
  type: NotifType,
  title: string,
  message: string,
  link?: string
) {
  const members = await prisma.user.findMany({
    where: { familyName: { not: "" } },
    select: { id: true },
  });

  if (members.length === 0) return;

  await prisma.notification.createMany({
    data: members.map((m) => ({
      userId: m.id,
      type,
      title,
      message,
      link,
    })),
  });
}

export async function notifyWarParticipants(
  warId: number,
  type: NotifType,
  title: string,
  message: string,
  link?: string
) {
  const participants = await prisma.warParticipant.findMany({
    where: { warId, status: "ATTENDING" },
    select: { userId: true },
  });

  if (participants.length === 0) return;

  await prisma.notification.createMany({
    data: participants.map((p) => ({
      userId: p.userId,
      type,
      title,
      message,
      link,
    })),
  });
}
