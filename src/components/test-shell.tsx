"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Swords, Users, Shield, Activity, Target, ChevronDown, BarChart3,
  Wrench, Search, ClipboardList, Map as MapIcon, Sparkles, CalendarDays,
  ListOrdered, Castle, Zap, MessageSquare, UserPlus, Flame, LayoutDashboard,
} from "lucide-react";
import "@/app/test/theme.css";
import "@/app/test/bridge.css";

/**
 * /test ekranlarının ortak kabuğu.
 *
 * Menü tek yerde duruyor; her sayfa kendi başlığını yazıp içeriğini
 * veriyor. Bütün ekranlar /test altında; eski rotalar yerinde duruyor
 * ama menü artık oraya götürmüyor.
 */

type Item = { label: string; href: string; icon: React.ElementType };

const NAV: { key: string; icon: React.ElementType; items: Item[] }[] = [
  { key: "Savaşlar", icon: Swords, items: [
    { label: "Savaş Listesi", href: "/test/savaslar", icon: Swords },
    { label: "Takvim", href: "/test/takvim", icon: CalendarDays },
    { label: "Etkinlikler", href: "/test/etkinlikler", icon: Zap },
  ] },
  { key: "İstatistik", icon: BarChart3, items: [
    { label: "Savaş Analizi", href: "/test/analiz", icon: BarChart3 },
    { label: "Hasar Raporu", href: "/test/hasar-raporu", icon: Flame },
    { label: "Tier List", href: "/test/tier-list", icon: ListOrdered },
  ] },
  { key: "Araçlar", icon: Wrench, items: [
    { label: "Kale Kurulumları", href: "/test/kaleler", icon: Castle },
    { label: "Harita", href: "/test/harita", icon: MapIcon },
    { label: "AI Asistan", href: "/test/ai-asistan", icon: Sparkles },
    { label: "Optimizer", href: "/test/optimizer", icon: Target },
    { label: "GeoGuessr", href: "/test/geo", icon: MapIcon },
  ] },
  { key: "Takip", icon: Search, items: [
    { label: "Üyeler", href: "/test/uyeler", icon: Users },
    { label: "Karakterim", href: "/test/profil", icon: Shield },
    { label: "Grind Tracker", href: "/test/grind-tracker", icon: Activity },
    { label: "Forum", href: "/test/forum", icon: MessageSquare },
  ] },
  { key: "Yönetim", icon: ClipboardList, items: [
    { label: "Admin Paneli", href: "/test/admin", icon: Shield },
    { label: "Başvurular", href: "/test/basvuru", icon: UserPlus },
    { label: "Ally", href: "/test/ally", icon: Users },
  ] },
];
export function TestShell({
  title, subtitle, tabs, aside, bare = false, children,
}: {
  title?: string;
  subtitle?: ReactNode;
  /** Başlığın üstündeki sekme şeridi */
  tabs?: ReactNode;
  /** Menü çubuğunun sağ ucu — klan rozetleri gibi */
  aside?: ReactNode;
  /**
   * Eski sayfalar kendi başlıklarını taşıyor; onları sarmalarken kabuk
   * kendi başlık bloğunu çizmesin diye.
   */
  bare?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const pathname = usePathname();

  // Menü dışına tıklayınca kapansın; hover tek dayanak kalmasın
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="t-root t-glow relative min-h-full">
      <header className="t-nav sticky top-0 z-[60]">
        <div className="mx-auto max-w-[1500px] px-5 h-[68px] flex items-center gap-6">
          <Link href="/test" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-[10px] grid place-items-center"
                 style={{ background: "linear-gradient(140deg, var(--t-gold), var(--t-ember))" }}>
              <Swords className="w-4 h-4" strokeWidth={2.4} style={{ color: "#0a0a0b" }} />
            </div>
            <div className="leading-none hidden sm:block">
              <div className="text-[15px] font-bold tracking-tight">Aetherion</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--t-faint)" }}>Klan Yönetimi</div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1" onMouseLeave={() => setOpen(null)}>
            <Link href="/test" className="t-tab" data-on={pathname === "/test"}>
              <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={2} /> Panel
            </Link>
            {NAV.map((n) => {
              const here = n.items.some((i) => i.href === pathname);
              return (
                <div key={n.key} className="relative" onClick={(e) => e.stopPropagation()}>
                  <button className="t-tab" data-on={open === n.key || here}
                          onMouseEnter={() => setOpen(n.key)}
                          onClick={() => setOpen(open === n.key ? null : n.key)}>
                    <n.icon className="w-3.5 h-3.5" strokeWidth={2} />
                    {n.key}
                    <ChevronDown className="w-3 h-3 opacity-60" strokeWidth={2.5} />
                  </button>
                  {open === n.key && (
                    <div className="t-menu">
                      {n.items.map((it) => (
                        <Link key={it.label} href={it.href} onClick={() => setOpen(null)}
                              style={pathname === it.href ? { color: "var(--t-text)" } : undefined}>
                          <it.icon className="w-3.5 h-3.5" strokeWidth={1.9} />
                          {it.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">{aside}</div>
        </div>
      </header>

      <main className={`relative mx-auto max-w-[1500px] px-5 ${bare ? "py-4" : "py-7 space-y-5"}`}>
        {tabs}
        {!bare && (
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-[30px] font-bold tracking-tight leading-none">{title}</h1>
              {subtitle && (
                <p className="text-[13px] mt-2" style={{ color: "var(--t-dim)" }}>{subtitle}</p>
              )}
            </div>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}

// ── Ortak parçalar ──────────────────────────────────────────────────────

export function Card({ children, className = "", hi = false }: {
  children: ReactNode; className?: string; hi?: boolean;
}) {
  return <div className={`t-card ${hi ? "t-card-hi" : ""} ${className}`}>{children}</div>;
}

export function Head({ icon: Icon, title, meta }: {
  icon: React.ElementType; title: string; meta?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--t-line)" }}>
      <Icon className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {meta && <span className="t-chip ml-auto">{meta}</span>}
    </div>
  );
}

export function Bar({ pct }: { pct: number }) {
  return <div className="t-bar"><i style={{ width: Math.max(2, Math.min(100, pct)) + "%" }} /></div>;
}

export type Guild = { tag: string; color: string } | null;

export function GuildTag({ g }: { g: Guild }) {
  if (!g) return null;
  return (
    <span className="text-[9px] font-bold px-1 py-px rounded flex-shrink-0"
          style={{ color: g.color, background: g.color + "18" }}>
      {g.tag}
    </span>
  );
}

/** Büyük sayıları kısaltır — tablolarda hizayı bozmasın */
export function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

/**
 * Ortak yükleyici.
 *
 * API'ler 401'de `{error:"Unauthorized"}` dönüyor; ham hâliyle ekrana
 * basmak kullanıcıya bir şey anlatmıyor, burada Türkçeye çevriliyor.
 */
export async function loadJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401) throw new Error("Bu ekranı görmek için giriş yapman gerekiyor.");
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? "Veri alınamadı.");
  }
  return res.json();
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Card className="p-10 text-center">
      <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>{children}</span>
    </Card>
  );
}
