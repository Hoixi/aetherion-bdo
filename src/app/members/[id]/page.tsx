"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { PortraitPanel } from "@/components/portrait-panel";
import { UserPerformanceStats } from "@/components/user-performance-stats";
import { getTypeName } from "@/lib/classes";
import { ArrowLeft, Trophy, Skull, Handshake, TrendingUp, Swords, AlertTriangle } from "lucide-react";
import { Loading, Card, CardHeader, Empty, GuildTag, type GuildInfo } from "@/components/ui";

interface GsHistoryEntry { ap: number; dp: number; createdAt: string }
interface WarEntry { id: number; title: string; type: string; date: string; result: string | null }

interface MemberProfile {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl: string;
  createdAt: string;
  siteRole: { name: string; color: string } | null;
  guild: GuildInfo | null;
  stats: { totalWars: number; attended: number; attendanceRate: number };
  wars: WarEntry[];
  gsHistory: GsHistoryEntry[];
  absenceCount?: number;
}

const RESULT_ICON = { WIN: Trophy, LOSS: Skull, DRAW: Handshake } as const;
const RESULT_TONE = { WIN: "text-emerald-400", LOSS: "text-red-400", DRAW: "text-bdo-text-muted" } as const;

export default function MemberProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const memberId = params.id as string;
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !memberId) return;
    setLoading(true);
    fetch(`/api/members/${memberId}/profile`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) setMember(data);
        else router.push("/members");
        setLoading(false);
      });
  }, [status, memberId, router]);

  if (status === "loading" || loading) return <Loading />;
  if (!session || !member) return null;

  const { attended, totalWars, attendanceRate: rate } = member.stats;

  return (
    <div>
      <Link
        href="/members"
        className="inline-flex items-center gap-1.5 text-[12px] text-bdo-text-secondary hover:text-bdo-gold transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
        Üyelere dön
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:items-start">
        <div className="md:sticky md:top-4">
          <PortraitPanel
            classId={member.class}
            spec={member.spec}
            ap={member.ap}
            dp={member.dp}
            roleName={member.siteRole?.name}
            roleColor={member.siteRole?.color}
          />
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="section-title">{member.familyName || "İsimsiz"}</h1>
              <GuildTag guild={member.guild} />
            </div>
            <p className="section-desc">
              {member.siteRole?.name && (
                <span style={{ color: member.siteRole.color }} className="font-semibold">
                  {member.siteRole.name} ·{" "}
                </span>
              )}
              Üyelik: {new Date(member.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="card px-4 py-3">
              <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider mb-1">Katılım</p>
              <p className="text-xl font-bold font-mono text-bdo-text-primary">{attended}</p>
              <p className="text-[10px] text-bdo-text-secondary mt-0.5">/ {totalWars} savaş</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider mb-1">Oran</p>
              <p className={`text-xl font-bold font-mono ${
                rate >= 70 ? "text-emerald-400" : rate >= 40 ? "text-yellow-400" : "text-red-400"
              }`}>%{rate}</p>
              <p className="text-[10px] text-bdo-text-secondary mt-0.5">katılım oranı</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider mb-1">Gear Puanı</p>
              <p className="text-xl font-bold font-mono text-bdo-gold">{member.ap + member.dp}</p>
              <p className="text-[10px] text-bdo-text-secondary mt-0.5">{member.ap} AP · {member.dp} DP</p>
            </div>
          </div>

          {session.user?.isAdmin && member.absenceCount !== undefined && member.absenceCount > 0 && (
            <div className="card border-red-500/20 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" strokeWidth={1.75} />
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-red-400 leading-tight">Seçildiği halde katılmama</p>
                  <p className="text-[11px] text-bdo-text-secondary leading-tight mt-0.5">
                    Partide olup savaşa katılmamış sayısı
                  </p>
                </div>
                <span className="text-lg font-bold font-mono text-red-400">{member.absenceCount}</span>
              </div>
            </div>
          )}

          {member.gsHistory.length > 1 && (
            <Card>
              <CardHeader title="GS Geçmişi" icon={TrendingUp} />
              <div className="p-4">
                <GsChart history={member.gsHistory} currentAp={member.ap} currentDp={member.dp} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Son Savaşlar" icon={Swords} meta={`${member.wars.length} kayıt`} />
            {member.wars.length === 0 ? (
              <Empty text="Henüz savaş kaydı yok." />
            ) : (
              member.wars.slice(0, 10).map((war) => {
                const ResultIcon = war.result ? RESULT_ICON[war.result as keyof typeof RESULT_ICON] : null;
                return (
                  <Link key={war.id} href={`/wars/${war.id}`} className="card-row justify-between">
                    <div className="min-w-0">
                      <p className="text-[13px] text-bdo-text-primary truncate leading-tight">{war.title}</p>
                      <p className="text-[10px] text-bdo-text-secondary leading-tight mt-0.5">{getTypeName(war.type)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {ResultIcon && (
                        <ResultIcon
                          className={`w-3.5 h-3.5 ${RESULT_TONE[war.result as keyof typeof RESULT_TONE]}`}
                          strokeWidth={1.75}
                        />
                      )}
                      <span className="text-[11px] text-bdo-text-secondary font-mono">
                        {new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </Card>

          <Card>
            <CardHeader title="Hasar İstatistikleri" />
            <div className="p-4">
              <UserPerformanceStats userId={member.id} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GsChart({ history, currentAp, currentDp }: { history: GsHistoryEntry[]; currentAp: number; currentDp: number }) {
  const data = [
    ...history.map((h) => ({ gs: h.ap + h.dp, date: h.createdAt })),
    { gs: currentAp + currentDp, date: new Date().toISOString() },
  ];

  const W = 500, H = 120;
  const pad = { top: 10, bottom: 22, left: 38, right: 8 };

  const gsValues = data.map((d) => d.gs);
  const minGs = Math.min(...gsValues) - 10;
  const maxGs = Math.max(...gsValues) + 10;
  const range = maxGs - minGs || 1;

  const points = data.map((d, i) => ({
    x: pad.left + (i / (data.length - 1)) * (W - pad.left - pad.right),
    y: pad.top + (1 - (d.gs - minGs) / range) * (H - pad.top - pad.bottom),
    gs: d.gs,
    date: d.date,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${H - pad.bottom} L ${points[0].x} ${H - pad.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32">
      <defs>
        <linearGradient id="gsGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a030" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#d4a030" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = pad.top + pct * (H - pad.top - pad.bottom);
        return (
          <g key={pct}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="#1e2a3c" />
            <text x={pad.left - 5} y={y + 3} textAnchor="end" fill="#4d5c73" fontSize="8">
              {Math.round(maxGs - pct * range)}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#gsGrad)" />
      <path d={linePath} fill="none" stroke="#d4a030" strokeWidth="1.75" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#d4a030" stroke="#131820" strokeWidth="1.5" />)}
      {points.filter((_, i) => i === 0 || i === points.length - 1).map((p, i) => (
        <text key={i} x={p.x} y={H - 6} textAnchor={i === 0 ? "start" : "end"} fill="#4d5c73" fontSize="7">
          {new Date(p.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
        </text>
      ))}
    </svg>
  );
}
