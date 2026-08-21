"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Users, Shield, Swords, Timer, Trophy, Skull, Flag } from "lucide-react";
import { BDO_CLASSES, getTypeName } from "@/lib/classes";
import { TestShell, Card, Head, Empty } from "@/components/app-shell";

/**
 * Müttefik özeti.
 *
 * İki klan ortak savaşa gidiyor; buradaki soru "kim kaç kişiyle geldi"
 * ve "hangi klan ne kadar güçlü". Sayılar klan renkleriyle veriliyor,
 * çünkü karşılaştırma yaparken etiket okumak yavaş.
 */

type GuildSummary = {
  id: number; name: string; tag: string; color: string; isPrimary: boolean;
  memberCount: number; avgGs: number; topGs: number;
  brackets: { label: string; count: number }[];
};

type WarRow = {
  id: number; title: string; type: string; date: string; result: string | null;
  total: number;
  byGuild: { guildId: number; tag: string; color: string; count: number }[];
};

type AllyData = {
  myGuildId: number | null;
  guilds: GuildSummary[];
  totals: { guildCount: number; memberCount: number; avgGs: number };
  warBreakdown: WarRow[];
  upcoming: {
    id: number; title: string; date: string; type: string;
    byGuild: { guildId: number; tag: string; color: string; name: string; count: number }[];
  } | null;
  classByGuild: {
    guildId: number; tag: string; color: string;
    classes: { class: string; count: number }[];
  }[];
};

const className = (id: string) => BDO_CLASSES.find((c) => c.id === id)?.name ?? id;

export default function AllyPage() {
  const { status } = useSession();
  const [data, setData] = useState<AllyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/ally/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); });
  }, [status]);

  // Geri sayım dakikada bir yeniliyor — saniye göstermiyoruz
  useEffect(() => {
    if (!data?.upcoming) return;
    const target = new Date(data.upcoming.date).getTime();
    function tick() {
      const diff = target - Date.now();
      if (diff <= 0) { setCountdown("Başladı!"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${d > 0 ? d + "g " : ""}${h}s ${m}dk`);
    }
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [data?.upcoming]);

  if (status === "unauthenticated") {
    return (
      <TestShell title="Müttefikler" subtitle="Giriş gerekiyor">
        <Empty>Bu ekranı görmek için giriş yapman gerekiyor.</Empty>
      </TestShell>
    );
  }
  if (loading || !data) {
    return <TestShell title="Müttefikler" subtitle="Yükleniyor…"><Empty>Veri geliyor…</Empty></TestShell>;
  }

  const maxMembers = Math.max(...data.guilds.map((g) => g.memberCount), 1);

  return (
    <TestShell
      title="Müttefikler"
      subtitle="Müttefik klanlarla ortak veriler — katılım, güç dağılımı ve savaş özetleri."
      aside={
        <span className="t-chip hidden sm:inline">
          {data.totals.guildCount} klan · {data.totals.memberCount} üye
        </span>
      }
    >
      {data.guilds.length < 2 && (
        <Card className="px-4 py-3 flex items-center gap-2.5">
          <Flag className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
          <p className="text-[12.5px]" style={{ color: "var(--t-dim)" }}>
            Henüz müttefik klan eklenmemiş. Admin panelindeki{" "}
            <span style={{ color: "var(--t-gold)" }}>Klanlar</span> sekmesinden ekleyebilirsin.
          </p>
        </Card>
      )}

      {/* ── Yaklaşan ortak savaş ───────────────────────────────────── */}
      {data.upcoming && (
        <Link href={`/savaslar/${data.upcoming.id}`} className="block">
          <Card hi className="p-4 transition-colors hover:border-[rgba(232,180,81,.35)]">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
                        style={{ background: "var(--t-gold)" }} />
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "var(--t-gold)" }} />
                </span>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>
                    Yaklaşan ortak savaş
                  </p>
                  <p className="text-[14px] font-semibold mt-0.5">{data.upcoming.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {data.upcoming.byGuild.map((g) => (
                  <span key={g.guildId} title={g.name}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border"
                        style={{ color: g.color, borderColor: g.color + "35", background: g.color + "12" }}>
                    {g.tag} <span className="t-num">{g.count}</span>
                  </span>
                ))}
                <div className="flex items-center gap-2 pl-1">
                  <Timer className="w-4 h-4 opacity-50" strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>
                      Kalan
                    </p>
                    <p className="t-num text-[15px] font-bold leading-none mt-0.5" style={{ color: "var(--t-gold)" }}>
                      {countdown || "…"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Link>
      )}

      {/* ── Klan kartları ──────────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.guilds.map((g) => (
          <Card key={g.id} hi={g.id === data.myGuildId} className="overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <span className="t-num text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded border flex-shrink-0"
                    style={{ color: g.color, borderColor: g.color + "40", background: g.color + "15" }}>
                {g.tag}
              </span>
              <span className="text-[13.5px] font-semibold truncate">{g.name}</span>
              {g.id === data.myGuildId && (
                <span className="text-[9px] font-semibold uppercase tracking-wider ml-auto flex-shrink-0"
                      style={{ color: "var(--t-gold)" }}>
                  Senin klanın
                </span>
              )}
            </div>

            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 mb-3.5">
                {[
                  { label: "Üye", value: g.memberCount, icon: Users },
                  { label: "Ort. GS", value: g.avgGs, icon: Shield },
                  { label: "En Yüksek", value: g.topGs, icon: Trophy },
                ].map((s) => (
                  <div key={s.label} className="px-2 py-1.5 rounded-[var(--t-r-sm)]"
                       style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                    <div className="flex items-center gap-1 mb-0.5">
                      <s.icon className="w-2.5 h-2.5" strokeWidth={2} style={{ color: "var(--t-faint)" }} />
                      <span className="text-[9px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
                        {s.label}
                      </span>
                    </div>
                    <p className="t-num text-[15px] font-bold leading-none">{s.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-[10px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--t-faint)" }}>
                GS Dağılımı
              </p>
              <div className="space-y-1.5">
                {g.brackets.map((b) => {
                  const pct = g.memberCount ? Math.round((b.count / g.memberCount) * 100) : 0;
                  return (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-[10px] w-14 flex-shrink-0" style={{ color: "var(--t-faint)" }}>
                        {b.label}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: g.color }} />
                      </div>
                      <span className="t-num text-[10px] w-5 text-right flex-shrink-0" style={{ color: "var(--t-dim)" }}>
                        {b.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* ── Ortak savaş katılımı ─────────────────────────────────── */}
        <Card className="lg:col-span-2 overflow-hidden">
          <Head icon={Swords} title="Ortak Savaş Katılımı" meta={`SON ${data.warBreakdown.length} SAVAŞ`} />
          {data.warBreakdown.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-faint)" }}>
              Henüz savaş kaydı yok.
            </p>
          ) : (
            data.warBreakdown.map((w) => {
              const RIcon = w.result === "WIN" ? Trophy : w.result === "LOSS" ? Skull : null;
              return (
                <Link key={w.id} href={`/savaslar/${w.id}`}
                      className="t-row px-5 py-2.5 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12.5px] truncate">{w.title}</p>
                      {RIcon && (
                        <RIcon className="w-3 h-3 flex-shrink-0" strokeWidth={2}
                               style={{ color: w.result === "WIN" ? "var(--t-good)" : "var(--t-bad)" }} />
                      )}
                    </div>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                      {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                      {" · "}{getTypeName(w.type)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex h-1.5 w-24 rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
                      {w.byGuild.map((g) => (
                        <div key={g.guildId} title={`${g.tag}: ${g.count}`}
                             style={{ width: `${(g.count / w.total) * 100}%`, background: g.color }} />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {w.byGuild.map((g) => (
                        <span key={g.guildId}
                              className="t-num text-[10px] font-semibold px-1 py-0.5 rounded border"
                              style={{ color: g.color, borderColor: g.color + "30", background: g.color + "10" }}>
                          {g.count}
                        </span>
                      ))}
                    </div>
                    <span className="t-num text-[11px] w-7 text-right" style={{ color: "var(--t-dim)" }}>
                      {w.total}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </Card>

        {/* ── Klan büyüklüğü + öne çıkan classlar ──────────────────── */}
        <Card className="overflow-hidden">
          <Head icon={Users} title="Klan Büyüklüğü" />
          <div className="p-4 space-y-3">
            {data.guilds.map((g) => (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: g.color }} />
                    <span className="text-[11px] truncate" style={{ color: "var(--t-dim)" }}>{g.name}</span>
                  </div>
                  <span className="t-num text-[11px] font-semibold">{g.memberCount}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
                  <div className="h-full rounded-full"
                       style={{ width: `${(g.memberCount / maxMembers) * 100}%`, background: g.color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4" style={{ borderTop: "1px solid var(--t-line)" }}>
            <p className="text-[10px] uppercase tracking-[0.06em] mb-2" style={{ color: "var(--t-faint)" }}>
              Öne Çıkan Classlar
            </p>
            <div className="space-y-2.5">
              {data.classByGuild.filter((c) => c.classes.length > 0).map((c) => (
                <div key={c.guildId}>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border"
                        style={{ color: c.color, borderColor: c.color + "35", background: c.color + "12" }}>
                    {c.tag}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.classes.slice(0, 5).map((cl) => (
                      <span key={cl.class} className="text-[10px] rounded px-1.5 py-0.5"
                            style={{ color: "var(--t-dim)", background: "var(--t-raised)",
                                     border: "1px solid var(--t-line)" }}>
                        {className(cl.class)}{" "}
                        <span className="t-num" style={{ color: "var(--t-faint)" }}>{cl.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="pb-6" />
    </TestShell>
  );
}
