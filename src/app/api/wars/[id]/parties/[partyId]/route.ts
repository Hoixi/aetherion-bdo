export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const partyId = Number(params.partyId);
  const warId = Number(params.id);

  const ROLES = ["MAIN", "DEFENSE", "FLANK"];
  // role verilmezse eski isDefense çağrılarından türetilir
  const nextRole: string | undefined =
    body.role !== undefined ? String(body.role)
      : body.isDefense !== undefined ? (body.isDefense ? "DEFENSE" : "MAIN")
      : undefined;

  if (nextRole !== undefined && !ROLES.includes(nextRole)) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  // Savaş başına tek savunma partisi — flank için sınır yok, birden çok olabilir
  if (nextRole === "DEFENSE") {
    const existing = await prisma.party.findFirst({
      where: { warId, role: "DEFENSE", id: { not: partyId } },
    });
    if (existing) return NextResponse.json({ error: "Zaten bir defans partisi var" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (nextRole !== undefined) {
    data.role = nextRole;
    // isDefense senkron kalsın — eski sorgular hâlâ onu okuyor
    data.isDefense = nextRole === "DEFENSE";
  }

  const party = await prisma.party.update({ where: { id: partyId }, data });
  return NextResponse.json(party);
}

export async function DELETE(_req: Request, { params }: { params: { id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.party.delete({ where: { id: Number(params.partyId) } });
  return NextResponse.json({ ok: true });
}
