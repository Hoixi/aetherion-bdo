import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";

/**
 * LiveKit sunucu tarafı — anahtar üretimi ve oda/katılımcı sorgusu.
 * Sunucu bizim VPS'te (LIVEKIT_URL); API anahtarı yalnızca burada.
 */

export function livekitAyar() {
  const url = process.env.LIVEKIT_URL, key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) return null;
  return { url, key, secret };
}

export async function odaAnahtari(me: { id: number; familyName: string }, room: string, ttl = "4h") {
  const a = livekitAyar(); if (!a) throw new Error("LiveKit ayarlı değil");
  const at = new AccessToken(a.key, a.secret, { identity: String(me.id), name: me.familyName || `Üye ${me.id}`, ttl });
  at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: [TrackSource.MICROPHONE] });
  return { url: a.url, token: await at.toJwt() };
}

/** Oda adı → içindeki katılımcı adları. Oda yoksa boş. */
export async function odaKatilimcilari(rooms: string[]): Promise<Record<string, string[]>> {
  const a = livekitAyar(); if (!a || rooms.length === 0) return {};
  // RoomServiceClient http(s) ister; wss → https
  const svc = new RoomServiceClient(a.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), a.key, a.secret);
  const out: Record<string, string[]> = {};
  const aktif = await svc.listRooms(rooms).catch(() => []);
  await Promise.all(aktif.map(async (r) => {
    const ps = await svc.listParticipants(r.name).catch(() => []);
    out[r.name] = ps.map((p) => p.name || p.identity);
  }));
  return out;
}
