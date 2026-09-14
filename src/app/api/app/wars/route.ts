export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS } from "@/lib/app-gate";

/**
 * Yaklaşan savaşlar + benim durumum + benim partim.
 *
 * Overlay'in "savaş başlıyor / katıl / partin" kartları tek istekten
 * besleniyor. Geçmiş savaşlar yok: uygulama ileriye bakıyor.
 */
export async function GET(req: Request) {
  return withApp(req, async (me) => {
    const simdi = new Date();
    // Bitmiş sayılması için savaş saatinin üstünden 3 saat geçmiş olsun
    const esik = new Date(simdi.getTime() - 3 * 60 * 60 * 1000);

    const wars = await prisma.war.findMany({
      where: { date: { gte: esik } },
      orderBy: { date: "asc" },
      take: 10,
      include: {
        participants: { where: { userId: me.id }, select: { status: true, asClass: true } },
        _count: { select: { participants: { where: { status: "ATTENDING" } } } },
        parties: {
          orderBy: { order: "asc" },
          include: {
            members: {
              orderBy: { order: "asc" },
              include: { user: { select: { id: true, familyName: true, class: true, spec: true } } },
            },
          },
        },
      },
    });

    return NextResponse.json(wars.map((w) => {
      const benimParti = w.parties.find((p) => p.members.some((m) => m.userId === me.id));
      return {
        id: w.id,
        title: w.title,
        type: w.type,
        tier: w.tier,
        date: w.date,
        deadline: w.deadline,
        isAllyWar: w.isAllyWar,
        // Sayı yöneticiye özel; üyeye null
        attending: me.isAdmin || me.isGuildAdmin ? w._count.participants : null,
        myStatus: w.participants[0]?.status ?? null,
        myClass: w.participants[0]?.asClass ?? null,
        // Kurulan partiler: ad, rol, üyeler — "şu partiler kuruldu" ekranı
        parties: w.parties.map((p) => ({
          id: p.id, name: p.name, role: p.role,
          members: p.members.map((m) => ({
            id: m.user.id, familyName: m.user.familyName,
            class: m.asClass ?? m.user.class, spec: m.user.spec,
          })),
        })),
        myParty: benimParti ? { id: benimParti.id, name: benimParti.name, role: benimParti.role } : null,
      };
    }), { headers: APP_HEADERS });
  });
}
