export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID!;
const CRON_SECRET = process.env.CRON_SECRET;
const GOLD = 0xd4a853;

async function sendReminder(war: {
  id: number;
  title: string;
  type: string;
  date: Date;
  discordMessageId: string | null;
}, hoursLeft: number) {
  const attendCount = await prisma.warParticipant.count({
    where: { warId: war.id, status: "ATTENDING" },
  });

  const emoji = hoursLeft <= 4 ? "🚨" : "⏰";
  const urgency = hoursLeft <= 4 ? "Son çağrı!" : "Hatırlatma";
  const warDate = new Date(war.date);
  const timeStr = warDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

  const warUrl = `https://www.aetheri.online/wars/${war.id}`;

  const embed = {
    title: `${emoji} ${urgency} — ${war.title}`,
    url: warUrl,
    description: `Savaş **${hoursLeft} saat** içinde başlıyor!\n\n⏰ Saat: **${timeStr}**\n✅ Katılım: **${attendCount}** kişi\n\n🔗 [Savaş sayfasına git](${warUrl})`,
    color: hoursLeft <= 4 ? 0xe74c3c : GOLD,
    footer: { text: "Aetherion" },
  };

  // Send reminder with @everyone
  await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify({
      content: "@everyone",
      embeds: [embed],
    }),
  });
}

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const in10h = new Date(now.getTime() + 10 * 60 * 60 * 1000);
  const in4h = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  let sent10h = 0;
  let sent4h = 0;

  // 10-hour reminders: wars between now and now+10h that haven't had 10h reminder
  const wars10h = await prisma.war.findMany({
    where: {
      date: { gt: now, lte: in10h },
      reminder10hSent: false,
    },
  });

  for (const war of wars10h) {
    await sendReminder(war, 10);
    await prisma.war.update({ where: { id: war.id }, data: { reminder10hSent: true } });
    sent10h++;
  }

  // 4-hour reminders: wars between now and now+4h that haven't had 4h reminder
  const wars4h = await prisma.war.findMany({
    where: {
      date: { gt: now, lte: in4h },
      reminder4hSent: false,
    },
  });

  for (const war of wars4h) {
    await sendReminder(war, 4);
    await prisma.war.update({ where: { id: war.id }, data: { reminder4hSent: true } });
    sent4h++;
  }

  return NextResponse.json({
    ok: true,
    checked: now.toISOString(),
    sent10h,
    sent4h,
  });
}
