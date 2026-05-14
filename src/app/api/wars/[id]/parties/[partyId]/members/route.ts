export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request, { params }: { params: { id: string; partyId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { memberIds } = await req.json() as { memberIds: number[] };
  const partyId = Number(params.partyId);

  if (memberIds.length > 20) {
    return NextResponse.json({ error: "Max 20 members per party" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.partyMember.deleteMany({ where: { partyId } }),
    prisma.partyMember.createMany({
      data: memberIds.map((userId, index) => ({ partyId, userId, order: index })),
    }),
  ]);

  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: { members: { include: { user: true }, orderBy: { order: "asc" } } },
  });

  return NextResponse.json(party);
}
