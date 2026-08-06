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
