/**
 * Savaş günlüğü — olayların ayrıştırılması ve özeti.
 *
 * İki kaynak var, ikisi de aynı olay listesine iniyor:
 *  1. Masaüstü uygulamasının canlı kaydı (uygulama olayları hazır gönderir)
 *  2. Elle yüklenen ikusa `.log` dosyası — satır biçimi:
 *       [08:01:03] Killer has killed Victim from GUILD (Aile,Karakter)
 *       [08:01:07] Victim died to Killer from GUILD
 *     "died to" satırında yön ters: ölen başta.
 *
 * Kaynak araç yönü bazen ters işaretliyor (kendi belgelerinde de yazıyor);
 * bu yüzden özet hem "bizim öldürmelerimiz" hem "bize gelen ölümler" için
 * aile adı eşleşmesine bakıyor, satırın yönüne körü körüne güvenmiyoruz.
 */

export interface GunlukOlay {
  /** Gün içi saat (HH:MM:SS) — dosyada tarih yok */
  t: string;
  killer: string;
  victim: string;
  guild?: string | null;
}

const SATIR = /^\[(\d{1,2}:\d{2}:\d{2})\]\s+(.+?)\s+(has killed|died to)\s+(.+?)(?:\s+from\s+(.+?))?\s*(?:\(([^)]*)\))?\s*$/;
/** Oyunun iç dizge anahtarları (WoR'da isim yerine bunlar çıkıyor) */
const COP = /^(LUA_|ROOM_|UI_|TEXT_)/;
const AD_OK = /^[A-Za-zÇĞİÖŞÜçğıöşü0-9_-]{2,24}$/;

/** `.log` metnini olaylara çevirir; okunamayan satırlar sayılır, atılır. */
export function gunlukAyristir(metin: string): { olaylar: GunlukOlay[]; atilan: number } {
  const olaylar: GunlukOlay[] = [];
  let atilan = 0;
  for (const ham of metin.split(/\r?\n/)) {
    const satir = ham.trim();
    if (!satir) continue;
    const m = SATIR.exec(satir);
    if (!m) { atilan++; continue; }
    const [, t, sol, yon, sag, klan] = m;
    const killer = (yon === "has killed" ? sol : sag).trim();
    const victim = (yon === "has killed" ? sag : sol).trim();
    if (!AD_OK.test(killer) || !AD_OK.test(victim) || COP.test(killer) || COP.test(victim)) { atilan++; continue; }
    olaylar.push({ t, killer, victim, guild: klan && !COP.test(klan) ? klan.trim().slice(0, 60) : null });
  }
  return { olaylar, atilan };
}

/** "08:01:03" + referans gün → gerçek zaman; gece yarısını aşan savaşta gün artar */
export function zamanla(olaylar: GunlukOlay[], baslangic: Date): Date[] {
  const out: Date[] = [];
  let gun = 0, oncekiSn = -1;
  for (const o of olaylar) {
    const [h, d, s] = o.t.split(":").map(Number);
    const sn = h * 3600 + d * 60 + s;
    if (oncekiSn >= 0 && sn + 60 < oncekiSn) gun++; // saat geriye sardıysa ertesi gün
    oncekiSn = sn;
    const t = new Date(baslangic);
    t.setHours(h, d, s, 0);
    t.setDate(t.getDate() + gun);
    out.push(t);
  }
  return out;
}

export interface OyuncuSatiri { ad: string; kill: number; death: number; bizden: boolean }

/**
 * Kişi başı özet. `bizimkiler` aile adları kümesi (küçük harf); bu kümedeki
 * adlar "bizden" sayılıp öne alınıyor.
 */
export function ozet(olaylar: Array<{ killer: string; victim: string }>, bizimkiler: Set<string>) {
  const say = new Map<string, OyuncuSatiri>();
  const al = (ad: string) => {
    const k = ad.toLocaleLowerCase("tr");
    const v = say.get(k) ?? { ad, kill: 0, death: 0, bizden: bizimkiler.has(k) };
    say.set(k, v);
    return v;
  };
  for (const o of olaylar) { al(o.killer).kill++; al(o.victim).death++; }
  const liste = Array.from(say.values());
  const biz = liste.filter((x) => x.bizden).sort((a, b) => b.kill - a.kill || a.death - b.death);
  const digerleri = liste.filter((x) => !x.bizden).sort((a, b) => b.kill - a.kill || a.ad.localeCompare(b.ad, "tr"));
  const toplamKill = biz.reduce((n, x) => n + x.kill, 0);
  const toplamDeath = biz.reduce((n, x) => n + x.death, 0);
  return { biz, digerleri, toplamKill, toplamDeath };
}

/** Dakikalık kill/death eğrisi — grafiğe hazır */
export function zamanCizgisi(olaylar: Array<{ at: Date | string; killerBizden: boolean }>) {
  const kova = new Map<number, { dk: number; kill: number; death: number }>();
  const zamanlar = olaylar.map((o) => new Date(o.at).getTime());
  const ilk = Math.min(...zamanlar);
  olaylar.forEach((o, i) => {
    const dk = Math.floor((zamanlar[i] - ilk) / 60_000);
    const v = kova.get(dk) ?? { dk, kill: 0, death: 0 };
    if (o.killerBizden) v.kill++; else v.death++;
    kova.set(dk, v);
  });
  return Array.from(kova.values()).sort((a, b) => a.dk - b.dk);
}
