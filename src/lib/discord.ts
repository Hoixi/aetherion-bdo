export interface DiscordMemberResult {
  isMember: boolean;
  hasRole: boolean;
  roles: string[];
}

export async function checkDiscordMembership(accessToken: string): Promise<DiscordMemberResult> {
  const guildId = process.env.DISCORD_GUILD_ID!;
  const requiredRoleId = process.env.DISCORD_REQUIRED_ROLE_ID!;

  const res = await fetch(
    `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    return { isMember: false, hasRole: false, roles: [] };
  }

  const member = await res.json();
  const memberRoles: string[] = member.roles ?? [];
  const hasRole = memberRoles.includes(requiredRoleId);

  return { isMember: true, hasRole, roles: memberRoles };
}
