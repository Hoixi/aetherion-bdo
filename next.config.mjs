/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com" },
      { protocol: "https", hostname: "static.pearlcdn.com" },
    ],
    // Portreler yıllardır değişmiyor — optimize edilmiş hallerini uzun süre sakla
    minimumCacheTTL: 60 * 60 * 24 * 365,
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    // Eski tasarımın adresleri yeni ekranlara taşınıyor. Discord'a
    // gönderilmiş mesajlarda hâlâ `/wars/12` gibi linkler duruyor; onlar
    // çalışmaya devam etsin diye siliniyor değil, yönlendiriliyor.
    // Kalıcı değil (307): geri dönmek gerekirse tarayıcılar önbelleğe
    // almış olmasın. Karşılıklar `src/lib/test-routes.ts` ile aynı.
    const tasinan = [
      ["/dashboard", "/test"],
      ["/wars", "/test/savaslar"],
      ["/members", "/test/uyeler"],
      ["/calendar", "/test/takvim"],
      ["/profile", "/test/profil/duzenle"],
      ["/admin", "/test/admin"],
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
      ["/basvuru", "/test/basvuru"],
      ["/ally", "/test/ally"],
      ["/patch-notes", "/test/patch-notes"],
    ];

    return [
      ...tasinan.flatMap(([from, to]) => [
        { source: from, destination: to, permanent: false },
        { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: false },
      ]),
      {
        // Tek kanonik adres: www → apex. Oturum cookie'si her ikisinde de
        // geçerli ama linklerin tek adrese düşmesi karışıklığı önler.
        source: "/:path*",
        has: [{ type: "host", value: "www.aetheri.online" }],
        destination: "https://aetheri.online/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // Class portreleri ve ikonları içerik olarak sabit; tarayıcı bir daha sormasın
        source: "/:dir(portrait|icons)/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
