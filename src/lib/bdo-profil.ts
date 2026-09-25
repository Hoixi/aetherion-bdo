/**
 * Oyunun resmî maceracı profilinden karakter listesi.
 *
 * Kill akışı bize rakibin hem aile hem karakter adını veriyor ama sınıfını
 * vermiyor. Pearl Abyss'in herkese açık profil sayfasında aile adıyla arama
 * yapılıp karakterlerin sınıfı okunabiliyor — sınıf, karakter resminin
 * adresindeki `class_<id>` ile geliyor ve bu numara bizim `classType`
 * değerlerimizle birebir aynı.
 *
 * İki sayfa: arama sonucu (aile → profil bağlantısı) ve profil (karakterler).
 * Sonuç veritabanında saklanıyor; aynı aile için tekrar tekrar istek
 * atılmıyor. Kayıt eskidiğinde yenileniyor, bulunamayan aile de "yok" diye
 * saklanıyor ki her açılışta yeniden denenmesin.
 */

const TABAN = "https://blackdesert.pearlabyss.com/TR/tr-TR/Game/Profile";
const ZAMAN_ASIMI = 9000;
/**
 * Sunucudan giden istek tarayıcı gibi görünsün: varsayılan Node başlığıyla
 * giden istekler sayfanın önündeki korumaya takılabiliyor. Sayfa herkese
 * açık, yaptığımız iş tarayıcıda yapılanın aynısı.
 */
const TARAYICI = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
};

export type ProfilKarakteri = { ad: string; sinif: number };

/** `&#x131;` / `&#305;` / `&amp;` gibi kaçışları çöz */
function cozHtml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .trim();
}

async function getir(url: string, referer?: string): Promise<string> {
  const iptal = AbortSignal.timeout(ZAMAN_ASIMI);
  const r = await fetch(url, {
    signal: iptal,
    redirect: "follow",
    headers: referer ? { ...TARAYICI, referer } : TARAYICI,
  });
  if (!r.ok) throw new Error(`Profil sayfası ${r.status}`);
  return r.text();
}

/** Arama sonucundan tam eşleşen ailenin profil bağlantısı */
function profilBaglantisi(html: string, aile: string): string | null {
  const hedef = aile.normalize("NFC").toLocaleLowerCase("tr");
  const re = /<a href="(https:\/\/blackdesert\.pearlabyss\.com\/[^"]*Profile\/Adventure[^"]*)"[^>]*>([^<]+)<\/a>/g;
  for (const m of Array.from(html.matchAll(re))) {
    if (cozHtml(m[2]).normalize("NFC").toLocaleLowerCase("tr") === hedef) return cozHtml(m[1]);
  }
  return null;
}

/** Profil sayfasındaki karakterler: sınıf ikonu + hemen ardından gelen ad */
function karakterleriOku(html: string): ProfilKarakteri[] {
  const re = /classes\/class_(\d+)\/character\/character\.png[\s\S]{0,700}?class="character_name">\s*([^<\n]+?)\s*</g;
  const out: ProfilKarakteri[] = [];
  const gorulen = new Set<string>();
  for (const m of Array.from(html.matchAll(re))) {
    const ad = cozHtml(m[2]);
    const anahtar = ad.toLocaleLowerCase("tr");
    if (!ad || gorulen.has(anahtar)) continue;
    gorulen.add(anahtar);
    out.push({ ad, sinif: Number(m[1]) });
  }
  return out;
}

/**
 * Bir ailenin karakterleri. Bulunamazsa boş dizi döner — aile gizli
 * olabilir, adı değişmiş olabilir ya da başka bölgede olabilir.
 */
export async function aileKarakterleri(aile: string): Promise<ProfilKarakteri[]> {
  const aramaUrl = `${TABAN}/Search?_type=2&_keyword=${encodeURIComponent(aile)}`;
  const arama = await getir(aramaUrl);
  const baglanti = profilBaglantisi(arama, aile);
  if (!baglanti) return [];
  const sayfa = await getir(baglanti, aramaUrl);
  // Profil kapalıysa sayfa yerine "mevcut değil" diyen bir yönlendirme geliyor
  if (sayfa.length < 400 && sayfa.includes("location.href")) return [];
  return karakterleriOku(sayfa);
}
