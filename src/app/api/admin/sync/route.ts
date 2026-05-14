export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GUILD_ROLE_ID = "1327570450070634521";

interface DiscordMember {
  discordId: string;
  avatarUrl: string;
  discordUsername: string;
}

async function fetchAllMembersWithRole(): Promise<DiscordMember[]> {
  const guildId = process.env.DISCORD_GUILD_ID!;
  const botToken = process.env.DISCORD_BOT_TOKEN!;

  const result: DiscordMember[] = [];
  let after = "0";

  while (true) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${botToken}` } }
    );
    if (!res.ok) throw new Error(`Discord API hatası: ${res.status}`);
    const members = await res.json();
    if (!Array.isArray(members) || members.length === 0) break;

    for (const m of members) {
      if (m.roles?.includes(GUILD_ROLE_ID)) {
        const avatar = m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.webp?size=128`
          : "";
        const discordUsername = m.nick || m.user.global_name || m.user.username || m.user.id;
        result.push({ discordId: m.user.id, avatarUrl: avatar, discordUsername });
      }
    }

    if (members.length < 1000) break;
    after = members[members.length - 1].user.id;
  }

  return result;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const discordMembers = await fetchAllMembersWithRole();
  const discordIds = new Set(discordMembers.map((m) => m.discordId));
  const usernameMap = new Map(discordMembers.map((m) => [m.discordId, m.discordUsername]));

  // Soft-delete active users who no longer have the role
  const softDeleted = await prisma.user.updateMany({
    where: { discordId: { notIn: Array.from(discordIds) }, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  // Restore previously soft-deleted users who now have the role
  const restored = await prisma.user.updateMany({
    where: { discordId: { in: Array.from(discordIds) }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });

  // Create users who don't exist yet
  let created = 0;
  for (const m of discordMembers) {
    const existing = await prisma.user.findUnique({ where: { discordId: m.discordId } });
    if (!existing) {
      await prisma.user.create({
        data: { discordId: m.discordId, avatarUrl: m.avatarUrl },
      });
      created++;
    }
  }

  // Find incomplete profiles (role members who haven't filled in info)
  const incomplete = await prisma.user.findMany({
    where: {
      discordId: { in: Array.from(discordIds) },
      deletedAt: null,
      OR: [{ familyName: "" }, { class: "" }, { ap: 0, dp: 0 }],
    },
    select: { id: true, discordId: true, familyName: true, avatarUrl: true, ap: true, dp: true, class: true },
  });

  // Attach Discord username to each incomplete user
  const incompleteWithUsername = incomplete.map((u) => ({
    ...u,
    discordUsername: usernameMap.get(u.discordId) ?? u.discordId,
  }));

  return NextResponse.json({
    softDeleted: softDeleted.count,
    restored: restored.count,
    created,
    incomplete: incompleteWithUsername,
    totalWithRole: discordMembers.length,
  });
}
