export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID!;
const CRON_SECRET = process.env.CRON_SECRET;
const GOLD = 0xd4a853;

async function deleteMsg(messageId: string) {
  if (!BOT_TOKEN || !CHANNEL_ID) return;
  await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${messageId}`, {
    method: "DELETE",
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
  });
}

async function sendReminder(war: {
  id: number;
  title: string;
  type: string;
  date: Date;
}, hoursLeft: number): Promise<string | null> {
  const attendCount = await prisma.warParticipant.count({
    where: { warId: war.id, status: "ATTENDING" },
  });

  const emoji = hoursLeft <= 4 ? "🚨" : "⏰";
  const urgency = hoursLeft <= 4 ? "Son çağrı!" : "Hatırlatma";
  const timeStr = new Date(war.date).toLocaleTimeString("tr-TR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
  });
  const warUrl = `https://www.aetheri.online/wars/${war.id}`;

  const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify({
      content: "@everyone",
      embeds: [{
        title: `${emoji} ${urgency} — ${war.title}`,
        url: warUrl,
        description: `Savaş **${hoursLeft} saat** içinde başlıyor!\n\n⏰ Saat: **${timeStr}**\n✅ Katılım: **${attendCount}** kişi\n\n🔗 [Savaş sayfasına git](${warUrl})`,
        color: hoursLeft <= 4 ? 0xe74c3c : GOLD,
        footer: { text: "Aetherion" },
      }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data.id as string;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in10h = new Date(now.getTime() + 10 * 3_600_000);
  const in4h  = new Date(now.getTime() +  4 * 3_600_000);

  let sent10h = 0, sent4h = 0, cleaned = 0;

  // ── 1. 10h reminders ─────────────────────────────────────────────────────
  const wars10h = await prisma.war.findMany({
    where: { date: { gt: now, lte: in10h }, reminder10hSent: false },
  });
  for (const war of wars10h) {
    const msgId = await sendReminder(war, 10);
    await prisma.war.update({
      where: { id: war.id },
      data: { reminder10hSent: true, reminder10hMsgId: msgId },
    });
    sent10h++;
  }

  // ── 2. 4h reminders: delete the 10h message first ────────────────────────
  const wars4h = await prisma.war.findMany({
    where: { date: { gt: now, lte: in4h }, reminder4hSent: false },
  });
  for (const war of wars4h) {
    // Delete 10h reminder if it exists
    if (war.reminder10hMsgId) {
      await deleteMsg(war.reminder10hMsgId);
    }
    const msgId = await sendReminder(war, 4);
    await prisma.war.update({
      where: { id: war.id },
      data: { reminder4hSent: true, reminder4hMsgId: msgId, reminder10hMsgId: null },
    });
    sent4h++;
  }

  // ── 3. Cleanup: delete 4h reminders for wars that have already started ───
  const pastWars = await prisma.war.findMany({
    where: { date: { lte: now }, reminder4hMsgId: { not: null } },
    select: { id: true, reminder4hMsgId: true },
  });
  for (const war of pastWars) {
    if (war.reminder4hMsgId) {
      await deleteMsg(war.reminder4hMsgId);
      await prisma.war.update({
        where: { id: war.id },
        data: { reminder4hMsgId: null },
      });
      cleaned++;
    }
  }

  return NextResponse.json({ ok: true, checked: now.toISOString(), sent10h, sent4h, cleaned });
}
