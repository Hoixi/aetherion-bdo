export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";
import { getClassByID } from "@/lib/classes";

/**
 * Bir üyenin o savaşa hangi class ile geleceğini işaretler.
 *
 * Bazı oyuncular inisiyatif alıp Shai giriyor; kayıtlı class'ları değişmeden
 * o savaş için farklı görünmeleri gerekiyor. null gönderilirse işaret kalkar.
 */
export async function PUT(req: NextRequest, { params }: { params: { partyId: string } }) {
  const scope = await getGuildScope();
  if (!scope?.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, asClass } = await req.json();
  const partyId = Number(params.partyId);

  if (asClass != null && !getClassByID(String(asClass))) {
    return NextResponse.json({ error: "Bilinmeyen class." }, { status: 400 });
  }

  const member = await prisma.partyMember.findFirst({
    where: { partyId, userId: Number(userId) },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ error: "Üye bu partide değil." }, { status: 404 });

  const updated = await prisma.partyMember.update({
    where: { id: member.id },
    data: { asClass: asClass ?? null },
  });
  return NextResponse.json({ ok: true, asClass: updated.asClass });
}
