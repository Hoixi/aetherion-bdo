import { prisma } from "@/lib/prisma";
import { BDO_CLASSES } from "@/lib/classes";

/**
 * T2 savaş planının beslendiği sayılar.
 *
 * Plan metni sabit, sayılar canlı: her savaştan sonra sayfa kendini
 * günceller, plan eskimez. Üç kaynak birleşiyor —
 *  - resmî hasar raporu (WarPerformance): kim ne kadar öldü, ne vurdu
 *  - kill akışı kaydı (CombatEvent): hangi klana, hangi sınıfa öldük
 *  - katılım (WarParticipant): bu savaşa kim geliyor, hangi sınıfla
 *
 * Kill akışında aynı paketi iki kayıtçı görmüş olabilir; rawHash ile
 * tekilleştiriliyor (bkz. savas-ozeti.ts).
 */

const SINIF_ADI = new Map<number, string>(BDO_CLASSES.map((c) => [c.classType, c.name]));
const SINIF_KIMLIK = new Map<string, string>(BDO_CLASSES.map((c) => [c.id, c.name]));

/** Kill akışının okunduğu savaş sayısı — plan bu pencereye dayanıyor */
const KAYIT_PENCERESI = 5;
/** Sınıf ortalamaları bu kadar savaştan */
const RAPOR_PENCERESI = 8;

export interface PlanKlan { ad: string; kill: number; olum: number; fark: number }
export interface PlanSinif { ad: string; olum: number; kill: number; kisi: number }
export interface PlanBizimSinif { id: string; ad: string; kayit: number; kill: number; olum: number; kd: number; hasar: number; cc: number; kale: number }

export async function t2PlanVerisi() {
  const simdi = new Date();

  // --- Yaklaşan T2 (yoksa en son T2)
  const yaklasan = await prisma.war.findFirst({
    where: { tier: "T2", date: { gte: new Date(simdi.getTime() - 6 * 3600_000) } },
    orderBy: { date: "asc" },
    select: { id: true, title: true, date: true, tier: true },
  });
  const sonT2 = await prisma.war.findFirst({
    where: { tier: "T2", date: { lt: simdi } },
    orderBy: { date: "desc" },
    select: { id: true, title: true, date: true },
  });

  // --- Bu savaşa gelenler ve sınıf dağılımı
  const katilanlar = yaklasan
    ? await prisma.warParticipant.findMany({
        where: { warId: yaklasan.id, status: "ATTENDING" },
        select: {
          asClass: true,
          user: { select: { id: true, familyName: true, class: true, ap: true, dp: true, guild: { select: { tag: true } } } },
        },
      })
    : [];
  const kadro = katilanlar
    .map((k) => ({
      id: k.user.id,
      ad: k.user.familyName,
      sinif: k.asClass ?? k.user.class,
      sinifAd: SINIF_KIMLIK.get(k.asClass ?? k.user.class) ?? (k.asClass ?? k.user.class),
      gs: k.user.ap + k.user.dp,
      klan: k.user.guild?.tag ?? null,
    }))
    .sort((a, b) => b.gs - a.gs);

  // --- T1 / T2 kıyası: T2'de ne kadar daha çok ölüyoruz
  const savaslar = await prisma.war.findMany({
    where: { performances: { some: {} } },
    orderBy: { date: "desc" },
    take: 14,
    select: { id: true, title: true, date: true, tier: true, result: true },
  });
  const toplamlar = await prisma.warPerformance.groupBy({
    by: ["warId"],
    where: { warId: { in: savaslar.map((w) => w.id) } },
    _sum: { kills: true, deaths: true, damageDealt: true, castleDamage: true },
    _count: { _all: true },
  });
  const ozetler = savaslar.map((w) => {
    const t = toplamlar.find((x) => x.warId === w.id);
    const kill = t?._sum.kills ?? 0, olum = t?._sum.deaths ?? 0, kisi = t?._count._all ?? 0;
    return {
      id: w.id, baslik: w.title, tarih: w.date, tier: w.tier, sonuc: w.result,
      kisi, kill, olum, kd: olum ? kill / olum : 0,
      kisiBasiOlum: kisi ? olum / kisi : 0,
      kale: t?._sum.castleDamage ?? 0,
    };
  });
  const tierOrt = (tier: string) => {
    const g = ozetler.filter((o) => o.tier === tier && o.kisi > 0);
    if (g.length === 0) return null;
    return {
      savas: g.length,
      kd: g.reduce((s, o) => s + o.kd, 0) / g.length,
      kisiBasiOlum: g.reduce((s, o) => s + o.kisiBasiOlum, 0) / g.length,
      kisi: Math.round(g.reduce((s, o) => s + o.kisi, 0) / g.length),
    };
  };

  // --- Kill akışı: son kayıtlı savaşlar
  const oturumlar = await prisma.combatSession.findMany({
    select: { id: true, warId: true },
    orderBy: { startedAt: "desc" },
    take: 40,
  });
  const sonSavaslar = Array.from(new Set(oturumlar.map((o) => o.warId))).slice(0, KAYIT_PENCERESI);
  const olaylarHam = sonSavaslar.length
    ? await prisma.combatEvent.findMany({
        where: { session: { warId: { in: sonSavaslar } } },
        select: { rawHash: true, ourKill: true, opponentGuild: true, opponentCharacter: true, opponentFamily: true },
      })
    : [];
  const gorulen = new Set<string>();
  const olaylar = olaylarHam.filter((e) => (gorulen.has(e.rawHash) ? false : (gorulen.add(e.rawHash), true)));

  const klanHarita = new Map<string, PlanKlan>();
  for (const o of olaylar) {
    const ad = o.opponentGuild || "—";
    const k = klanHarita.get(ad) ?? { ad, kill: 0, olum: 0, fark: 0 };
    if (o.ourKill) k.kill++; else k.olum++;
    k.fark = k.kill - k.olum;
    klanHarita.set(ad, k);
  }
  const klanlar = Array.from(klanHarita.values()).sort((a, b) => a.fark - b.fark);

  // Karşı sınıflar — profil önbelleğinden
  const aileler = Array.from(new Set(olaylar.map((o) => o.opponentFamily).filter(Boolean)));
  const sinifHarita = new Map<string, number>();
  if (aileler.length) {
    try {
      const rows = await prisma.$queryRaw<Array<{ karakterler: unknown }>>`
        SELECT "karakterler" FROM "bdo_families" WHERE lower("aile") = ANY(${aileler.map((a) => a.toLowerCase())}::text[])`;
      for (const r of rows) {
        for (const k of (r.karakterler as Array<{ ad: string; sinif: number }>) ?? []) {
          sinifHarita.set(k.ad.toLocaleLowerCase("tr"), k.sinif);
        }
      }
    } catch { /* önbellek yoksa sınıfsız devam */ }
  }
  const sinifSayac = new Map<number, { olum: number; kill: number; kisi: Set<string> }>();
  let sinifsiz = 0;
  for (const o of olaylar) {
    const s = sinifHarita.get(o.opponentCharacter.toLocaleLowerCase("tr"));
    if (s == null) { sinifsiz++; continue; }
    const v = sinifSayac.get(s) ?? { olum: 0, kill: 0, kisi: new Set<string>() };
    if (o.ourKill) v.kill++; else v.olum++;
    v.kisi.add(o.opponentFamily);
    sinifSayac.set(s, v);
  }
  const karsiSiniflar: PlanSinif[] = Array.from(sinifSayac.entries())
    .map(([s, v]) => ({ ad: SINIF_ADI.get(s) ?? `class ${s}`, olum: v.olum, kill: v.kill, kisi: v.kisi.size }))
    .sort((a, b) => b.olum - a.olum);

  // --- Bizim sınıflar: son savaşların rapor ortalaması
  const raporSavaslari = savaslar.slice(0, RAPOR_PENCERESI).map((w) => w.id);
  const raporlar = await prisma.warPerformance.findMany({
    where: { warId: { in: raporSavaslari } },
    select: { class: true, kills: true, deaths: true, damageDealt: true, ccCount: true, castleDamage: true, user: { select: { class: true } } },
  });
  const bizSayac = new Map<string, { n: number; k: number; d: number; dmg: number; cc: number; kale: number }>();
  for (const r of raporlar) {
    const c = r.class || r.user?.class || "?";
    const v = bizSayac.get(c) ?? { n: 0, k: 0, d: 0, dmg: 0, cc: 0, kale: 0 };
    v.n++; v.k += r.kills; v.d += r.deaths; v.dmg += r.damageDealt; v.cc += r.ccCount; v.kale += r.castleDamage;
    bizSayac.set(c, v);
  }
  const bizimSiniflar: PlanBizimSinif[] = Array.from(bizSayac.entries())
    .filter(([, v]) => v.n >= 3)
    .map(([id, v]) => ({
      id, ad: SINIF_KIMLIK.get(id) ?? id, kayit: v.n,
      kill: v.k / v.n, olum: v.d / v.n, kd: v.d ? v.k / v.d : v.k,
      hasar: v.dmg / v.n, cc: v.cc / v.n, kale: v.kale / v.n,
    }))
    .sort((a, b) => b.kd - a.kd);

  return {
    yaklasan, sonT2, kadro,
    ozetler, t1: tierOrt("T1"), t2: tierOrt("T2"),
    klanlar, karsiSiniflar, sinifsiz, bizimSiniflar,
    kayitSavaslari: sonSavaslar, olaySayisi: olaylar.length,
  };
}

export type T2Plan = Awaited<ReturnType<typeof t2PlanVerisi>>;
