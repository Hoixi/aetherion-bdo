export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

// Discord kanal tipleri
const TEXT = 0;
const ANNOUNCEMENT = 5;
const CATEGORY = 4;

type DiscordChannel = {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
};

/**
 * Bir Discord sunucusunun yazı kanallarını kategori adlarıyla döner.
 * Savaş duyurusu kanalı seçimi için kullanılır.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const serverId = new URL(req.url).searchParams.get("serverId");
  if (!serverId) return NextResponse.json({ error: "serverId gerekli" }, { status: 400 });

  const res = await fetch(`https://discord.com/api/v10/guilds/${serverId}/channels`, {
    headers: { Authorization: `Bot ${BOT_TOKEN}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `Kanallar çekilemedi (${res.status})`, detail: detail.slice(0, 200) },
      { status: 502 },
    );
  }

  const channels = (await res.json()) as DiscordChannel[];
  const categories = new Map(
    channels.filter((c) => c.type === CATEGORY).map((c) => [c.id, c.name]),
  );

  const textChannels = channels
    .filter((c) => c.type === TEXT || c.type === ANNOUNCEMENT)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      name: c.name,
      category: c.parent_id ? categories.get(c.parent_id) ?? null : null,
      isAnnouncement: c.type === ANNOUNCEMENT,
    }));

  return NextResponse.json(textChannels);
}
