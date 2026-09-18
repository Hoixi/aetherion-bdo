import { prisma } from "@/lib/prisma";

/**
 * Savaş ↔ Discord "Zamanlanmış Etkinlik".
 *
 * Savaş açılınca ana klanın Discord sunucusunda harici (EXTERNAL) bir etkinlik
 * oluşturulur; konum olarak sitedeki savaş sayfası verilir. Tarih/başlık
 * değişince güncellenir, savaş silinince kaldırılır. Botun sunucuda
 * "Etkinlikleri Yönet" izni olmalı; yoksa sessizce atlanır (savaş yine açılır).
 */

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const API = "https://discord.com/api/v10";
/** Node war ortalama bu kadar sürer; Discord bitiş zamanı ister */
const SURE_SAAT = 3;

type SavasBilgi = { id: number; title: string; date: Date; tier?: string | null; notes?: string | null };

async function sunucuId() {
  const g = await prisma.guild.findFirst({ where: { isPrimary: true }, select: { discordServerId: true } });
  return g?.discordServerId ?? null;
}

function govde(w: SavasBilgi) {
  const site = process.env.NEXTAUTH_URL || "https://aetheri.online";
  const bas = new Date(w.date);
  const bit = new Date(bas.getTime() + SURE_SAAT * 3600_000);
  const aciklama = [w.tier ? `Kademe: ${w.tier}` : "", w.notes?.trim() || "", `Katılım: ${site}/savaslar/${w.id}`]
    .filter(Boolean).join("\n").slice(0, 1000);
  return {
    name: w.title.slice(0, 100),
    description: aciklama,
    scheduled_start_time: bas.toISOString(),
    scheduled_end_time: bit.toISOString(),
    privacy_level: 2,          // GUILD_ONLY
    entity_type: 3,            // EXTERNAL
    entity_metadata: { location: `${site}/savaslar/${w.id}` },
  };
}

async function istek(yol: string, method: string, body?: unknown): Promise<unknown | null> {
  if (!BOT_TOKEN) return null;
  const r = await fetch(`${API}${yol}`, {
    method,
    headers: { Authorization: `Bot ${BOT_TOKEN}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (!r) return null;
  if (!r.ok) { console.error(`[discord-events] ${method} ${yol} → ${r.status} ${await r.text().catch(() => "")}`); return null; }
  return r.status === 204 ? {} : r.json().catch(() => null);
}

/** Etkinlik oluşturur ve savaşa yazar. Geçmiş tarihli savaş için oluşturmaz (Discord kabul etmiyor). */
export async function etkinlikOlustur(w: SavasBilgi) {
  const sunucu = await sunucuId(); if (!sunucu) return null;
  if (new Date(w.date).getTime() < Date.now()) return null;
  const e = (await istek(`/guilds/${sunucu}/scheduled-events`, "POST", govde(w))) as { id?: string } | null;
  if (!e?.id) return null;
  await prisma.war.update({ where: { id: w.id }, data: { discordEventId: e.id } }).catch(() => {});
  return e.id;
}

/** Var olan etkinliği günceller; yoksa (ve savaş ilerideyse) oluşturur. */
export async function etkinlikGuncelle(w: SavasBilgi & { discordEventId?: string | null }) {
  const sunucu = await sunucuId(); if (!sunucu) return;
  if (!w.discordEventId) { await etkinlikOlustur(w); return; }
  if (new Date(w.date).getTime() < Date.now()) return; // geçmişe çekilen etkinlik Discord tarafında düzenlenemez
  const r = await istek(`/guilds/${sunucu}/scheduled-events/${w.discordEventId}`, "PATCH", govde(w));
  if (r === null) await etkinlikOlustur(w); // Discord tarafında silinmiş olabilir
}

export async function etkinlikSil(discordEventId: string | null | undefined) {
  if (!discordEventId) return;
  const sunucu = await sunucuId(); if (!sunucu) return;
  await istek(`/guilds/${sunucu}/scheduled-events/${discordEventId}`, "DELETE");
}
