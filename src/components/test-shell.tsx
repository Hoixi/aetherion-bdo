"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Swords, Users, Shield, Activity, Target, ChevronDown, BarChart3,
  Wrench, Search, ClipboardList, Map as MapIcon, Sparkles, CalendarDays,
  ListOrdered, Castle, Zap, MessageSquare, UserPlus, Flame, LayoutDashboard,
  Menu, X, ScrollText, CalendarClock,
} from "lucide-react";
import { toTestRoute } from "@/lib/test-routes";
import { UserMenu } from "@/components/test-user-menu";
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
    { label: "Savaş Yönetimi", href: "/test/savaslar/yonetim", icon: CalendarClock },
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
    { label: "Yama Notları", href: "/test/patch-notes", icon: ScrollText },
  ] },
  { key: "Yönetim", icon: ClipboardList, items: [
    { label: "Admin Paneli", href: "/test/admin", icon: Shield },
    { label: "Başvurular", href: "/test/basvuru", icon: UserPlus },
    { label: "Müttefikler", href: "/test/ally", icon: Users },
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
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Menü dışına tıklayınca kapansın; hover tek dayanak kalmasın
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  // Gidilen yer değişince çekmece açık kalmasın
  useEffect(() => { setDrawer(false); }, [pathname]);

  /**
   * Taşınan ekranlar içeride hâlâ eski adreslere link veriyor; bir savaşa
   * tıklayınca temadan düşülüyordu. Sayfaların içine dokunmak yerine
   * tıklamayı burada yakalayıp /test karşılığına çeviriyoruz.
   */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Yeni sekmede açma, orta tık, değiştirici tuşlar bize ait değil
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (!href || a.target === "_blank" || a.hasAttribute("download")) return;

      let url: URL;
      try { url = new URL(href, window.location.origin); }
      catch { return; }
      if (url.origin !== window.location.origin) return;

      const mapped = toTestRoute(url.pathname);
      if (!mapped) return;

      e.preventDefault();
      router.push(mapped + url.search + url.hash);
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

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

          {/* Menü lg altında gizli; telefonda tek gezinme yolu bu */}
          <button className="t-tab lg:hidden" onClick={(e) => { e.stopPropagation(); setDrawer((v) => !v); }}
                  aria-label="Menü">
            {drawer ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

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

          <div className="ml-auto flex items-center gap-2">
            {aside}
            <UserMenu />
          </div>
        </div>

        {drawer && (
          <div className="lg:hidden max-h-[70vh] overflow-y-auto px-4 pb-4"
               style={{ borderTop: "1px solid var(--t-line)", background: "var(--t-shell)" }}
               onClick={(e) => e.stopPropagation()}>
            <Link href="/test" className="t-tab w-full !justify-start mt-3"
                  data-on={pathname === "/test"} onClick={() => setDrawer(false)}>
              <LayoutDashboard className="w-3.5 h-3.5" strokeWidth={2} /> Panel
            </Link>
            {NAV.map((n) => (
              <div key={n.key} className="mt-4">
                <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] uppercase tracking-[0.08em]"
                     style={{ color: "var(--t-faint)" }}>
                  <n.icon className="w-3 h-3" strokeWidth={2} /> {n.key}
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {n.items.map((it) => (
                    <Link key={it.label} href={it.href} onClick={() => setDrawer(false)}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-[var(--t-r-sm)] text-[12.5px]"
                          style={{
                            background: pathname === it.href ? "var(--t-raised)" : "transparent",
                            color: pathname === it.href ? "var(--t-text)" : "var(--t-dim)",
                          }}>
                      <it.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.9} />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
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
