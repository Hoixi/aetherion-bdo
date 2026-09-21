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

/** Anons odası: herkes dinler, yöneticiler yayınlar (bkz. app ses.ts anons) */
export const ANONS_ODASI = "anons";

function servis(a: { url: string; key: string; secret: string }) {
  // RoomServiceClient http(s) ister; wss → https
  return new RoomServiceClient(a.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), a.key, a.secret);
}

/**
 * Bir kişi aynı anda tek odada olur: yeni anahtar verilirken diğer odalardaki
 * (kopmuş uygulama, ikinci pencere, hayalet) kayıtları düşür. Elden geldiğince;
 * hata olursa anahtar yine verilir.
 */
async function digerOdalardanCikar(a: { url: string; key: string; secret: string }, identity: string, hedef: string) {
  const svc = servis(a);
  const odalar = await svc.listRooms().catch(() => []);
  await Promise.all(odalar.filter((r) => r.name !== hedef && r.name !== ANONS_ODASI).map(async (r) => {
    const ps = await svc.listParticipants(r.name).catch(() => []);
    if (ps.some((p) => p.identity === identity)) await svc.removeParticipant(r.name, identity).catch(() => {});
  }));
}

export async function odaAnahtari(me: { id: number; familyName: string }, room: string, ttl = "4h", yayin = true) {
  const a = livekitAyar(); if (!a) throw new Error("LiveKit ayarlı değil");
  await digerOdalardanCikar(a, String(me.id), room);
  const at = new AccessToken(a.key, a.secret, { identity: String(me.id), name: me.familyName || `Üye ${me.id}`, ttl });
  // yayin=false: konuşma kısıtlı odada dinleyici — yetki verilince sunucu tarafından canlı açılır (yayinIzniAyarla)
  // Mikrofon + ekran paylaşımı (görüntü ve sistem sesi); kamera yok
  at.addGrant({ room, roomJoin: true, canPublish: yayin, canSubscribe: true, canPublishData: true, canPublishSources: yayin ? [TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO] : [] });
  return { url: a.url, token: await at.toJwt() };
}

/** Odadaki kişinin konuşma iznini anında değiştir (odada değilse sessizce geç) */
export async function yayinIzniAyarla(room: string, userId: number, yayin: boolean) {
  const a = livekitAyar(); if (!a) return;
  await servis(a).updateParticipant(room, String(userId), undefined, { canPublish: yayin, canSubscribe: true, canPublishData: true }).catch(() => {});
}

/**
 * Anons odası anahtarı: üye asıl odasının yanında buna da bağlanır (yalnızca
 * dinler); yönetici `yayin` ile konuşabilir. Tek odaya bağlı olmasına
 * dokunmaz (anons odası "diğer oda" sayılmaz).
 */
export async function anonsAnahtari(me: { id: number; familyName: string }, yayin: boolean, ttl = "4h") {
  const a = livekitAyar(); if (!a) throw new Error("LiveKit ayarlı değil");
  const at = new AccessToken(a.key, a.secret, { identity: String(me.id), name: me.familyName || `Üye ${me.id}`, ttl });
  at.addGrant({ room: ANONS_ODASI, roomJoin: true, canPublish: yayin, canSubscribe: true, canPublishData: false, canPublishSources: yayin ? [TrackSource.MICROPHONE] : [] });
  return { url: a.url, token: await at.toJwt(), canPublish: yayin };
}

/** Oda adı → içindeki katılımcı adları. Oda yoksa boş. */
export async function odaKatilimcilari(rooms: string[]): Promise<Record<string, string[]>> {
  const a = livekitAyar(); if (!a || rooms.length === 0) return {};
  const svc = servis(a);
  const out: Record<string, string[]> = {};
  const aktif = await svc.listRooms(rooms).catch(() => []);
  await Promise.all(aktif.map(async (r) => {
    const ps = await svc.listParticipants(r.name).catch(() => []);
    out[r.name] = ps.map((p) => p.name || p.identity);
  }));
  return out;
}
