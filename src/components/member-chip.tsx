"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BDO_CLASSES } from "@/lib/classes";
import { useState, useRef, useEffect } from "react";
import type { AttendanceStatus, WarAttendanceSummary } from "@/app/api/wars/attendance-history/route";

export interface UserPerfStats {
  wars: number;
  avgKills: number;
  avgDeaths: number;
  avgKillStreak: number;
  avgDamage: number;
  avgDamageTaken: number;
  avgCc: number;
  avgHeal: number;
  avgAllyHeal: number;
  maxKills: number;
  maxKillStreak: number;
  maxDamage: number;
  kdr: number;
  score: number;
}

// ─── Attendance dot ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AttendanceStatus, { icon: string; color: string; label: string }> = {
  attending_not_selected:    { icon: "✓", color: "text-blue-400",   label: "Katıldı — seçilmedi" },
  attending_selected_absent: { icon: "✕", color: "text-red-500",    label: "Seçildi — gelmedi" },
  attending_selected_came:   { icon: "✓", color: "text-green-400",  label: "Seçildi — geldi" },
  not_attending:             { icon: "○", color: "text-orange-400/60", label: "Katılmadı / cevap yok" },
  not_attending_came:        { icon: "✓", color: "text-orange-400", label: "Katılmadı — yine de geldi" },
};

function AttendanceDots({ userId, history }: { userId: number; history: WarAttendanceSummary[] }) {
  if (history.length === 0) return null;
  return (
    <div className="flex gap-0.5 mt-1 justify-center">
      {history.map((war) => {
        const status = war.statuses[userId];
        if (!status) {
          return (
            <span key={war.warId} title={`${war.title} — Veri yok`}
              className="text-[9px] leading-none text-bdo-border">·</span>
          );
        }
        const cfg = STATUS_CONFIG[status];
        return (
          <span key={war.warId}
            title={`${new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} — ${cfg.label}`}
            className={`text-[9px] leading-none font-bold ${cfg.color}`}>
            {cfg.icon}
          </span>
        );
      })}
    </div>
  );
}

interface MemberChipProps {
  id: string;
  user: { id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string };
  isDragOverlay?: boolean;
  perf?: UserPerfStats;
  attendanceHistory?: WarAttendanceSummary[];
}

function fmtDmg(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

function ScoreBar({ score }: { score: number }) {
  // score aralığı yaklaşık -10 ile +40 arası; clamp edip renklendir
  const clamped = Math.max(-15, Math.min(40, score));
  const pct = Math.round(((clamped + 15) / 55) * 100);
  const color = score >= 20 ? "#22c55e" : score >= 8 ? "#d4a853" : score >= 0 ? "#f59e0b" : "#ef4444";
  return (
    <div className="w-full h-1 bg-bdo-border rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function ScoreDot({ score }: { score: number }) {
  const color = score >= 20 ? "bg-green-400" : score >= 8 ? "bg-bdo-gold" : score >= 0 ? "bg-amber-400" : "bg-red-400";
  return (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} title={`Skor: ${score}`} />
  );
}

export function MemberChip({ id, user, isDragOverlay, perf, attendanceHistory }: MemberChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const chipRef = useRef<HTMLDivElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const className = BDO_CLASSES.find((c) => c.id === user.class)?.name ?? user.class;

  function handleMouseEnter() {
    if (!chipRef.current) return;
    const rect = chipRef.current.getBoundingClientRect();
    // Tooltip'i chip'in üstüne yerleştir, ekranın sağına taşmamas için sola hizala
    const left = Math.min(rect.left, window.innerWidth - 240);
    setTooltipPos({ top: rect.top - 8, left });
    setShowTooltip(true);
  }

  // Sürükleme başlayınca kapat
  useEffect(() => { if (isDragging) setShowTooltip(false); }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      className="relative"
    >
      {/* Tooltip — fixed pozisyon, overflow sorununu çözer */}
      {perf && showTooltip && !isDragging && (
        <div
          className="fixed z-[9999] w-56 bg-[#0f1020] border border-bdo-border rounded-xl p-3 shadow-2xl pointer-events-none"
          style={{ top: tooltipPos.top, left: tooltipPos.left, transform: "translateY(-100%)", minWidth: 220 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-bdo-text-primary">{user.familyName}</span>
            <span className="text-[10px] text-bdo-text-muted">{perf.wars} savaş</span>
          </div>

          <ScoreBar score={perf.score} />
          <div className="text-[10px] text-bdo-text-muted mt-0.5 mb-2">
            Skor: <span className="font-mono font-bold" style={{ color: perf.score >= 20 ? "#22c55e" : perf.score >= 8 ? "#d4a853" : perf.score >= 0 ? "#f59e0b" : "#ef4444" }}>{perf.score}</span>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-bdo-text-muted">⚔️ Ort. Öldürme</span>
              <span className="font-mono text-green-400 font-semibold">{perf.avgKills}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bdo-text-muted">💀 Ort. Ölüm</span>
              <span className="font-mono text-red-400 font-semibold">{perf.avgDeaths}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bdo-text-muted">📊 KDR</span>
              <span className="font-mono text-bdo-gold font-semibold">{perf.kdr.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-bdo-text-muted">🔥 En Uzun Seri</span>
              <span className="font-mono text-amber-400 font-semibold">{perf.avgKillStreak}</span>
            </div>
            <div className="flex justify-between col-span-2">
              <span className="text-bdo-text-muted">💥 Ort. Hasar</span>
              <span className="font-mono text-orange-400 font-semibold">{fmtDmg(perf.avgDamage)}</span>
            </div>
            {perf.avgCc > 0 && (
              <div className="flex justify-between col-span-2">
                <span className="text-bdo-text-muted">🌀 Ort. CC</span>
                <span className="font-mono text-purple-400 font-semibold">{perf.avgCc}</span>
              </div>
            )}
            {perf.avgHeal > 0 && (
              <div className="flex justify-between col-span-2">
                <span className="text-bdo-text-muted">💊 Ort. Heal</span>
                <span className="font-mono text-emerald-400 font-semibold">{fmtDmg(perf.avgHeal)}</span>
              </div>
            )}
          </div>

          {/* Max records */}
          <div className="mt-2 pt-2 border-t border-bdo-border/50 flex gap-3 text-[10px] text-bdo-text-muted">
            <span>Max kill: <span className="text-green-400 font-mono">{perf.maxKills}</span></span>
            <span>Max hasar: <span className="text-orange-400 font-mono">{fmtDmg(perf.maxDamage)}</span></span>
          </div>
        </div>
      )}

      {/* Chip */}
      <div
        ref={chipRef}
        {...attributes}
        {...listeners}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShowTooltip(false)}
        className={`bg-bdo-surface border border-bdo-border rounded-lg px-2.5 py-1.5 cursor-grab active:cursor-grabbing select-none ${
          isDragOverlay ? "shadow-lg border-bdo-gold/50" : "hover:border-bdo-gold/30"
        }`}
      >
        {/* Row 1: avatar + name + class */}
        <div className="flex items-center gap-1.5">
          {user.avatarUrl && <img src={user.avatarUrl} alt="" className="w-5 h-5 rounded-full shrink-0" />}
          <span className="text-xs font-semibold text-bdo-text-primary truncate">{user.familyName}</span>
          <span className="text-[10px] text-bdo-text-muted shrink-0">({className})</span>
        </div>
        {/* Row 2: AP/DP + score */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-bdo-gold font-mono">{user.ap}/{user.dp}</span>
          {perf && (
            <span className="text-[10px] font-mono font-semibold ml-auto" style={{ color: perf.score >= 20 ? "#22c55e" : perf.score >= 8 ? "#d4a853" : perf.score >= 0 ? "#f59e0b" : "#ef4444" }}>
              {perf.score}p
            </span>
          )}
        </div>
        {/* Row 3: attendance dots */}
        {!isDragOverlay && attendanceHistory && (
          <AttendanceDots userId={user.id} history={attendanceHistory} />
        )}
      </div>
    </div>
  );
}
