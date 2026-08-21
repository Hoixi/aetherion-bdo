import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "./theme.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aetherion",
  description: "Aetherion Klan Yönetimi",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aetherion",
  },
  openGraph: {
    title: "Aetherion",
    description: "Aetherion Klan Yönetimi",
    images: [{ url: "/icons/logo.png", width: 512, height: 512 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Uygulama kabuğu.
 *
 * Menü artık burada değil: her ekran `TestShell` ile kendi üst çubuğunu
 * kuruyor. Eskiden burada sabit bir kenar menüsü ve ona yer açan
 * `md:ml-56` payı vardı; yeni tasarım tam genişlik istediği için o pay
 * kalktı.
 *
 * `t-root` gövdede duruyor ki palet ve zemin giriş ekranı dahil her yerde
 * geçerli olsun. Kaydırma da gövdede — içeride sabit bir kaydırma
 * kapsayıcısı olsaydı tarayıcının konum hatırlaması ve mobilde adres
 * çubuğunun toplanması bozulurdu.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="icon" href="/icons/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/logo.png" />
      </head>
      <body className="t-root font-sans min-h-screen">
        <Providers>{children}</Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
      </body>
    </html>
  );
}
