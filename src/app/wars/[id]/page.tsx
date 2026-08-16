"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PartyBuilder } from "@/components/party-builder";
import { UserPerfStats } from "@/components/member-chip";
import type { WarAttendanceSummary } from "@/app/api/wars/attendance-history/route";
import { getTypeName } from "@/lib/classes";
import { classifyAttendance, ATTENDANCE_META, attendanceKnown } from "@/lib/attendance";
import {
  ArrowLeft, Check, X, HelpCircle, AlertTriangle, Users, Send, Clock, Swords,
} from "lucide-react";
import Link from "next/link";
import { Loading, Card, CardHeader, Empty, Button, Avatar, GuildTag, type GuildInfo as Guild } from "@/components/ui";

interface WarPerf {
  id: number;
  inGameName: string;
  kills: number; deaths: number; killStreak: number;
  damageDealt: number; damageTaken: number; ccCount: number;
  hpHeal: number; allyHpHeal: number; castleDamage: number;
  cannonHits: number; cannonDestroys: number; cannonMaxRange: number;
  trapExplosions: number;
  user: { familyName: string; avatarUrl: string; class: string } | null;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

interface User {
  id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string;
  guild?: Guild | null;
}
interface PartyMember { id: number; userId: number; order: number; user: User }
interface Party { id: number; name: string; order: number; isDefense: boolean; members: PartyMember[] }
interface Participant { id: number; status: string; user: User }

interface WarDetail {
  id: number;
  title: string;
  type: string;
  date: string;
  notes: string;
  deadline: string | null;
  maxParticipants: number | null;
  participants: Participant[];
  parties: Party[];
}

const PERF_COLS = [
  { key: "kills", label: "Kill", tone: "text-bdo-text-primary" },
  { key: "deaths", label: "Ölüm", tone: "text-bdo-text-muted" },
  { key: "killStreak", label: "Seri", tone: "text-bdo-text-muted" },
  { key: "damageDealt", label: "Ver. Hasar", tone: "text-bdo-gold font-semibold", fmt: true },
  { key: "damageTaken", label: "Al. Hasar", tone: "text-red-400/70", fmt: true },
  { key: "ccCount", label: "CC", tone: "text-bdo-text-muted" },
  { key: "hpHeal", label: "HP Yenile", tone: "text-emerald-400/70", fmt: true },
  { key: "allyHpHeal", label: "Mütt. HP", tone: "text-emerald-400/60", fmt: true },
  { key: "castleDamage", label: "Kale", tone: "text-orange-400/70", fmt: true },
  { key: "cannonHits", label: "Top", tone: "text-bdo-text-muted" },
  { key: "trapExplosions", label: "Tuzak", tone: "text-bdo-text-muted" },
] as const;

export default function WarDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const warId = params.id as string;

  const [war, setWar] = useState<WarDetail | null>(null);
  const [allMembers, setAllMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [publishingParties, setPublishingParties] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [performances, setPerformances] = useState<WarPerf[]>([]);
  const [absentMembers, setAbsentMembers] = useState<{ id: number; familyName: string; avatarUrl: string }[]>([]);
  const [memberStats, setMemberStats] = useState<Record<number, UserPerfStats>>({});
  const [attendanceHistory, setAttendanceHistory] = useState<WarAttendanceSummary[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !warId) return;

    async function fetchWar() {
      setLoading(true);
      const [warRes, membersRes, perfRes, statsRes, historyRes] = await Promise.all([
        fetch(`/api/wars/${warId}`),
        fetch("/api/members"),
        fetch(`/api/wars/${warId}/performance`),
        fetch("/api/performances/user-averages"),
        fetch("/api/wars/attendance-history"),
      ]);
      if (warRes.ok) {
        const data = await warRes.json();
        setWar(data);
        const mine = data.participants.find((p: Participant) => p.user.id === session?.user?.id);
        setMyStatus(mine?.status ?? null);
      } else {
        router.push("/dashboard");
      }
      if (membersRes.ok) setAllMembers(await membersRes.json());
      if (perfRes.ok) {
        const perfData = await perfRes.json();
        setPerformances(perfData.performances ?? []);
        setAbsentMembers(perfData.absent ?? []);
      }
      if (statsRes.ok) setMemberStats(await statsRes.json());
      if (historyRes.ok) setAttendanceHistory(await historyRes.json());
      setLoading(false);
    }

    fetchWar();
  }, [status, warId, router, session?.user?.id]);

  async function handleParticipate(newStatus: string) {
    if (!war) return;
    setStatusLoading(true);
    const res = await fetch(`/api/wars/${war.id}/participate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setMyStatus(newStatus);
      const warRes = await fetch(`/api/wars/${warId}`);
      if (warRes.ok) setWar(await warRes.json());
    }
    setStatusLoading(false);
  }

  if (status === "loading" || loading) return <Loading />;
  if (!session || !war) return null;

  const attending = war.participants.filter((p) => p.status === "ATTENDING").map((p) => p.user);
  const declined = war.participants.filter((p) => p.status === "DECLINED").map((p) => p.user);
  const respondedIds = new Set(war.participants.map((p) => p.user.id));
  const notResponded = allMembers.filter((m) => !respondedIds.has(m.id));

  // Katılanların klan bazlı dağılımı
  const guildBreakdown = Array.from(
    attending.reduce((map, u) => {
      if (!u.guild) return map;
      map.set(u.guild.id, { guild: u.guild, count: (map.get(u.guild.id)?.count ?? 0) + 1 });
      return map;
    }, new Map<number, { guild: Guild; count: number }>()).values()
  ).sort((a, b) => b.count - a.count);

  // Bu savaşın kendi durumları — geçmiş savaş geçmişiyle aynı sınıflandırma
  const selectedIds = new Set(war.parties.flatMap((p) => p.members.map((m) => m.userId)));
  const cameIds = new Set<number>();
  {
    const byName = new Map(allMembers.map((m) => [m.familyName.toLowerCase(), m.id]));
    for (const perf of performances) {
      const uid = perf.user
        ? byName.get(perf.user.familyName.toLowerCase())
        : byName.get(perf.inGameName.toLowerCase());
      if (uid) cameIds.add(uid);
    }
  }
  // Rapor yüklenmeden kimin geldiği bilinemez; o ana kadar sadece seçim durumu gösterilir
  const knowsAttendance = attendanceKnown(performances.length);

  function statusOf(userId: number, participantStatus: string) {
    return classifyAttendance(
      participantStatus,
      selectedIds.has(userId),
      knowsAttendance ? cameIds.has(userId) : false,
    );
  }

  const attendingCounts = war.participants
    .filter((p) => p.status === "ATTENDING")
    .reduce((m, p) => {
      const st = statusOf(p.user.id, "ATTENDING");
      m.set(st, (m.get(st) ?? 0) + 1);
      return m;
    }, new Map<string, number>());

  const deadlinePassed = war.deadline ? new Date() > new Date(war.deadline) : false;
  const warDate = new Date(war.date);
  const overCap = war.maxParticipants && attending.length > war.maxParticipants;

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-[12px] text-bdo-text-secondary hover:text-bdo-gold transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
        Dashboard&apos;a dön
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="section-title">{war.title}</h1>
            <span className="text-[10px] bg-bdo-surface border border-bdo-border text-bdo-text-muted px-2 py-0.5 rounded font-semibold uppercase tracking-wide">
              {getTypeName(war.type)}
            </span>
          </div>
          <p className="section-desc flex items-center gap-1.5">
            <Clock className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
            {warDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>

        {deadlinePassed ? (
          <span className="text-[11px] text-red-400/70 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" strokeWidth={1.75} />
            Katılım süresi doldu
          </span>
        ) : (
          <div className="flex gap-1.5 flex-shrink-0">
            <Button
              variant={myStatus === "ATTENDING" ? "success" : "ghost"}
              size="md" icon={Check}
              onClick={() => handleParticipate("ATTENDING")}
              disabled={statusLoading || myStatus === "ATTENDING"}
            >
              Katılıyorum
            </Button>
            <Button
              variant={myStatus === "DECLINED" ? "danger" : "ghost"}
              size="md" icon={X}
              onClick={() => handleParticipate("DECLINED")}
              disabled={statusLoading || myStatus === "DECLINED"}
            >
              Katılmıyorum
            </Button>
          </div>
        )}
      </div>

      {war.notes && (
        <div className="card p-3 mb-4">
          <p className="text-[13px] text-bdo-text-muted leading-relaxed">{war.notes}</p>
        </div>
      )}

      {/* Participation lists */}
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <Card>
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />
              <span className="card-title">Katılanlar</span>
            </div>
            <span className={`text-[11px] font-mono font-semibold ${overCap ? "text-yellow-400" : "text-bdo-text-secondary"}`}>
              {attending.length}{war.maxParticipants ? ` / ${war.maxParticipants}` : ""}
              {Array.from(attendingCounts.entries()).map(([st, n]) => {
                const meta = ATTENDANCE_META[st as keyof typeof ATTENDANCE_META];
                return (
                  <span key={st} title={meta.label} className="ml-2 font-normal" style={{ color: meta.color }}>
                    {meta.mark}{n}
                  </span>
                );
              })}
            </span>
          </div>
          {overCap && (
            <div className="flex items-center gap-1.5 px-4 py-1.5 bg-yellow-500/8 border-b border-bdo-border">
              <AlertTriangle className="w-3 h-3 text-yellow-400 flex-shrink-0" strokeWidth={2} />
              <span className="text-[10px] text-yellow-400">
                {attending.length - war.maxParticipants!} kişi fazla
              </span>
            </div>
          )}
          {guildBreakdown.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-bdo-border">
              {guildBreakdown.map(({ guild, count }) => (
                <span
                  key={guild.id}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border"
                  style={{ color: guild.color, borderColor: `${guild.color}35`, backgroundColor: `${guild.color}12` }}
                >
                  {guild.tag}
                  <span className="font-mono">{count}</span>
                </span>
              ))}
            </div>
          )}
          {attending.length === 0 ? (
            <Empty text="Henüz katılan yok." />
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {attending.map((u) => {
                const meta = ATTENDANCE_META[statusOf(u.id, "ATTENDING")];
                return (
                  <div key={u.id} className="card-row gap-2.5">
                    <Avatar src={u.avatarUrl} size={22} />
                    <span className="text-[13px] text-bdo-text-primary truncate flex-1">{u.familyName}</span>
                    <span
                      title={meta.label}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ color: meta.color, backgroundColor: meta.bg }}
                    >
                      {meta.mark} {meta.short}
                    </span>
                    <GuildTag guild={u.guild} />
                    <span className="text-[11px] font-mono font-semibold text-bdo-gold flex-shrink-0">{u.ap + u.dp}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="card-header">
            <div className="flex items-center gap-2">
              <X className="w-3.5 h-3.5 text-red-400" strokeWidth={2.5} />
              <span className="card-title">Katılmayanlar</span>
            </div>
            <span className="text-[11px] font-mono text-bdo-text-secondary">{declined.length}</span>
          </div>
          {declined.length === 0 ? (
            <Empty text="Kimse reddetmedi." />
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {declined.map((u) => (
                <div key={u.id} className="card-row gap-2.5 opacity-60">
                  <Avatar src={u.avatarUrl} size={22} />
                  <span className="text-[13px] text-bdo-text-muted truncate">{u.familyName}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="card-header">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-3.5 h-3.5 text-yellow-400/70" strokeWidth={2} />
              <span className="card-title">Bildirmedi</span>
            </div>
            <span className="text-[11px] font-mono text-bdo-text-secondary">{notResponded.length}</span>
          </div>
          {notResponded.length === 0 ? (
            <Empty text="Herkes cevap verdi." />
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notResponded.map((u) => (
                <div key={u.id} className="card-row gap-2.5 opacity-50">
                  <Avatar src={u.avatarUrl} size={22} />
                  <span className="text-[13px] text-bdo-text-muted truncate">{u.familyName}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Party builder (admin) */}
      {session.user.canManageWars && (
        <div className="mb-4">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div>
              <h2 className="text-[15px] font-bold text-bdo-text-primary">Parti Builder</h2>
              <p className="text-[11px] text-bdo-text-secondary mt-0.5">
                Katılımcıları partilere dağıt, Discord&apos;a yayınla.
              </p>
            </div>
            {war.parties.length > 0 && (
              <div className="flex items-center gap-2">
                {publishMsg && <span className="text-[11px] text-bdo-gold">{publishMsg}</span>}
                <Button
                  variant="ghost" icon={Send}
                  onClick={async () => {
                    setPublishingParties(true);
                    const res = await fetch("/api/discord/publish", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "parties", id: war.id }),
                    });
                    setPublishMsg(res.ok ? "Gönderildi!" : "Gönderilemedi.");
                    setPublishingParties(false);
                    setTimeout(() => setPublishMsg(null), 3000);
                  }}
                  disabled={publishingParties}
                >
                  {publishingParties ? "Gönderiliyor..." : "Discord'a Gönder"}
                </Button>
              </div>
            )}
          </div>

          {attendanceHistory.length > 0 && (
            <div className="card px-3 py-2 mb-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-bdo-text-secondary items-center">
                <span className="font-semibold text-bdo-text-muted">Son {attendanceHistory.length} savaş:</span>
                <span><span className="text-[#6b93ff] font-bold">✓</span> başvurdu, seçilmedi</span>
                <span><span className="text-red-400 font-bold">✕</span> seçildi, gelmedi</span>
                <span><span className="text-emerald-400 font-bold">✓</span> savaşa geldi</span>
              </div>
            </div>
          )}

          <PartyBuilder
            warId={war.id}
            attendees={attending}
            initialParties={war.parties}
            maxParticipants={war.maxParticipants}
            memberStats={memberStats}
            attendanceHistory={attendanceHistory}
          />
        </div>
      )}

      {/* Performance table */}
      {performances.length > 0 && (
        <Card className="mb-4">
          <CardHeader title="Hasar Raporu" icon={Swords} meta={`${performances.length} oyuncu`} />
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-bdo-border bg-bdo-bg/40">
                  <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-bdo-text-secondary whitespace-nowrap">
                    Aile Adı
                  </th>
                  {PERF_COLS.map((c) => (
                    <th key={c.key} className="text-right py-2.5 px-3 text-[10px] uppercase tracking-wider font-medium text-bdo-text-secondary whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {performances.map((p) => (
                  <tr key={p.id} className="border-b border-bdo-border/40 last:border-0 hover:bg-bdo-surface-2/60 transition-colors">
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <Avatar src={p.user?.avatarUrl} size={20} ring={false} />
                        <span className="text-bdo-text-primary font-medium">{p.inGameName}</span>
                      </div>
                    </td>
                    {PERF_COLS.map((c) => {
                      const val = p[c.key as keyof WarPerf] as number;
                      return (
                        <td key={c.key} className={`py-2 px-3 text-right font-mono ${c.tone}`}>
                          {"fmt" in c && c.fmt ? fmtNum(val) : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {absentMembers.length > 0 && (
            <div className="border-t border-bdo-border p-3 bg-red-500/5">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" strokeWidth={2} />
                <p className="text-[11px] font-semibold text-red-400">
                  Katılacağını bildirdi, oyunda görünmüyor ({absentMembers.length})
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {absentMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                    <Avatar src={m.avatarUrl} size={14} ring={false} />
                    <span className="text-[11px] text-red-300/90">{m.familyName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Parties (non-admin view) */}
      {war.parties.length > 0 && !session.user.canManageWars && (
        <div>
          <h2 className="text-[15px] font-bold text-bdo-text-primary mb-3">Partiler</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {war.parties.map((party) => (
              <Card key={party.id}>
                <div className="card-header">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-bdo-text-secondary" strokeWidth={1.75} />
                    <span className="card-title">{party.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-bdo-text-secondary">{party.members.length}</span>
                </div>
                {party.members.map((m) => (
                  <div key={m.id} className="card-row gap-2.5">
                    <Avatar src={m.user.avatarUrl} size={20} />
                    <span className="text-[12px] text-bdo-text-primary truncate flex-1">{m.user.familyName}</span>
                    <GuildTag guild={m.user.guild} />
                    <span className="text-[11px] font-mono text-bdo-gold flex-shrink-0">{m.user.ap + m.user.dp}</span>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
