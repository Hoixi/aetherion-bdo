import { prisma } from "./prisma";

export interface DiscordMemberResult {
  /** Bilinen sunuculardan en az birinde üye mi */
  isMember: boolean;
  /** Siteye girebilir mi (ana klan rolü VEYA bir klana bağlı rol) */
  hasRole: boolean;
  /** Tüm sunuculardan toplanan rol ID'leri */
  roles: string[];
  /** Eşleşen klan (varsa) */
  matchedGuildId: number | null;
}

type GuildRoleMap = { id: number; serverId: string | null; roleIds: string[]; isPrimary: boolean };

async function fetchMemberRoles(accessToken: string, serverId: string): Promise<string[] | null> {
  const res = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${serverId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );
  if (!res.ok) return null; // 404 = o sunucuda değil
  const member = await res.json();
  return (member.roles ?? []) as string[];
}

/**
 * Kullanıcının siteye girip giremeyeceğini belirler.
 *
 * Giriş iki yoldan biriyle açılır:
 *   1. Ana sunucuda DISCORD_REQUIRED_ROLE_ID rolüne sahipse (Aetherion üyesi)
 *   2. Herhangi bir klana bağlanmış bir role sahipse (müttefik klan üyesi)
 *
 * Roller birden fazla Discord sunucusundan toplanır — müttefik kendi
 * sunucusunda olabilir.
 */
export async function checkDiscordMembership(accessToken: string): Promise<DiscordMemberResult> {
  const mainServerId = process.env.DISCORD_GUILD_ID!;
  const requiredRoleId = process.env.DISCORD_REQUIRED_ROLE_ID!;

  const guildRows = await prisma.guild.findMany({
    select: { id: true, discordServerId: true, discordRoleIds: true, isPrimary: true },
  });

  const guilds: GuildRoleMap[] = guildRows.map((g) => {
    let roleIds: string[] = [];
    try { roleIds = JSON.parse(g.discordRoleIds || "[]"); } catch { /* bozuk JSON */ }
    return { id: g.id, serverId: g.discordServerId, roleIds, isPrimary: g.isPrimary };
  });

  // Kontrol edilecek sunucular: ana sunucu + klanlara bağlı sunucular
  const serverIds = Array.from(new Set(
    [mainServerId, ...guilds.map((g) => g.serverId).filter((s): s is string => !!s)],
  ));

  const perServer = await Promise.all(
    serverIds.map(async (sid) => ({ sid, roles: await fetchMemberRoles(accessToken, sid) })),
  );

  const allRoles: string[] = [];
  let isMember = false;
  for (const { roles } of perServer) {
    if (roles === null) continue;
    isMember = true;
    allRoles.push(...roles);
  }

  if (!isMember) {
    console.error("[discord] kullanıcı bilinen hiçbir sunucuda bulunamadı", { serverIds });
    return { isMember: false, hasRole: false, roles: [], matchedGuildId: null };
  }

  // Klan eşleşmesi — müttefikler önce, ana klan fallback
  const ordered = [...guilds].sort((a, b) => Number(a.isPrimary) - Number(b.isPrimary));
  let matchedGuildId: number | null = null;
  for (const g of ordered) {
    if (g.roleIds.length > 0 && g.roleIds.some((rid) => allRoles.includes(rid))) {
      matchedGuildId = g.id;
      break;
    }
  }

  const hasMainRole = allRoles.includes(requiredRoleId);
  const hasRole = hasMainRole || matchedGuildId !== null;

  console.log(
    `[discord] erişim kontrolü — sunucular:${serverIds.length} rol:${allRoles.length} ` +
    `anaRol:${hasMainRole} klan:${matchedGuildId ?? "yok"} sonuç:${hasRole}`,
  );

  return { isMember: true, hasRole, roles: allRoles, matchedGuildId };
}
