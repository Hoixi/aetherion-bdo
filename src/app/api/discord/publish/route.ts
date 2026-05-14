export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendWarToDiscord, sendAnnouncementToDiscord, sendPartiesToDiscord } from "@/lib/discord-bot";

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
    const ann = await prisma.announcement.findUnique({
      where: { id: Number(id) },
      include: { creator: { select: { familyName: true } } },
    });
    if (!ann) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Get previous announcement to delete its Discord message
    const prevAnnouncement = await prisma.announcement.findFirst({
      where: { id: { not: ann.id } },
      orderBy: { createdAt: "desc" },
      select: { discordMessageId: true },
    });

    const messageId = await sendAnnouncementToDiscord({
      title: ann.title,
      content: ann.content,
      creator: ann.creator.familyName,
      oldMessageId: prevAnnouncement?.discordMessageId || undefined,
    });

    // Save Discord message ID
    if (messageId) {
      await prisma.announcement.update({
        where: { id: ann.id },
        data: { discordMessageId: messageId },
      });
    }

    return NextResponse.json({ ok: true });
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
