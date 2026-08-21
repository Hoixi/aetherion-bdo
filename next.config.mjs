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
    // İki kuşak eski adres var ve ikisi de Discord'a gönderilmiş
    // mesajların içinde duruyor:
    //   1) ilk tasarımın İngilizce yolları (/wars/12, /members/5)
    //   2) siyah temanın geçici /test öneki
    // Sayfalar silindi, adresler yaşıyor. Kalıcı değil (307) — geri
    // dönmek gerekirse tarayıcılar 301'i önbelleğe almış olmasın.
    const eskiIngilizce = [
      ["/dashboard", "/panel"],
      ["/wars", "/savaslar"],
      ["/members", "/uyeler"],
      ["/calendar", "/takvim"],
      ["/profile", "/profil/duzenle"],
    ];

    return [
      ...eskiIngilizce.flatMap(([from, to]) => [
        { source: from, destination: to, permanent: false },
        { source: `${from}/:path*`, destination: `${to}/:path*`, permanent: false },
      ]),
      // /test öneki tek kuralla düşüyor; alt yolların adı zaten aynı
      { source: "/test", destination: "/panel", permanent: false },
      { source: "/test/:path*", destination: "/:path*", permanent: false },
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
