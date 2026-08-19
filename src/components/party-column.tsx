"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MemberChip, UserPerfStats } from "./member-chip";
import { useState } from "react";
import { Trash2, Pencil } from "lucide-react";
import type { WarAttendanceSummary, AttendanceStatus } from "@/app/api/wars/attendance-history/route";

/**
 * Tek bir parti sütunu.
 *
 * Rol seçimi üç ayrı simge butonu yerine tek bir segment şeridi: hangisinin
 * seçili olduğu bir bakışta görünüyor, yanlışlıkla başkasına basmak zor.
 * Başlıkta yalnızca ad, doluluk ve ortalama GS var; klan dağılımı ve
 * silme gibi daha seyrek işler alt satıra indi.
 */

export const ROLES = [
  { key: "MAIN", label: "Main", tone: "#e8b451" },
  { key: "DEFENSE", label: "Savunma", tone: "#6b93ff" },
  { key: "FLANK", label: "Flank", tone: "#b98cff" },
] as const;

export type PartyMemberData = {
  id: number;
  userId: number;
  asClass?: string | null;
  user: {
    id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string;
    guild?: { tag: string; color: string } | null;
  };
};

interface PartyColumnProps {
  party: { id: number; name: string; isDefense: boolean; role?: string; members: PartyMemberData[] };
  onRename: (partyId: number, name: string) => void;
  onDelete: (partyId: number) => void;
  onSetRole: (partyId: number, role: string) => Promise<{ error?: string }>;
  memberStats?: Record<number, UserPerfStats>;
  currentStatuses?: Record<number, AttendanceStatus>;
  attendanceHistory?: WarAttendanceSummary[];
  /** Parti başına üye sınırı */
  capacity?: number;
}

export function PartyColumn({
  party, onRename, onDelete, onSetRole, memberStats, attendanceHistory,
  currentStatuses, capacity = 20,
}: PartyColumnProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(party.name);
  const [roleErr, setRoleErr] = useState<string | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: `party-${party.id}` });

  const memberIds = party.members.map((m) => `member-${m.userId}`);
  const role = party.role ?? (party.isDefense ? "DEFENSE" : "MAIN");
  const roleMeta = ROLES.find((r) => r.key === role) ?? ROLES[0];

  const count = party.members.length;
  const avgAp = count ? Math.round(party.members.reduce((s, m) => s + m.user.ap, 0) / count) : 0;
  const avgDp = count ? Math.round(party.members.reduce((s, m) => s + m.user.dp, 0) / count) : 0;

  // İttifak savaşlarında dengeyi görmek için
  const guilds = Array.from(
    party.members.reduce((m, mem) => {
      const g = mem.user.guild;
      if (!g) return m;
      const cur = m.get(g.tag) ?? { tag: g.tag, color: g.color, n: 0 };
      cur.n++;
      m.set(g.tag, cur);
      return m;
    }, new Map<string, { tag: string; color: string; n: number }>()).values(),
  ).sort((a, b) => b.n - a.n);

  function saveName() {
    setEditing(false);
    if (name !== party.name) onRename(party.id, name);
  }

  async function pickRole(next: string) {
    setRoleErr(null);
    const res = await onSetRole(party.id, next);
    if (res?.error) {
      setRoleErr(res.error);
      setTimeout(() => setRoleErr(null), 3000);
    }
  }

  return (
    <div ref={setNodeRef}
         className="flex-shrink-0 w-[268px] rounded-xl border transition-colors bg-bdo-surface"
         style={{
           borderColor: isOver ? "var(--tw-ring-color, #e8b451)" : roleMeta.tone + "33",
           boxShadow: isOver ? `0 0 0 1px ${roleMeta.tone}` : undefined,
         }}>
      {/* Başlık */}
      <div className="px-3 pt-2.5 pb-2 border-b border-bdo-border">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: roleMeta.tone }} />
          {editing ? (
            <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName}
                   onKeyDown={(e) => e.key === "Enter" && saveName()} autoFocus
                   className="bg-transparent border-b border-bdo-gold text-[13px] font-semibold
                              text-bdo-text-primary focus:outline-none flex-1 min-w-0" />
          ) : (
            <button onClick={() => setEditing(true)}
                    className="group flex items-center gap-1.5 text-[13px] font-semibold
                               text-bdo-text-primary flex-1 min-w-0">
              <span className="truncate">{party.name}</span>
              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
            </button>
          )}
          <span className="text-[11px] font-mono shrink-0"
                style={{ color: count >= capacity ? "#ef5f5f" : undefined }}>
            <span className="text-bdo-text-primary">{count}</span>
            <span className="text-bdo-text-secondary">/{capacity}</span>
          </span>
        </div>

        {/* Rol — tek segment şeridi */}
        <div className="flex mt-2 rounded-md overflow-hidden border border-bdo-border">
          {ROLES.map((r) => (
            <button key={r.key} onClick={() => pickRole(r.key)}
                    className="flex-1 text-[10px] py-1 font-semibold transition-colors"
                    style={role === r.key
                      ? { background: r.tone + "26", color: r.tone }
                      : { color: "#5e5e66" }}>
              {r.label}
            </button>
          ))}
        </div>
        {roleErr && <p className="text-[10px] text-red-400 mt-1">{roleErr}</p>}

        {/* Ortalama gear + klan dağılımı */}
        {count > 0 && (
          <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
            <span className="text-bdo-text-muted" title="Ortalama AP / DP">
              {avgAp}/{avgDp}
            </span>
            <span className="text-bdo-gold" title="Ortalama gear puanı">GS {avgAp + avgDp}</span>
            {guilds.length > 0 && (
              <span className="ml-auto flex items-center gap-1">
                {guilds.map((g) => (
                  <span key={g.tag} title={`${g.tag}: ${g.n} kişi`}
                        className="text-[9px] font-bold uppercase tracking-wider"
                        style={{ color: g.color }}>{g.tag}&nbsp;{g.n}</span>
                ))}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Üyeler */}
      <SortableContext items={memberIds} strategy={verticalListSortingStrategy}>
        <div className="p-2 space-y-1.5 min-h-[72px]">
          {count === 0 && (
            <div className="border border-dashed border-bdo-border rounded-lg py-6 text-center
                            text-[11px] text-bdo-text-secondary">
              Buraya sürükle
            </div>
          )}
          {party.members.map((m) => (
            <MemberChip key={`member-${m.userId}`} id={`member-${m.userId}`} user={m.user}
                        perf={memberStats?.[m.userId]} attendanceHistory={attendanceHistory}
                        currentStatus={currentStatuses?.[m.userId]} asClass={m.asClass} />
          ))}
        </div>
      </SortableContext>

      <div className="px-3 pb-2">
        <button onClick={() => onDelete(party.id)}
                className="flex items-center gap-1 text-[10px] text-bdo-text-secondary
                           hover:text-red-400 transition-colors">
          <Trash2 className="w-3 h-3" /> Partiyi sil
        </button>
      </div>
    </div>
  );
}
