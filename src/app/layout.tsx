import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/sidebar";
import { MobileNav } from "@/components/mobile-nav";

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
  themeColor: "#0c0f15",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="icon" href="/icons/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icons/logo.png" />
      </head>
      <body className="bg-bdo-bg text-bdo-text-primary font-sans min-h-screen">
        <Providers>
          <Sidebar />
          <div className="md:ml-56 min-h-screen flex flex-col">
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 md:px-6 py-5 pb-20 md:pb-6">{children}</main>
            <footer className="hidden md:block text-center py-4 text-[11px] text-bdo-text-secondary/50 select-none">
              Made by <span className="text-bdo-gold/50">Hoixi</span> · Aetherion 2026
            </footer>
          </div>
          <MobileNav />
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js')}`,
          }}
        />
      </body>
    </html>
  );
}
