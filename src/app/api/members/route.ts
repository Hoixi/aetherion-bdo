export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";

/**
 * Üye listesi — tüm klanlar görünür.
 *
 * Kadro bilgisi (isim, class, GS) zaten oyun içinde görünür ve müttefikler
 * birlikte savaştığı için ortak tutulur. Gizli kalan şey toplu performans
 * verisi: dashboard istatistikleri, hasar raporu ve AI asistanı hâlâ
 * kullanıcının kendi klanına filtrelidir.
 *
 * ?guild=<id> ile tek bir klana daraltılabilir.
 */
export async function GET(req: Request) {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guildParam = new URL(req.url).searchParams.get("guild");
  const guildId = guildParam ? Number(guildParam) : null;

  const members = await prisma.user.findMany({
    where: {
      familyName: { not: "" },
      deletedAt: null,
      ...(guildId ? { guildId } : {}),
    },
    orderBy: [{ ap: "desc" }, { dp: "desc" }],
    include: {
      siteRole: { select: { name: true, color: true } },
      guild: { select: { id: true, name: true, tag: true, color: true } },
      _count: { select: { participations: { where: { status: "ATTENDING" } } } },
    },
  });

  return NextResponse.json(members);
}
