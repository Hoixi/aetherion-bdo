export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { AccessToken, TrackSource } from "livekit-server-sdk";
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
    const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) return appError("Sesli sohbet sunucusu ayarlı değil.", 503);

    const b = (await req.json().catch(() => ({}))) as { warId?: number; room?: "parti" | "genel" };
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

    let room: string, label: string;
    if (tur === "parti") {
      const parti = war.parties.find((p) => p.members.some((m) => m.userId === me.id));
      if (!parti) return appError("Bu savaşta bir partide değilsin.", 403);
      room = `savas-${war.id}-parti-${parti.id}`; label = parti.name;
    } else {
      const katilan = war.participants[0]?.status === "ATTENDING" || war.parties.some((p) => p.members.some((m) => m.userId === me.id));
      if (!katilan && !me.isAdmin && !me.isGuildAdmin) return appError("Genel ses için savaşa katıl demiş olman gerekiyor.", 403);
      room = `savas-${war.id}-genel`; label = "Genel";
    }

    const at = new AccessToken(key, secret, { identity: String(me.id), name: me.familyName || `Üye ${me.id}`, ttl: SURE });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: [TrackSource.MICROPHONE] });
    return NextResponse.json({ url, token: await at.toJwt(), room, label, war: { id: war.id, title: war.title } }, { headers: APP_HEADERS });
  });
}
