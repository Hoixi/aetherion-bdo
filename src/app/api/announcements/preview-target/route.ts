export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target") ?? "all";

  type UserRow = { id: number; discordId: string; familyName: string | null; class: string | null; ap: number; dp: number };

  let users: UserRow[] = [];

  if (target === "all") {
    // Channel message — no individual user list needed
    return NextResponse.json({ mode: "channel", count: null, users: [] });
  }

  if (target === "no_login") {
    users = await db.user.findMany({
      where: {
        deletedAt: null,
        discordId: { not: null },
        OR: [{ familyName: null }, { familyName: "" }],
      },
      select: { id: true, discordId: true, familyName: true, class: true, ap: true, dp: true },
      orderBy: { familyName: "asc" },
    });
  } else if (target === "no_gear") {
    users = await db.user.findMany({
      where: {
        deletedAt: null,
        discordId: { not: null },
        ap: 0,
        dp: 0,
      },
      select: { id: true, discordId: true, familyName: true, class: true, ap: true, dp: true },
      orderBy: { familyName: "asc" },
    });
  } else if (target === "pvp") {
    const pvpUserIds: { userId: number }[] = await db.warParticipant.findMany({
      distinct: ["userId"],
      select: { userId: true },
    });
    const ids = pvpUserIds.map((r: { userId: number }) => r.userId);
    users = await db.user.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        discordId: { not: null },
      },
      select: { id: true, discordId: true, familyName: true, class: true, ap: true, dp: true },
      orderBy: { familyName: "asc" },
    });
  }

  return NextResponse.json({ mode: "dm", count: users.length, users });
}
