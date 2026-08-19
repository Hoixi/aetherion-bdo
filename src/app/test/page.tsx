"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Swords, Users, Trophy, Flame, Shield,
  Activity, Crown, Target, ChevronRight, ChevronDown, BarChart3,
  Wrench, Search, ClipboardList, Map as MapIcon, Sparkles, CalendarDays,
  ListOrdered, Castle, Zap, MessageSquare, UserPlus,
} from "lucide-react";
import { getClassByID, getClassIconUrl, getPortraitUrl, getTypeName } from "@/lib/classes";
import "./theme.css";

/** Üst menü — her başlık kendi alt sayfalarını açar */
const NAV = [
  { key: "Savaşlar", icon: Swords, items: [
    { label: "Savaş Listesi", href: "/wars", icon: Swords },
    { label: "Takvim", href: "/calendar", icon: CalendarDays },
    { label: "Etkinlikler", href: "/etkinlikler", icon: Zap },
  ] },
  { key: "İstatistik", icon: BarChart3, items: [
    { label: "Savaş Analizi", href: "/analiz", icon: BarChart3 },
    { label: "Hasar Raporu", href: "/hasar-raporu", icon: Flame },
    { label: "Tier List", href: "/tier-list", icon: ListOrdered },
  ] },
  { key: "Araçlar", icon: Wrench, items: [
    { label: "Harita", href: "/harita", icon: MapIcon },
    { label: "AI Asistan", href: "/ai-asistan", icon: Sparkles },
    { label: "Optimizer", href: "/optimizer", icon: Target },
    { label: "GeoGuessr", href: "/geo", icon: MapIcon },
  ] },
  { key: "Takip", icon: Search, items: [
    { label: "Üyeler", href: "/members", icon: Users },
    { label: "Grind Tracker", href: "/grind-tracker", icon: Activity },
    { label: "Forum", href: "/forum", icon: MessageSquare },
  ] },
  { key: "Yönetim", icon: ClipboardList, items: [
    { label: "Admin Paneli", href: "/admin", icon: Shield },
    { label: "Başvurular", href: "/basvuru", icon: UserPlus },
    { label: "Ally", href: "/ally", icon: Users },
  ] },
] as const;

const TABS = ["Genel", "Karakterler", "Performans", "Savaşlar"] as const;
type Tab = (typeof TABS)[number];

type Guild = { tag: string; color: string } | null;

type Data = {
  totals: {
    members: number; geared: number; avgGs: number; wins: number; losses: number;
    damage: number; castle: number; kills: number; deaths: number; warsCounted: number;
  };
  guildBreakdown: { tag: string; color: string; n: number }[];
  classes: { class: string; n: number }[];
  playedClasses: { class: string; n: number }[];
  topGear: { id: number; name: string; class: string; spec: string; ap: number; dp: number; gs: number; avatarUrl: string | null; guild: Guild }[];
  players: {
    name: string; class: string; spec: string; avatarUrl: string | null; guild: Guild;
    wars: number; kills: number; deaths: number; damage: number; castle: number; cc: number;
    avgDamage: number; kd: number;
  }[];
  wars: { id: number; title: string; type: string; date: string; result: string | null;
          _count: { participants: number; performances: number } }[];
  trend: { id: number; title: string; date: string; participants: number; reported: number }[];
};

function fmt(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

function Card({ children, className = "", hi = false }: { children: React.ReactNode; className?: string; hi?: boolean }) {
  return <div className={`t-card ${hi ? "t-card-hi" : ""} ${className}`}>{children}</div>;
}

function Head({ icon: Icon, title, meta }: { icon: React.ElementType; title: string; meta?: string }) {
  return (
    <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--t-line)" }}>
      <Icon className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {meta && <span className="t-chip ml-auto">{meta}</span>}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return <div className="t-bar"><i style={{ width: Math.max(2, Math.min(100, pct)) + "%" }} /></div>;
}

function GuildTag({ g }: { g: Guild }) {
  if (!g) return null;
  return (
    <span className="text-[9px] font-bold px-1 py-px rounded flex-shrink-0"
          style={{ color: g.color, background: g.color + "18" }}>
      {g.tag}
    </span>
  );
}

export default function TestPage() {
  const [tab, setTab] = useState<Tab>("Genel");
  const [open, setOpen] = useState<string | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/test/overview")
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({})))))
      .then(setD)
      .catch((e) => setErr(e?.error ?? "Veri alınamadı — giriş yapmış olman gerekiyor."));
  }, []);

  const maxDamage = useMemo(() => d?.players[0]?.damage ?? 1, [d]);
  const maxTrend = useMemo(
    () => Math.max(1, ...(d?.trend ?? []).map((t) => t.participants)),
    [d],
  );

  return (
    <div className="t-root t-glow relative min-h-full">
      {/* Üst menü */}
      <header className="t-nav sticky top-0 z-50">
        <div className="mx-auto max-w-[1400px] px-5 h-[68px] flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] grid place-items-center"
                 style={{ background: "linear-gradient(140deg, var(--t-gold), var(--t-ember))" }}>
              <Swords className="w-4 h-4" strokeWidth={2.4} style={{ color: "#0a0a0b" }} />
            </div>
            <div className="leading-none">
              <div className="text-[15px] font-bold tracking-tight">Aetherion</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--t-faint)" }}>Klan Yönetimi</div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 ml-2" onMouseLeave={() => setOpen(null)}>
            {NAV.map((n) => (
              <div key={n.key} className="relative">
                <button className="t-tab" data-on={open === n.key}
                        onMouseEnter={() => setOpen(n.key)}
                        onClick={() => setOpen(open === n.key ? null : n.key)}>
                  <n.icon className="w-3.5 h-3.5" strokeWidth={2} />
                  {n.key}
                  <ChevronDown className="w-3 h-3 opacity-60" strokeWidth={2.5} />
                </button>
                {open === n.key && (
                  <div className="t-menu">
                    {n.items.map((it) => (
                      <Link key={it.label} href={it.href} onClick={() => setOpen(null)}>
                        <it.icon className="w-3.5 h-3.5" strokeWidth={1.9} />
                        {it.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {d && d.guildBreakdown.map((g) => (
              <span key={g.tag} className="t-chip hidden sm:inline"
                    style={{ color: g.color, borderColor: g.color + "40" }}>
                {g.tag} {g.n}
              </span>
            ))}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-5 py-7 space-y-5">
        <div className="flex items-center gap-1 flex-wrap">
          {TABS.map((t) => (
            <button key={t} className="t-tab" data-on={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>

        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[30px] font-bold tracking-tight leading-none">{tab}</h1>
            <p className="text-[13px] mt-2" style={{ color: "var(--t-dim)" }}>
              {d ? `İki klanın birleşik görünümü · son ${d.totals.warsCounted} savaş` : "Yükleniyor…"}
            </p>
          </div>
          <Link href="/dashboard" className="text-[12px] flex items-center gap-1 hover:opacity-80"
                style={{ color: "var(--t-gold)" }}>
            Mevcut siteye dön <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
        {!d && !err && <Card className="p-8 text-center"><span className="text-[13px]" style={{ color: "var(--t-dim)" }}>Veriler geliyor…</span></Card>}

        {d && (
          <>
            {/* KPI — her sekmede görünür, bağlam kaybolmasın */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { label: "Üye", value: String(d.totals.members), hint: `${d.totals.geared} gear girmiş`, icon: Users },
                { label: "Ortalama GS", value: String(d.totals.avgGs), hint: "AP + DP", icon: Shield },
                { label: "Galibiyet", value: `${d.totals.wins}`, hint: `${d.totals.losses} mağlubiyet`, icon: Trophy },
                { label: "Toplam Hasar", value: fmt(d.totals.damage), hint: `son ${d.totals.warsCounted} savaş`, icon: Flame },
                { label: "Kale Hasarı", value: fmt(d.totals.castle), hint: `${d.totals.kills} kill`, icon: Castle },
              ].map((k) => (
                <Card key={k.label} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <k.icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                    <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>{k.label}</span>
                  </div>
                  <div className="t-num text-[25px] font-bold leading-none">{k.value}</div>
                  <div className="text-[11px] mt-1.5" style={{ color: "var(--t-faint)" }}>{k.hint}</div>
                </Card>
              ))}
            </div>

            {/* ── GENEL */}
            {tab === "Genel" && (
              <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5">
                <Card className="overflow-hidden">
                  <Head icon={Crown} title="Hasar Sıralaması" meta={`SON ${d.totals.warsCounted} SAVAŞ`} />
                  {d.players.slice(0, 10).map((p, i) => {
                    const icon = getClassIconUrl(p.class);
                    return (
                      <div key={p.name + i} className="t-row px-5 py-3 flex items-center gap-3">
                        <span className="t-num text-[13px] font-bold w-5"
                              style={{ color: i === 0 ? "var(--t-gold)" : "var(--t-faint)" }}>{i + 1}</span>
                        {icon
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={icon} alt="" className="w-5 h-5 opacity-70 flex-shrink-0" />
                          : <span className="w-5 flex-shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium truncate">{p.name}</span>
                            <GuildTag g={p.guild} />
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                            {getClassByID(p.class)?.name ?? "—"} · {p.wars} savaş
                          </div>
                        </div>
                        <div className="w-24 text-right">
                          <div className="t-num text-[13px]" style={{ color: "var(--t-gold)" }}>{fmt(p.damage)}</div>
                          <div className="mt-1"><Bar pct={(p.damage / maxDamage) * 100} /></div>
                        </div>
                        <div className="w-16 text-right hidden sm:block">
                          <div className="t-num text-[12px]">{p.kills}/{p.deaths}</div>
                          <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>K/Ö</div>
                        </div>
                      </div>
                    );
                  })}
                </Card>

                <div className="space-y-5">
                  <Card className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                      <h2 className="text-[14px] font-semibold">Savaşta Oynanan Class</h2>
                    </div>
                    <div className="space-y-2.5">
                      {d.playedClasses.map((c) => {
                        const max = d.playedClasses[0]?.n || 1;
                        return (
                          <div key={c.class}>
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-[12px]">{getClassByID(c.class)?.name ?? c.class}</span>
                              <span className="t-num text-[12px]" style={{ color: "var(--t-dim)" }}>{c.n}</span>
                            </div>
                            <Bar pct={(c.n / max) * 100} />
                          </div>
                        );
                      })}
                    </div>
                  </Card>

                  <Card hi className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                      <h2 className="text-[14px] font-semibold">Katılım Eğrisi</h2>
                    </div>
                    <div className="flex items-end gap-1.5 h-24">
                      {d.trend.map((t, i) => (
                        <div key={t.id} className="flex-1 rounded-t-[3px] relative group"
                             title={`${t.title} — ${t.participants} katılım`}
                             style={{
                               height: Math.max(6, (t.participants / maxTrend) * 100) + "%",
                               background: i === d.trend.length - 1
                                 ? "linear-gradient(180deg, var(--t-gold), var(--t-ember))"
                                 : "rgba(255,255,255,.09)",
                             }} />
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] mt-2" style={{ color: "var(--t-faint)" }}>
                      <span>eski</span><span>son savaş</span>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ── KARAKTERLER */}
            {tab === "Karakterler" && (
              <div className="grid lg:grid-cols-[1fr_1fr] gap-5">
                <Card className="overflow-hidden">
                  <Head icon={Shield} title="En Yüksek Gear" meta="AP + DP" />
                  {d.topGear.map((m, i) => {
                    const portrait = getPortraitUrl(m.class, m.spec);
                    return (
                      <div key={m.id} className="t-row px-5 py-3 flex items-center gap-3">
                        <span className="t-num text-[13px] font-bold w-5"
                              style={{ color: i === 0 ? "var(--t-gold)" : "var(--t-faint)" }}>{i + 1}</span>
                        <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0"
                             style={{ background: "var(--t-raised)" }}>
                          {portrait && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={portrait} alt="" className="w-full h-full object-cover object-top" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-medium truncate">{m.name}</span>
                            <GuildTag g={m.guild} />
                          </div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                            {getClassByID(m.class)?.name ?? "—"}
                            {m.spec ? ` · ${m.spec === "succession" ? "Succ" : "Awak"}` : ""}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="t-num text-[14px] font-bold" style={{ color: "var(--t-gold)" }}>{m.gs}</div>
                          <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>{m.ap} / {m.dp}</div>
                        </div>
                      </div>
                    );
                  })}
                </Card>

                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                    <h2 className="text-[14px] font-semibold">Klan Class Dağılımı</h2>
                    <span className="t-chip ml-auto">PROFİLE GÖRE</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                    {d.classes.slice(0, 16).map((c) => {
                      const max = d.classes[0]?.n || 1;
                      const icon = getClassIconUrl(c.class);
                      return (
                        <div key={c.class}>
                          <div className="flex items-center gap-1.5 mb-1">
                            {icon && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={icon} alt="" className="w-3.5 h-3.5 opacity-60" />
                            )}
                            <span className="text-[12px] truncate flex-1">{getClassByID(c.class)?.name ?? c.class}</span>
                            <span className="t-num text-[11px]" style={{ color: "var(--t-dim)" }}>{c.n}</span>
                          </div>
                          <Bar pct={(c.n / max) * 100} />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            )}

            {/* ── PERFORMANS */}
            {tab === "Performans" && (
              <Card className="overflow-hidden">
                <Head icon={BarChart3} title="Oyuncu Performansı" meta={`SON ${d.totals.warsCounted} SAVAŞ`} />
                <div className="overflow-x-auto">
                  <div className="min-w-[760px]">
                    <div className="px-5 py-2.5 grid grid-cols-[26px_1fr_70px_70px_66px_78px_60px] gap-3
                                    text-[10px] uppercase tracking-[0.07em]"
                         style={{ color: "var(--t-faint)", borderBottom: "1px solid var(--t-line)" }}>
                      <span>#</span><span>Oyuncu</span><span>Hasar</span><span>Ort/Savaş</span>
                      <span>Kill</span><span>Kale</span><span className="text-right">K/Ö</span>
                    </div>
                    {d.players.map((p, i) => (
                      <div key={p.name + i}
                           className="t-row px-5 py-2.5 grid grid-cols-[26px_1fr_70px_70px_66px_78px_60px] gap-3 items-center">
                        <span className="t-num text-[12px] font-bold"
                              style={{ color: i < 3 ? "var(--t-gold)" : "var(--t-faint)" }}>{i + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12.5px] truncate">{p.name}</span>
                            <GuildTag g={p.guild} />
                          </div>
                          <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                            {getClassByID(p.class)?.name ?? "—"} · {p.wars} savaş
                          </div>
                        </div>
                        <span className="t-num text-[12px]" style={{ color: "var(--t-gold)" }}>{fmt(p.damage)}</span>
                        <span className="t-num text-[12px]" style={{ color: "var(--t-dim)" }}>{fmt(p.avgDamage)}</span>
                        <span className="t-num text-[12px]">{p.kills}</span>
                        <span className="t-num text-[12px]" style={{ color: "var(--t-ember)" }}>{fmt(p.castle)}</span>
                        <span className="t-num text-[12px] text-right"
                              style={{ color: p.kd >= 1 ? "var(--t-good)" : "var(--t-bad)" }}>{p.kd}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {/* ── SAVAŞLAR */}
            {tab === "Savaşlar" && (
              <Card className="overflow-hidden">
                <Head icon={Swords} title="Savaş Geçmişi" meta={`${d.wars.length} KAYIT`} />
                {d.wars.map((w) => {
                  const win = w.result === "WIN";
                  const loss = w.result === "LOSS";
                  return (
                    <Link key={w.id} href={`/wars/${w.id}`}
                          className="t-row px-5 py-3.5 flex items-center gap-4 flex-wrap">
                      <div className="w-1 h-9 rounded-full flex-shrink-0"
                           style={{ background: win ? "var(--t-good)" : loss ? "var(--t-bad)" : "var(--t-faint)" }} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium truncate">{w.title}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                          {getTypeName(w.type)} · {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                        </div>
                      </div>
                      {w.result && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-md"
                              style={{
                                color: win ? "var(--t-good)" : "var(--t-bad)",
                                background: win ? "rgba(56,208,127,.10)" : "rgba(239,95,95,.10)",
                              }}>
                          {win ? "GALİBİYET" : "MAĞLUBİYET"}
                        </span>
                      )}
                      <div className="text-right w-16">
                        <div className="t-num text-[13px]">{w._count.participants}</div>
                        <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>katılım</div>
                      </div>
                      <div className="text-right w-16">
                        <div className="t-num text-[13px]"
                             style={{ color: w._count.performances ? "var(--t-gold)" : "var(--t-faint)" }}>
                          {w._count.performances}
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>rapor</div>
                      </div>
                      <ChevronRight className="w-4 h-4" style={{ color: "var(--t-faint)" }} />
                    </Link>
                  );
                })}
              </Card>
            )}
          </>
        )}

        <p className="text-[11px] pb-6" style={{ color: "var(--t-faint)" }}>
          Yeni tema denemesi · veriler canlı
        </p>
      </main>
    </div>
  );
}
