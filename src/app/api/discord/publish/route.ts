export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWarToDiscord, sendAnnouncementToDiscord, sendPartiesToDiscord, sendAnnouncementDm } from "@/lib/discord-bot";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, id } = await req.json();

  if (type === "war") {
    const war = await prisma.war.findUnique({ where: { id: Number(id) } });
    if (!war) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const messageId = await sendWarToDiscord(war);

    // Save Discord message ID for future updates
    if (messageId) {
      await prisma.war.update({
        where: { id: war.id },
        data: { discordMessageId: messageId },
      });
    }

    return NextResponse.json({ ok: true });
  }

  if (type === "announcement") {
    const ann = await db.announcement.findUnique({
      where: { id: Number(id) },
      include: { creator: { select: { familyName: true } } },
    });
    if (!ann) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const target: string = ann.target ?? "all";
    const announcementPayload = {
      title: ann.title,
      content: ann.content,
      creator: ann.creator.familyName,
    };

    // "all" → send to the clan channel (existing behaviour)
    if (target === "all") {
      const prevAnnouncement = await prisma.announcement.findFirst({
        where: { id: { not: ann.id } },
        orderBy: { createdAt: "desc" },
        select: { discordMessageId: true },
      });

      const messageId = await sendAnnouncementToDiscord({
        ...announcementPayload,
        oldMessageId: prevAnnouncement?.discordMessageId || undefined,
      });

      if (messageId) {
        await db.announcement.update({
          where: { id: ann.id },
          data: { discordMessageId: messageId },
        });
      }

      return NextResponse.json({ ok: true });
    }

    // DM targets — fetch matching users
    let users: { id: number; discordId: string }[] = [];

    if (target === "no_login") {
      // familyName is String @default("") — non-nullable, check for empty string
      users = await prisma.user.findMany({
        where: { deletedAt: null, familyName: "" },
        select: { id: true, discordId: true },
      });
    } else if (target === "no_gear") {
      users = await prisma.user.findMany({
        where: { deletedAt: null, familyName: { not: "" }, ap: 0, dp: 0 },
        select: { id: true, discordId: true },
      });
    } else if (target === "pvp") {
      const pvpRows = await prisma.warParticipant.findMany({
        distinct: ["userId"],
        select: { userId: true },
      });
      const ids = pvpRows.map((r) => r.userId);
      users = await prisma.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true, discordId: true },
      });
    }

    // Send DMs
    let sent = 0;
    let failed = 0;
    for (const user of users) {
      const ok = await sendAnnouncementDm(user.discordId, announcementPayload);
      if (ok) sent++; else failed++;
    }

    return NextResponse.json({ ok: true, sent, failed, target });
  }

  if (type === "parties") {
    const war = await prisma.war.findUnique({
      where: { id: Number(id) },
      include: {
        parties: {
          include: {
            members: {
              include: { user: { select: { familyName: true, ap: true, dp: true, class: true } } },
              orderBy: { order: "asc" },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!war) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (war.parties.length === 0) return NextResponse.json({ error: "No parties" }, { status: 400 });
    await sendPartiesToDiscord(war);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
