import { prisma } from "@/lib/prisma";
import { BDO_CLASSES } from "@/lib/classes";

/**
 * Karşı klanların dosyası — kill akışı kayıtlarından.
 *
 * Savaş başına analiz zaten var; burası onun üstüne çıkıyor: aynı klanla
 * defalarca karşılaşıyoruz ve her seferinde sıfırdan "bunlar kimdi"
 * diye bakıyoruz. Bu sayfa hafıza: kime karşı ne yaptık, kadroları
 * neye benziyor, kim tehlikeli.
 *
 * Kaynak yalnız kill akışı (CombatEvent). Resmî rapor klan kırılımı
 * vermiyor; oradaki sayılar bizim tarafın toplamı.
 */

const SINIF_ADI = new Map<number, string>(BDO_CLASSES.map((c) => [c.classType, c.name]));
const SINIF_ID = new Map<number, string>(BDO_CLASSES.map((c) => [c.classType, c.id]));

export interface RakipOyuncu {
  aile: string;
  /** Savaşta gördüğümüz karakter (en çok kullandığı) */
  karakter: string;
  sinif: number | null;
  sinifAd: string | null;
  bizeOlum: number;
  bizimKill: number;
}

export interface RakipSinif { sinif: number; ad: string; id: string | null; kisi: number; bizeOlum: number; bizimKill: number }

export interface RakipKlan {
  ad: string;
  kill: number;
  olum: number;
  fark: number;
  /** Kaç ayrı savaşta karşılaştık */
  savas: number;
  sonKarsilasma: Date | null;
  /** Gördüğümüz ayrı aile sayısı */
  kisi: number;
  oyuncular: RakipOyuncu[];
  siniflar: RakipSinif[];
  /** Savaş savaş fark — gidişat */
  gidisat: Array<{ warId: number; tarih: Date; fark: number; kill: number; olum: number }>;
}

export async function rakipDosyalari(): Promise<{ klanlar: RakipKlan[]; savasSayisi: number; olaySayisi: number; sinifsiz: number }> {
  const oturumlar = await prisma.combatSession.findMany({
    select: { id: true, warId: true, war: { select: { date: true, title: true } } },
  });
  if (oturumlar.length === 0) return { klanlar: [], savasSayisi: 0, olaySayisi: 0, sinifsiz: 0 };
  const savasBilgi = new Map(oturumlar.map((o) => [o.warId, o.war]));

  const ham = await prisma.combatEvent.findMany({
    where: { sessionId: { in: oturumlar.map((o) => o.id) } },
    select: {
      rawHash: true, ourKill: true, opponentGuild: true, opponentCharacter: true,
      opponentFamily: true, session: { select: { warId: true } },
    },
  });
  // Aynı paketi iki kayıtçı görmüş olabilir
  const gorulen = new Set<string>();
  const olaylar = ham.filter((e) => (gorulen.has(e.rawHash) ? false : (gorulen.add(e.rawHash), true)));

  // Sınıflar profil önbelleğinden
  const aileler = Array.from(new Set(olaylar.map((o) => o.opponentFamily).filter(Boolean)));
  const karakterSinif = new Map<string, number>();
  if (aileler.length) {
    try {
      const rows = await prisma.$queryRaw<Array<{ karakterler: unknown }>>`
        SELECT "karakterler" FROM "bdo_families" WHERE lower("aile") = ANY(${aileler.map((a) => a.toLowerCase())}::text[])`;
      for (const r of rows) {
        for (const k of (r.karakterler as Array<{ ad: string; sinif: number }>) ?? []) {
          karakterSinif.set(k.ad.toLocaleLowerCase("tr"), k.sinif);
        }
      }
    } catch { /* önbellek yoksa sınıfsız */ }
  }

  interface Biriktir {
    kill: number; olum: number;
    savaslar: Map<number, { kill: number; olum: number }>;
    oyuncu: Map<string, { aile: string; karakterler: Map<string, number>; bizeOlum: number; bizimKill: number }>;
  }
  const klan = new Map<string, Biriktir>();
  let sinifsiz = 0;

  for (const o of olaylar) {
    const ad = o.opponentGuild || "—";
    const k = klan.get(ad) ?? { kill: 0, olum: 0, savaslar: new Map(), oyuncu: new Map() };
    if (o.ourKill) k.kill++; else k.olum++;

    const w = k.savaslar.get(o.session.warId) ?? { kill: 0, olum: 0 };
    if (o.ourKill) w.kill++; else w.olum++;
    k.savaslar.set(o.session.warId, w);

    if (o.opponentFamily) {
      const oy = k.oyuncu.get(o.opponentFamily) ?? { aile: o.opponentFamily, karakterler: new Map<string, number>(), bizeOlum: 0, bizimKill: 0 };
      if (o.ourKill) oy.bizimKill++; else oy.bizeOlum++;
      if (o.opponentCharacter) oy.karakterler.set(o.opponentCharacter, (oy.karakterler.get(o.opponentCharacter) ?? 0) + 1);
      k.oyuncu.set(o.opponentFamily, oy);
    }
    if (!karakterSinif.has(o.opponentCharacter.toLocaleLowerCase("tr"))) sinifsiz++;
    klan.set(ad, k);
  }

  const klanlar: RakipKlan[] = Array.from(klan.entries()).map(([ad, k]) => {
    const oyuncular: RakipOyuncu[] = Array.from(k.oyuncu.values()).map((oy) => {
      const karakter = Array.from(oy.karakterler.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
      const sinif = karakterSinif.get(karakter.toLocaleLowerCase("tr")) ?? null;
      return {
        aile: oy.aile, karakter, sinif,
        sinifAd: sinif != null ? SINIF_ADI.get(sinif) ?? `class ${sinif}` : null,
        bizeOlum: oy.bizeOlum, bizimKill: oy.bizimKill,
      };
    }).sort((a, b) => b.bizeOlum - a.bizeOlum || b.bizimKill - a.bizimKill);

    const sinifSayac = new Map<number, { kisi: Set<string>; bizeOlum: number; bizimKill: number }>();
    for (const o of oyuncular) {
      if (o.sinif == null) continue;
      const v = sinifSayac.get(o.sinif) ?? { kisi: new Set<string>(), bizeOlum: 0, bizimKill: 0 };
      v.kisi.add(o.aile); v.bizeOlum += o.bizeOlum; v.bizimKill += o.bizimKill;
      sinifSayac.set(o.sinif, v);
    }
    const siniflar: RakipSinif[] = Array.from(sinifSayac.entries())
      .map(([sinif, v]) => ({ sinif, ad: SINIF_ADI.get(sinif) ?? `class ${sinif}`, id: SINIF_ID.get(sinif) ?? null, kisi: v.kisi.size, bizeOlum: v.bizeOlum, bizimKill: v.bizimKill }))
      .sort((a, b) => b.kisi - a.kisi || b.bizeOlum - a.bizeOlum);

    const gidisat = Array.from(k.savaslar.entries())
      .map(([warId, v]) => ({ warId, tarih: savasBilgi.get(warId)?.date ?? new Date(0), fark: v.kill - v.olum, kill: v.kill, olum: v.olum }))
      .sort((a, b) => a.tarih.getTime() - b.tarih.getTime());

    return {
      ad, kill: k.kill, olum: k.olum, fark: k.kill - k.olum,
      savas: k.savaslar.size,
      sonKarsilasma: gidisat.length ? gidisat[gidisat.length - 1].tarih : null,
      kisi: k.oyuncu.size, oyuncular, siniflar, gidisat,
    };
  }).sort((a, b) => (b.kill + b.olum) - (a.kill + a.olum));

  return {
    klanlar,
    savasSayisi: new Set(oturumlar.map((o) => o.warId)).size,
    olaySayisi: olaylar.length,
    sinifsiz,
  };
}
