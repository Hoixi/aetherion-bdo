export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS } from "@/lib/app-gate";

/**
 * Olay akışı — imleçli sorgulama.
 *
 * Uygulama `?since=<ISO>` ile sorar, olaylar veritabanı durumundan
 * türetilir, yanıttaki `serverTime` bir sonraki imleç olur. SSE yerine bu
 * seçildi: tek konteynerde uzun ömürlü bağlantı tutmak yerine durumsuz
 * istek daha sağlam, ve uygulama kapalıyken olanlar kaybolmuyor.
 *
 * "Savaş başlıyor" zamana bağlı olduğu için imleçten bağımsız: 30 dakika
 * içinde başlayacak her savaş her sorguda döner, uygulama savaş kimliğiyle
 * tekilleştirir. Parti ataması ayrı olay değil: `/api/app/wars`teki
 * `myParty` alanını uygulama kendisi kıyaslıyor (PartyMember'da zaman yok).
 */

type Olay =
  | { type: "castle_buff"; at: string; id: number; castle: string; buff: string; effect: string; expiresAt: string; reportedBy: string; refreshed: boolean }
  | { type: "war_created"; at: string; id: number; title: string; date: string; tier: string }
  | { type: "war_starting"; at: string; id: number; title: string; date: string; startsInMinutes: number }
  | { type: "voice_invite"; at: string; warId: number; warTitle: string; partyId: number; partyName: string; from: string };

const YAKIN_DK = 30;

export async function GET(req: Request) {
  return withApp(req, async (me) => {
    const url = new URL(req.url);
    const sinceParam = url.searchParams.get("since");
    const since = sinceParam && !Number.isNaN(Date.parse(sinceParam))
      ? new Date(sinceParam)
      // İlk açılışta son 10 dakikayı ver; daha eskisi ekranda gürültü olur
      : new Date(Date.now() - 10 * 60_000);
    const simdi = new Date();
    const olaylar: Olay[] = [];

    const buffs = await prisma.castleBuff.findMany({
      where: { updatedAt: { gt: since }, expiresAt: { gt: simdi } },
      include: { reporter: { select: { familyName: true } } },
    });
    for (const b of buffs) {
      olaylar.push({
        type: "castle_buff", at: b.updatedAt.toISOString(), id: b.id,
        castle: b.castle, buff: b.buff, effect: b.effect,
        expiresAt: b.expiresAt.toISOString(), reportedBy: b.reporter.familyName,
        refreshed: b.updatedAt.getTime() - b.createdAt.getTime() > 1000,
      });
    }

    const yeniSavaslar = await prisma.war.findMany({
      where: { createdAt: { gt: since }, date: { gt: simdi } },
      select: { id: true, title: true, date: true, tier: true, createdAt: true },
    });
    for (const w of yeniSavaslar) {
      olaylar.push({ type: "war_created", at: w.createdAt.toISOString(), id: w.id,
                     title: w.title, date: w.date.toISOString(), tier: w.tier });
    }

    const yakin = await prisma.war.findMany({
      where: { date: { gt: simdi, lte: new Date(simdi.getTime() + YAKIN_DK * 60_000) } },
      select: { id: true, title: true, date: true },
    });
    for (const w of yakin) {
      olaylar.push({
        type: "war_starting", at: simdi.toISOString(), id: w.id, title: w.title,
        date: w.date.toISOString(),
        startsInMinutes: Math.max(0, Math.round((w.date.getTime() - simdi.getTime()) / 60_000)),
      });
    }

    // Ses davetleri: bana gelen, imleçten yeni
    const davetler = await prisma.voiceInvite.findMany({
      where: { userId: me.id, createdAt: { gt: since } },
      include: { inviter: { select: { familyName: true } } },
    });
    if (davetler.length) {
      const wars = await prisma.war.findMany({ where: { id: { in: davetler.map((d) => d.warId) } }, select: { id: true, title: true, parties: { select: { id: true, name: true } } } });
      for (const d of davetler) {
        const w = wars.find((x) => x.id === d.warId); if (!w) continue;
        olaylar.push({ type: "voice_invite", at: d.createdAt.toISOString(), warId: d.warId, warTitle: w.title,
                       partyId: d.partyId, partyName: w.parties.find((p) => p.id === d.partyId)?.name ?? "?", from: d.inviter.familyName });
      }
    }

    olaylar.sort((a, b) => a.at.localeCompare(b.at));
    return NextResponse.json({ serverTime: simdi.toISOString(), events: olaylar },
                             { headers: APP_HEADERS });
  });
}
