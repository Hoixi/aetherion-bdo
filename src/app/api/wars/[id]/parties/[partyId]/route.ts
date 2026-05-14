export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const partyId = Number(params.partyId);
  const warId = Number(params.id);

  // Enforce max 1 defense party per war
  if (body.isDefense === true) {
    const existing = await prisma.party.findFirst({
      where: { warId, isDefense: true, id: { not: partyId } },
    });
    if (existing) return NextResponse.json({ error: "Zaten bir defans partisi var" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.isDefense !== undefined) data.isDefense = body.isDefense;

  const party = await prisma.party.update({ where: { id: partyId }, data });
  return NextResponse.json(party);
}

export async function DELETE(_req: Request, { params }: { params: { id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.party.delete({ where: { id: Number(params.partyId) } });
  return NextResponse.json({ ok: true });
}
