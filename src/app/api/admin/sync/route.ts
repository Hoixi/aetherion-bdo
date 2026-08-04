export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface DiscordMember {
  discordId: string;
  avatarUrl: string;
  discordUsername: string;
  /** Eşleştiği klan */
  guildId: number;
}

type GuildRoleMap = {
  id: number;
  name: string;
  tag: string;
  serverId: string;
  roleIds: string[];
  isPrimary: boolean;
};

/** Bir Discord sunucusundaki tüm üyeleri sayfalayarak çeker */
async function fetchServerMembers(serverId: string, botToken: string) {
  const out: {
    id: string; avatar: string | null; nick: string | null;
    globalName: string | null; username: string; roles: string[];
  }[] = [];
  let after = "0";

  while (true) {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${serverId}/members?limit=1000&after=${after}`,
      { headers: { Authorization: `Bot ${botToken}` }, cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(`Sunucu ${serverId} okunamadı (${res.status}) — bot o sunucuda mı?`);
    }
    const members = await res.json();
    if (!Array.isArray(members) || members.length === 0) break;

    for (const m of members) {
      out.push({
        id: m.user.id,
        avatar: m.user.avatar ?? null,
        nick: m.nick ?? null,
        globalName: m.user.global_name ?? null,
        username: m.user.username ?? m.user.id,
        roles: m.roles ?? [],
      });
    }

    if (members.length < 1000) break;
    after = members[members.length - 1].user.id;
  }

  return out;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const botToken = process.env.DISCORD_BOT_TOKEN!;
  const mainServerId = process.env.DISCORD_GUILD_ID!;
  const fallbackRoleId = process.env.DISCORD_REQUIRED_ROLE_ID;

  // Klan → rol eşleştirmeleri
  const guildRows = await prisma.guild.findMany({
    select: { id: true, name: true, tag: true, discordServerId: true, discordRoleIds: true, isPrimary: true },
  });

  const guilds: GuildRoleMap[] = guildRows.map((g) => {
    let roleIds: string[] = [];
    try { roleIds = JSON.parse(g.discordRoleIds || "[]"); } catch { /* bozuk JSON */ }
    // Ana klanda rol tanımlı değilse env'deki zorunlu role düş
    if (roleIds.length === 0 && g.isPrimary && fallbackRoleId) roleIds = [fallbackRoleId];
    return {
      id: g.id, name: g.name, tag: g.tag,
      serverId: g.discordServerId || mainServerId,
      roleIds,
      isPrimary: g.isPrimary,
    };
  }).filter((g) => g.roleIds.length > 0);

  if (guilds.length === 0) {
    return NextResponse.json(
      { error: "Hiçbir klana Discord rolü bağlanmamış. Önce Klanlar sekmesinden rol ata." },
      { status: 400 },
    );
  }

  // Gerekli sunucuları bir kez çek
  const serverIds = Array.from(new Set(guilds.map((g) => g.serverId)));
  const serverMembers = new Map<string, Awaited<ReturnType<typeof fetchServerMembers>>>();
  const serverErrors: string[] = [];

  for (const sid of serverIds) {
    try {
      serverMembers.set(sid, await fetchServerMembers(sid, botToken));
    } catch (e) {
      serverErrors.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (serverMembers.size === 0) {
    return NextResponse.json({ error: serverErrors[0] ?? "Hiçbir sunucu okunamadı." }, { status: 502 });
  }

  // Üye → klan eşleştirmesi (müttefikler önce, ana klan fallback)
  const ordered = [...guilds].sort((a, b) => Number(a.isPrimary) - Number(b.isPrimary));
  const matched = new Map<string, DiscordMember>();

  for (const g of ordered) {
    const members = serverMembers.get(g.serverId);
    if (!members) continue;
    for (const m of members) {
      if (matched.has(m.id)) continue; // ilk eşleşen klan kazanır
      if (!g.roleIds.some((rid) => m.roles.includes(rid))) continue;
      matched.set(m.id, {
        discordId: m.id,
        avatarUrl: m.avatar ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.webp?size=128` : "",
        discordUsername: m.nick || m.globalName || m.username,
        guildId: g.id,
      });
    }
  }

  const discordMembers = Array.from(matched.values());
  const discordIds = discordMembers.map((m) => m.discordId);
  const usernameMap = new Map(discordMembers.map((m) => [m.discordId, m.discordUsername]));

  // Rolü kalmayanları gizle
  const softDeleted = await prisma.user.updateMany({
    where: { discordId: { notIn: discordIds }, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  // Rolü geri gelenleri aç
  const restored = await prisma.user.updateMany({
    where: { discordId: { in: discordIds }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });

  // Yeni üyeleri oluştur, mevcutların klanını güncelle
  const existing = await prisma.user.findMany({
    where: { discordId: { in: discordIds } },
    select: { discordId: true, guildId: true },
  });
  const existingMap = new Map(existing.map((u) => [u.discordId, u]));

  let created = 0;
  let guildUpdated = 0;

  for (const m of discordMembers) {
    const found = existingMap.get(m.discordId);
    if (!found) {
      await prisma.user.create({
        data: { discordId: m.discordId, avatarUrl: m.avatarUrl, guildId: m.guildId },
      });
      created++;
    } else if (found.guildId !== m.guildId) {
      await prisma.user.update({
        where: { discordId: m.discordId },
        data: { guildId: m.guildId },
      });
      guildUpdated++;
    }
  }

  // Klan bazlı özet
  const perGuild = guilds.map((g) => ({
    tag: g.tag,
    name: g.name,
    count: discordMembers.filter((m) => m.guildId === g.id).length,
  }));

  // Profili eksik olanlar
  const incomplete = await prisma.user.findMany({
    where: {
      discordId: { in: discordIds },
      deletedAt: null,
      OR: [{ familyName: "" }, { class: "" }, { ap: 0, dp: 0 }],
    },
    select: {
      id: true, discordId: true, familyName: true, avatarUrl: true,
      ap: true, dp: true, class: true,
      guild: { select: { tag: true, color: true } },
    },
  });

  return NextResponse.json({
    softDeleted: softDeleted.count,
    restored: restored.count,
    created,
    guildUpdated,
    totalWithRole: discordMembers.length,
    perGuild,
    serversRead: serverMembers.size,
    serverErrors,
    incomplete: incomplete.map((u) => ({
      ...u,
      discordUsername: usernameMap.get(u.discordId) ?? u.discordId,
    })),
  });
}
