"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BDO_CLASSES } from "@/lib/classes";
import { useState } from "react";

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

interface MemberChipProps {
  id: string;
  user: { id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string };
  isDragOverlay?: boolean;
  perf?: UserPerfStats;
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

export function MemberChip({ id, user, isDragOverlay, perf }: MemberChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [showTooltip, setShowTooltip] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const className = BDO_CLASSES.find((c) => c.id === user.class)?.name ?? user.class;

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      className="relative"
    >
      {/* Tooltip */}
      {perf && showTooltip && !isDragging && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 w-56 bg-[#13131a] border border-bdo-border rounded-xl p-3 shadow-2xl pointer-events-none"
          style={{ minWidth: 220 }}
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
        {...attributes}
        {...listeners}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex items-center gap-2 bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none ${
          isDragOverlay ? "shadow-lg border-bdo-gold/50" : "hover:border-bdo-gold/30"
        }`}
      >
        {user.avatarUrl && <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full" />}
        <span className="text-sm text-bdo-text-primary whitespace-nowrap">{user.familyName}</span>
        <span className="text-xs text-bdo-text-muted">({className})</span>
        <div className="ml-auto flex items-center gap-1.5">
          {perf && <ScoreDot score={perf.score} />}
          <span className="text-xs text-bdo-gold font-mono">{user.ap}/{user.dp}</span>
        </div>
      </div>
    </div>
  );
}
