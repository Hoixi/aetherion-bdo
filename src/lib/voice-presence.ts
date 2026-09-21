import { RoomServiceClient } from "livekit-server-sdk";
import { livekitAyar, ANONS_ODASI } from "@/lib/livekit";

/**
 * Kim hangi odada — anlık.
 *
 * Kaynak LiveKit'in webhook'u (participant_joined / left, room_finished):
 * biri odaya girer girmez sunucu bize haber verir, biz de bellekteki
 * tabloyu güncelleyip açık bağlantılara (SSE) yayarız. Tablo ilk istekte
 * ve dakikada bir LiveKit'ten yeniden okunur ki kaçan bir olay kalıcı
 * hata olmasın. Tek süreç (tek container) olduğu için bellek yeter;
 * globalThis'te tutuluyor ki her route parçası aynı tabloyu görsün.
 */

export interface SesOlayi { tur: "girdi" | "cikti" | "senkron"; oda?: string; ad?: string; odalar: Record<string, string[]> }
type Dinleyici = (o: SesOlayi) => void;
interface Depo { odalar: Map<string, Map<string, string>>; hazir: boolean; sonSenk: number; dinleyiciler: Set<Dinleyici>; senkSoz: Promise<void> | null }

const g = globalThis as unknown as { __sesDepo?: Depo };
const depo: Depo = g.__sesDepo ??= { odalar: new Map(), hazir: false, sonSenk: 0, dinleyiciler: new Set(), senkSoz: null };

const anlikTablo = (): Record<string, string[]> => {
  const out: Record<string, string[]> = {};
  for (const [oda, uyeler] of Array.from(depo.odalar)) if (oda !== ANONS_ODASI && uyeler.size) out[oda] = Array.from(uyeler.values()).sort((a, b) => a.localeCompare(b, "tr"));
  return out;
};
const yay = (o: Omit<SesOlayi, "odalar">) => { const olay = { ...o, odalar: anlikTablo() }; depo.dinleyiciler.forEach((f) => { try { f(olay); } catch { /* kopuk */ } }); };

/** LiveKit'ten baştan oku (ilk istek ve dakikada bir) */
export async function sesSenkronla(): Promise<void> {
  if (depo.senkSoz) return depo.senkSoz;
  depo.senkSoz = (async () => {
    const a = livekitAyar(); if (!a) return;
    const svc = new RoomServiceClient(a.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), a.key, a.secret);
    const rooms = await svc.listRooms().catch(() => []);
    const yeni = new Map<string, Map<string, string>>();
    await Promise.all(rooms.map(async (r) => {
      const ps = await svc.listParticipants(r.name).catch(() => []);
      yeni.set(r.name, new Map(ps.map((p) => [p.identity, p.name || p.identity])));
    }));
    depo.odalar = yeni; depo.hazir = true; depo.sonSenk = Date.now();
    yay({ tur: "senkron" });
  })().finally(() => { depo.senkSoz = null; });
  return depo.senkSoz;
}

/** Oda → içindeki adlar (anons odası hariç). Gerekirse önce senkron. */
export async function sesTablosu(): Promise<Record<string, string[]>> {
  if (!depo.hazir || Date.now() - depo.sonSenk > 60_000) await sesSenkronla();
  return anlikTablo();
}

/** Webhook olayı — LiveKit'ten */
export function sesOlayiIsle(ev: { event: string; room?: { name?: string }; participant?: { identity?: string; name?: string } }) {
  const oda = ev.room?.name; if (!oda) return;
  if (ev.event === "room_finished") { depo.odalar.delete(oda); yay({ tur: "cikti", oda }); return; }
  const id = ev.participant?.identity; if (!id) return;
  const ad = ev.participant?.name || id;
  if (ev.event === "participant_joined") {
    const u = depo.odalar.get(oda) ?? new Map<string, string>(); u.set(id, ad); depo.odalar.set(oda, u);
    if (oda !== ANONS_ODASI) yay({ tur: "girdi", oda, ad });
  } else if (ev.event === "participant_left") {
    const u = depo.odalar.get(oda); if (u) { u.delete(id); if (!u.size) depo.odalar.delete(oda); }
    if (oda !== ANONS_ODASI) yay({ tur: "cikti", oda, ad });
  }
}

export function sesAbone(f: Dinleyici): () => void {
  depo.dinleyiciler.add(f);
  return () => { depo.dinleyiciler.delete(f); };
}
