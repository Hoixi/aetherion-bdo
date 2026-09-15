export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS } from "@/lib/app-gate";

/** Bana gelen ve benim gönderdiğim aktif davetler (savaşı 6 saatten eski olmayanlar) */
export async function GET(req: Request) {
  return withApp(req, async (me) => {
    const esik = new Date(Date.now() - 6 * 3600_000);
    const rows = await prisma.voiceInvite.findMany({
      where: { OR: [{ userId: me.id }, { invitedBy: me.id }] },
      include: {
        user: { select: { id: true, familyName: true } },
        inviter: { select: { id: true, familyName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const warIds = Array.from(new Set(rows.map((r) => r.warId)));
    const wars = await prisma.war.findMany({
      where: { id: { in: warIds }, date: { gte: esik } },
      select: { id: true, title: true, parties: { select: { id: true, name: true } } },
    });
    const out = rows.flatMap((r) => {
      const w = wars.find((x) => x.id === r.warId); if (!w) return [];
      const p = w.parties.find((x) => x.id === r.partyId);
      return [{
        warId: r.warId, warTitle: w.title, partyId: r.partyId, partyName: p?.name ?? "?",
        user: r.user, inviter: r.inviter, createdAt: r.createdAt, mine: r.userId === me.id,
      }];
    });
    return NextResponse.json(out, { headers: APP_HEADERS });
  });
}
