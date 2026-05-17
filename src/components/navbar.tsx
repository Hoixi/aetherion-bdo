"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { NotificationBell } from "./notification-bell";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/members", label: "Üyeler" },
  { href: "/etkinlikler", label: "Etkinlikler" },
  { href: "/forum", label: "Forum" },
  { href: "/calendar", label: "Takvim" },
  { href: "/hasar-raporu", label: "Hasar Raporu" },
  { href: "/patch-notes", label: "Yama Notları" },
  { href: "/profile", label: "Profil" },
];

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) return null;

  return (
    <nav className="border-b border-bdo-border bg-gradient-to-r from-bdo-gradient-start to-bdo-gradient-end sticky top-0 z-50 backdrop-blur-lg bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-bdo-gold font-bold text-lg">
            ⚔ AETHERION
          </Link>
          {/* Desktop nav links */}
          <div className="hidden md:flex gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors ${
                  pathname === link.href
                    ? "text-bdo-gold"
                    : "text-bdo-text-muted hover:text-bdo-text-primary"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {session.user.isAdmin && (
              <Link
                href="/admin"
                className={`text-sm transition-colors ${
                  pathname === "/admin"
                    ? "text-bdo-gold"
                    : "text-bdo-text-muted hover:text-bdo-text-primary"
                }`}
              >
                Admin
              </Link>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          {/* Admin link for mobile */}
          {session.user.isAdmin && (
            <Link
              href="/admin"
              className={`md:hidden text-xs px-2 py-1 rounded transition-colors ${
                pathname === "/admin"
                  ? "bg-bdo-gold text-bdo-bg"
                  : "text-bdo-text-muted hover:text-bdo-gold"
              }`}
            >
              Admin
            </Link>
          )}
          <span className="hidden sm:inline text-sm text-bdo-text-muted">{session.user.familyName || session.user.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-bdo-text-muted hover:text-red-400 transition-colors"
          >
            <span className="hidden sm:inline">Çıkış</span>
            <svg className="sm:hidden w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
