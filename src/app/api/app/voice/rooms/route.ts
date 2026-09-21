export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { odaAnahtari } from "@/lib/livekit";
import { sesTablosuKimlikli } from "@/lib/voice-presence";

/**
 * Kalıcı ses odaları.
 *  GET   → odalar + içindekiler (canlı tablo, avatarlı) + yaklaşan savaşın parti/genel odaları
 *  POST  → oda aç (yönetici)         { name, adminOnly?, speakRestricted?, category? }
 *  DELETE→ oda sil (yönetici)        ?id=
 *  PUT   → odaya giriş anahtarı      { id }   (konuşma kısıtlı odada yetkisi olmayana dinleyici anahtarı)
 *
 * adminOnly: yalnızca yönetici girer. speakRestricted: herkes girer, yalnızca
 * yönetici ve yetki verilenler (voice_room_speakers) konuşur.
 */

const AD_MAX = 40;
const slugla = (s: string) => s.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "oda";
const yonetici = (me: { isAdmin: boolean; isGuildAdmin: boolean }) => me.isAdmin || me.isGuildAdmin;

export async function GET(req: Request) {
  return withApp(req, async (me) => {
    const odalar = await prisma.voiceRoom.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }, { id: "asc" }], include: { speakers: { select: { userId: true } } } });
    // Yaklaşan savaşın odaları da listede görünsün (kim seste)
    const simdi = new Date();
    const savas = await prisma.war.findFirst({
      where: { date: { gte: new Date(simdi.getTime() - 6 * 3600_000) } }, orderBy: { date: "asc" },
      select: { id: true, title: true, parties: { select: { id: true, name: true }, orderBy: { order: "asc" } } },
    });
    const savasOdalari = savas ? [
      { room: `savas-${savas.id}-genel`, label: `${savas.title} · Genel` },
      ...savas.parties.map((p) => ({ room: `savas-${savas.id}-parti-${p.id}`, label: `${savas.title} · ${p.name}` })),
    ] : [];
    // Bellekteki canlı tablo (webhook'la güncel); avatarlar tek sorguyla
    const tablo = await sesTablosuKimlikli();
    const idler = Array.from(new Set(Object.values(tablo).flat().map((m) => m.id)));
    const kisiler = idler.length ? await prisma.user.findMany({ where: { id: { in: idler } }, select: { id: true, avatarUrl: true, isAdmin: true, isGuildAdmin: true } }) : [];
    const bilgi = new Map(kisiler.map((k) => [k.id, k]));
    const uyeler = (oda: string, konusanlar?: Set<number>, kisitli = false) => (tablo[oda] ?? []).map((m) => {
      const k = bilgi.get(m.id);
      return { id: m.id, name: m.name, avatar: k?.avatarUrl || null, canSpeak: !kisitli || !!(k && (k.isAdmin || k.isGuildAdmin)) || !!konusanlar?.has(m.id) };
    });
    const ben = yonetici(me);
    return NextResponse.json({
      rooms: odalar.map((o) => {
        const konusanlar = new Set(o.speakers.map((s) => s.userId));
        const liste = uyeler(`oda-${o.slug}`, konusanlar, o.speakRestricted);
        return {
          id: o.id, name: o.name, slug: o.slug, category: o.category, adminOnly: o.adminOnly, speakRestricted: o.speakRestricted,
          canJoin: !o.adminOnly || ben,
          canSpeak: !o.speakRestricted || ben || konusanlar.has(me.id),
          speakers: Array.from(konusanlar),
          members: liste.map((m) => m.name), memberList: liste,
        };
      }),
      warRooms: savasOdalari.map((o) => { const liste = uyeler(o.room); return { ...o, members: liste.map((m) => m.name), memberList: liste }; }),
      canManage: ben,
    }, { headers: APP_HEADERS });
  });
}

export async function POST(req: Request) {
  return withApp(req, async (me) => {
    if (!yonetici(me)) return appError("Oda açmak yöneticiye özel.", 403);
    const b = (await req.json().catch(() => ({}))) as { name?: string; adminOnly?: boolean; speakRestricted?: boolean; category?: string };
    const name = String(b.name ?? "").trim().slice(0, AD_MAX);
    const category = String(b.category ?? "").trim().slice(0, AD_MAX) || "Genel";
    if (!name) return appError("Oda adı gerekli.", 400);
    let slug = slugla(name);
    if (await prisma.voiceRoom.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const son = await prisma.voiceRoom.aggregate({ _max: { order: true } });
    const oda = await prisma.voiceRoom.create({ data: { name, slug, category, adminOnly: !!b.adminOnly, speakRestricted: !!b.speakRestricted, createdBy: me.id, order: (son._max.order ?? 0) + 1 } });
    return NextResponse.json({ id: oda.id, name: oda.name, slug: oda.slug }, { headers: APP_HEADERS });
  });
}

export async function DELETE(req: Request) {
  return withApp(req, async (me) => {
    if (!yonetici(me)) return appError("Oda silmek yöneticiye özel.", 403);
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return appError("id gerekli.", 400);
    await prisma.voiceRoom.delete({ where: { id } }).catch(() => null);
    return NextResponse.json({ ok: true }, { headers: APP_HEADERS });
  });
}

/** Odaya giriş anahtarı */
export async function PUT(req: Request) {
  return withApp(req, async (me) => {
    const b = (await req.json().catch(() => ({}))) as { id?: number };
    const oda = await prisma.voiceRoom.findUnique({ where: { id: Number(b.id) }, include: { speakers: { where: { userId: me.id }, select: { id: true } } } });
    if (!oda) return appError("Oda bulunamadı.", 404);
    if (oda.adminOnly && !yonetici(me)) return appError("Bu oda yöneticiye özel.", 403);
    const yayin = !oda.speakRestricted || yonetici(me) || oda.speakers.length > 0;
    const t = await odaAnahtari(me, `oda-${oda.slug}`, "4h", yayin);
    return NextResponse.json({ ...t, room: `oda-${oda.slug}`, label: oda.name, canSpeak: yayin }, { headers: APP_HEADERS });
  });
}
