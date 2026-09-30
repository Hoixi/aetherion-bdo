export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * "Oyundan rapor yükleme" yetkisi — kişi bazlı.
 *
 * Savaş raporunu oyundan çeken kişinin yönetici olması gerekmiyordu ama
 * tek yetki kapısı yönetici bayrağıydı; rapor yüklesin diye insanlara
 * bütün yönetim araçları açılıyordu. Bu uç yalnızca o kapıyı açıyor.
 *
 * Site admini herkese, klan yöneticisi yalnızca kendi klanındaki üyeye
 * verebiliyor. Yetkinin ne kadarını kapsadığı sunucuda ayrıca sınırlı:
 * yükleyen kişi yalnız kendi klanının satırlarına dokunabiliyor
 * (bkz. `reportMergePlan`).
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const ben = session?.user;
  if (!ben?.isAdmin && !ben?.isGuildAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { canImportReports } = await req.json().catch(() => ({}));
  if (typeof canImportReports !== "boolean") {
    return NextResponse.json({ error: "canImportReports (true/false) gerekli." }, { status: 400 });
  }

  const hedef = await prisma.user.findUnique({
    where: { id: Number(params.id) },
    select: { id: true, familyName: true, guildId: true, deletedAt: true },
  });
  if (!hedef || hedef.deletedAt) return NextResponse.json({ error: "Üye bulunamadı." }, { status: 404 });

  if (!ben.isAdmin) {
    const benimKlan = (await prisma.user.findUnique({ where: { id: ben.id }, select: { guildId: true } }))?.guildId ?? null;
    if (!benimKlan || hedef.guildId !== benimKlan) {
      return NextResponse.json({ error: "Yalnızca kendi klanındaki üyeye yetki verebilirsin." }, { status: 403 });
    }
  }

  const user = await prisma.user.update({
    where: { id: hedef.id },
    data: { canImportReports },
    select: { id: true, familyName: true, canImportReports: true },
  });
  return NextResponse.json(user);
}
