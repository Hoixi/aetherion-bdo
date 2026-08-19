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

/**
 * /test ekranlarının ortak kabuğu.
 *
 * Menü tek yerde duruyor; her sayfa kendi başlığını yazıp içeriğini
 * veriyor. `old` işaretli bağlantılar hâlâ eski tasarıma gidiyor —
 * hangilerinin taşındığı menüde görünsün diye.
 */

type Item = { label: string; href: string; icon: React.ElementType; old?: boolean };

const NAV: { key: string; icon: React.ElementType; items: Item[] }[] = [
  { key: "Savaşlar", icon: Swords, items: [
    { label: "Savaş Listesi", href: "/test/savaslar", icon: Swords },
    { label: "Takvim", href: "/calendar", icon: CalendarDays, old: true },
    { label: "Etkinlikler", href: "/etkinlikler", icon: Zap, old: true },
  ] },
  { key: "İstatistik", icon: BarChart3, items: [
    { label: "Savaş Analizi", href: "/analiz", icon: BarChart3, old: true },
    { label: "Hasar Raporu", href: "/hasar-raporu", icon: Flame, old: true },
    { label: "Tier List", href: "/tier-list", icon: ListOrdered, old: true },
  ] },
  { key: "Araçlar", icon: Wrench, items: [
    { label: "Kale Kurulumları", href: "/test/kaleler", icon: Castle },
    { label: "Harita", href: "/harita", icon: MapIcon, old: true },
    { label: "AI Asistan", href: "/ai-asistan", icon: Sparkles, old: true },
    { label: "Optimizer", href: "/optimizer", icon: Target, old: true },
    { label: "GeoGuessr", href: "/geo", icon: MapIcon, old: true },
  ] },
  { key: "Takip", icon: Search, items: [
    { label: "Üyeler", href: "/test/uyeler", icon: Users },
    { label: "Karakterim", href: "/test/profil", icon: Shield },
    { label: "Grind Tracker", href: "/grind-tracker", icon: Activity, old: true },
    { label: "Forum", href: "/forum", icon: MessageSquare, old: true },
  ] },
  { key: "Yönetim", icon: ClipboardList, items: [
    { label: "Admin Paneli", href: "/admin", icon: Shield, old: true },
    { label: "Başvurular", href: "/basvuru", icon: UserPlus, old: true },
    { label: "Ally", href: "/ally", icon: Users, old: true },
  ] },
];

export function TestShell({
  title, subtitle, tabs, aside, children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Başlığın üstündeki sekme şeridi */
  tabs?: ReactNode;
  /** Menü çubuğunun sağ ucu — klan rozetleri gibi */
  aside?: ReactNode;
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
                          {it.old && (
                            <span className="ml-auto text-[9px] uppercase tracking-[0.08em]"
                                  style={{ color: "var(--t-faint)" }}>eski</span>
                          )}
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

      <main className="relative mx-auto max-w-[1500px] px-5 py-7 space-y-5">
        {tabs}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[30px] font-bold tracking-tight leading-none">{title}</h1>
            {subtitle && (
              <p className="text-[13px] mt-2" style={{ color: "var(--t-dim)" }}>{subtitle}</p>
            )}
          </div>
        </div>
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
