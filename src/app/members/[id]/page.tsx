"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { PortraitPanel } from "@/components/portrait-panel";
import { UserPerformanceStats } from "@/components/user-performance-stats";
import { getTypeName } from "@/lib/classes";

interface GsHistoryEntry { ap: number; dp: number; createdAt: string; }
interface WarEntry { id: number; title: string; type: string; date: string; result: string | null; }

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
  absenceCount?: number;
}

const resultEmoji: Record<string, string> = { WIN: "🏆", LOSS: "💀", DRAW: "🤝" };

export default function MemberProfilePage() {
  const { data: session, status } = useSession();
  const router  = useRouter();
  const params  = useParams();
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

  const attended = member.stats.attended;
  const totalWars = member.stats.totalWars;
  const rate = member.stats.attendanceRate;

  return (
    <div className="space-y-5">
      <Link href="/members" className="text-sm text-bdo-text-muted hover:text-bdo-gold transition-colors">
        ← Üyelere dön
      </Link>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5 md:items-start">

        {/* LEFT: Portrait panel — sticky on scroll */}
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

        {/* RIGHT: Stats + history */}
        <div className="flex flex-col gap-4">

          {/* Header */}
          <div>
            <h1 className="text-2xl font-black text-white leading-tight">
              {member.familyName || "İsimsiz"}
            </h1>
            <p className="text-sm text-bdo-text-muted mt-0.5">
              {member.siteRole?.name && (
                <span style={{ color: member.siteRole.color }} className="font-semibold mr-2">
                  {member.siteRole.name}
                </span>
              )}
              Üyelik: {new Date(member.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-1">Katılım</div>
              <div className="text-2xl font-bold font-mono text-bdo-gold">{attended}</div>
              <div className="text-[10px] text-bdo-text-muted">/ {totalWars} savaş</div>
            </div>
            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-1">Katılım Oranı</div>
              <div className={`text-2xl font-bold font-mono ${
                rate >= 70 ? "text-green-400" : rate >= 40 ? "text-yellow-400" : "text-red-400"
              }`}>%{rate}</div>
            </div>
            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-1">Gear Score</div>
              <div className="text-2xl font-bold font-mono text-bdo-gold">{member.ap + member.dp}</div>
              <div className="text-[10px] text-bdo-text-muted">{member.ap} AP / {member.dp} DP</div>
            </div>
          </div>

          {/* Admin: absence counter */}
          {session.user?.isAdmin && member.absenceCount !== undefined && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase text-red-400 tracking-wider mb-1">Seçildiği halde Katılmama</div>
              <div className="text-2xl font-bold font-mono text-red-400">{member.absenceCount}</div>
              <div className="text-[10px] text-red-300/70">Partide olup savaşa katılmamış sayısı</div>
            </div>
          )}

          {/* GS History */}
          {member.gsHistory.length > 1 && (
            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
              <h3 className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-4">GS Geçmişi</h3>
              <GsChart history={member.gsHistory} currentAp={member.ap} currentDp={member.dp} />
            </div>
          )}

          {/* Recent wars */}
          {member.wars.length > 0 && (
            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
              <h3 className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-3">Son Savaşlar</h3>
              <div className="space-y-1">
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

          {/* Performance */}
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <h3 className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-4">Hasar İstatistikleri</h3>
            <UserPerformanceStats userId={member.id} />
          </div>

        </div>
      </div>
    </div>
  );
}

// ── SVG GS Chart ──
function GsChart({ history, currentAp, currentDp }: { history: GsHistoryEntry[]; currentAp: number; currentDp: number }) {
  const data = [
    ...history.map((h) => ({ gs: h.ap + h.dp, date: h.createdAt })),
    { gs: currentAp + currentDp, date: new Date().toISOString() },
  ];

  const W = 500, H = 120;
  const pad = { top: 10, bottom: 22, left: 40, right: 10 };

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
          <stop offset="0%" stopColor="#d4a853" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#d4a853" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = pad.top + pct * (H - pad.top - pad.bottom);
        return (
          <g key={pct}>
            <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.05)" />
            <text x={pad.left - 5} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize="8">
              {Math.round(maxGs - pct * range)}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#gsGrad)" />
      <path d={linePath} fill="none" stroke="#d4a853" strokeWidth="2" />
      {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#d4a853" stroke="#1a1a2e" strokeWidth="1.5" />)}
      {points.filter((_, i) => i === 0 || i === points.length - 1).map((p, i) => (
        <text key={i} x={p.x} y={H - 6} textAnchor={i === 0 ? "start" : "end"} fill="rgba(255,255,255,0.3)" fontSize="7">
          {new Date(p.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
        </text>
      ))}
    </svg>
  );
}
