"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { LayoutGrid, Users, Zap, MessageSquare, Sparkles, User } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Ana Sayfa", icon: LayoutGrid },
  { href: "/members", label: "Üyeler", icon: Users },
  { href: "/etkinlikler", label: "Etkinlik", icon: Zap },
  { href: "/forum", label: "Forum", icon: MessageSquare },
  { href: "/ai-asistan", label: "AI", icon: Sparkles },
  { href: "/profile", label: "Profil", icon: User },
];

export function MobileNav() {
  const { data: session } = useSession();
  const pathname = usePathname();

  // /test kendi ekranı — site kabuğu oraya girmesin.
  // Erken dönüş hook'lardan sonra: aksi halde render'lar arasında hook
  // sırası değişir.
  if (pathname?.startsWith("/test")) return null;
  if (!session) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-bdo-bg/95 backdrop-blur-xl border-t border-bdo-border z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg transition-all"
            >
              <Icon
                className={`w-[18px] h-[18px] transition-colors ${active ? "text-bdo-gold" : "text-bdo-text-secondary"}`}
                strokeWidth={active ? 2 : 1.75}
              />
              <span className={`text-[9px] font-medium ${active ? "text-bdo-gold" : "text-bdo-text-secondary"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
