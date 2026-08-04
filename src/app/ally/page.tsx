"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Handshake, Users, Shield, Swords, Timer, Trophy, Skull, Flag } from "lucide-react";
import { PageHeader, Card, CardHeader, Loading, Empty } from "@/components/ui";
import { BDO_CLASSES, getTypeName } from "@/lib/classes";

interface GuildSummary {
  id: number; name: string; tag: string; color: string; isPrimary: boolean;
  memberCount: number; avgGs: number; topGs: number;
  brackets: { label: string; count: number }[];
}

interface WarRow {
  id: number; title: string; type: string; date: string; result: string | null;
  total: number;
  byGuild: { guildId: number; tag: string; color: string; count: number }[];
}

interface AllyData {
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
}

function className(id: string) {
  return BDO_CLASSES.find((c) => c.id === id)?.name ?? id;
}

export default function AllyPage() {
  const { status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<AllyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/ally/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d); setLoading(false); });
  }, [status]);

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

  if (status === "loading" || loading) return <Loading />;
  if (!data) return null;

  const maxMembers = Math.max(...data.guilds.map((g) => g.memberCount), 1);

  return (
    <div>
      <PageHeader
        title="Ally"
        desc="Müttefik klanlarla ortak veriler — katılım, güç dağılımı ve savaş özetleri."
        icon={Handshake}
        action={
          <span className="text-[11px] text-bdo-text-secondary">
            <span className="text-bdo-text-primary font-semibold font-mono">{data.totals.guildCount}</span> klan ·{" "}
            <span className="text-bdo-text-primary font-semibold font-mono">{data.totals.memberCount}</span> üye
          </span>
        }
      />

      {data.guilds.length < 2 && (
        <div className="card px-4 py-3 mb-4 flex items-center gap-2.5">
          <Flag className="w-4 h-4 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
          <p className="text-[12px] text-bdo-text-muted">
            Henüz müttefik klan eklenmemiş. Admin panelinden <span className="text-bdo-gold">Klanlar</span> sekmesinden ekleyebilirsin.
          </p>
        </div>
      )}

      {/* Yaklaşan ortak savaş */}
      {data.upcoming && (
        <Link href={`/wars/${data.upcoming.id}`} className="block mb-4">
          <div className="card card-accent p-4 hover:border-bdo-gold/35 transition-colors">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2 w-2 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bdo-gold opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-bdo-gold" />
                </span>
                <div>
                  <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">Yaklaşan Ortak Savaş</p>
                  <p className="text-sm font-semibold text-bdo-text-primary mt-0.5">{data.upcoming.title}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {data.upcoming.byGuild.map((g) => (
                  <span
                    key={g.guildId}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border"
                    style={{ color: g.color, borderColor: `${g.color}35`, backgroundColor: `${g.color}12` }}
                    title={g.name}
                  >
                    {g.tag}
                    <span className="font-mono">{g.count}</span>
                  </span>
                ))}
                <div className="flex items-center gap-2 pl-1">
                  <Timer className="w-4 h-4 text-bdo-text-secondary/50" strokeWidth={1.75} />
                  <div className="text-right">
                    <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">Kalan</p>
                    <p className="text-[15px] font-bold font-mono text-bdo-gold leading-none mt-0.5">{countdown || "..."}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Klan kartları */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
        {data.guilds.map((g) => (
          <div key={g.id} className={`card ${g.id === data.myGuildId ? "card-accent" : ""}`}>
            <div className="card-header">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded border flex-shrink-0 font-mono"
                  style={{ color: g.color, borderColor: `${g.color}40`, backgroundColor: `${g.color}15` }}
                >
                  {g.tag}
                </span>
                <span className="card-title truncate">{g.name}</span>
              </div>
              {g.id === data.myGuildId && (
                <span className="text-[9px] text-bdo-gold font-semibold uppercase tracking-wider flex-shrink-0">
                  Senin klanın
                </span>
              )}
            </div>

            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Üye", value: g.memberCount, icon: Users },
                  { label: "Ort. GS", value: g.avgGs, icon: Shield },
                  { label: "En Yüksek", value: g.topGs, icon: Trophy },
                ].map((s) => (
                  <div key={s.label} className="bg-bdo-bg border border-bdo-border rounded-lg px-2 py-1.5">
                    <div className="flex items-center gap-1 mb-0.5">
                      <s.icon className="w-2.5 h-2.5 text-bdo-text-secondary" strokeWidth={2} />
                      <span className="text-[9px] uppercase tracking-wider text-bdo-text-secondary">{s.label}</span>
                    </div>
                    <p className="text-[15px] font-bold font-mono text-bdo-text-primary leading-none">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* GS dağılımı */}
              <p className="text-[10px] uppercase tracking-wider text-bdo-text-secondary mb-1.5">GS Dağılımı</p>
              <div className="space-y-1.5">
                {g.brackets.map((b) => {
                  const pct = g.memberCount ? Math.round((b.count / g.memberCount) * 100) : 0;
                  return (
                    <div key={b.label} className="flex items-center gap-2">
                      <span className="text-[10px] text-bdo-text-secondary w-14 flex-shrink-0">{b.label}</span>
                      <div className="flex-1 bg-bdo-bg rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: g.color }} />
                      </div>
                      <span className="text-[10px] font-mono text-bdo-text-muted w-5 text-right flex-shrink-0">{b.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Ortak savaş geçmişi */}
        <Card className="md:col-span-2">
          <CardHeader title="Ortak Savaş Katılımı" icon={Swords} meta={`son ${data.warBreakdown.length} savaş`} />
          {data.warBreakdown.length === 0 ? (
            <Empty icon={Swords} text="Henüz savaş kaydı yok." />
          ) : (
            data.warBreakdown.map((w) => {
              const RIcon = w.result === "WIN" ? Trophy : w.result === "LOSS" ? Skull : null;
              return (
                <Link key={w.id} href={`/wars/${w.id}`} className="card-row gap-3 flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] text-bdo-text-primary truncate">{w.title}</p>
                      {RIcon && (
                        <RIcon
                          className={`w-3 h-3 flex-shrink-0 ${w.result === "WIN" ? "text-emerald-400" : "text-red-400"}`}
                          strokeWidth={2}
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-bdo-text-secondary mt-0.5">
                      {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} · {getTypeName(w.type)}
                    </p>
                  </div>

                  {/* Klan dağılım barı */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex h-1.5 w-24 rounded-full overflow-hidden bg-bdo-bg">
                      {w.byGuild.map((g) => (
                        <div
                          key={g.guildId}
                          style={{ width: `${(g.count / w.total) * 100}%`, backgroundColor: g.color }}
                          title={`${g.tag}: ${g.count}`}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {w.byGuild.map((g) => (
                        <span
                          key={g.guildId}
                          className="text-[10px] font-mono font-semibold px-1 py-0.5 rounded border"
                          style={{ color: g.color, borderColor: `${g.color}30`, backgroundColor: `${g.color}10` }}
                        >
                          {g.count}
                        </span>
                      ))}
                    </div>
                    <span className="text-[11px] font-mono text-bdo-text-muted w-7 text-right">{w.total}</span>
                  </div>
                </Link>
              );
            })
          )}
        </Card>

        {/* Klan büyüklüğü karşılaştırma */}
        <Card>
          <CardHeader title="Klan Büyüklüğü" icon={Users} />
          <div className="p-4 space-y-3">
            {data.guilds.map((g) => (
              <div key={g.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: g.color }} />
                    <span className="text-[11px] text-bdo-text-muted truncate">{g.name}</span>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-bdo-text-primary">{g.memberCount}</span>
                </div>
                <div className="h-1.5 bg-bdo-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(g.memberCount / maxMembers) * 100}%`, backgroundColor: g.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Class dağılımı — klan bazında ilk 5 */}
          <div className="border-t border-bdo-border p-4">
            <p className="text-[10px] uppercase tracking-wider text-bdo-text-secondary mb-2">
              Öne Çıkan Classlar
            </p>
            <div className="space-y-2.5">
              {data.classByGuild.filter((c) => c.classes.length > 0).map((c) => (
                <div key={c.guildId}>
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border"
                    style={{ color: c.color, borderColor: `${c.color}35`, backgroundColor: `${c.color}12` }}
                  >
                    {c.tag}
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {c.classes.slice(0, 5).map((cl) => (
                      <span
                        key={cl.class}
                        className="text-[10px] text-bdo-text-muted bg-bdo-bg border border-bdo-border rounded px-1.5 py-0.5"
                      >
                        {className(cl.class)} <span className="font-mono text-bdo-text-secondary">{cl.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
