"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Shield, Flame, Skull, Castle, Swords, TrendingUp, ChevronRight, Zap,
} from "lucide-react";
import { getClassByID, getClassBannerUrl, getPortraitUrl, getTypeName } from "@/lib/classes";
import { TestShell, Card, Head, Bar, GuildTag, Empty, fmt, loadJson, type Guild } from "@/components/app-shell";

/**
 * Kendi karakterimizin detay ekranı.
 *
 * Paneldeki kart özet veriyor; burada savaş savaş dökümü var. Kişinin
 * kendi verisi olduğu için klan filtresi uygulanmıyor, `?userId=` ile
 * yalnızca kendi satırları çekiliyor.
 */

type Profile = {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  absenceCount: number;
  guild: (Guild & { id: number; name: string }) | null;
  participations: {
    id: number;
    war: { id: number; title: string; type: string; date: string };
  }[];
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
  spec: string;
  war: { id: number; title: string; date: string; type: string };
};

export default function ProfilPage() {
  const [p, setP] = useState<Profile | null>(null);
  const [perfs, setPerfs] = useState<Perf[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const prof = await loadJson<Profile>("/api/user/profile");
        if (dead) return;
        setP(prof);

        // Kimliği öğrenmeden performansları isteyemiyoruz, bu yüzden sıralı
        const data = await loadJson<{ performances: Perf[] }>(
          `/api/performances?userId=${prof.id}`,
        );
        if (!dead) setPerfs(data.performances ?? []);
      } catch (e) {
        if (!dead) setErr((e as Error).message);
      }
    })();
    return () => { dead = true; };
  }, []);

  // Savaş tarihine göre yeni → eski; API hasara göre sıralı geliyor
  const byDate = useMemo(
    () => [...(perfs ?? [])].sort((a, b) => +new Date(b.war.date) - +new Date(a.war.date)),
    [perfs],
  );

  const totals = useMemo(() => {
    const list = perfs ?? [];
    if (!list.length) return null;
    const sum = list.reduce(
      (s, x) => ({
        damage: s.damage + x.damageDealt,
        castle: s.castle + x.castleDamage,
        kills: s.kills + x.kills,
        deaths: s.deaths + x.deaths,
        cc: s.cc + x.ccCount,
      }),
      { damage: 0, castle: 0, kills: 0, deaths: 0, cc: 0 },
    );
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

  /** Savaşta oynadığımız class'lar — karakter değiştirenler için */
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

  return (
    <TestShell
      title="Karakterim"
      subtitle={
        p
          ? `${cls?.name ?? "Class yok"} · ${p.participations.length} savaşa katıldın`
          : "Yükleniyor…"
      }
      aside={
        <Link href="/profil/duzenle" className="t-tab">
          Düzenle <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      }
    >
      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
      {!p && !err && <Empty>Profil geliyor…</Empty>}

      {p && (
        <>
          {/* Kimlik — banner tam opak, okunurluk gradyanla sağlanıyor;
              yükseklik sabit, içeriğe bırakılırsa kart uzayıp gidiyor */}
          <Card hi className="overflow-hidden relative h-[210px] sm:h-[240px]">
            {banner ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={banner} alt="" className="absolute inset-0 w-full h-full object-cover
                                                    pointer-events-none select-none"
                     style={{ objectPosition: "center 26%" }} />
                <div className="absolute inset-0"
                     style={{ background: "linear-gradient(90deg, var(--t-surface) 0%, rgba(11,11,12,.78) 42%, rgba(11,11,12,.12) 100%)" }} />
                <div className="absolute inset-x-0 bottom-0 h-28"
                     style={{ background: "linear-gradient(0deg, var(--t-surface) 12%, rgba(11,11,12,.7) 60%, transparent 100%)" }} />
                <div className="absolute inset-x-0 top-0 h-12"
                     style={{ background: "linear-gradient(180deg, rgba(11,11,12,.75), transparent)" }} />
              </>
            ) : (
              <div className="absolute inset-0" style={{ background: "var(--t-surface)" }} />
            )}

            <div className="relative h-full flex flex-col justify-between p-5 sm:p-6">
              <div className="flex items-start gap-4">
                {portrait && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portrait} alt="" className="w-14 h-14 rounded-xl object-cover object-top flex-shrink-0"
                       style={{ boxShadow: "0 6px 20px rgba(0,0,0,.65)",
                                outline: "1px solid rgba(255,255,255,.14)" }} />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[24px] font-bold tracking-tight truncate"
                          style={{ textShadow: "0 2px 10px rgba(0,0,0,.9)" }}>{p.familyName}</span>
                    <GuildTag g={p.guild} />
                  </div>
                  <div className="text-[13px] mt-1"
                       style={{ color: "rgba(255,255,255,.72)", textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
                    {cls?.name ?? "Class seçilmemiş"} ·{" "}
                    {p.spec === "succession" ? "Succession" : "Awakening"}
                    {p.guild ? ` · ${p.guild.name}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex items-stretch gap-2">
                {[["AP", p.ap], ["DP", p.dp], ["GS", p.ap + p.dp]].map(([l, v]) => (
                  <div key={l as string}
                       className="flex-1 max-w-[130px] rounded-[var(--t-r-sm)] px-3 py-2 backdrop-blur-sm"
                       style={{ background: "rgba(20,20,22,.72)", border: "1px solid rgba(255,255,255,.08)" }}>
                    <div className="text-[9px] uppercase tracking-[0.08em]"
                         style={{ color: "var(--t-faint)" }}>{l}</div>
                    <div className="t-num text-[22px] font-bold leading-none mt-1"
                         style={l === "GS" ? { color: "var(--t-gold)" } : undefined}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Toplamlar */}
          {totals ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                { icon: Swords, label: "Raporlu Savaş", value: String(totals.wars),
                  hint: `${p.participations.length} katılım kaydı` },
                { icon: Flame, label: "Toplam Hasar", value: fmt(totals.damage),
                  hint: `maç başı ${fmt(totals.avgDamage)}` },
                { icon: Castle, label: "Kale Hasarı", value: fmt(totals.castle),
                  hint: `${totals.cc} CC` },
                { icon: Skull, label: "K / Ö", value: `${totals.kills}/${totals.deaths}`,
                  hint: `oran ${totals.kd}` },
                { icon: TrendingUp, label: "En İyi Savaş", value: fmt(totals.best.damageDealt),
                  hint: totals.best.war.title },
              ].map((k) => (
                <Card key={k.label} className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <k.icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                    <span className="text-[10px] uppercase tracking-[0.08em]"
                          style={{ color: "var(--t-faint)" }}>{k.label}</span>
                  </div>
                  <div className="t-num text-[23px] font-bold leading-none">{k.value}</div>
                  <div className="text-[11px] mt-1.5 truncate" style={{ color: "var(--t-faint)" }}>
                    {k.hint}
                  </div>
                </Card>
              ))}
            </div>
          ) : perfs ? (
            <Empty>Henüz performans raporun girilmemiş.</Empty>
          ) : null}

          <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
            {/* Savaş savaş döküm */}
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
                  <Link key={x.id} href={`/savaslar/${x.warId}`}
                        className="t-row px-5 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-medium truncate">{x.war.title}</span>
                        {/* O savaşta başka class'la girmişse belirt */}
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
              {playedClasses.length > 1 && (
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                    <h2 className="text-[14px] font-semibold">Savaşta Oynadıkların</h2>
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
                <Head icon={Shield} title="Katılım Geçmişi"
                      meta={`${p.participations.length} KAYIT`} />
                {p.participations.length === 0 ? (
                  <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-dim)" }}>
                    Henüz bir savaşa katılmadın.
                  </p>
                ) : p.participations.slice(0, 12).map((x) => (
                  <Link key={x.id} href={`/savaslar/${x.war.id}`}
                        className="t-row px-5 py-2.5 flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] truncate">{x.war.title}</div>
                      <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                        {new Date(x.war.date).toLocaleDateString("tr-TR",
                          { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--t-faint)" }} />
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
