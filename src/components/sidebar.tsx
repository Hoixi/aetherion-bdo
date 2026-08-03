"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "./notification-bell";

const navGroups = [
  {
    label: "Genel",
    items: [
      {
        href: "/dashboard", label: "Dashboard",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>,
      },
      {
        href: "/members", label: "Üyeler",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
      },
      {
        href: "/etkinlikler", label: "Etkinlikler",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      },
    ],
  },
  {
    label: "İçerik",
    items: [
      {
        href: "/forum", label: "Forum",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
      },
      {
        href: "/tier-list", label: "Tier List",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      },
      {
        href: "/hasar-raporu", label: "Hasar Raporu",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
      },
      {
        href: "/ai-asistan", label: "AI Asistan",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>,
      },
      {
        href: "/geo", label: "GeoGuessr",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      },
    ],
  },
  {
    label: "Hesap",
    items: [
      {
        href: "/profile", label: "Profil",
        icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
      },
    ],
  },
];

export function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-56 bg-bdo-bg border-r border-bdo-border z-50">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-bdo-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-bdo-gold/15 flex items-center justify-center flex-shrink-0">
            <img src="/icons/logo.png" alt="" className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-bdo-text-primary tracking-wide leading-none">AETHERION</p>
            <p className="text-[10px] text-bdo-text-secondary mt-0.5 leading-none">Guild Management</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold text-bdo-text-secondary uppercase tracking-widest px-2 mb-1">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all group ${
                      active
                        ? "bg-bdo-surface text-bdo-text-primary"
                        : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-surface/60"
                    }`}
                  >
                    <span className={`flex-shrink-0 transition-colors ${active ? "text-bdo-gold" : "text-bdo-text-secondary group-hover:text-bdo-text-muted"}`}>
                      {item.icon}
                    </span>
                    {item.label}
                    {active && <span className="ml-auto w-1 h-1 rounded-full bg-bdo-gold flex-shrink-0" />}
                  </Link>
                );
              })}
              {group.label === "Hesap" && session.user.isAdmin && (
                <Link
                  href="/admin"
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all group ${
                    pathname === "/admin"
                      ? "bg-bdo-surface text-bdo-text-primary"
                      : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-surface/60"
                  }`}
                >
                  <span className={`flex-shrink-0 transition-colors ${pathname === "/admin" ? "text-bdo-gold" : "text-bdo-text-secondary group-hover:text-bdo-text-muted"}`}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </span>
                  Admin
                  {pathname === "/admin" && <span className="ml-auto w-1 h-1 rounded-full bg-bdo-gold flex-shrink-0" />}
                </Link>
              )}
            </div>
          </div>
        ))}
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
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
