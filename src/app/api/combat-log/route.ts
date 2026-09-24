export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { gunlukAyristir, zamanla } from "@/lib/savas-gunlugu";

/**
 * Savaş günlükleri.
 *  GET  ?warId=            → günlük listesi (savaşa bağlı ya da hepsi)
 *  POST { title, warId?, source, text? | events[] }  → yeni günlük
 *
 * Hem site oturumu hem uygulama anahtarı geçerli (app-gate ikisini de kabul
 * ediyor): uygulama canlı kaydı olay listesiyle, site `.log` metniyle yolluyor.
 */
export async function GET(req: Request) {
  return withApp(req, async () => {
    const warId = Number(new URL(req.url).searchParams.get("warId"));
    const rows = await prisma.combatLog.findMany({
      where: Number.isInteger(warId) ? { warId } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, warId: true, title: true, source: true, startedAt: true, endedAt: true, createdAt: true,
        uploader: { select: { id: true, familyName: true } },
        _count: { select: { kills: true } },
      },
    });
    return NextResponse.json(rows, { headers: APP_HEADERS });
  });
}

export async function POST(req: Request) {
  return withApp(req, async (me) => {
    const b = (await req.json().catch(() => ({}))) as {
      title?: string; warId?: number; source?: string; text?: string;
      events?: Array<{ t?: string; at?: string; killer?: string; victim?: string; guild?: string | null }>;
      startedAt?: string;
    };
    const title = String(b.title ?? "").trim().slice(0, 120) || "Savaş günlüğü";
    const warId = Number.isInteger(Number(b.warId)) && Number(b.warId) > 0 ? Number(b.warId) : null;
    const source = b.source === "logger" ? "logger" : "import";

    // Ham metin geldiyse burada ayrıştırılıyor; uygulama zaten olay listesi yolluyor
    type Olay = { t: string; at?: string; killer: string; victim: string; guild?: string | null };
    const olaylar: Olay[] = b.text
      ? gunlukAyristir(b.text).olaylar.map((o) => ({ ...o }))
      : (b.events ?? [])
          .map((e) => ({ t: e.t ?? "", at: e.at, killer: String(e.killer ?? ""), victim: String(e.victim ?? ""), guild: e.guild ?? null }))
          .filter((e) => e.killer && e.victim);
    if (olaylar.length === 0) return appError("Okunabilir olay yok.", 400);

    // Zaman: olayda tam tarih varsa o, yoksa HH:MM:SS + referans gün
    const ref = b.startedAt ? new Date(b.startedAt) : warId
      ? (await prisma.war.findUnique({ where: { id: warId }, select: { date: true } }))?.date ?? new Date()
      : new Date();
    const tamZaman = olaylar.every((o) => !!o.at);
    const zamanlar = tamZaman
      ? olaylar.map((o) => new Date(o.at as string))
      : zamanla(olaylar.map((o) => ({ t: o.t, killer: o.killer, victim: o.victim })), ref);

    // Aile adı → üye eşleşmesi (kim bizden)
    const uyeler = await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, familyName: true } });
    const adId = new Map(uyeler.filter((u) => u.familyName).map((u) => [u.familyName.toLocaleLowerCase("tr"), u.id]));

    const log = await prisma.combatLog.create({
      data: {
        title, warId, source, uploadedBy: me.id,
        startedAt: zamanlar[0] ?? ref, endedAt: zamanlar[zamanlar.length - 1] ?? ref,
        kills: {
          create: olaylar.map((o, i) => ({
            at: zamanlar[i] ?? ref,
            killerName: o.killer.slice(0, 40),
            victimName: o.victim.slice(0, 40),
            guildName: o.guild ? String(o.guild).slice(0, 60) : null,
            killerUserId: adId.get(o.killer.toLocaleLowerCase("tr")) ?? null,
            victimUserId: adId.get(o.victim.toLocaleLowerCase("tr")) ?? null,
          })),
        },
      },
      select: { id: true, title: true, _count: { select: { kills: true } } },
    });
    return NextResponse.json({ id: log.id, title: log.title, events: log._count.kills }, { headers: APP_HEADERS });
  });
}
