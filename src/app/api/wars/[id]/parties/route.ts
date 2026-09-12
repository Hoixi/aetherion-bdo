export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parties = await prisma.party.findMany({
    where: { warId: Number(params.id) },
    include: { members: { include: { user: true }, orderBy: { order: "asc" } } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(parties);
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, role } = await req.json();
  const warId = Number(params.id);
  const nextRole = String(role ?? "MAIN");
  if (!(["MAIN", "DEFENSE", "FLANK"] as const).includes(nextRole as "MAIN" | "DEFENSE" | "FLANK")) {
    return NextResponse.json({ error: "Geçersiz rol." }, { status: 400 });
  }

  const maxOrder = await prisma.party.findFirst({
    where: { warId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const party = await prisma.party.create({
    data: {
      warId,
      name,
      role: nextRole,
      isDefense: nextRole === "DEFENSE",
      order: (maxOrder?.order ?? -1) + 1,
    },
    include: { members: { include: { user: true } } },
  });

  return NextResponse.json(party, { status: 201 });
}
