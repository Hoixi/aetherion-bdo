/**
 * Aile → karakter önbelleğini bir ev bilgisayarından doldurur.
 *
 * Site normalde bu okumayı kendi yapıyor (`/api/bdo-profil`). Sunucunun
 * adresi profil sayfası tarafından engellenirse orada boş dönüyor; aynı
 * okuma buradan yapılıp sonuç siteye yükleniyor. Yükleme yalnızca
 * yöneticiye açık.
 *
 * Kullanım:
 *   1. Savaş analizinde "N aileyi kopyala" düğmesiyle listeyi al, bir
 *      dosyaya yapıştır (her satırda bir aile adı).
 *   2. Tarayıcıda siteye girip çerezi al: DevTools → Application →
 *      Cookies → `__Secure-next-auth.session-token` (yerelde
 *      `next-auth.session-token`) değerini kopyala.
 *   3. Çalıştır:
 *
 *      AETHERI_COOKIE="__Secure-next-auth.session-token=..." \
 *      node scripts/profil-onbellek-doldur.mjs aileler.txt
 *
 *   Sadece okuyup dosyaya yazmak için (yükleme yok):
 *      node scripts/profil-onbellek-doldur.mjs aileler.txt --cikti sonuc.json
 */

import fs from "node:fs";

const TABAN = "https://blackdesert.pearlabyss.com/TR/tr-TR/Game/Profile";
const SITE = process.env.AETHERI_SITE ?? "https://aetheri.online";
/** Sayfayı yormayalım: aileler arası bekleme */
const ARA_MS = 700;
const BASLIK = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "tr-TR,tr;q=0.9,en;q=0.8",
};

const coz = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .trim();

async function getir(url, referer) {
  const r = await fetch(url, {
    headers: referer ? { ...BASLIK, referer } : BASLIK,
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

async function karakterler(aile) {
  const aramaUrl = `${TABAN}/Search?_type=2&_keyword=${encodeURIComponent(aile)}`;
  const arama = await getir(aramaUrl);
  const hedef = aile.normalize("NFC").toLocaleLowerCase("tr");
  let baglanti = null;
  const re = /<a href="(https:\/\/blackdesert\.pearlabyss\.com\/[^"]*Profile\/Adventure[^"]*)"[^>]*>([^<]+)<\/a>/g;
  for (const m of arama.matchAll(re)) {
    if (coz(m[2]).normalize("NFC").toLocaleLowerCase("tr") === hedef) { baglanti = coz(m[1]); break; }
  }
  if (!baglanti) return [];
  const sayfa = await getir(baglanti, aramaUrl);
  const out = [], gorulen = new Set();
  const kre = /classes\/class_(\d+)\/character\/character\.png[\s\S]{0,700}?class="character_name">\s*([^<\n]+?)\s*</g;
  for (const m of sayfa.matchAll(kre)) {
    const ad = coz(m[2]), k = ad.toLocaleLowerCase("tr");
    if (!ad || gorulen.has(k)) continue;
    gorulen.add(k);
    out.push({ ad, sinif: Number(m[1]) });
  }
  return out;
}

const dosya = process.argv[2];
if (!dosya) {
  console.error("kullanım: node scripts/profil-onbellek-doldur.mjs <aileler.txt> [--cikti sonuc.json]");
  process.exit(1);
}
const ciktiIdx = process.argv.indexOf("--cikti");
const cikti = ciktiIdx > 0 ? process.argv[ciktiIdx + 1] : null;

const aileler = Array.from(new Set(
  fs.readFileSync(dosya, "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
));
console.error(`${aileler.length} aile okunacak`);

const sonuc = {};
let bulunan = 0, bos = 0, hata = 0;
for (const [i, aile] of aileler.entries()) {
  try {
    const k = await karakterler(aile);
    sonuc[aile] = k;
    if (k.length) bulunan++; else bos++;
  } catch (e) {
    hata++;
    console.error(`  ${aile}: ${e.message}`);
  }
  if ((i + 1) % 10 === 0) console.error(`${i + 1}/${aileler.length} · bulunan ${bulunan} · boş ${bos} · hata ${hata}`);
  await new Promise((r) => setTimeout(r, ARA_MS));
}
console.error(`bitti · bulunan ${bulunan} · boş ${bos} · hata ${hata}`);

if (cikti) {
  fs.writeFileSync(cikti, JSON.stringify({ aileler: sonuc }, null, 1));
  console.error(`yazıldı: ${cikti}`);
}

const cerez = process.env.AETHERI_COOKIE;
if (!cerez) {
  console.error("AETHERI_COOKIE verilmedi — yükleme atlandı.");
  process.exit(0);
}
const r = await fetch(`${SITE}/api/bdo-profil`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie: cerez },
  body: JSON.stringify({ aileler: sonuc }),
});
console.error(`yükleme: HTTP ${r.status} · ${(await r.text()).slice(0, 200)}`);
