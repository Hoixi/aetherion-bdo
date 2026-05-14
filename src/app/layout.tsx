import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";
import { MobileNav } from "@/components/mobile-nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Aetherion",
  description: "Aetherion Guild Management",
  manifest: "/manifest.json",
  themeColor: "#d4a853",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Aetherion",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body className="bg-bdo-bg text-bdo-text-primary font-sans min-h-screen">
        <Providers>
          <Navbar />
          <main className="max-w-7xl mx-auto px-4 py-4 pb-20 md:pb-6">{children}</main>
          <MobileNav />
          <footer className="hidden md:block text-center py-4 text-xs text-bdo-text-muted/50 select-none">
            Made by <span className="text-bdo-gold/70">Hoixi</span> with <span className="text-red-400">♥</span> &nbsp;·&nbsp; v1.0.0
          </footer>
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
