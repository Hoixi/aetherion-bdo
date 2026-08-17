"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "./notification-bell";
import {
  LayoutGrid, Users, Zap, MessageSquare, ListOrdered, BarChart3,
  Sparkles, Globe2, User, Settings, LogOut, Swords, Handshake, CalendarDays, MapPin, LineChart } from "lucide-react";

const navGroups = [
  {
    label: "Genel",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/wars", label: "Savaşlar", icon: Swords },
      { href: "/members", label: "Üyeler", icon: Users },
      { href: "/hasar-raporu", label: "Hasar Raporu", icon: BarChart3 },
      { href: "/analiz", label: "Savaş Analizi", icon: LineChart },
      { href: "/etkinlikler", label: "Etkinlikler", icon: Zap },
      { href: "/calendar", label: "Takvim", icon: CalendarDays },
      { href: "/ally", label: "Ally", icon: Handshake },
    ],
  },
  {
    label: "İçerik",
    items: [
      { href: "/forum", label: "Forum", icon: MessageSquare },
      { href: "/tier-list", label: "Tier List", icon: ListOrdered },
      { href: "/ai-asistan", label: "AI Asistan", icon: Sparkles },
      { href: "/harita", label: "Harita", icon: MapPin },
      { href: "/geo", label: "GeoGuessr", icon: Globe2 },
    ],
  },
];

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  const linkCls = (active: boolean) =>
    `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all group ${
      active
        ? "bg-bdo-surface text-bdo-text-primary"
        : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-surface/60"
    }`;

  const iconCls = (active: boolean) =>
    `w-4 h-4 flex-shrink-0 transition-colors ${
      active ? "text-bdo-gold" : "text-bdo-text-secondary group-hover:text-bdo-text-muted"
    }`;

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-56 bg-bdo-bg border-r border-bdo-border z-50">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-bdo-border flex-shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-lg bg-bdo-gold/15 flex items-center justify-center flex-shrink-0 group-hover:bg-bdo-gold/25 transition-colors">
            <img src="/icons/logo.png" alt="" className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-bdo-text-primary tracking-wide leading-none">AETHERION</p>
            <p className="text-[10px] text-bdo-text-secondary mt-0.5 leading-none">Guild Management</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-bdo-text-secondary uppercase tracking-widest px-2 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href} className={linkCls(active)}>
                    <Icon className={iconCls(active)} strokeWidth={1.75} />
                    {label}
                    {active && <span className="ml-auto w-1 h-1 rounded-full bg-bdo-gold flex-shrink-0" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <p className="text-[10px] font-semibold text-bdo-text-secondary uppercase tracking-widest px-2 mb-1">
            Hesap
          </p>
          <div className="space-y-0.5">
            <Link href="/profile" className={linkCls(pathname === "/profile")}>
              <User className={iconCls(pathname === "/profile")} strokeWidth={1.75} />
              Profil
              {pathname === "/profile" && <span className="ml-auto w-1 h-1 rounded-full bg-bdo-gold flex-shrink-0" />}
            </Link>
            {(session.user.isAdmin || session.user.isGuildAdmin) && (
              <Link href="/admin" className={linkCls(pathname === "/admin")}>
                <Settings className={iconCls(pathname === "/admin")} strokeWidth={1.75} />
                {session.user.isAdmin ? "Admin" : "Klan Yönetimi"}
                {pathname === "/admin" && <span className="ml-auto w-1 h-1 rounded-full bg-bdo-gold flex-shrink-0" />}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-bdo-border p-3 flex-shrink-0">
        <div className="flex items-center gap-2.5 px-1 mb-2">
          {session.user.image
            ? <img src={session.user.image} className="w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-bdo-border" alt="" />
            : <div className="w-7 h-7 rounded-full bg-bdo-surface flex-shrink-0 ring-1 ring-bdo-border" />
          }
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium text-bdo-text-primary truncate leading-tight">
              {session.user.familyName || session.user.name}
            </p>
            <p className="text-[10px] text-bdo-text-secondary leading-tight">{session.user.role || "Üye"}</p>
          </div>
          <NotificationBell />
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-bdo-text-secondary hover:text-red-400 hover:bg-red-400/8 transition-all"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
