"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Shield, Flame, Skull, Castle, Swords, TrendingUp, ChevronLeft, Zap,
  CalendarCheck, LineChart,
} from "lucide-react";
import { getClassByID, getClassBannerUrl, getPortraitUrl, getTypeName } from "@/lib/classes";
import {
  TestShell, Card, Head, Bar, GuildTag, Empty, fmt, loadJson, type Guild,
} from "@/components/test-shell";

/**
 * Başka bir üyenin karakter sayfası.
 *
 * Kendi profilimizle aynı ölçüler gösteriliyor — kadro bilgisi ve savaş
 * performansı zaten ortak tutuluyor, kimin ne yaptığı savaş sonunda oyun
 * içi raporda da görünüyor. Farkı: burada gear geçmişi ve katılım oranı
 * da var, çünkü bu sayfaya bakma sebebi genelde "bu adam ne durumda".
 */

type MemberProfile = {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl: string | null;
  siteRole: { name: string; color: string } | null;
  guild: (Guild & { id: number; name: string }) | null;
  createdAt: string;
  stats: { totalWars: number; attended: number; attendanceRate: number };
  wars: { id: number; title: string; type: string; date: string; result: string | null }[];
  gsHistory: { ap: number; dp: number; createdAt: string }[];
  absenceCount?: number;
};

type Perf = {
  id: number;
  warId: number;
  kills: number;
  deaths: number;
  damageDealt: number;
  castleDamage: number;
  ccCount: number;
  class: string;
  war: { id: number; title: string; date: string; type: string };
};

export default function UyeDetayPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [p, setP] = useState<MemberProfile | null>(null);
  const [perfs, setPerfs] = useState<Perf[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let dead = false;
    (async () => {
      try {
        const prof = await loadJson<MemberProfile>(`/api/members/${id}/profile`);
        if (dead) return;
        setP(prof);
        const data = await loadJson<{ performances: Perf[] }>(`/api/performances?userId=${id}`);
        if (!dead) setPerfs(data.performances ?? []);
      } catch (e) {
        if (!dead) setErr((e as Error).message);
      }
    })();
    return () => { dead = true; };
  }, [id]);

  const byDate = useMemo(
    () => [...(perfs ?? [])].sort((a, b) => +new Date(b.war.date) - +new Date(a.war.date)),
    [perfs],
  );

  const totals = useMemo(() => {
    const list = perfs ?? [];
    if (!list.length) return null;
    const sum = list.reduce((s, x) => ({
      damage: s.damage + x.damageDealt,
      castle: s.castle + x.castleDamage,
      kills: s.kills + x.kills,
      deaths: s.deaths + x.deaths,
      cc: s.cc + x.ccCount,
    }), { damage: 0, castle: 0, kills: 0, deaths: 0, cc: 0 });
    return {
      ...sum,
      wars: list.length,
      avgDamage: sum.damage / list.length,
      kd: sum.deaths > 0 ? Math.round((sum.kills / sum.deaths) * 100) / 100 : sum.kills,
      best: list.reduce((a, b) => (b.damageDealt > a.damageDealt ? b : a)),
    };
  }, [perfs]);

  const maxDamage = useMemo(
    () => Math.max(1, ...(perfs ?? []).map((x) => x.damageDealt)),
    [perfs],
  );

  /** Savaşta oynadığı class'lar — karakter değiştirenler için */
  const playedClasses = useMemo(() => {
    const seen = new Map<string, number>();
    for (const x of perfs ?? []) {
      if (!x.class) continue;
      seen.set(x.class, (seen.get(x.class) ?? 0) + 1);
    }
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]);
  }, [perfs]);

  const cls = p ? getClassByID(p.class) : null;
  const portrait = p ? getPortraitUrl(p.class, p.spec) : "";
  const banner = cls ? getClassBannerUrl(cls.classType) : "";
  const gs = p ? p.ap + p.dp : 0;

  return (
    <TestShell
      title={p?.familyName ?? "Üye"}
      subtitle={p ? `${cls?.name ?? "Class yok"} · ${p.stats.attended} savaşa katıldı` : "Yükleniyor…"}
      aside={
        <Link href="/test/uyeler" className="t-tab">
          <ChevronLeft className="w-3.5 h-3.5" /> Kadro
        </Link>
      }
    >
      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
      {!p && !err && <Empty>Profil geliyor…</Empty>}

      {p && (
        <>
          {/* Kimlik — panel kartıyla aynı dil */}
          <Card hi className="overflow-hidden relative">
            {banner && (
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={banner} alt="" className="w-full h-full object-cover select-none"
                     style={{ objectPosition: "center 26%" }} />
                <div className="absolute inset-0"
                     style={{ background: "linear-gradient(95deg, var(--t-surface) 30%, rgba(11,11,12,.72) 58%, rgba(11,11,12,.15) 100%)" }} />
              </div>
            )}

            <div className="relative flex flex-col lg:flex-row lg:items-stretch gap-5 p-5">
              <div className="flex items-center gap-4 min-w-0 lg:w-[290px] flex-shrink-0">
                {portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portrait} alt="" className="w-[76px] h-[76px] rounded-2xl object-cover object-top flex-shrink-0"
                       style={{ background: "var(--t-raised)", outline: "1px solid rgba(255,255,255,.14)",
                                boxShadow: "0 6px 20px rgba(0,0,0,.6)" }} />
                ) : (
                  <div className="w-[76px] h-[76px] rounded-2xl flex-shrink-0"
                       style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }} />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[19px] font-bold tracking-tight truncate"
                          style={{ textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>{p.familyName}</span>
                    <GuildTag g={p.guild} />
                  </div>
                  <div className="text-[12px] mt-1"
                       style={{ color: "var(--t-dim)", textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
                    {cls?.name ?? "Class seçilmemiş"} ·{" "}
                    {p.spec === "succession" ? "Succession" : "Awakening"}
                  </div>
                  {p.siteRole && (
                    <span className="t-chip inline-block mt-2 backdrop-blur-sm"
                          style={{ color: p.siteRole.color, borderColor: p.siteRole.color + "50",
                                   background: p.siteRole.color + "14" }}>
                      {p.siteRole.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-5 lg:px-5 lg:border-l lg:border-r"
                   style={{ borderColor: "var(--t-line)" }}>
                {[["AP", p.ap], ["DP", p.dp], ["GS", gs]].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="text-[10px] uppercase tracking-[0.08em]"
                         style={{ color: "var(--t-faint)", textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>{l}</div>
                    <div className="t-num text-[24px] font-bold leading-tight"
                         style={{ color: l === "GS" ? "var(--t-gold)" : undefined,
                                  textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>{v}</div>
                  </div>
                ))}
              </div>

              <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-3 gap-3 self-center">
                {[
                  { icon: CalendarCheck, label: "Katılım", value: `%${p.stats.attendanceRate}`,
                    hint: `${p.stats.attended} / ${p.stats.totalWars} savaş` },
                  { icon: Swords, label: "Raporlu", value: String(totals?.wars ?? 0),
                    hint: totals ? `ort. ${fmt(totals.avgDamage)} hasar` : "rapor yok" },
                  { icon: Shield, label: "Aramızda",
                    value: new Date(p.createdAt).toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }),
                    hint: p.absenceCount != null ? `${p.absenceCount} devamsızlık` : "katıldığı tarih" },
                ].map((s) => (
                  <div key={s.label} className="rounded-[var(--t-r-sm)] px-3 py-2.5 backdrop-blur-sm"
                       style={{ background: "rgba(20,20,22,.72)", border: "1px solid rgba(255,255,255,.07)" }}>
                    <div className="flex items-center gap-1.5">
                      <s.icon className="w-3 h-3" strokeWidth={2} style={{ color: "var(--t-faint)" }} />
                      <span className="text-[10px] uppercase tracking-[0.08em]"
                            style={{ color: "var(--t-faint)" }}>{s.label}</span>
                    </div>
                    <div className="t-num text-[17px] font-bold mt-1 leading-none">{s.value}</div>
                    <div className="text-[10px] mt-1 truncate" style={{ color: "var(--t-faint)" }}>{s.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Savaş toplamları */}
          {totals ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { icon: Flame, label: "Toplam Hasar", value: fmt(totals.damage),
                  hint: `maç başı ${fmt(totals.avgDamage)}` },
                { icon: Castle, label: "Kale Hasarı", value: fmt(totals.castle), hint: `${totals.cc} CC` },
                { icon: Skull, label: "K / Ö", value: `${totals.kills}/${totals.deaths}`,
                  hint: `oran ${totals.kd}` },
                { icon: TrendingUp, label: "En İyi Savaş", value: fmt(totals.best.damageDealt),
                  hint: totals.best.war.title },
                { icon: Swords, label: "Raporlu Savaş", value: String(totals.wars),
                  hint: `${p.stats.attended} katılım kaydı` },
              ].map((k) => (
                <Card key={k.label} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <k.icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                    <span className="text-[10px] uppercase tracking-[0.08em]"
                          style={{ color: "var(--t-faint)" }}>{k.label}</span>
                  </div>
                  <div className="t-num text-[23px] font-bold leading-none">{k.value}</div>
                  <div className="text-[11px] mt-1.5 truncate" style={{ color: "var(--t-faint)" }}>{k.hint}</div>
                </Card>
              ))}
            </div>
          ) : perfs ? (
            <Empty>Bu üyenin performans raporu girilmemiş.</Empty>
          ) : null}

          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
            <Card className="overflow-hidden">
              <Head icon={Swords} title="Savaş Dökümü"
                    meta={byDate.length ? `${byDate.length} SAVAŞ` : undefined} />
              {byDate.length === 0 ? (
                <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-dim)" }}>
                  Rapor yok.
                </p>
              ) : byDate.map((x) => {
                const played = getClassByID(x.class);
                const different = x.class && x.class !== p.class;
                return (
                  <Link key={x.id} href={`/test/savaslar/${x.warId}`}
                        className="t-row px-5 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium truncate">{x.war.title}</span>
                        {different && (
                          <span className="t-chip flex-shrink-0"
                                style={{ color: "var(--t-ember)", borderColor: "var(--t-ember)50" }}>
                            {played?.name ?? x.class}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                        {getTypeName(x.war.type)} ·{" "}
                        {new Date(x.war.date).toLocaleDateString("tr-TR",
                          { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div className="w-24 text-right">
                      <div className="t-num text-[13px]" style={{ color: "var(--t-gold)" }}>
                        {fmt(x.damageDealt)}
                      </div>
                      <div className="mt-1"><Bar pct={(x.damageDealt / maxDamage) * 100} /></div>
                    </div>
                    <div className="w-14 text-right hidden sm:block">
                      <div className="t-num text-[12px]">{x.kills}/{x.deaths}</div>
                      <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>K/Ö</div>
                    </div>
                    <div className="w-16 text-right hidden md:block">
                      <div className="t-num text-[12px]" style={{ color: "var(--t-ember)" }}>
                        {fmt(x.castleDamage)}
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>kale</div>
                    </div>
                  </Link>
                );
              })}
            </Card>

            <div className="space-y-5">
              {p.gsHistory.length > 1 && <GearHistory history={p.gsHistory} />}

              {playedClasses.length > 1 && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                    <h2 className="text-[14px] font-semibold">Savaşta Oynadıkları</h2>
                  </div>
                  <div className="space-y-2.5">
                    {playedClasses.map(([c, n]) => (
                      <div key={c}>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-[12px]">{getClassByID(c)?.name ?? c}</span>
                          <span className="t-num text-[12px]" style={{ color: "var(--t-dim)" }}>{n}</span>
                        </div>
                        <Bar pct={(n / playedClasses[0][1]) * 100} />
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card className="overflow-hidden">
                <Head icon={CalendarCheck} title="Katıldığı Savaşlar"
                      meta={`${p.wars.length} KAYIT`} />
                {p.wars.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-dim)" }}>
                    Henüz bir savaşa katılmamış.
                  </p>
                ) : p.wars.slice(0, 12).map((w) => (
                  <Link key={w.id} href={`/test/savaslar/${w.id}`}
                        className="t-row px-5 py-2.5 flex items-center gap-2">
                    <div className="w-1 h-6 rounded-full flex-shrink-0"
                         style={{ background: w.result === "WIN" ? "var(--t-good)"
                                  : w.result === "LOSS" ? "var(--t-bad)" : "var(--t-faint)" }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] truncate">{w.title}</div>
                      <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                        {new Date(w.date).toLocaleDateString("tr-TR",
                          { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </Link>
                ))}
              </Card>
            </div>
          </div>
        </>
      )}

      <div className="pb-6" />
    </TestShell>
  );
}

/** Gear geçmişi — mutlak değil, değişimin şeklini göstermek için */
function GearHistory({ history }: { history: { ap: number; dp: number; createdAt: string }[] }) {
  const pts = history.map((h) => h.ap + h.dp);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const diff = last - first;

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-1">
        <LineChart className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
        <h2 className="text-[14px] font-semibold">Gear Geçmişi</h2>
        <span className="t-chip ml-auto"
              style={diff > 0 ? { color: "var(--t-good)", borderColor: "var(--t-good)50" } : undefined}>
          {diff > 0 ? `+${diff}` : diff} GS
        </span>
      </div>
      <p className="text-[11px] mb-3" style={{ color: "var(--t-faint)" }}>
        {first} → {last} · {history.length} kayıt
      </p>
      <div className="flex items-end gap-1 h-20">
        {pts.map((v, i) => (
          <div key={i} className="flex-1 rounded-t-[3px] min-w-[3px]"
               title={`${v} GS · ${new Date(history[i].createdAt).toLocaleDateString("tr-TR")}`}
               style={{
                 height: Math.max(8, ((v - min) / span) * 100) + "%",
                 background: i === pts.length - 1
                   ? "linear-gradient(180deg, var(--t-gold), var(--t-ember))"
                   : "rgba(255,255,255,.09)",
               }} />
        ))}
      </div>
    </Card>
  );
}
