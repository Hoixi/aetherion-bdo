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

/* ------------------------------------------------------------------ *
 *  Grafikler için türetilmiş seriler
 * ------------------------------------------------------------------ */

export interface ZamanKovasi {
  /** Kovanın başlangıcı (ms) */
  t: number;
  kill: number;
  death: number;
  /** Kova sonuna kadarki kümülatif fark (kill − death) */
  fark: number;
}

/**
 * Olayları eşit aralıklı kovalara böler — boş dakikalar da var, çünkü
 * savaşın sustuğu yer de bilgi. Kova genişliği kayıt uzunluğuna göre
 * seçiliyor: 30 kovadan fazla çubuk dar ekranda okunmuyor.
 */
export function zamanKovalari(olaylar: SavasOlayi[], hedefKova = 30): { kovalar: ZamanKovasi[]; kovaSn: number } {
  if (olaylar.length === 0) return { kovalar: [], kovaSn: 60 };
  const t = olaylar.map((o) => o.at);
  const ilk = Math.min(...t), son = Math.max(...t);
  const adaylar = [15, 30, 60, 120, 300, 600];
  const gerek = Math.max(1, (son - ilk) / 1000 / hedefKova);
  const kovaSn = adaylar.find((s) => s >= gerek) ?? 900;
  const genis = kovaSn * 1000;
  const bas = Math.floor(ilk / genis) * genis;
  const sayi = Math.max(1, Math.floor((son - bas) / genis) + 1);
  const kovalar: ZamanKovasi[] = Array.from({ length: sayi }, (_, i) => ({
    t: bas + i * genis, kill: 0, death: 0, fark: 0,
  }));
  for (const o of olaylar) {
    const k = kovalar[Math.min(sayi - 1, Math.floor((o.at - bas) / genis))];
    if (o.bizimKill) k.kill++; else k.death++;
  }
  let toplam = 0;
  for (const k of kovalar) { toplam += k.kill - k.death; k.fark = toplam; }
  return { kovalar, kovaSn };
}

export interface SinifSatiri {
  sinif: number;
  /** Bu sınıftan aldığımız kill */
  kill: number;
  /** Bu sınıfa verdiğimiz ölüm */
  olum: number;
  toplam: number;
  /** Kayıtta bu sınıftan kaç ayrı aile göründü */
  kisi: number;
}

/** karakter adı → sınıf eşlemesi, küçük harf anahtarla */
export type SinifHaritasi = Record<string, number>;

/** Rakip olayların sınıfa göre dağılımı */
export function sinifDagilimi(olaylar: SavasOlayi[], siniflar: SinifHaritasi) {
  const m = new Map<number, { kill: number; olum: number; aile: Set<string> }>();
  let bilinmeyen = 0;
  for (const o of olaylar) {
    const s = siniflar[o.rakipKarakter.toLocaleLowerCase("tr")];
    if (s == null) { bilinmeyen++; continue; }
    const v = m.get(s) ?? { kill: 0, olum: 0, aile: new Set<string>() };
    if (o.bizimKill) v.kill++; else v.olum++;
    v.aile.add(o.rakipAile);
    m.set(s, v);
  }
  const satirlar: SinifSatiri[] = Array.from(m.entries())
    .map(([sinif, v]) => ({ sinif, kill: v.kill, olum: v.olum, toplam: v.kill + v.olum, kisi: v.aile.size }))
    .sort((a, b) => b.olum - a.olum || b.toplam - a.toplam);
  return { satirlar, bilinmeyen, bilinen: olaylar.length - bilinmeyen };
}

/**
 * Klan × sınıf: hangi klanın kadrosunda hangi sınıftan kaç kişi göründü.
 *
 * Hücre olayı değil *kişiyi* sayıyor — bir klanda iki cadı varsa hücre 2,
 * o cadılar bizi kırk kere öldürmüş olsa bile. Kadro kompozisyonu sorusunun
 * cevabı bu; kaç kere öldürdükleri ayrı kartta.
 */
export function klanSinifMatrisi(olaylar: SavasOlayi[], siniflar: SinifHaritasi, enFazlaKlan = 8) {
  /** klan → sınıf → aileler */
  const klan = new Map<string, Map<number, Set<string>>>();
  const klanToplam = new Map<string, Set<string>>();
  const sinifToplam = new Map<number, number>();
  for (const o of olaylar) {
    const s = siniflar[o.rakipKarakter.toLocaleLowerCase("tr")];
    if (s == null || !o.rakipAile) continue;
    const ad = o.rakipKlan || "—";
    const h = klan.get(ad) ?? new Map<number, Set<string>>();
    const set = h.get(s) ?? new Set<string>();
    set.add(o.rakipAile);
    h.set(s, set); klan.set(ad, h);
    const hepsi = klanToplam.get(ad) ?? new Set<string>();
    hepsi.add(o.rakipAile);
    klanToplam.set(ad, hepsi);
  }
  for (const h of Array.from(klan.values())) {
    for (const [s, set] of Array.from(h.entries())) sinifToplam.set(s, (sinifToplam.get(s) ?? 0) + set.size);
  }
  const satirlar = Array.from(klan.entries())
    .map(([ad, h]) => ({
      ad,
      kisi: klanToplam.get(ad)?.size ?? 0,
      hucre: new Map(Array.from(h.entries()).map(([s, set]) => [s, set.size])),
    }))
    .sort((a, b) => b.kisi - a.kisi)
    .slice(0, enFazlaKlan);
  // Sütunlar: yalnızca kalan klanlarda gerçekten görülen sınıflar, çoktan aza
  const gorulen = new Set<number>();
  for (const r of satirlar) for (const s of Array.from(r.hucre.keys())) gorulen.add(s);
  const sutunlar = Array.from(gorulen)
    .sort((a, b) => (sinifToplam.get(b) ?? 0) - (sinifToplam.get(a) ?? 0));
  const enBuyuk = Math.max(1, ...satirlar.flatMap((r) => Array.from(r.hucre.values())));
  return { satirlar, sutunlar, enBuyuk };
}

export interface KarakterSatiri {
  ad: string;
  aile: string;
  klan: string;
  /** Sınıf bilinmiyorsa null */
  sinif: number | null;
  /** Bizi öldürdüğü sayı */
  bizeOlum: number;
  /** Bizim onu öldürdüğümüz sayı */
  bizimKill: number;
  toplam: number;
}

/**
 * Karakter dağılımı — aile değil, o ailenin savaşta gördüğümüz karakteri.
 *
 * Bir aile savaş içinde karakter değiştirebiliyor (ölen karakterle geri
 * gelmek yerine ikinci sınıfına geçen çok); aile bazında bakınca bu
 * kayboluyor, burada ayrı satır oluyor.
 */
export function karakterDagilimi(olaylar: SavasOlayi[], siniflar: SinifHaritasi): KarakterSatiri[] {
  const m = new Map<string, KarakterSatiri>();
  for (const o of olaylar) {
    if (!o.rakipKarakter) continue;
    const anahtar = o.rakipKarakter.toLocaleLowerCase("tr");
    const r = m.get(anahtar) ?? {
      ad: o.rakipKarakter, aile: o.rakipAile, klan: o.rakipKlan,
      sinif: siniflar[anahtar] ?? null, bizeOlum: 0, bizimKill: 0, toplam: 0,
    };
    if (o.bizimKill) r.bizimKill++; else r.bizeOlum++;
    r.toplam++;
    if (r.sinif == null) r.sinif = siniflar[anahtar] ?? null;
    m.set(anahtar, r);
  }
  return Array.from(m.values()).sort((a, b) => b.bizeOlum - a.bizeOlum || b.toplam - a.toplam);
}

/**
 * Ailelerin kadrosu: profilden okunan bütün karakterler, savaşta görülen
 * karakterle birlikte. "Bu aile hangi sınıfları oynuyor" sorusu — savaşta
 * cadıyı gördüysek de adamın asıl karakteri başka olabilir.
 */
export function aileKadrosu(
  olaylar: SavasOlayi[],
  kadro: Record<string, Array<{ ad: string; sinif: number }>>,
) {
  const gorulen = new Map<string, Set<string>>();
  const sayac = new Map<string, { bizeOlum: number; bizimKill: number }>();
  for (const o of olaylar) {
    if (!o.rakipAile) continue;
    const g = gorulen.get(o.rakipAile) ?? new Set<string>();
    if (o.rakipKarakter) g.add(o.rakipKarakter.toLocaleLowerCase("tr"));
    gorulen.set(o.rakipAile, g);
    const s = sayac.get(o.rakipAile) ?? { bizeOlum: 0, bizimKill: 0 };
    if (o.bizimKill) s.bizimKill++; else s.bizeOlum++;
    sayac.set(o.rakipAile, s);
  }
  return Array.from(gorulen.entries())
    .map(([aile, g]) => {
      const hepsi = kadro[aile.toLocaleLowerCase("tr")] ?? [];
      return {
        aile,
        ...(sayac.get(aile) ?? { bizeOlum: 0, bizimKill: 0 }),
        /** Profilde kayıtlı bütün karakterler */
        karakterler: hepsi,
        /** Savaşta gerçekten gördüklerimiz */
        gorulen: hepsi.filter((k) => g.has(k.ad.toLocaleLowerCase("tr"))),
      };
    })
    .sort((a, b) => b.bizeOlum - a.bizeOlum || b.bizimKill - a.bizimKill);
}

/**
 * Sınıf eşleşmeleri: bizim sınıfımız × karşı sınıf, kaç ölüm / kaç kill.
 *
 * "Hangi sınıfımız hangi sınıfa yem oluyor" sorusu. Satır bizim sınıf,
 * sütun karşı sınıf; iki tarafın da sınıfı bilinen olaylar sayılıyor, o
 * yüzden toplamı genel toplamdan küçük olabiliyor.
 */
export function sinifEslesmeleri(
  olaylar: SavasOlayi[],
  rakipSinif: SinifHaritasi,
  bizimSinif: SinifHaritasi,
  enFazlaSatir = 10,
) {
  /** bizim sınıf → karşı sınıf → ölüm */
  const olum = new Map<number, Map<number, number>>();
  const satirToplam = new Map<number, number>();
  const sutunToplam = new Map<number, number>();
  let sayilan = 0;
  for (const o of olaylar) {
    if (o.bizimKill) continue;                       // burada yalnız ölümlerimiz
    const biz = bizimSinif[o.bizimAile.toLocaleLowerCase("tr")];
    const rakip = rakipSinif[o.rakipKarakter.toLocaleLowerCase("tr")];
    if (biz == null || rakip == null) continue;
    const h = olum.get(biz) ?? new Map<number, number>();
    h.set(rakip, (h.get(rakip) ?? 0) + 1);
    olum.set(biz, h);
    satirToplam.set(biz, (satirToplam.get(biz) ?? 0) + 1);
    sutunToplam.set(rakip, (sutunToplam.get(rakip) ?? 0) + 1);
    sayilan++;
  }
  const satirlar = Array.from(olum.entries())
    .map(([sinif, h]) => ({ sinif, toplam: satirToplam.get(sinif) ?? 0, hucre: h }))
    .sort((a, b) => b.toplam - a.toplam)
    .slice(0, enFazlaSatir);
  const gorulen = new Set<number>();
  for (const r of satirlar) for (const s of Array.from(r.hucre.keys())) gorulen.add(s);
  const sutunlar = Array.from(gorulen).sort((a, b) => (sutunToplam.get(b) ?? 0) - (sutunToplam.get(a) ?? 0));
  const enBuyuk = Math.max(1, ...satirlar.flatMap((r) => Array.from(r.hucre.values())));
  return { satirlar, sutunlar, enBuyuk, sayilan };
}
