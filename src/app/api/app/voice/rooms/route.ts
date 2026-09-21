export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { odaAnahtari } from "@/lib/livekit";
import { sesTablosu } from "@/lib/voice-presence";

/**
 * Kalıcı ses odaları.
 *  GET   → odalar + içindekiler (LiveKit'ten canlı) + yaklaşan savaşın parti/genel odalarındaki kişiler
 *  POST  → oda aç (yönetici)         { name, adminOnly? }
 *  DELETE→ oda sil (yönetici)        ?id=
 *  PUT   → odaya giriş anahtarı      { id }
 */

const AD_MAX = 40;
const slugla = (s: string) => s.toLocaleLowerCase("tr").replace(/[^a-z0-9çğıöşü]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "oda";
const yonetici = (me: { isAdmin: boolean; isGuildAdmin: boolean }) => me.isAdmin || me.isGuildAdmin;

export async function GET(req: Request) {
  return withApp(req, async (me) => {
    const odalar = await prisma.voiceRoom.findMany({ orderBy: [{ category: "asc" }, { order: "asc" }, { id: "asc" }] });
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
    // Bellekteki canlı tablo (webhook'la güncel); LiveKit'e her seferinde gitmiyoruz
    const kisiler = await sesTablosu();
    return NextResponse.json({
      rooms: odalar.map((o) => ({ id: o.id, name: o.name, slug: o.slug, category: o.category, adminOnly: o.adminOnly,
                                  canJoin: !o.adminOnly || yonetici(me), members: kisiler[`oda-${o.slug}`] ?? [] })),
      warRooms: savasOdalari.map((o) => ({ ...o, members: kisiler[o.room] ?? [] })),
      canManage: yonetici(me),
    }, { headers: APP_HEADERS });
  });
}

export async function POST(req: Request) {
  return withApp(req, async (me) => {
    if (!yonetici(me)) return appError("Oda açmak yöneticiye özel.", 403);
    const b = (await req.json().catch(() => ({}))) as { name?: string; adminOnly?: boolean; category?: string };
    const name = String(b.name ?? "").trim().slice(0, AD_MAX);
    const category = String(b.category ?? "").trim().slice(0, AD_MAX) || "Genel";
    if (!name) return appError("Oda adı gerekli.", 400);
    let slug = slugla(name);
    if (await prisma.voiceRoom.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const son = await prisma.voiceRoom.aggregate({ _max: { order: true } });
    const oda = await prisma.voiceRoom.create({ data: { name, slug, category, adminOnly: !!b.adminOnly, createdBy: me.id, order: (son._max.order ?? 0) + 1 } });
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
    const oda = await prisma.voiceRoom.findUnique({ where: { id: Number(b.id) } });
    if (!oda) return appError("Oda bulunamadı.", 404);
    if (oda.adminOnly && !yonetici(me)) return appError("Bu oda yöneticiye özel.", 403);
    const t = await odaAnahtari(me, `oda-${oda.slug}`);
    return NextResponse.json({ ...t, room: `oda-${oda.slug}`, label: oda.name }, { headers: APP_HEADERS });
  });
}
