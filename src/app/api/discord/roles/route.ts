export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

type DiscordGuild = { id: string; name: string; icon: string | null };
type DiscordRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
};

/** Discord int rengini hex'e çevirir; 0 = renk yok (varsayılan gri) */
function toHex(color: number): string {
  if (!color) return "#7a8ba3";
  return "#" + color.toString(16).padStart(6, "0");
}

/**
 * Botun bulunduğu tüm sunucuları ve her sunucunun rollerini döner.
 * Klan → Discord rolü eşleştirmesi için admin panelinde kullanılır.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const guildsRes = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
    cache: "no-store",
  });

  if (!guildsRes.ok) {
    const detail = await guildsRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Sunucular çekilemedi (${guildsRes.status})`, detail: detail.slice(0, 200) },
      { status: 502 },
    );
  }

  const guilds = (await guildsRes.json()) as DiscordGuild[];

  const results = await Promise.all(
    guilds.map(async (g) => {
      const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${g.id}/roles`, {
        headers: { Authorization: `Bot ${BOT_TOKEN}` },
        cache: "no-store",
      });
      if (!rolesRes.ok) return { id: g.id, name: g.name, icon: g.icon, roles: [] };

      const roles = (await rolesRes.json()) as DiscordRole[];
      return {
        id: g.id,
        name: g.name,
        icon: g.icon,
        roles: roles
          // @everyone ve bot/entegrasyon tarafından yönetilen rolleri gizle
          .filter((r) => r.id !== g.id && !r.managed)
          .sort((a, b) => b.position - a.position)
          .map((r) => ({ id: r.id, name: r.name, color: toHex(r.color) })),
      };
    }),
  );

  return NextResponse.json(results);
}
