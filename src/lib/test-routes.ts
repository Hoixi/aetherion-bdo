/**
 * Eski rota → /test karşılığı.
 *
 * Taşınan ekranlar kendi içlerinde eski adreslere link veriyor (bir savaşa
 * tıklayınca `/wars/12`). Sayfaların içine dokunmadan bunları /test altında
 * tutmak için kabuk tıklamaları yakalayıp buradan çeviriyor.
 *
 * Sıra önemli: `/tier-list` ile `/tier-list/yeni` gibi durumlarda önek
 * eşleşmesi yaptığımız için uzun olan önce denenmeli.
 */
const MAP: [string, string][] = [
  ["/wars", "/test/savaslar"],
  ["/members", "/test/uyeler"],
  ["/calendar", "/test/takvim"],
  ["/profile", "/test/profil/duzenle"],
  ["/dashboard", "/test"],
  ["/analiz", "/test/analiz"],
  ["/hasar-raporu", "/test/hasar-raporu"],
  ["/tier-list", "/test/tier-list"],
  ["/etkinlikler", "/test/etkinlikler"],
  ["/harita", "/test/harita"],
  ["/ai-asistan", "/test/ai-asistan"],
  ["/optimizer", "/test/optimizer"],
  ["/geo", "/test/geo"],
  ["/grind-tracker", "/test/grind-tracker"],
  ["/forum", "/test/forum"],
  ["/admin", "/test/admin"],
  ["/basvuru", "/test/basvuru"],
  ["/ally", "/test/ally"],
  ["/patch-notes", "/test/patch-notes"],
];

/**
 * Verilen yolun /test karşılığını döner; taşınmamışsa null.
 * Zaten /test altındaysa dokunmaz.
 */
export function toTestRoute(pathname: string): string | null {
  if (pathname.startsWith("/test")) return null;
  for (const [from, to] of MAP) {
    if (pathname === from) return to;
    if (pathname.startsWith(from + "/")) return to + pathname.slice(from.length);
  }
  return null;
}
