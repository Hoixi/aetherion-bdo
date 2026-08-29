"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Swords, Castle, Users, Gauge, ArrowRight, ExternalLink, Skull, BarChart3, Sparkles,
} from "lucide-react";
import { fmt } from "@/components/app-shell";

/**
 * Karşılama ekranı.
 *
 * Giriş yapmamış ziyaretçi için: klanın ne olduğunu anlatıyor ve iki yola
 * çıkarıyor — üyeyse Discord ile giriş, değilse başvuru. Sayılar
 * `/api/landing`den geliyor ve oturumsuz; yalnızca toplamlar var, kimse
 * adıyla görünmüyor.
 */

type Landing = {
  memberCount: number;
  averageGs: number;
  wars: {
    window: number; counted: number;
    totalDamage: number; totalCastleDamage: number; totalKills: number;
  };
  discordInvite: string;
  slogan: string;
  manifesto: string;
  wallpaperBlur: number;
};

/** Ayar gelene kadar ekran sloganısız kalmasın — panelden değiştirilebiliyor. */
const VARSAYILAN_SLOGAN = "En iyi bildiğin yol en iyi bildiğin yoldur";
const VARSAYILAN_MANIFESTO =
  "Aetherion bir PvP klanıdır. Her gün node war atmaya çalışırız; girdiğimiz her " +
  "savaşın raporunu tutar, herkesin katkısını tek tek ölçeriz. Burada kim ne yaptıysa görünür.";

/** Panelin sunduklari — klan kimliginden ayri dursun diye kendi bolumunde. */
const OZELLIKLER = [
  { icon: Swords, label: "Savaş yönetimi" },
  { icon: Users, label: "Üye takibi" },
  { icon: BarChart3, label: "Hasar raporları" },
  { icon: Sparkles, label: "AI asistan" },
] as const;

const DISCORD_PATH =
  "M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [d, setD] = useState<Landing | null>(null);
  const [duvar, setDuvar] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.push("/panel");
  }, [session, router]);

  useEffect(() => {
    fetch("/api/landing")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && !j.error && setD(j))
      .catch(() => {});
  }, []);

  // Duvar kâğıdı: her açılışta biri. Klasör boşsa düz zemin kalıyor.
  useEffect(() => {
    fetch("/api/wallpapers")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const f: string[] = j?.files ?? [];
        if (f.length) setDuvar(f[Math.floor(Math.random() * f.length)]);
      })
      .catch(() => {});
  }, []);

  if (status === "loading" || session) {
    return <div className="fixed inset-0" style={{ background: "var(--t-canvas)" }} />;
  }

  const pencere = d?.wars.window ?? 5;

  return (
    <main className="relative min-h-screen overflow-x-hidden">
      {/* Duvar kâğıdı: bulanık ve karartılmış — yazı her karede okunsun.
          scale, blur'un kenarlarda saydamlaşmasını gizliyor. */}
      {duvar && (
        <div className="fixed inset-0 pointer-events-none" aria-hidden
             style={{
               backgroundImage: `url("${duvar}")`,
               backgroundSize: "cover",
               backgroundPosition: "center",
               filter: `blur(${d?.wallpaperBlur ?? 6}px) saturate(1.06)`,
               transform: "scale(1.12)",
               opacity: 0.6,
             }} />
      )}
      {duvar && (
        <div className="fixed inset-0 pointer-events-none" aria-hidden
             style={{
               background:
                 "linear-gradient(180deg, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.74) 50%, rgba(0,0,0,0.88) 100%)",
             }} />
      )}

      <div className="absolute inset-0 pointer-events-none" aria-hidden
           style={{ background: "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(232,180,81,0.10), transparent 70%)" }} />

      <div className="relative mx-auto w-full max-w-[880px] px-6 py-14 sm:py-20">
        {/* Kimlik */}
        <header className="text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center"
               style={{ background: "var(--t-surface)", border: "1px solid var(--t-line-strong)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.png" alt="" className="w-8 h-8" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tight">AETHERION</h1>

          <p className="mt-3 text-[15px] sm:text-[16px] font-medium" style={{ color: "var(--t-gold)" }}>
            {d?.slogan || VARSAYILAN_SLOGAN}
          </p>

          <p className="mt-4 mx-auto max-w-[560px] text-[13.5px] leading-relaxed whitespace-pre-line"
             style={{ color: "var(--t-dim)" }}>
            {d?.manifesto || VARSAYILAN_MANIFESTO}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Rozet icon={Swords} metin="PvP odaklı" />
            <Rozet icon={Castle} metin="Her gün node war" />
            <Rozet icon={Skull} metin="Haftalık boss" />
            <Rozet icon={Gauge} metin="Performans ölçümü" />
          </div>
        </header>

        {/* Sayılar */}
        <section className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Kutu icon={Users} etiket="Üye" deger={d ? String(d.memberCount) : null} />
          <Kutu icon={Gauge} etiket="Ortalama GS" deger={d ? String(d.averageGs) : null} />
          <Kutu icon={Swords} etiket="Toplam hasar"
                deger={d ? fmt(d.wars.totalDamage) : null} alt={`son ${pencere} savaş`} />
          <Kutu icon={Castle} etiket="Kale hasarı"
                deger={d ? fmt(d.wars.totalCastleDamage) : null} alt={`son ${pencere} savaş`} />
        </section>

        {d && d.wars.counted > 0 && d.wars.counted < pencere && (
          <p className="mt-2 text-center text-[11px]" style={{ color: "var(--t-faint)" }}>
            Raporu girilmiş {d.wars.counted} savaş üzerinden.
          </p>
        )}

        {/* Yollar */}
        <section className="mt-10 grid sm:grid-cols-2 gap-3">
          {/* Başvuru öne çıkan */}
          <Link href="/basvuru"
                className="group relative rounded-[var(--t-r)] p-5 flex flex-col justify-between overflow-hidden transition-transform hover:-translate-y-0.5"
                style={{ background: "linear-gradient(160deg, rgba(232,180,81,0.14), rgba(232,180,81,0.04))",
                         border: "1px solid rgba(232,180,81,0.42)" }}>
            <div>
              <h2 className="text-[16px] font-bold" style={{ color: "var(--t-gold)" }}>
                Klana katıl
              </h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--t-dim)" }}>
                Başvuru formu birkaç dakika sürer. Klanda değilsen buradan başla.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold"
                  style={{ color: "var(--t-gold)" }}>
              Başvuru yap
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.2} />
            </span>
          </Link>

          {/* Üye girişi */}
          <div className="rounded-[var(--t-r)] p-5 flex flex-col justify-between"
               style={{ background: "var(--t-surface)", border: "1px solid var(--t-line-strong)" }}>
            <div>
              <h2 className="text-[16px] font-bold">Zaten üyeyim</h2>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: "var(--t-dim)" }}>
                Giriş için Aetherion Discord sunucusunda üye olman gerekir.
              </p>
            </div>
            <button onClick={() => signIn("discord", { callbackUrl: "/panel" })}
                    className="mt-4 w-full flex items-center justify-center gap-2.5 font-semibold px-5 py-2.5 rounded-xl text-[13.5px] transition-colors"
                    style={{ background: "var(--t-gold)", color: "#000" }}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d={DISCORD_PATH} />
              </svg>
              Discord ile Giriş
            </button>
          </div>
        </section>

        {/* Discord daveti */}
        {d?.discordInvite ? (
          <section className="mt-3 rounded-[var(--t-r)] px-5 py-4 flex flex-wrap items-center gap-3"
                   style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"
                 style={{ color: "#5865F2" }} aria-hidden>
              <path d={DISCORD_PATH} />
            </svg>
            <p className="text-[12.5px] flex-1 min-w-[220px]" style={{ color: "var(--t-dim)" }}>
              Başvurmadan önce ya da sonra sunucumuza uğra — sorularını orada sorabilirsin.
            </p>
            <a href={d.discordInvite} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12.5px] font-semibold"
               style={{ background: "#5865F2", color: "#fff" }}>
              Discord&apos;a katıl
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.2} />
            </a>
          </section>
        ) : null}

        {/* Panelde neler var */}
        <section className="mt-10">
          <h2 className="text-center text-[11px] uppercase tracking-[0.09em] mb-3"
              style={{ color: "var(--t-faint)" }}>
            Üyeler için panelde
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {OZELLIKLER.map(({ icon: Icon, label }) => (
              <div key={label}
                   className="flex items-center gap-2 px-3 py-2.5 rounded-[var(--t-r-sm)]"
                   style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
                <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.9}
                      style={{ color: "var(--t-gold)" }} />
                <span className="text-[11.5px] truncate" style={{ color: "var(--t-dim)" }}>{label}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-center text-[11px]" style={{ color: "var(--t-faint)" }}>
          Black Desert Online · Aetherion klan paneli
        </p>
      </div>
    </main>
  );
}

function Rozet({ icon: Icon, metin }: { icon: React.ElementType; metin: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px]"
          style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                   color: "var(--t-dim)" }}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
      {metin}
    </span>
  );
}

function Kutu({ icon: Icon, etiket, deger, alt }: {
  icon: React.ElementType; etiket: string; deger: string | null; alt?: string;
}) {
  return (
    <div className="group relative rounded-[var(--t-r)] px-4 py-4 overflow-hidden transition-colors"
         style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
      {/* üst kenarda altın çizgi */}
      <span className="absolute inset-x-0 top-0 h-px pointer-events-none" aria-hidden
            style={{ background: "linear-gradient(90deg, transparent, rgba(232,180,81,.55), transparent)" }} />
      {/* köşede sıcak parıltı */}
      <span className="absolute -top-10 -left-8 w-32 h-24 pointer-events-none" aria-hidden
            style={{ background: "radial-gradient(closest-side, rgba(232,180,81,.15), transparent)" }} />

      <div className="relative flex items-center gap-2">
        <span className="w-6 h-6 rounded-md grid place-items-center flex-shrink-0"
              style={{ background: "rgba(232,180,81,.10)", border: "1px solid rgba(232,180,81,.22)" }}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
        </span>
        <span className="text-[11px] truncate" style={{ color: "var(--t-faint)" }}>{etiket}</span>
      </div>

      <div className="relative mt-2.5 t-num text-[26px] font-bold leading-none">
        {deger
          ? <span className="t-stat-num">{deger}</span>
          : <span className="inline-block w-14 h-[20px] rounded animate-pulse"
                  style={{ background: "var(--t-raised)" }} />}
      </div>

      {alt && (
        <div className="relative mt-1.5 text-[10.5px]" style={{ color: "var(--t-faint)" }}>{alt}</div>
      )}
    </div>
  );
}
