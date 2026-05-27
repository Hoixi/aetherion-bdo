"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PartyBuilder } from "@/components/party-builder";
import { UserPerfStats } from "@/components/member-chip";
import type { WarAttendanceSummary } from "@/app/api/wars/attendance-history/route";
import { getTypeName } from "@/lib/classes";

interface WarPerf {
  id: number;
  inGameName: string;
  kills: number;
  deaths: number;
  killStreak: number;
  damageDealt: number;
  damageTaken: number;
  ccCount: number;
  hpHeal: number;
  allyHpHeal: number;
  castleDamage: number;
  cannonHits: number;
  cannonDestroys: number;
  cannonMaxRange: number;
  trapExplosions: number;
  user: { familyName: string; avatarUrl: string; class: string } | null;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 100_000) return Math.round(n / 1_000) + "B";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

interface User {
  id: number;
  familyName: string;
  class: string;
  ap: number;
  dp: number;
  avatarUrl: string;
}

interface PartyMember {
  id: number;
  userId: number;
  order: number;
  user: User;
}

interface Party {
  id: number;
  name: string;
  order: number;
  isDefense: boolean;
  members: PartyMember[];
}

interface Participant {
  id: number;
  status: string;
  user: User;
}

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
        const myParticipation = data.participants.find(
          (p: Participant) => p.user.id === session?.user?.id
        );
        setMyStatus(myParticipation?.status ?? null);
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
      // Refetch to update participant lists
      const warRes = await fetch(`/api/wars/${warId}`);
      if (warRes.ok) setWar(await warRes.json());
    }
    setStatusLoading(false);
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-bdo-text-muted">Yükleniyor...</p>
      </div>
    );
  }

  if (!session || !war) return null;

  const attending = war.participants
    .filter((p) => p.status === "ATTENDING")
    .map((p) => p.user);

  const declined = war.participants
    .filter((p) => p.status === "DECLINED")
    .map((p) => p.user);

  const respondedIds = new Set(war.participants.map((p) => p.user.id));
  const notResponded = allMembers.filter((m) => !respondedIds.has(m.id));

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-bdo-gold">{war.title}</h1>
          <span className="text-xs bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded">
            {getTypeName(war.type)}
          </span>
        </div>
        <p className="text-sm text-bdo-text-muted">
          {new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>
        {war.notes && <p className="mt-3 text-sm text-bdo-text-secondary bg-bdo-surface border border-bdo-border rounded-lg p-3">{war.notes}</p>}

        {/* Participation buttons */}
        {(() => {
          const deadlinePassed = war.deadline ? new Date() > new Date(war.deadline) : false;
          if (deadlinePassed) {
            return <p className="mt-4 text-xs text-red-400">Katılım süresi dolmuş.</p>;
          }
          return (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-bdo-text-muted">Katılım:</span>
              <button
                onClick={() => handleParticipate("ATTENDING")}
                disabled={statusLoading || myStatus === "ATTENDING"}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  myStatus === "ATTENDING"
                    ? "bg-bdo-gold text-bdo-bg"
                    : "bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20"
                } disabled:opacity-50`}
              >
                {myStatus === "ATTENDING" ? "Katılıyorum ✓" : "Katılıyorum"}
              </button>
              <button
                onClick={() => handleParticipate("DECLINED")}
                disabled={statusLoading || myStatus === "DECLINED"}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  myStatus === "DECLINED"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-bdo-border text-bdo-text-muted hover:bg-red-500/10 hover:text-red-400"
                } disabled:opacity-50`}
              >
                {myStatus === "DECLINED" ? "Katılmıyorum ✓" : "Katılmıyorum"}
              </button>
            </div>
          );
        })()}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <h3 className="text-sm text-bdo-text-muted uppercase mb-2">
          Katılanlar ({attending.length}{war.maxParticipants ? `/${war.maxParticipants}` : ""})
          {war.maxParticipants && attending.length > war.maxParticipants && (
            <span className="ml-2 text-yellow-500 text-xs normal-case">⚠️ +{attending.length - war.maxParticipants} fazla</span>
          )}
        </h3>
          <div className="space-y-1">
            {attending.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-sm bg-bdo-surface border border-bdo-border rounded px-3 py-2">
                {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}
                <span className="text-bdo-text-primary">{u.familyName}</span>
                <span className="text-bdo-gold font-mono text-xs ml-auto">{u.ap + u.dp}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm text-bdo-text-muted uppercase mb-2">Katılmayanlar ({declined.length})</h3>
          <div className="space-y-1">
            {declined.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-sm bg-bdo-surface border border-bdo-border/50 rounded px-3 py-2 opacity-60">
                {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}
                <span className="text-bdo-text-muted">{u.familyName}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm text-yellow-500/80 uppercase mb-2">Henüz Bildirmedi ({notResponded.length})</h3>
          <div className="space-y-1">
            {notResponded.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-sm bg-bdo-surface border border-yellow-500/20 rounded px-3 py-2 opacity-50">
                {u.avatarUrl && <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}
                <span className="text-bdo-text-muted">{u.familyName}</span>
                <span className="text-yellow-500/60 text-[10px] ml-auto">?</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {session.user.isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-bdo-text-primary">Parti Builder</h2>
            {war.parties.length > 0 && (
              <div className="flex items-center gap-2">
                {publishMsg && <span className="text-xs text-bdo-gold">{publishMsg}</span>}
                <button
                  onClick={async () => {
                    setPublishingParties(true);
                    const res = await fetch("/api/discord/publish", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ type: "parties", id: war.id }),
                    });
                    setPublishMsg(res.ok ? "Discord'a gönderildi!" : "Gönderilemedi.");
                    setPublishingParties(false);
                    setTimeout(() => setPublishMsg(null), 3000);
                  }}
                  disabled={publishingParties}
                  className="text-xs bg-[#5865F2]/10 text-[#5865F2] px-3 py-1.5 rounded-lg hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                  {publishingParties ? "Gönderiliyor..." : "Partileri Discord'a Gönder"}
                </button>
              </div>
            )}
          </div>
          {/* Legend */}
          {attendanceHistory.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4 text-[10px] text-bdo-text-muted bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2">
              <span className="font-semibold text-bdo-text-primary mr-1">Son {attendanceHistory.length} savaş:</span>
              <span><span className="text-green-400 font-bold">✓</span> Katıldı + seçildi + geldi</span>
              <span><span className="text-red-500 font-bold">✕</span> Katıldı + seçildi + <em>gelmedi</em></span>
              <span><span className="text-blue-400 font-bold">✓</span> Katıldı + seçilmedi</span>
              <span><span className="text-orange-400/60 font-bold">○</span> Katılmadı / cevap yok</span>
              <span><span className="text-orange-400 font-bold">✓</span> Katılmadı ama geldi</span>
              <span><span className="text-bdo-border font-bold">·</span> Veri yok</span>
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

      {performances.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-bdo-text-primary mb-4">Hasar Raporu</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-bdo-border text-bdo-text-muted">
                  <th className="text-left py-2 px-2 whitespace-nowrap">Aile Adı</th>
                  <th className="text-center py-2 px-2" title="Öldürme">💀</th>
                  <th className="text-center py-2 px-2" title="Ölüm">🪦</th>
                  <th className="text-center py-2 px-2" title="Seri">🔥</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Ver. Hasar</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Al. Hasar</th>
                  <th className="text-center py-2 px-2">CC</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">HP Yenile</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Mütt. HP</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Kale Hasar</th>
                  <th className="text-center py-2 px-2" title="Top İsabet">🏹</th>
                  <th className="text-center py-2 px-2" title="Tuzak">⚙️</th>
                </tr>
              </thead>
              <tbody>
                {performances.map((p) => (
                  <tr key={p.id} className="border-b border-bdo-border/50 hover:bg-bdo-surface/50 transition-colors">
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1.5">
                        {p.user?.avatarUrl && <img src={p.user.avatarUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />}
                        <span className="text-bdo-text-primary">{p.inGameName}</span>
                      </div>
                    </td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{p.kills}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{p.deaths}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{p.killStreak}</td>
                    <td className="text-right py-2 px-2 text-bdo-gold font-mono">{fmtNum(p.damageDealt)}</td>
                    <td className="text-right py-2 px-2 text-red-400/80 font-mono">{fmtNum(p.damageTaken)}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{p.ccCount}</td>
                    <td className="text-right py-2 px-2 text-green-400/80 font-mono">{fmtNum(p.hpHeal)}</td>
                    <td className="text-right py-2 px-2 text-green-400/60 font-mono">{fmtNum(p.allyHpHeal)}</td>
                    <td className="text-right py-2 px-2 text-orange-400/80 font-mono">{fmtNum(p.castleDamage)}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{p.cannonHits}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{p.trapExplosions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {absentMembers.length > 0 && (
            <div className="mt-3 bg-red-500/5 border border-red-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-400 mb-2">
                ⚠️ Katılacağını bildirdi ama oyunda görünmüyor ({absentMembers.length} kişi)
              </p>
              <div className="flex flex-wrap gap-2">
                {absentMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                    {m.avatarUrl && <img src={m.avatarUrl} alt="" className="w-4 h-4 rounded-full" />}
                    <span className="text-xs text-red-300">{m.familyName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {war.parties.length > 0 && !session.user.isAdmin && (
        <div>
          <h2 className="text-lg font-semibold text-bdo-text-primary mb-4">Partiler</h2>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {war.parties.map((party) => (
              <div key={party.id} className="flex-shrink-0 w-64 bg-bdo-surface border border-bdo-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-bdo-text-muted">{party.name}</span>
                  <span className="text-xs text-bdo-text-muted">{party.members.length} üye</span>
                </div>
                <div className="space-y-2">
                  {party.members.map((m) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm bg-bdo-bg border border-bdo-border rounded px-2 py-1.5">
                      {m.user.avatarUrl && <img src={m.user.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}
                      <span className="text-bdo-text-primary text-xs">{m.user.familyName}</span>
                      <span className="text-bdo-gold font-mono text-xs ml-auto">{m.user.ap + m.user.dp}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
