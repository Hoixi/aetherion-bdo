"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTypeName } from "@/lib/classes";
import {
  Swords, Castle, Skull, Pin, Trophy, Handshake, Lock, Check, X,
  Timer, CalendarX, LucideIcon,
} from "lucide-react";
import { PageHeader, Card, CardHeader, Loading, Empty, Tabs, StatTile } from "@/components/ui";

interface War {
  id: number;
  title: string;
  type: string;
  date: string;
  deadline: string | null;
  result: string | null;
  isAllyWar: boolean;
  maxParticipants: number | null;
  _count: { participants: number };
  participants: { status: string }[];
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  NODE_WAR: Swords, SIEGE: Castle, KARA_TAPINAK: Skull, OTHER: Pin,
};

const RESULT = {
  WIN: { label: "Kazandık", tone: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  LOSS: { label: "Kaybettik", tone: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  DRAW: { label: "Berabere", tone: "text-bdo-text-muted", bg: "bg-bdo-surface-2 border-bdo-border" },
} as const;

type TabKey = "upcoming" | "past";

export default function WarsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [wars, setWars] = useState<War[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("upcoming");
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/wars")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setWars(d); setLoading(false); });
  }, [status]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = wars.filter((w) => new Date(w.date).getTime() >= now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const pa = wars.filter((w) => new Date(w.date).getTime() < now);
    return { upcoming: up, past: pa };
  }, [wars]);

  async function respond(warId: number, newStatus: string) {
    setBusy(warId);
    const res = await fetch(`/api/wars/${warId}/participate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setWars((prev) => prev.map((w) => w.id === warId
        ? { ...w, participants: [{ status: newStatus }] }
        : w));
    }
    setBusy(null);
  }

  if (status === "loading" || loading) return <Loading />;
  if (!session) return null;

  const myAttending = wars.filter((w) => w.participants[0]?.status === "ATTENDING").length;
  const wins = past.filter((w) => w.result === "WIN").length;
  const decided = past.filter((w) => w.result).length;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;

  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div>
      <PageHeader
        title="Savaşlar"
        desc="Yaklaşan savaşlara katılım bildir, geçmiş sonuçları incele."
        icon={Swords}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatTile label="Yaklaşan" value={upcoming.length} sub="savaş" icon={Timer} accent={upcoming.length > 0} />
        <StatTile label="Katıldığım" value={myAttending} sub="toplam" icon={Check} />
        <StatTile label="Geçmiş" value={past.length} sub="savaş" icon={Swords} />
        <StatTile label="Win Rate" value={`%${winRate}`} sub={`${wins}/${decided}`} icon={Trophy}
          tone={winRate >= 50 ? "text-emerald-400" : "text-bdo-text-primary"} />
      </div>

      <Tabs
        tabs={[
          { id: "upcoming" as TabKey, label: "Yaklaşan", icon: Timer, count: upcoming.length },
          { id: "past" as TabKey, label: "Geçmiş", icon: Trophy, count: past.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      <Card>
        <CardHeader
          title={tab === "upcoming" ? "Yaklaşan Savaşlar" : "Savaş Geçmişi"}
          icon={Swords}
          meta={`${list.length} kayıt`}
        />

        {list.length === 0 ? (
          <Empty
            icon={CalendarX}
            text={tab === "upcoming" ? "Yaklaşan savaş yok." : "Henüz tamamlanmış savaş yok."}
          />
        ) : (
          list.map((war) => {
            const Icon = TYPE_ICONS[war.type] ?? Pin;
            const d = new Date(war.date);
            const myStatus = war.participants[0]?.status ?? null;
            const deadlinePassed = war.deadline ? new Date() > new Date(war.deadline) : false;
            const isPast = tab === "past";
            const res = war.result ? RESULT[war.result as keyof typeof RESULT] : null;

            return (
              <div key={war.id} className="card-row items-start gap-3 py-2.5 flex-wrap">
                {/* Tarih */}
                <div className="w-9 text-center flex-shrink-0 pt-0.5">
                  <p className="text-[9px] uppercase text-bdo-text-secondary font-semibold tracking-wider leading-none">
                    {d.toLocaleDateString("tr-TR", { month: "short" })}
                  </p>
                  <p className="text-base font-bold text-bdo-text-primary leading-tight">{d.getDate()}</p>
                  <p className="text-[9px] text-bdo-text-secondary">
                    {d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                <div className="w-8 h-8 rounded-lg bg-bdo-surface-2 border border-bdo-border flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-bdo-gold/70" strokeWidth={1.75} />
                </div>

                {/* Bilgi */}
                <div className="flex-1 min-w-[150px] py-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Link href={`/wars/${war.id}`} className="text-[13px] font-medium text-bdo-text-primary hover:text-bdo-gold transition-colors">
                      {war.title}
                    </Link>
                    {war.isAllyWar ? (
                      <Handshake className="w-3 h-3 text-bdo-text-secondary flex-shrink-0" strokeWidth={2} />
                    ) : (
                      <Lock className="w-3 h-3 text-bdo-text-secondary flex-shrink-0" strokeWidth={2} />
                    )}
                    {res && (
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${res.bg} ${res.tone}`}>
                        {res.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-bdo-text-secondary">
                    <span>{getTypeName(war.type)}</span>
                    <span>·</span>
                    <span>
                      {war._count.participants}
                      {war.maxParticipants ? ` / ${war.maxParticipants}` : ""} katılımcı
                    </span>
                    {myStatus === "ATTENDING" && <span className="text-emerald-400 font-medium">· Katılıyorum</span>}
                    {myStatus === "DECLINED" && <span className="text-red-400 font-medium">· Katılmıyorum</span>}
                  </div>
                </div>

                {/* Aksiyon */}
                {!isPast && !deadlinePassed ? (
                  <div className="flex gap-1.5 flex-shrink-0 pt-0.5">
                    <button
                      onClick={() => respond(war.id, "ATTENDING")}
                      disabled={busy === war.id || myStatus === "ATTENDING"}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                        myStatus === "ATTENDING"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                          : "bg-bdo-surface-2 text-bdo-text-muted border-bdo-border hover:text-emerald-400 hover:border-emerald-500/30"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => respond(war.id, "DECLINED")}
                      disabled={busy === war.id || myStatus === "DECLINED"}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
                        myStatus === "DECLINED"
                          ? "bg-red-500/15 text-red-400 border-red-500/25"
                          : "bg-bdo-surface-2 text-bdo-text-muted border-bdo-border hover:text-red-400 hover:border-red-500/30"
                      }`}
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-bdo-text-secondary flex-shrink-0 pt-1.5">
                    {isPast ? "Tamamlandı" : "Süre doldu"}
                  </span>
                )}
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
