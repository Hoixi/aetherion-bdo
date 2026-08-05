export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target") ?? "all";
  const guildParam = searchParams.get("guild");

  type UserRow = { id: number; discordId: string; familyName: string; class: string; ap: number; dp: number; avatarUrl: string; guild: { tag: string; color: string } | null };
  const select = {
    id: true, discordId: true, familyName: true, class: true, ap: true, dp: true, avatarUrl: true,
    guild: { select: { tag: true, color: true } },
  };

  // Klan daraltması — hem "guild:<id>" hedefi hem ?guild= parametresi
  const guildId = target.startsWith("guild:")
    ? Number(target.slice(6))
    : guildParam ? Number(guildParam) : null;
  const guildWhere = guildId ? { guildId } : {};

  let users: UserRow[] = [];

  if (target === "all") {
    return NextResponse.json({ mode: "channel", count: null, users: [] });
  }

  // Bir klanın tüm üyeleri
  if (target.startsWith("guild:")) {
    users = await prisma.user.findMany({
      where: { deletedAt: null, familyName: { not: "" }, guildId },
      select,
      orderBy: { familyName: "asc" },
    });
    return NextResponse.json({ mode: "dm", count: users.length, users });
  }

  if (target === "no_login") {
    users = await prisma.user.findMany({
      where: { deletedAt: null, familyName: "", ...guildWhere },
      select,
      orderBy: { discordId: "asc" },
    });
  } else if (target === "no_gear") {
    users = await prisma.user.findMany({
      where: { deletedAt: null, familyName: { not: "" }, ap: 0, dp: 0, ...guildWhere },
      select,
      orderBy: { familyName: "asc" },
    });
  } else if (target === "pvp") {
    const pvpRows = await prisma.warParticipant.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });
    const ids = pvpRows.map((r) => r.userId);
    users = await prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null, ...guildWhere },
      select,
      orderBy: { familyName: "asc" },
    });
  }

  return NextResponse.json({ mode: "dm", count: users.length, users });
}
