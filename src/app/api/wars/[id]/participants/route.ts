export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setParticipation } from "@/lib/war-participation";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const participants = await prisma.warParticipant.findMany({
    where: { warId: Number(params.id) },
    include: { user: true },
    orderBy: { respondedAt: "asc" },
  });

  return NextResponse.json(participants);
}

/**
 * Yönetici başkası adına "katıl" atıyor.
 *
 * Bazı üyeler savaş saatinde siteye/Discord'a bakamıyor, geleceğini
 * başka yoldan haber veriyor. Kimlik olarak Discord ID isteniyor çünkü
 * tek benzersiz alan o; kolaylık olsun diye aile adı da kabul ediliyor.
 * Son tarih kuralı burada geçmiyor — zaten geç kalanı kaydediyoruz.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.canManageWars) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  const warId = Number(params.id);
  if (!Number.isSafeInteger(warId)) return NextResponse.json({ error: "Geçersiz savaş" }, { status: 400 });

  const { kimlik } = await req.json().catch(() => ({ kimlik: "" }));
  const ham = String(kimlik ?? "").trim();
  if (!ham) return NextResponse.json({ error: "Discord ID ya da aile adı gerekli." }, { status: 400 });

  // Discord'dan kopyalanan değer <@123…> biçiminde de gelebiliyor
  const sayi = ham.replace(/[^0-9]/g, "");
  const secim = { id: true, familyName: true, class: true, spec: true, ap: true, dp: true,
                  avatarUrl: true, guild: { select: { id: true, tag: true, color: true } } };

  let user = /^\d{15,22}$/.test(sayi)
    ? await prisma.user.findUnique({ where: { discordId: sayi }, select: secim })
    : null;
  if (!user) {
    user = await prisma.user.findFirst({
      where: { familyName: { equals: ham, mode: "insensitive" } },
      select: secim,
    });
  }
  if (!user) {
    return NextResponse.json({ error: "Bu Discord ID ya da aile adıyla kayıtlı üye yok." }, { status: 404 });
  }

  const onceki = await prisma.warParticipant.findUnique({
    where: { warId_userId: { warId, userId: user.id } },
    select: { status: true },
  });

  const sonuc = await setParticipation(user.id, warId, { status: "ATTENDING" }, { sonTarihiAtla: true });
  if (!sonuc.ok) return NextResponse.json({ error: sonuc.error }, { status: sonuc.status });

  return NextResponse.json({ user, zatenVardi: onceki?.status === "ATTENDING" });
}
