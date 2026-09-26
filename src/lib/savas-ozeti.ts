import { prisma } from "@/lib/prisma";
import type { IsiNoktasi } from "@/lib/harita-karti";

/**
 * Bir savaşın kill akışından çıkan özet — sunucu tarafı.
 *
 * Arayüzdeki analiz ekranı aynı işi tarayıcıda yapıyor (`savas-analiz.ts`);
 * burası Discord kartı için: veriyi doğrudan veritabanından okuyor ve
 * o savaşın bütün kayıtlarını birleştiriyor.
 *
 * Aynı savaşta birden çok kişi kayıt almış olabiliyor ve ikisi de aynı
 * paketi görüyor. Tekrarı `rawHash` ayıklıyor: aynı paket, aynı hash.
 *
 * Bu sayılar resmî hasar raporunun yerine geçmez — kaydı alanların
 * gördüğü akıştır.
 */

export interface OzetSatiri {
  ad: string;
  kill: number;
  olum: number;
}

export interface SinifOzeti {
  sinif: number;
  olum: number;
  kill: number;
  kisi: number;
}

export interface ZamanDilimi {
  t: number;
  kill: number;
  death: number;
}

const artan = <T>(m: Map<string, T>, k: string, bos: () => T) => {
  const v = m.get(k) ?? bos();
  m.set(k, v);
  return v;
};

export async function savasOzeti(warId: number) {
  const oturumlar = await prisma.combatSession.findMany({
    where: { warId },
    select: { id: true, uploader: { select: { familyName: true } } },
  });
  if (oturumlar.length === 0) return null;

  const ham = await prisma.combatEvent.findMany({
    where: { sessionId: { in: oturumlar.map((o) => o.id) } },
    select: {
      rawHash: true, receivedAt: true, ourKill: true,
      ourFamily: true, opponentFamily: true, opponentCharacter: true, opponentGuild: true,
      gameX: true, gameZ: true,
    },
    orderBy: { receivedAt: "asc" },
  });
  if (ham.length === 0) return null;

  // İki kayıtçı aynı paketi görmüş olabilir
  const gorulen = new Set<string>();
  const olaylar = ham.filter((e) => {
    if (gorulen.has(e.rawHash)) return false;
    gorulen.add(e.rawHash);
    return true;
  });

  const kill = olaylar.filter((o) => o.ourKill).length;
  const death = olaylar.length - kill;
  const ilk = olaylar[0].receivedAt.getTime();
  const son = olaylar[olaylar.length - 1].receivedAt.getTime();

  const klan = new Map<string, OzetSatiri>();
  const biz = new Map<string, OzetSatiri>();
  const rakip = new Map<string, OzetSatiri>();
  const aileler = new Set<string>();
  for (const o of olaylar) {
    const k = artan(klan, o.opponentGuild || "—", () => ({ ad: o.opponentGuild || "—", kill: 0, olum: 0 }));
    const b = artan(biz, o.ourFamily, () => ({ ad: o.ourFamily, kill: 0, olum: 0 }));
    const r = artan(rakip, o.opponentFamily, () => ({ ad: o.opponentFamily, kill: 0, olum: 0 }));
    if (o.ourKill) { k.kill++; b.kill++; r.olum++; } else { k.olum++; b.olum++; r.kill++; }
    if (o.opponentFamily) aileler.add(o.opponentFamily);
  }

  // Sınıflar önbellekten; okunmamış aile varsa o olaylar "bilinmiyor" kalıyor
  const sinifHaritasi = new Map<string, number>();
  if (aileler.size > 0) {
    try {
      const satirlar = await prisma.$queryRaw<Array<{ karakterler: unknown }>>`
        SELECT "karakterler" FROM "bdo_families"
        WHERE lower("aile") = ANY(${Array.from(aileler).map((a) => a.toLowerCase())}::text[])`;
      for (const s of satirlar) {
        for (const k of (s.karakterler as Array<{ ad: string; sinif: number }>) ?? []) {
          sinifHaritasi.set(k.ad.toLocaleLowerCase("tr"), k.sinif);
        }
      }
    } catch {
      // Önbellek tablosu yoksa sınıfsız devam
    }
  }

  const sinif = new Map<number, { olum: number; kill: number; aile: Set<string> }>();
  let sinifsiz = 0;
  for (const o of olaylar) {
    const s = sinifHaritasi.get(o.opponentCharacter.toLocaleLowerCase("tr"));
    if (s == null) { sinifsiz++; continue; }
    const v = sinif.get(s) ?? { olum: 0, kill: 0, aile: new Set<string>() };
    if (o.ourKill) v.kill++; else v.olum++;
    v.aile.add(o.opponentFamily);
    sinif.set(s, v);
  }

  // Zaman dilimleri: 30 küsur sütun kartın genişliğine sığıyor ve savaşın
  // şekli görünüyor; daha az dilimde her sütun tavana dayanıp düz bir
  // duvara dönüşüyor.
  const adaylar = [30, 60, 120, 300, 600];
  const gerek = Math.max(1, (son - ilk) / 1000 / 34);
  const dilimSn = adaylar.find((a) => a >= gerek) ?? 900;
  const genis = dilimSn * 1000;
  const bas = Math.floor(ilk / genis) * genis;
  const adet = Math.max(1, Math.floor((son - bas) / genis) + 1);
  const dilimler: ZamanDilimi[] = Array.from({ length: adet }, (_, i) => ({ t: bas + i * genis, kill: 0, death: 0 }));
  for (const o of olaylar) {
    const d = dilimler[Math.min(adet - 1, Math.floor((o.receivedAt.getTime() - bas) / genis))];
    if (o.ourKill) d.kill++; else d.death++;
  }

  const noktalar: IsiNoktasi[] = olaylar.map((o) => ({ x: o.gameX, z: o.gameZ, kill: o.ourKill }));

  return {
    kill, death, ilk, son,
    sureSn: Math.round((son - ilk) / 1000),
    olaySayisi: olaylar.length,
    /** Aynı savaşta kaç ayrı kişi kayıt almış */
    kayitci: oturumlar.length,
    kayitciAdlari: oturumlar.map((o) => o.uploader.familyName).filter(Boolean),
    /** Tekrar eden (iki kayıtta da görülen) paket sayısı */
    tekrar: ham.length - olaylar.length,
    dilimler, dilimSn,
    klanlar: Array.from(klan.values()).sort((a, b) => b.olum + b.kill - (a.olum + a.kill)),
    biz: Array.from(biz.values()).sort((a, b) => b.kill - a.kill || a.olum - b.olum),
    rakipler: Array.from(rakip.values()).sort((a, b) => b.kill - a.kill),
    siniflar: Array.from(sinif.entries())
      .map(([s, v]) => ({ sinif: s, olum: v.olum, kill: v.kill, kisi: v.aile.size }) as SinifOzeti)
      .sort((a, b) => b.olum - a.olum),
    sinifsiz,
    noktalar,
  };
}

export type SavasOzeti = NonNullable<Awaited<ReturnType<typeof savasOzeti>>>;
