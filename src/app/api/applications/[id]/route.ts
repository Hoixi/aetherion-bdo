export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope, canManageGuild } from "@/lib/guild-scope";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

type GuildMember = {
  user: { id: string; username?: string; global_name?: string | null };
  nick?: string | null;
};

/**
 * Discord sunucusunda kullanıcı adına göre üye arar.
 * Kabul sırasında rol atayabilmek için discordId'yi çözer.
 */
async function findDiscordMember(serverId: string, username: string): Promise<GuildMember | null> {
  const q = encodeURIComponent(username.replace(/^@/, "").split("#")[0]);
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${serverId}/members/search?query=${q}&limit=10`,
    { headers: { Authorization: `Bot ${BOT_TOKEN}` }, cache: "no-store" },
  );
  if (!res.ok) return null;

  const members = (await res.json()) as GuildMember[];
  const target = username.replace(/^@/, "").split("#")[0].toLowerCase();
  return (
    members.find((m) => m.user.username?.toLowerCase() === target) ??
    members.find((m) => m.nick?.toLowerCase() === target) ??
    members.find((m) => m.user.global_name?.toLowerCase() === target) ??
    members[0] ??
    null
  );
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getGuildScope();
  if (!scope?.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { status, reviewNote } = await req.json();
  const id = Number(params.id);

  const app = await prisma.application.findUnique({
    where: { id },
    include: { guild: true },
  });
  if (!app) return NextResponse.json({ error: "Başvuru bulunamadı." }, { status: 404 });

  if (!canManageGuild(scope, app.guildId)) {
    return NextResponse.json({ error: "Bu başvuruyu yönetemezsin." }, { status: 403 });
  }

  const validStatuses = ["NEW", "REVIEW", "ACCEPTED", "REJECTED"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  let discordId = app.discordId;
  let roleWarning: string | null = null;

  // Kabul → Discord rolünü ata
  if (status === "ACCEPTED" && app.guild) {
    const serverId = app.guild.discordServerId;
    let roleIds: string[] = [];
    try { roleIds = JSON.parse(app.guild.discordRoleIds || "[]"); } catch { /* bozuk JSON */ }

    if (!serverId || roleIds.length === 0) {
      roleWarning = "Klanın Discord sunucusu veya rolü ayarlı değil — rol atanamadı.";
    } else {
      const member = await findDiscordMember(serverId, app.discordUsername);
      if (!member) {
        roleWarning = `"${app.discordUsername}" sunucuda bulunamadı — önce Discord'a katılmalı.`;
      } else {
        discordId = member.user.id;
        const res = await fetch(
          `https://discord.com/api/v10/guilds/${serverId}/members/${member.user.id}/roles/${roleIds[0]}`,
          { method: "PUT", headers: { Authorization: `Bot ${BOT_TOKEN}` } },
        );
        if (!res.ok) {
          roleWarning = `Rol atanamadı (${res.status}) — botun rolü hedef rolün üstünde mi?`;
        }
      }
    }
  }

  const updated = await prisma.application.update({
    where: { id },
    data: {
      status: status ?? undefined,
      reviewNote: reviewNote !== undefined ? reviewNote : undefined,
      discordId,
      reviewedBy: status ? scope.userId : undefined,
      reviewedAt: status ? new Date() : undefined,
    },
    include: {
      guild: { select: { id: true, name: true, tag: true, color: true } },
      reviewer: { select: { familyName: true } },
    },
  });

  return NextResponse.json({ ...updated, roleWarning });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getGuildScope();
  if (!scope?.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const app = await prisma.application.findUnique({ where: { id: Number(params.id) } });
  if (!app) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  if (!canManageGuild(scope, app.guildId)) {
    return NextResponse.json({ error: "Bu başvuruyu silemezsin." }, { status: 403 });
  }

  await prisma.application.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
