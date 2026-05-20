export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, isAdmin, color, discordRoleIds, priority } = body;

  const role = await prisma.siteRole.update({
    where: { id: Number(params.id) },
    data: {
      name: name ?? undefined,
      isAdmin: isAdmin !== undefined ? isAdmin : undefined,
      color: color ?? undefined,
      discordRoleIds: discordRoleIds !== undefined ? JSON.stringify(discordRoleIds) : undefined,
      priority: priority !== undefined ? priority : undefined,
    },
  });

  return NextResponse.json(role);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.siteRole.delete({ where: { id: Number(params.id) } });
  return NextResponse.json({ ok: true });
}
