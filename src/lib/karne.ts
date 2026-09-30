import { prisma } from "@/lib/prisma";
import { BDO_CLASSES } from "@/lib/classes";

/**
 * Kişisel savaş karnesi — kill akışı kayıtlarından.
 *
 * Hasar raporu "kaç öldürdün, kaç öldün" diyor; burası nedenini
 * söylüyor: kimin elinden ölüyorsun, hangi sınıf sana denk geliyor,
 * hangi gece iyi hangi gece kötüydün. Antrenör gözü.
 *
 * Aile adı üzerinden eşleşiyor: kill akışı oyuncu numarası değil aile
 * adı taşıyor. Sitede aynı aile adına sahip üye bulunursa sınıfı ve
 * klanı da ekleniyor.
 */

const SINIF_ADI = new Map<number, string>(BDO_CLASSES.map((c) => [c.classType, c.name]));
const SINIF_ID = new Map<number, string>(BDO_CLASSES.map((c) => [c.classType, c.id]));

export interface KarneSatiri {
  aile: string;
  uyeId: number | null;
  sinifId: string | null;
  sinifAd: string | null;
  klan: string | null;
  kill: number;
  olum: number;
  kd: number;
  savas: number;
  /** Savaş başına ölüm */
  savasBasiOlum: number;
  /** En çok öldüğü karşı sınıf */
  zorlandigi: { ad: string; id: string | null; olum: number } | null;
  /** En çok öldüğü karşı klan */
  zorKlan: { ad: string; olum: number } | null;
  /** En çok öldürdüğü kişi */
  avi: { aile: string; kill: number } | null;
  /** Savaş savaş fark */
  gidisat: Array<{ warId: number; fark: number }>;
}

export async function karneler() {
  const oturumlar = await prisma.combatSession.findMany({ select: { id: true, warId: true } });
  if (oturumlar.length === 0) return { satirlar: [], savasSayisi: 0, olaySayisi: 0 };

  const ham = await prisma.combatEvent.findMany({
    where: { sessionId: { in: oturumlar.map((o) => o.id) } },
    select: {
      rawHash: true, ourKill: true, ourFamily: true, opponentFamily: true,
      opponentCharacter: true, opponentGuild: true, session: { select: { warId: true } },
    },
  });
  const gorulen = new Set<string>();
  const olaylar = ham.filter((e) => (gorulen.has(e.rawHash) ? false : (gorulen.add(e.rawHash), true)));

  // Karşı karakter → sınıf
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
    } catch { /* önbellek yok */ }
  }

  // Bizim aileler → üye kaydı
  const bizimAileler = Array.from(new Set(olaylar.map((o) => o.ourFamily).filter(Boolean)));
  const uyeler = await prisma.user.findMany({
    where: { familyName: { in: bizimAileler } },
    select: { id: true, familyName: true, class: true, guild: { select: { tag: true } } },
  });
  const uyeHarita = new Map(uyeler.map((u) => [u.familyName.toLocaleLowerCase("tr"), u]));

  interface Kova {
    kill: number; olum: number;
    savaslar: Map<number, { kill: number; olum: number }>;
    sinif: Map<number, number>;
    klan: Map<string, number>;
    av: Map<string, number>;
  }
  const kisi = new Map<string, Kova>();
  for (const o of olaylar) {
    if (!o.ourFamily) continue;
    const k = kisi.get(o.ourFamily) ?? { kill: 0, olum: 0, savaslar: new Map(), sinif: new Map(), klan: new Map(), av: new Map() };
    const w = k.savaslar.get(o.session.warId) ?? { kill: 0, olum: 0 };
    if (o.ourKill) {
      k.kill++; w.kill++;
      if (o.opponentFamily) k.av.set(o.opponentFamily, (k.av.get(o.opponentFamily) ?? 0) + 1);
    } else {
      k.olum++; w.olum++;
      const s = karakterSinif.get(o.opponentCharacter.toLocaleLowerCase("tr"));
      if (s != null) k.sinif.set(s, (k.sinif.get(s) ?? 0) + 1);
      const g = o.opponentGuild || "—";
      k.klan.set(g, (k.klan.get(g) ?? 0) + 1);
    }
    k.savaslar.set(o.session.warId, w);
    kisi.set(o.ourFamily, k);
  }

  const enBuyuk = <T,>(m: Map<T, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

  const satirlar: KarneSatiri[] = Array.from(kisi.entries()).map(([aile, k]) => {
    const u = uyeHarita.get(aile.toLocaleLowerCase("tr"));
    const zor = enBuyuk(k.sinif);
    const zorK = enBuyuk(k.klan);
    const av = enBuyuk(k.av);
    return {
      aile,
      uyeId: u?.id ?? null,
      sinifId: u?.class ?? null,
      sinifAd: u?.class ? (BDO_CLASSES.find((c) => c.id === u.class)?.name ?? u.class) : null,
      klan: u?.guild?.tag ?? null,
      kill: k.kill, olum: k.olum,
      kd: k.olum ? k.kill / k.olum : k.kill,
      savas: k.savaslar.size,
      savasBasiOlum: k.savaslar.size ? k.olum / k.savaslar.size : 0,
      zorlandigi: zor ? { ad: SINIF_ADI.get(zor[0]) ?? `class ${zor[0]}`, id: SINIF_ID.get(zor[0]) ?? null, olum: zor[1] } : null,
      zorKlan: zorK ? { ad: zorK[0], olum: zorK[1] } : null,
      avi: av ? { aile: av[0], kill: av[1] } : null,
      gidisat: Array.from(k.savaslar.entries()).sort((a, b) => a[0] - b[0]).map(([warId, v]) => ({ warId, fark: v.kill - v.olum })),
    };
  }).sort((a, b) => b.kd - a.kd || b.kill - a.kill);

  return {
    satirlar,
    savasSayisi: new Set(oturumlar.map((o) => o.warId)).size,
    olaySayisi: olaylar.length,
  };
}
