export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendActivityToDiscord } from "@/lib/activity-discord";

const ACTIVITY_CHANNEL_ID = "1366043560608137277";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Delete expired activities and their Discord messages
  const expired = await prisma.activity.findMany({ where: { expiresAt: { lt: new Date() } } });
  for (const a of expired) {
    if (a.discordMessageId) {
      await fetch(`https://discord.com/api/v10/channels/${ACTIVITY_CHANNEL_ID}/messages/${a.discordMessageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${BOT_TOKEN}` },
      });
    }
  }
  await prisma.activity.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  const activities = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { id: true, familyName: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, familyName: true, avatarUrl: true } } },
      },
    },
  });

  return NextResponse.json(activities);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { type, maxSize } = await req.json();

  const validTypes = ["KARA_TAPINAK", "KAN_ALTARI", "PARTI_SLOTLARI"];
  if (!validTypes.includes(type)) return NextResponse.json({ error: "Geçersiz tip" }, { status: 400 });

  const size =
    type === "KARA_TAPINAK" ? 5 :
    type === "KAN_ALTARI" ? 3 :
    [3, 5].includes(maxSize) ? maxSize : 5;

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const activity = await prisma.activity.create({
    data: {
      type,
      maxSize: size,
      creatorId: session.user.id,
      expiresAt,
      members: { create: { userId: session.user.id } },
    },
    include: {
      creator: { select: { id: true, familyName: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, familyName: true, avatarUrl: true, ap: true, dp: true } } },
      },
    },
  });

  // Send to Discord
  const msgId = await sendActivityToDiscord({
    ...activity,
    members: activity.members.map((m) => ({ user: m.user })),
  });
  if (msgId) {
    await prisma.activity.update({ where: { id: activity.id }, data: { discordMessageId: msgId } });
  }

  return NextResponse.json(activity, { status: 201 });
}
