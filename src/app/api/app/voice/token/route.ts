export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { odaAnahtari } from "@/lib/livekit";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";

/**
 * Sesli sohbet için LiveKit odası anahtarı.
 *
 * Odalar savaşa bağlı: `savas-<id>-parti-<partiId>` (yalnızca o partinin
 * üyeleri) ve `savas-<id>-genel` (savaşa katılan herkes). Anahtar 4 saat
 * geçerli, yalnızca ses yayınlama/dinleme izni; kimlik = kullanıcı id,
 * görünen ad = aile adı. LiveKit sunucusu kendi VPS'imizde
 * (livekit.aetheri.online); API gizli anahtarı yalnızca burada.
 */

const SURE = "4h";

export async function POST(req: Request) {
  return withApp(req, async (me) => {
    if (!process.env.LIVEKIT_URL || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) return appError("Sesli sohbet sunucusu ayarlı değil.", 503);

    const b = (await req.json().catch(() => ({}))) as { warId?: number; room?: "parti" | "genel"; partyId?: number };
    const warId = Number(b.warId);
    if (!Number.isInteger(warId)) return appError("warId gerekli.", 400);
    const tur = b.room === "genel" ? "genel" : "parti";

    const war = await prisma.war.findUnique({
      where: { id: warId },
      select: {
        id: true, title: true, date: true,
        participants: { where: { userId: me.id }, select: { status: true } },
        parties: { select: { id: true, name: true, members: { select: { userId: true } } } },
      },
    });
    if (!war) return appError("Savaş bulunamadı.", 404);
    // Savaştan 6 saat sonrasına kadar oda açık; eski savaşlara ses yok
    if (Date.now() - war.date.getTime() > 6 * 3600_000) return appError("Bu savaşın sesi kapandı.", 410);

    let room: string, label: string, partyId: number | null = null;
    // Savaş odaları Discord kanalı gibi: üye olan istediği odaya girer.
    // Varsayılan kendi partim; partyId verilirse o parti.
    if (tur === "parti") {
      const parti = Number.isInteger(b.partyId)
        ? war.parties.find((p) => p.id === Number(b.partyId))
        : war.parties.find((p) => p.members.some((m) => m.userId === me.id));
      if (!parti) return appError("Parti bulunamadı.", 404);
      room = `savas-${war.id}-parti-${parti.id}`; label = parti.name; partyId = parti.id;
    } else {
      room = `savas-${war.id}-genel`; label = "Genel";
    }

    const t = await odaAnahtari(me, room, SURE);
    return NextResponse.json({ ...t, room, label, partyId, war: { id: war.id, title: war.title } }, { headers: APP_HEADERS });
  });
}
