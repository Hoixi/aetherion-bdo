"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Swords, Users, Trophy, Flame, Shield,
  Activity, Crown, Target, ChevronRight, BarChart3, Castle,
} from "lucide-react";
import { getClassByID, getClassIconUrl, getPortraitUrl, getTypeName } from "@/lib/classes";
import {
  TestShell, Card, Head, Bar, GuildTag, fmt, loadJson, type Guild,
} from "@/components/app-shell";
import { CharacterCard, type Me } from "@/components/character-card";

const TABS = ["Genel", "Karakterler", "Performans", "Savaşlar"] as const;
type Tab = (typeof TABS)[number];

type Data = {
  me: Me | null;
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

export default function TestPage() {
  const [tab, setTab] = useState<Tab>("Genel");
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadJson<Data>("/api/test/overview")
      .then(setD)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const maxDamage = useMemo(() => d?.players[0]?.damage ?? 1, [d]);
  const maxTrend = useMemo(
    () => Math.max(1, ...(d?.trend ?? []).map((t) => t.participants)),
    [d],
  );

  return (
    <TestShell
      title={tab}
      subtitle={d ? `İki klanın birleşik görünümü · son ${d.totals.warsCounted} savaş` : "Yükleniyor…"}
      aside={d?.guildBreakdown.map((g) => (
        <span key={g.tag} className="t-chip hidden sm:inline"
              style={{ color: g.color, borderColor: g.color + "40" }}>
          {g.tag} {g.n}
        </span>
      ))}
      tabs={
        <div className="flex items-center gap-1 flex-wrap">
          {TABS.map((t) => (
            <button key={t} className="t-tab" data-on={tab === t} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
      }
    >
      <>
        {/* Klan geneline bakmadan önce insan kendi durumunu görsün */}
        {d?.me && <CharacterCard me={d.me} warsCounted={d.totals.warsCounted} />}

        {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
        {!d && !err && <Card className="p-8 text-center"><span className="text-[13px]" style={{ color: "var(--t-dim)" }}>Veriler geliyor…</span></Card>}

        {d && (
          <>
            {/* KPI — her sekmede görünür, bağlam kaybolmasın */}
            {/* Her ipucu kendi metriğini anlatıyor: kale hasarının altında
                kill sayısı yazınca sayı yanlışmış gibi okunuyordu */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {[
                { label: "Üye", value: String(d.totals.members), hint: `${d.totals.geared} gear girmiş`, icon: Users },
                { label: "Ortalama GS", value: String(d.totals.avgGs), hint: "AP + DP", icon: Shield },
                { label: "Galibiyet", value: `${d.totals.wins}`, hint: `${d.totals.losses} mağlubiyet`, icon: Trophy },
                { label: "Toplam Hasar", value: fmt(d.totals.damage), hint: `son ${d.totals.warsCounted} savaş`, icon: Flame },
                { label: "Kale Hasarı", value: fmt(d.totals.castle), hint: `son ${d.totals.warsCounted} savaş`, icon: Castle },
                { label: "Kill / Ölüm", value: `${d.totals.kills}/${d.totals.deaths}`, hint: `son ${d.totals.warsCounted} savaş`, icon: Crown },
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
                      {/* Kapsam yazmayınca sayılar yanlış görünüyor:
                          bu kart profil değil, sahadaki raporları sayıyor */}
                      <span className="t-chip ml-auto">SON {d.totals.warsCounted} SAVAŞ · KİŞİ</span>
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
                    <Link key={w.id} href={`/savaslar/${w.id}`}
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
      </>
    </TestShell>
  );
}
