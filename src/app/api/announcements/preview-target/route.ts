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

  type UserRow = { id: number; discordId: string; familyName: string; class: string; ap: number; dp: number };

  let users: UserRow[] = [];

  if (target === "all") {
    return NextResponse.json({ mode: "channel", count: null, users: [] });
  }

  if (target === "no_login") {
    // familyName is String @default("") — non-nullable, so just check for empty string
    users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        familyName: "",
      },
      select: { id: true, discordId: true, familyName: true, class: true, ap: true, dp: true },
      orderBy: { discordId: "asc" },
    });
  } else if (target === "no_gear") {
    users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        familyName: { not: "" },
        ap: 0,
        dp: 0,
      },
      select: { id: true, discordId: true, familyName: true, class: true, ap: true, dp: true },
      orderBy: { familyName: "asc" },
    });
  } else if (target === "pvp") {
    const pvpRows = await prisma.warParticipant.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });
    const ids = pvpRows.map((r) => r.userId);
    users = await prisma.user.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
      },
      select: { id: true, discordId: true, familyName: true, class: true, ap: true, dp: true },
      orderBy: { familyName: "asc" },
    });
  }

  return NextResponse.json({ mode: "dm", count: users.length, users });
}
