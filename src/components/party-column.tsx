"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { MemberChip, UserPerfStats } from "./member-chip";
import { useState } from "react";

interface PartyColumnProps {
  party: {
    id: number;
    name: string;
    isDefense: boolean;
    members: { id: number; userId: number; user: { id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string } }[];
  };
  onRename: (partyId: number, name: string) => void;
  onDelete: (partyId: number) => void;
  onToggleDefense: (partyId: number, isDefense: boolean) => Promise<{ error?: string }>;
  memberStats?: Record<number, UserPerfStats>;
}

export function PartyColumn({ party, onRename, onDelete, onToggleDefense, memberStats }: PartyColumnProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(party.name);
  const [defenseErr, setDefenseErr] = useState<string | null>(null);
  const { setNodeRef, isOver } = useDroppable({ id: `party-${party.id}` });

  const memberIds = party.members.map((m) => `member-${m.userId}`);

  const count = party.members.length;
  const avgAp = count > 0 ? Math.round(party.members.reduce((s, m) => s + m.user.ap, 0) / count) : 0;
  const avgDp = count > 0 ? Math.round(party.members.reduce((s, m) => s + m.user.dp, 0) / count) : 0;
  const avgGs = avgAp + avgDp;

  function handleNameSave() {
    setEditing(false);
    if (name !== party.name) onRename(party.id, name);
  }

  async function handleDefenseToggle() {
    setDefenseErr(null);
    const result = await onToggleDefense(party.id, !party.isDefense);
    if (result?.error) {
      setDefenseErr(result.error);
      setTimeout(() => setDefenseErr(null), 3000);
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-64 border rounded-lg p-3 transition-colors ${
        party.isDefense
          ? "bg-blue-950/30 border-blue-500/40"
          : isOver
          ? "bg-bdo-surface border-bdo-gold"
          : "bg-bdo-surface border-bdo-border"
      }`}
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
            {party.isDefense && <span title="Defans Partisi">🛡️</span>}
            {party.name}
          </button>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-bdo-text-muted">{party.members.length}/20</span>
          <button
            onClick={handleDefenseToggle}
            title={party.isDefense ? "Defans modunu kapat" : "Defans partisi olarak işaretle"}
            className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
              party.isDefense
                ? "text-blue-400 bg-blue-500/20 hover:bg-blue-500/30"
                : "text-bdo-text-muted hover:text-blue-400 hover:bg-blue-500/10"
            }`}
          >
            🛡
          </button>
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

      <SortableContext items={memberIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 min-h-[60px]">
          {party.members.length === 0 && (
            <div className="border border-dashed border-bdo-border rounded-lg p-4 text-center text-xs text-bdo-text-muted">
              Buraya sürükle
            </div>
          )}
          {party.members.map((m) => (
            <MemberChip key={`member-${m.userId}`} id={`member-${m.userId}`} user={m.user} perf={memberStats?.[m.userId]} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
