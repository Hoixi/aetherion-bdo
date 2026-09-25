import type { SavasOlayi } from "@/lib/savas-olaylari";

/**
 * Kill akışından çıkan çıkarımlar.
 *
 * Hepsi tek bir kaydın içinden hesaplanıyor: bir kaydın gördüğü olaylar o
 * istemciye gelen akıştır, bütün savaşın tamamı olduğu garanti değil. Bu
 * yüzden buradaki sayılar "şu kayıtta şunlar oldu" demek; resmî hasar
 * raporunun yerine geçmez.
 */

export interface KlanSatiri {
  ad: string;
  /** Bu klana verdiğimiz ölüm sayısı */
  olum: number;
  /** Bu klandan aldığımız kill */
  kill: number;
  toplam: number;
}

export interface OyuncuSatiri {
  ad: string;
  kill: number;
  death: number;
  /** Bizimkiler için kullandığı karakter adları, rakipler için klanı */
  ek: string[];
}

export interface IkiliSatir {
  bizim: string;
  rakip: string;
  /** Rakibin bizi öldürdüğü sayı */
  bizeOlum: number;
  /** Bizim onu öldürdüğümüz sayı */
  bizimKill: number;
}

const artan = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

/** En uzun ardışık dizi — momentum: kaç ölümü üst üste yedik */
function enUzunSeri(olaylar: SavasOlayi[], kill: boolean) {
  let en = 0, simdi = 0;
  for (const o of olaylar) {
    if (o.bizimKill === kill) { simdi++; en = Math.max(en, simdi); } else simdi = 0;
  }
  return en;
}

export function savasAnalizi(olaylar: SavasOlayi[]) {
  const sirali = olaylar.slice().sort((a, b) => a.at - b.at);
  const klan = new Map<string, KlanSatiri>();
  const biz = new Map<string, { kill: number; death: number; karakter: Set<string> }>();
  const rakip = new Map<string, { kill: number; death: number; klan: Set<string> }>();
  const ikili = new Map<string, IkiliSatir>();

  for (const o of sirali) {
    const k = klan.get(o.rakipKlan) ?? { ad: o.rakipKlan || "—", olum: 0, kill: 0, toplam: 0 };
    if (o.bizimKill) k.kill++; else k.olum++;
    k.toplam++;
    klan.set(o.rakipKlan, k);

    const b = biz.get(o.bizimAile) ?? { kill: 0, death: 0, karakter: new Set<string>() };
    if (o.bizimKill) b.kill++; else b.death++;
    if (o.bizimKarakter) b.karakter.add(o.bizimKarakter);
    biz.set(o.bizimAile, b);

    const r = rakip.get(o.rakipAile) ?? { kill: 0, death: 0, klan: new Set<string>() };
    // Rakip açısından ters: bizim ölümümüz onun kill'i
    if (o.bizimKill) r.death++; else r.kill++;
    if (o.rakipKlan) r.klan.add(o.rakipKlan);
    rakip.set(o.rakipAile, r);

    const anahtar = `${o.bizimAile}\u0000${o.rakipAile}`;
    const i = ikili.get(anahtar) ?? { bizim: o.bizimAile, rakip: o.rakipAile, bizeOlum: 0, bizimKill: 0 };
    if (o.bizimKill) i.bizimKill++; else i.bizeOlum++;
    ikili.set(anahtar, i);
  }

  // En yoğun dakika: hangi dakikada en çok olay oldu
  const dakika = new Map<string, number>();
  for (const o of sirali) artan(dakika, new Date(o.at).toISOString().slice(0, 16));
  const yogun = Array.from(dakika.entries()).sort((a, b) => b[1] - a[1])[0];

  const kill = sirali.filter((o) => o.bizimKill).length;
  const death = sirali.length - kill;

  return {
    kill, death,
    /** Kayıttaki ilk ve son olay arası, saniye */
    sureSn: sirali.length > 1 ? Math.round((sirali[sirali.length - 1].at - sirali[0].at) / 1000) : 0,
    ilk: sirali[0] ?? null,
    son: sirali[sirali.length - 1] ?? null,
    enYogunDakika: yogun ? { dakika: yogun[0], sayi: yogun[1] } : null,
    olumSerisi: enUzunSeri(sirali, false),
    killSerisi: enUzunSeri(sirali, true),
    klanlar: Array.from(klan.values()).sort((a, b) => b.olum - a.olum || b.toplam - a.toplam),
    biz: Array.from(biz.entries())
      .map(([ad, v]) => ({ ad, kill: v.kill, death: v.death, ek: Array.from(v.karakter) }))
      .sort((a, b) => b.death - a.death || b.kill - a.kill) as OyuncuSatiri[],
    rakip: Array.from(rakip.entries())
      .map(([ad, v]) => ({ ad, kill: v.kill, death: v.death, ek: Array.from(v.klan) }))
      .sort((a, b) => b.kill - a.kill || a.ad.localeCompare(b.ad, "tr")) as OyuncuSatiri[],
    ikililer: Array.from(ikili.values())
      .sort((a, b) => b.bizeOlum - a.bizeOlum || b.bizimKill - a.bizimKill)
      .filter((i) => i.bizeOlum + i.bizimKill > 1),
  };
}

export type SavasAnalizi = ReturnType<typeof savasAnalizi>;

/** Olayların yayıldığı alan ve merkezi — oyun birimi */
export function olayYayilimi(olaylar: SavasOlayi[]) {
  if (olaylar.length === 0) return null;
  const xs = olaylar.map((o) => o.dunya[0]), zs = olaylar.map((o) => o.dunya[2]);
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length, mz = zs.reduce((s, v) => s + v, 0) / zs.length;
  // Metre: 100 oyun birimi = 1 m (karo meta.json'ındaki ölçek)
  const uzakliklar = olaylar.map((o) => Math.hypot(o.dunya[0] - mx, o.dunya[2] - mz) / 100);
  return {
    merkez: [mx, mz] as [number, number],
    ortalamaMetre: Math.round(uzakliklar.reduce((s, v) => s + v, 0) / uzakliklar.length),
    enUzakMetre: Math.round(Math.max(...uzakliklar)),
  };
}
