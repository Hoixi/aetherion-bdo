"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Users, Swords, BarChart3, Sparkles } from "lucide-react";

const FEATURES = [
  { icon: Swords, label: "Savaş yönetimi" },
  { icon: Users, label: "Üye takibi" },
  { icon: BarChart3, label: "Hasar raporları" },
  { icon: Sparkles, label: "AI asistan" },
];

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  if (status === "loading" || session) {
    return <div className="fixed inset-0 bg-bdo-bg" />;
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bdo-bg z-50 px-6">
      {/* subtle radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(212,160,48,0.05), transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-bdo-surface border border-bdo-border flex items-center justify-center mx-auto mb-5">
          <img src="/icons/logo.png" alt="" className="w-9 h-9" />
        </div>

        <h1 className="text-3xl font-black italic text-bdo-text-primary tracking-tight">AETHERION</h1>
        <p className="text-[13px] text-bdo-text-secondary mt-1.5 mb-8">
          Guild management for Black Desert Online
        </p>

        <button
          onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-2.5 bg-bdo-gold text-bdo-bg font-semibold px-6 py-3 rounded-xl hover:bg-bdo-gold-dim transition-colors text-[14px]"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z" />
          </svg>
          Discord ile Giriş
        </button>

        <div className="grid grid-cols-2 gap-2 mt-8">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-left px-3 py-2.5 rounded-lg bg-bdo-surface/60 border border-bdo-border">
              <Icon className="w-3.5 h-3.5 text-bdo-gold/60 flex-shrink-0" strokeWidth={1.75} />
              <span className="text-[11px] text-bdo-text-muted">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-bdo-text-secondary mt-8">
          Klanda değil misin?{" "}
          <Link href="/basvuru" className="text-bdo-gold hover:underline font-medium">
            Başvuru yap
          </Link>
        </p>
        <p className="text-[10px] text-bdo-text-secondary/60 mt-2">
          Giriş için Aetherion Discord sunucusunda üye olman gerekir.
        </p>
      </div>
    </div>
  );
}
