"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Swords, Users, Trophy, Flame, Shield, ArrowUpRight, ArrowDownRight,
  Activity, Crown, Target, ChevronRight,
} from "lucide-react";
import "./theme.css";

/* Tema denemesi — veriler temsili, amaç görünümü değerlendirmek */

const TABS = ["Genel", "Karakterler", "Performans", "Savaşlar"] as const;
type Tab = (typeof TABS)[number];

const KPI = [
  { label: "Aktif Üye", value: "87", delta: +6, icon: Users, hint: "son 30 gün" },
  { label: "Kazanılan Savaş", value: "24", delta: +3, icon: Trophy, hint: "18 mağlubiyet" },
  { label: "Ortalama GS", value: "742", delta: +11, icon: Shield, hint: "AP+DP" },
  { label: "Toplam Hasar", value: "1.24B", delta: -4, icon: Flame, hint: "son 5 savaş" },
];

const TOP = [
  { name: "Xiuu", cls: "Maehwa", guild: "AETHR", score: 78.4, dmg: "227K", kd: "10 / 22", bar: 92 },
  { name: "Drakanıa", cls: "Drakania", guild: "AETHR", score: 74.1, dmg: "198K", kd: "9 / 14", bar: 86 },
  { name: "Molloy", cls: "Maehwa", guild: "GOLD", score: 71.9, dmg: "151K", kd: "7 / 20", bar: 79 },
  { name: "Nogayhan", cls: "Archer", guild: "AETHR", score: 68.2, dmg: "176K", kd: "11 / 18", bar: 74 },
  { name: "Solvina", cls: "Sage", guild: "AETHR", score: 65.7, dmg: "141K", kd: "6 / 12", bar: 68 },
];

const CLASSES = [
  { name: "Maehwa", n: 11, pct: 100 },
  { name: "Drakania", n: 9, pct: 82 },
  { name: "Sage", n: 8, pct: 73 },
  { name: "Archer", n: 6, pct: 55 },
  { name: "Nova", n: 5, pct: 45 },
  { name: "Musa", n: 4, pct: 36 },
];

const WARS = [
  { title: "Kale Kuşatması — Valencia", date: "18 Ağu", result: "GALİBİYET", n: 58, dmg: "412M" },
  { title: "Node War — Calpheon", date: "16 Ağu", result: "GALİBİYET", n: 44, dmg: "287M" },
  { title: "Node War — Mediah", date: "14 Ağu", result: "MAĞLUBİYET", n: 39, dmg: "203M" },
  { title: "Guild League", date: "13 Ağu", result: "GALİBİYET", n: 25, dmg: "156M" },
];

export default function TestPage() {
  const [tab, setTab] = useState<Tab>("Genel");

  return (
    <div className="t-root t-glow relative min-h-full">
      {/* Üst menü */}
      <header className="t-nav sticky top-0 z-50">
        <div className="mx-auto max-w-[1400px] px-5 h-[68px] flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] grid place-items-center"
                 style={{ background: "linear-gradient(140deg, var(--t-gold), var(--t-ember))" }}>
              <Swords className="w-4 h-4" strokeWidth={2.4} style={{ color: "#12131a" }} />
            </div>
            <div className="leading-none">
              <div className="text-[15px] font-bold tracking-tight">Aetherion</div>
              <div className="text-[10px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                Klan Yönetimi
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 ml-2">
            {TABS.map((t) => (
              <button key={t} className="t-tab" data-on={tab === t} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="t-chip hidden sm:inline">SEZON 4</span>
            <div className="w-8 h-8 rounded-full"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line-strong)" }} />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1400px] px-5 py-8 space-y-6">
        {/* Başlık */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[30px] font-bold tracking-tight leading-none">{tab}</h1>
            <p className="text-[13px] mt-2" style={{ color: "var(--t-dim)" }}>
              İki klanın birleşik görünümü · son güncelleme birkaç dakika önce
            </p>
          </div>
          <Link href="/dashboard"
                className="text-[12px] flex items-center gap-1 hover:opacity-80"
                style={{ color: "var(--t-gold)" }}>
            Mevcut siteye dön <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* KPI şeridi */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KPI.map((k) => {
            const up = k.delta >= 0;
            return (
              <div key={k.label} className="t-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <k.icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                  <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>
                    {k.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="t-num text-[27px] font-bold leading-none">{k.value}</span>
                  <span className="flex items-center gap-0.5 text-[11px] font-semibold"
                        style={{ color: up ? "var(--t-good)" : "var(--t-bad)" }}>
                    {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(k.delta)}%
                  </span>
                </div>
                <div className="text-[11px] mt-1.5" style={{ color: "var(--t-faint)" }}>{k.hint}</div>
              </div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-[1.55fr_1fr] gap-5">
          {/* Sıralama */}
          <section className="t-card overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4"
                 style={{ borderBottom: "1px solid var(--t-line)" }}>
              <Crown className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
              <h2 className="text-[14px] font-semibold">Performans Sıralaması</h2>
              <span className="t-chip ml-auto">SON 5 SAVAŞ</span>
            </div>

            <div className="px-5 py-2.5 grid grid-cols-[24px_1fr_86px_92px_58px] gap-3 text-[10px]
                            uppercase tracking-[0.07em]"
                 style={{ color: "var(--t-faint)", borderBottom: "1px solid var(--t-line)" }}>
              <span>#</span><span>Oyuncu</span><span>Hasar</span><span>K / Ö</span>
              <span className="text-right">Puan</span>
            </div>

            {TOP.map((p, i) => (
              <div key={p.name}
                   className="t-row px-5 py-3 grid grid-cols-[24px_1fr_86px_92px_58px] gap-3 items-center">
                <span className="t-num text-[13px] font-bold"
                      style={{ color: i === 0 ? "var(--t-gold)" : "var(--t-faint)" }}>
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">{p.name}</span>
                    <span className="text-[9px] px-1 py-px rounded"
                          style={{ background: "var(--t-raised)", color: "var(--t-dim)" }}>
                      {p.guild}
                    </span>
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>{p.cls}</div>
                </div>
                <span className="t-num text-[13px]" style={{ color: "var(--t-gold)" }}>{p.dmg}</span>
                <span className="t-num text-[12px]" style={{ color: "var(--t-dim)" }}>{p.kd}</span>
                <div className="text-right">
                  <div className="t-num text-[14px] font-bold">{p.score}</div>
                  <div className="t-bar mt-1"><i style={{ width: p.bar + "%" }} /></div>
                </div>
              </div>
            ))}
          </section>

          <div className="space-y-5">
            {/* Class dağılımı */}
            <section className="t-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                <h2 className="text-[14px] font-semibold">Class Dağılımı</h2>
              </div>
              <div className="space-y-2.5">
                {CLASSES.map((c) => (
                  <div key={c.name}>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-[12px]">{c.name}</span>
                      <span className="t-num text-[12px]" style={{ color: "var(--t-dim)" }}>{c.n}</span>
                    </div>
                    <div className="t-bar"><i style={{ width: c.pct + "%" }} /></div>
                  </div>
                ))}
              </div>
            </section>

            {/* Katılım */}
            <section className="t-card t-card-hi p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                <h2 className="text-[14px] font-semibold">Katılım Oranı</h2>
              </div>
              <div className="flex items-end gap-1.5 h-20">
                {[62, 71, 58, 84, 77, 91, 68, 88, 74, 95, 81, 86].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-[3px]"
                       style={{
                         height: h + "%",
                         background: i === 9
                           ? "linear-gradient(180deg, var(--t-gold), var(--t-ember))"
                           : "rgba(255,255,255,.09)",
                       }} />
                ))}
              </div>
              <div className="flex justify-between text-[10px] mt-2" style={{ color: "var(--t-faint)" }}>
                <span>12 hafta önce</span><span>bu hafta</span>
              </div>
            </section>
          </div>
        </div>

        {/* Savaşlar */}
        <section className="t-card overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <Swords className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
            <h2 className="text-[14px] font-semibold">Son Savaşlar</h2>
          </div>
          {WARS.map((w) => {
            const win = w.result === "GALİBİYET";
            return (
              <div key={w.title} className="t-row px-5 py-3.5 flex items-center gap-4 flex-wrap">
                <div className="w-1 h-9 rounded-full flex-shrink-0"
                     style={{ background: win ? "var(--t-good)" : "var(--t-bad)" }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{w.title}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>{w.date}</div>
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-md"
                      style={{
                        color: win ? "var(--t-good)" : "var(--t-bad)",
                        background: win ? "rgba(56,208,127,.10)" : "rgba(239,95,95,.10)",
                      }}>
                  {w.result}
                </span>
                <div className="text-right w-16">
                  <div className="t-num text-[13px]">{w.n}</div>
                  <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>katılım</div>
                </div>
                <div className="text-right w-20">
                  <div className="t-num text-[13px]" style={{ color: "var(--t-gold)" }}>{w.dmg}</div>
                  <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>hasar</div>
                </div>
              </div>
            );
          })}
        </section>

        <p className="text-[11px] pb-6" style={{ color: "var(--t-faint)" }}>
          Tema denemesi — veriler temsili. Beğenirsen gerçek uçlara bağlarım.
        </p>
      </main>
    </div>
  );
}
