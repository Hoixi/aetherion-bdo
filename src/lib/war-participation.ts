import { prisma } from "@/lib/prisma";
import { getClassByID } from "@/lib/classes";

/**
 * Savaşa katılım — tek kaynak.
 *
 * Aynı kurallar hem sitenin `/api/wars/[id]/participate` ucunda hem
 * uygulamanın `/api/app/wars/[id]/participate` ucunda geçerli: son tarih
 * geçtiyse reddet, karakter bildirilmediyse profildekini say, "katılmıyorum"
 * deyince o savaşın partilerinden düş. İki yerde ayrı yazılsaydı biri
 * değişince öbürü sessizce eskirdi.
 */

export type KatilimSonuc =
  | { ok: true; participant: { warId: number; userId: number; status: string } }
  | { ok: false; status: number; error: string };

export async function setParticipation(
  userId: number,
  warId: number,
  input: { status: string; asClass?: unknown; asSpec?: unknown; note?: unknown },
): Promise<KatilimSonuc> {
  const status = input.status;
  if (status !== "ATTENDING" && status !== "DECLINED") {
    return { ok: false, status: 400, error: "Geçersiz durum." };
  }

  const war = await prisma.war.findUnique({ where: { id: warId } });
  if (!war) return { ok: false, status: 404, error: "Savaş bulunamadı." };

  if (war.deadline && new Date() > war.deadline) {
    return { ok: false, status: 400, error: "Katılım süresi doldu." };
  }

  // Hangi karakterle geleceği — bildirmezse profilindeki geçerli sayılır
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { class: true, spec: true },
  });
  const pickedClass =
    input.asClass && getClassByID(String(input.asClass)) ? String(input.asClass) : me?.class ?? null;
  const pickedSpec = input.asSpec ? String(input.asSpec) : me?.spec ?? null;
  // Not: gönderilmediyse eskisi kalsın (undefined), boş gönderildiyse silinsin
  const note = input.note === undefined ? undefined : String(input.note).trim().slice(0, 200) || null;

  const participant = await prisma.warParticipant.upsert({
    where: { warId_userId: { warId, userId } },
    update: {
      status,
      respondedAt: new Date(),
      // Katılmıyorsa karakter bilgisi anlamsız
      asClass: status === "ATTENDING" ? pickedClass : null,
      asSpec: status === "ATTENDING" ? pickedSpec : null,
      note,
    },
    create: {
      warId, userId, status, respondedAt: new Date(),
      asClass: status === "ATTENDING" ? pickedClass : null,
      asSpec: status === "ATTENDING" ? pickedSpec : null,
      note: note ?? null,
    },
  });

  // Katılmıyorum seçildiyse, bu savaşın tüm partilerinden kullanıcıyı çıkart
  if (status === "DECLINED") {
    await prisma.partyMember.deleteMany({ where: { userId, party: { warId } } });
  }

  return { ok: true, participant: { warId, userId, status: participant.status } };
}
