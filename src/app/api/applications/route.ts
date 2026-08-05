export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GOLD = 0xd4a853;

/** Başvuru geldiğinde klanın duyuru kanalına haber ver */
async function notifyOfficers(app: {
  id: number; familyName: string; discordUsername: string;
  class: string; ap: number; dp: number; guildId: number | null;
}) {
  if (!BOT_TOKEN || !app.guildId) return;

  const guild = await prisma.guild.findUnique({
    where: { id: app.guildId },
    select: { name: true, warChannelId: true, allyWarChannelId: true },
  });
  const channelId = guild?.warChannelId || guild?.allyWarChannelId;
  if (!channelId) return;

  const site = process.env.NEXTAUTH_URL || "";
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify({
      embeds: [{
        title: "Yeni Başvuru",
        description: `**${app.familyName}** klana başvurdu.`,
        color: GOLD,
        fields: [
          { name: "Discord", value: app.discordUsername, inline: true },
          { name: "Class", value: app.class || "—", inline: true },
          { name: "GS", value: `${app.ap + app.dp} (${app.ap}/${app.dp})`, inline: true },
        ],
        url: site ? `${site}/admin` : undefined,
        footer: { text: guild?.name ?? "Aetherion" },
        timestamp: new Date().toISOString(),
      }],
    }),
  }).catch(() => {});
}

/** POST — herkese açık, giriş gerektirmez */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    familyName, discordUsername, guildId,
    class: cls, spec, ap, dp, experience, note,
  } = body;

  if (!familyName?.trim() || !discordUsername?.trim()) {
    return NextResponse.json({ error: "Aile adı ve Discord kullanıcı adı zorunlu." }, { status: 400 });
  }

  const apNum = Number(ap) || 0;
  const dpNum = Number(dp) || 0;
  if (apNum < 0 || apNum > 5000 || dpNum < 0 || dpNum > 5000) {
    return NextResponse.json({ error: "AP/DP değerleri geçersiz." }, { status: 400 });
  }

  // Aynı kişi bekleyen başvuru bırakmışsa tekrar açma
  const existing = await prisma.application.findFirst({
    where: {
      discordUsername: discordUsername.trim(),
      status: { in: ["NEW", "REVIEW"] },
    },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Bu Discord hesabıyla bekleyen bir başvurun zaten var." },
      { status: 409 },
    );
  }

  const app = await prisma.application.create({
    data: {
      familyName: familyName.trim().slice(0, 60),
      discordUsername: discordUsername.trim().slice(0, 60),
      guildId: guildId ? Number(guildId) : null,
      class: cls || "",
      spec: spec || "awakening",
      ap: apNum,
      dp: dpNum,
      experience: experience?.slice(0, 2000) || null,
      note: note?.slice(0, 1000) || null,
    },
  });

  await notifyOfficers(app);

  return NextResponse.json({ ok: true, id: app.id }, { status: 201 });
}

/** GET — sadece yetkililer */
export async function GET() {
  const scope = await getGuildScope();
  if (!scope?.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const applications = await prisma.application.findMany({
    // Klan yöneticisi sadece kendi klanına gelenleri görür
    where: scope.isAdmin ? {} : { guildId: scope.guildId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      guild: { select: { id: true, name: true, tag: true, color: true } },
      reviewer: { select: { familyName: true } },
    },
  });

  return NextResponse.json(applications);
}
