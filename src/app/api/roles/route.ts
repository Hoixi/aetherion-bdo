export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = await prisma.siteRole.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { users: true } } },
  });

  return NextResponse.json(roles);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, isAdmin, color, discordRoleIds, priority } = body;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const role = await prisma.siteRole.create({
    data: {
      name,
      isAdmin: isAdmin ?? false,
      color: color || "#d4a853",
      discordRoleIds: JSON.stringify(discordRoleIds || []),
      priority: priority ?? 0,
    },
  });

  return NextResponse.json(role);
}
