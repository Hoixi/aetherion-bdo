"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown, Shield, Settings, LogOut, User } from "lucide-react";

/**
 * Menü çubuğunun sağ ucundaki hesap düğmesi.
 *
 * Discord avatarı ve aile adı görünüyor; tıklayınca kendi ekranlarına
 * kısayollar ve çıkış açılıyor. Oturum yoksa giriş bağlantısı çıkıyor —
 * /test oturumsuz da geziliyor.
 */
export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  if (status === "loading") {
    return <div className="w-8 h-8 rounded-full" style={{ background: "var(--t-raised)" }} />;
  }

  if (!session) {
    return <Link href="/" className="t-tab">Giriş yap</Link>;
  }

  const name = session.user.familyName || session.user.name || "Hesap";
  const role = session.user.role || (session.user.isAdmin ? "Yönetici" : "Üye");
  const canAdmin = session.user.isAdmin || session.user.isGuildAdmin;

  return (
    <div ref={boxRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full transition-colors"
              style={{ background: open ? "var(--t-raised)" : "transparent" }}>
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.user.image} alt="" className="w-7 h-7 rounded-full flex-shrink-0"
               style={{ outline: "1px solid var(--t-line-strong)" }} />
        ) : (
          <span className="w-7 h-7 rounded-full grid place-items-center flex-shrink-0"
                style={{ background: "var(--t-raised)" }}>
            <User className="w-3.5 h-3.5" style={{ color: "var(--t-faint)" }} />
          </span>
        )}
        <span className="text-[12.5px] font-medium hidden sm:block max-w-[130px] truncate">
          {name}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60 hidden sm:block" strokeWidth={2.5} />
      </button>

      {open && (
        <div className="t-menu right-0 left-auto" style={{ minWidth: 210 }}>
          <div className="px-2.5 py-2 mb-1" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <div className="text-[13px] font-semibold truncate">{name}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>{role}</div>
          </div>

          <Link href="/profil" onClick={() => setOpen(false)}>
            <Shield className="w-3.5 h-3.5" strokeWidth={1.9} /> Karakterim
          </Link>
          <Link href="/profil/duzenle" onClick={() => setOpen(false)}>
            <Settings className="w-3.5 h-3.5" strokeWidth={1.9} /> Profili düzenle
          </Link>
          {canAdmin && (
            <Link href="/admin" onClick={() => setOpen(false)}>
              <Settings className="w-3.5 h-3.5" strokeWidth={1.9} />
              {session.user.isAdmin ? "Admin paneli" : "Klan yönetimi"}
            </Link>
          )}

          <button onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 w-full px-2.5 py-2 mt-1 rounded-[var(--t-r-sm)]
                             text-[12.5px] transition-colors"
                  style={{ color: "var(--t-bad)", borderTop: "1px solid var(--t-line)" }}>
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.9} /> Çıkış yap
          </button>
        </div>
      )}
    </div>
  );
}
