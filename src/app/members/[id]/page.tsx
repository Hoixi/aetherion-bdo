"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { CharacterCard } from "@/components/character-card";
import { UserPerformanceStats } from "@/components/user-performance-stats";
import { getTypeName } from "@/lib/classes";

interface GsHistoryEntry {
  ap: number;
  dp: number;
  createdAt: string;
}

interface WarEntry {
  id: number;
  title: string;
  type: string;
  date: string;
  result: string | null;
}

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
  stats: { totalWars: number; attended: number; attendanceRate: number };
  wars: WarEntry[];
  gsHistory: GsHistoryEntry[];
}

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

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-bdo-text-muted">Yükleniyor...</p></div>;
  }
  if (!session || !member) return null;

  const resultEmoji: Record<string, string> = { WIN: "🏆", LOSS: "💀", DRAW: "🤝" };

  return (
    <div className="space-y-6">
      <Link href="/members" className="text-sm text-bdo-text-muted hover:text-bdo-gold transition-colors">
        ← Üyelere dön
      </Link>

      <CharacterCard
        familyName={member.familyName}
        className={member.class}
        spec={member.spec}
        ap={member.ap}
        dp={member.dp}
        avatarUrl={member.avatarUrl}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 text-center">
          <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">Katılım</div>
          <div className="text-2xl font-bold font-mono text-bdo-gold mt-1">{member.stats.attended}</div>
          <div className="text-[10px] text-bdo-text-muted">/ {member.stats.totalWars} savaş</div>
        </div>
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 text-center">
          <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">Katılım Oranı</div>
          <div className={`text-2xl font-bold font-mono mt-1 ${
            member.stats.attendanceRate >= 70 ? "text-green-400" :
            member.stats.attendanceRate >= 40 ? "text-yellow-400" : "text-red-400"
          }`}>
            %{member.stats.attendanceRate}
          </div>
        </div>
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 text-center">
          <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">Gear Score</div>
          <div className="text-2xl font-bold font-mono text-bdo-gold mt-1">{member.ap + member.dp}</div>
          <div className="text-[10px] text-bdo-text-muted">{member.ap} AP / {member.dp} DP</div>
        </div>
      </div>

      {/* GS History Chart */}
      {member.gsHistory.length > 1 && (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
          <h3 className="text-xs uppercase text-bdo-text-muted mb-4">GS Geçmişi</h3>
          <GsChart history={member.gsHistory} currentAp={member.ap} currentDp={member.dp} />
        </div>
      )}

      {/* Recent Wars */}
      {member.wars.length > 0 && (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
          <h3 className="text-xs uppercase text-bdo-text-muted mb-3">Son Savaşlar</h3>
          <div className="space-y-2">
            {member.wars.slice(0, 10).map((war) => (
              <Link
                key={war.id}
                href={`/wars/${war.id}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-bdo-gold/5 transition-colors -mx-1"
              >
                <div>
                  <span className="text-sm text-bdo-text-primary">{war.title}</span>
                  <span className="ml-2 text-[10px] text-bdo-text-muted">{getTypeName(war.type)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {war.result && <span className="text-sm">{resultEmoji[war.result]}</span>}
                  <span className="text-xs text-bdo-text-muted">
                    {new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Performance Stats */}
      <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
        <h3 className="text-xs uppercase text-bdo-text-muted mb-4">Hasar İstatistikleri</h3>
        <UserPerformanceStats userId={member.id} />
      </div>

      {member.siteRole && (
        <div className="text-xs text-bdo-text-muted">
          Rol: <span style={{ color: member.siteRole.color }} className="font-semibold">{member.siteRole.name}</span>
          {" · "}Üyelik: {new Date(member.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      )}
    </div>
  );
}

// SVG-based GS chart
function GsChart({ history, currentAp, currentDp }: { history: GsHistoryEntry[]; currentAp: number; currentDp: number }) {
  // Add current values as the last point
  const data = [
    ...history.map((h) => ({ gs: h.ap + h.dp, date: h.createdAt })),
    { gs: currentAp + currentDp, date: new Date().toISOString() },
  ];

  const width = 500;
  const height = 120;
  const padding = { top: 10, bottom: 20, left: 40, right: 10 };

  const gsValues = data.map((d) => d.gs);
  const minGs = Math.min(...gsValues) - 10;
  const maxGs = Math.max(...gsValues) + 10;
  const range = maxGs - minGs || 1;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - (d.gs - minGs) / range) * (height - padding.top - padding.bottom);
    return { x, y, gs: d.gs, date: d.date };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = padding.top + pct * (height - padding.top - padding.bottom);
        const val = Math.round(maxGs - pct * range);
        return (
          <g key={pct}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
            <text x={padding.left - 5} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8">{val}</text>
          </g>
        );
      })}
      {/* Area fill */}
      <path d={areaPath} fill="url(#gsGradient)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke="#d4a853" strokeWidth="2" />
      {/* Points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#d4a853" stroke="#1a1a2e" strokeWidth="1.5" />
      ))}
      {/* Date labels */}
      {points.filter((_, i) => i === 0 || i === points.length - 1).map((p, i) => (
        <text key={i} x={p.x} y={height - 5} textAnchor={i === 0 ? "start" : "end"} fill="rgba(255,255,255,0.3)" fontSize="7">
          {new Date(p.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
        </text>
      ))}
      <defs>
        <linearGradient id="gsGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a853" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#d4a853" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
