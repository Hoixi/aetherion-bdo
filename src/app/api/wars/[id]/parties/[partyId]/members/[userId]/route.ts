export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BDO_CLASSES, hasClassVariants } from "@/lib/classes";

/**
 * Parti üyesinin bu savaşa hangi karakterle geleceğini yönetici seçer.
 * Yalnızca üyenin izin verdiği seçenekler: ana karakteri, katıl derken
 * bildirdiği ya da "yönetici seçebilir" dediği alternatifler.
 *  PUT { asClass, asSpec }   → seç;  { asClass: null } → bildirdiğine dön
 */
export async function PUT(req: Request, { params }: { params: { id: string; partyId: string; userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const partyId = Number(params.partyId), userId = Number(params.userId), warId = Number(params.id);
  const b = (await req.json().catch(() => ({}))) as { asClass?: string | null; asSpec?: string | null };

  const uye = await prisma.partyMember.findUnique({ where: { partyId_userId: { partyId, userId } }, select: { id: true, party: { select: { warId: true } } } });
  if (!uye || uye.party.warId !== warId) return NextResponse.json({ error: "Üye bu partide değil." }, { status: 404 });

  let asClass: string | null = null, asSpec: string | null = null;
  if (b.asClass) {
    const cls = String(b.asClass);
    if (!BDO_CLASSES.some((c) => c.id === cls)) return NextResponse.json({ error: "Geçersiz class." }, { status: 400 });
    const spec = hasClassVariants(cls) && b.asSpec === "succession" ? "succession" : "awakening";
    const [u, p] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { class: true, spec: true, characters: { select: { class: true, spec: true, pickable: true } } } }),
      prisma.warParticipant.findUnique({ where: { warId_userId: { warId, userId } }, select: { asClass: true, asSpec: true } }),
    ]);
    if (!u) return NextResponse.json({ error: "Üye yok." }, { status: 404 });
    const uygun =
      (u.class === cls && (u.spec || "awakening") === spec) ||
      (p?.asClass === cls && (p.asSpec || "awakening") === spec) ||
      u.characters.some((c) => c.class === cls && c.spec === spec && c.pickable);
    if (!uygun) return NextResponse.json({ error: "Üye bu karakter için izin vermemiş." }, { status: 400 });
    asClass = cls; asSpec = spec;
  }
  await prisma.partyMember.update({ where: { id: uye.id }, data: { asClass, asSpec } });
  return NextResponse.json({ ok: true, asClass, asSpec });
}
