"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MemberChip, UserPerfStats } from "./member-chip";
import { useState } from "react";
import type { WarAttendanceSummary, AttendanceStatus } from "@/app/api/wars/attendance-history/route";


/** Parti rolleri — analizde her rol kendi içinde kıyaslanır */
const ROLES = [
  { key: "MAIN",    label: "Main",     mark: "⚔",  tone: "#e0b040" },
  { key: "DEFENSE", label: "Savunma",  mark: "⛨",  tone: "#6b93ff" },
  { key: "FLANK",   label: "Flank",    mark: "↱",  tone: "#b98cff" },
] as const;

interface PartyColumnProps {
  party: {
    id: number;
    name: string;
    isDefense: boolean;
    role?: string;
    members: { id: number; userId: number; asClass?: string | null; user: { id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string; guild?: { tag: string; color: string } | null } }[];
  };
  onRename: (partyId: number, name: string) => void;
  onDelete: (partyId: number) => void;
  onSetRole: (partyId: number, role: string) => Promise<{ error?: string }>;
  memberStats?: Record<number, UserPerfStats>;
  currentStatuses?: Record<number, AttendanceStatus>;
  onToggleShai?: (partyId: number, userId: number, next: string | null) => void;
  attendanceHistory?: WarAttendanceSummary[];
}

export function PartyColumn({ party, onRename, onDelete, onSetRole, memberStats, attendanceHistory, currentStatuses, onToggleShai }: PartyColumnProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(party.name);
  const [defenseErr, setDefenseErr] = useState<string | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: `party-${party.id}` });

  const memberIds = party.members.map((m) => `member-${m.userId}`);

  const role = party.role ?? (party.isDefense ? "DEFENSE" : "MAIN");
  const roleMeta = ROLES.find((r) => r.key === role) ?? ROLES[0];

  const count = party.members.length;
  const avgAp = count > 0 ? Math.round(party.members.reduce((s, m) => s + m.user.ap, 0) / count) : 0;
  const avgDp = count > 0 ? Math.round(party.members.reduce((s, m) => s + m.user.dp, 0) / count) : 0;
  const avgGs = avgAp + avgDp;

  // Partideki klan dağılımı — ittifak savaşlarında dengeyi görmek için
  const guildCounts = Array.from(
    party.members.reduce((m, mem) => {
      const g = mem.user.guild;
      if (!g) return m;
      const cur = m.get(g.tag) ?? { tag: g.tag, color: g.color, n: 0 };
      cur.n++;
      m.set(g.tag, cur);
      return m;
    }, new Map<string, { tag: string; color: string; n: number }>()).values(),
  ).sort((a, b) => b.n - a.n);

  function handleNameSave() {
    setEditing(false);
    if (name !== party.name) onRename(party.id, name);
  }

  async function handleSetRole(next: string) {
    setDefenseErr(null);
    const result = await onSetRole(party.id, next);
    if (result?.error) {
      setDefenseErr(result.error);
      setTimeout(() => setDefenseErr(null), 3000);
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-64 border rounded-lg p-3 transition-colors ${
        isOver ? "bg-bdo-surface border-bdo-gold" : "bg-bdo-surface"
      }`}
      style={!isOver ? { borderColor: roleMeta.tone + "3d", background: roleMeta.tone + "0a" } : undefined}
    >
      <div className="flex items-center justify-between mb-1">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameSave}
            onKeyDown={(e) => e.key === "Enter" && handleNameSave()}
            autoFocus
            className="bg-transparent border-b border-bdo-gold text-sm text-bdo-text-primary focus:outline-none w-full"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="text-sm text-bdo-text-muted hover:text-bdo-text-primary flex items-center gap-1">
            <span title={roleMeta.label} style={{ color: roleMeta.tone }}>{roleMeta.mark}</span>
            {party.name}
          </button>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-bdo-text-muted">{party.members.length}/20</span>
          {ROLES.map((r) => (
            <button
              key={r.key}
              onClick={() => handleSetRole(r.key)}
              title={r.label}
              className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
              style={role === r.key
                ? { color: r.tone, backgroundColor: r.tone + "26" }
                : { color: "#4d5c73" }}
            >
              {r.mark}
            </button>
          ))}
          <button onClick={() => onDelete(party.id)} className="text-xs text-red-400 hover:text-red-300">✕</button>
        </div>
      </div>
      {defenseErr && <p className="text-[10px] text-red-400 mb-1">{defenseErr}</p>}

      {/* AP/DP ortalama */}
      {count > 0 && (
        <div className="flex items-center gap-2 mb-2 text-[10px] font-mono">
          <span className="text-red-400/80" title="Ort. AP">⚔ {avgAp}</span>
          <span className="text-blue-400/80" title="Ort. DP">🛡 {avgDp}</span>
          <span className="ml-auto text-bdo-gold/70" title="Ort. GS">GS {avgGs}</span>
        </div>
      )}

      {guildCounts.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {guildCounts.map((g) => (
            <span
              key={g.tag}
              title={`${g.tag}: ${g.n} kişi`}
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
              style={{ color: g.color, borderColor: g.color + "38", backgroundColor: g.color + "14" }}
            >
              {g.tag} {g.n}
            </span>
          ))}
        </div>
      )}

      <SortableContext items={memberIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5 min-h-[60px]">
          {party.members.length === 0 && (
            <div className="border border-dashed border-bdo-border rounded-lg p-4 text-center text-xs text-bdo-text-muted">
              Buraya sürükle
            </div>
          )}
          {party.members.map((m) => (
            <div key={`member-${m.userId}`} className="w-full">
              <MemberChip
                id={`member-${m.userId}`}
                user={m.user}
                perf={memberStats?.[m.userId]}
                attendanceHistory={attendanceHistory}
                currentStatus={currentStatuses?.[m.userId]}
                asClass={m.asClass}
                onToggleShai={
                  onToggleShai ? (userId, next) => onToggleShai(party.id, userId, next) : undefined
                }
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
