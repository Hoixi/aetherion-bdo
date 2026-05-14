"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  CollisionDetection,
} from "@dnd-kit/core";

// Custom collision: pool uses rectIntersection (generous), parties use pointerWithin (precise)
const customCollision: CollisionDetection = (args) => {
  // First check pointerWithin for precise hits on parties/members
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;

  // Fallback to rectIntersection to catch the pool area
  return rectIntersection(args);
};
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { MemberChip } from "./member-chip";
import { PartyColumn } from "./party-column";

interface User {
  id: number;
  familyName: string;
  class: string;
  ap: number;
  dp: number;
  avatarUrl: string;
}

interface PartyData {
  id: number;
  name: string;
  isDefense: boolean;
  members: { id: number; userId: number; user: User }[];
}

interface PartyBuilderProps {
  warId: number;
  attendees: User[];
  initialParties: PartyData[];
  maxParticipants?: number | null;
}

function DroppablePool({ children }: { children: React.ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: "pool" });
  return (
    <div
      ref={setNodeRef}
      className={`flex gap-2 flex-wrap p-4 bg-bdo-bg border-2 border-dashed rounded-lg min-h-[80px] transition-colors ${
        isOver ? "border-bdo-gold bg-bdo-gold/5" : "border-bdo-border"
      }`}
    >
      {children}
    </div>
  );
}

export function PartyBuilder({ warId, attendees, initialParties, maxParticipants }: PartyBuilderProps) {
  const [parties, setParties] = useState<PartyData[]>(initialParties);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const assignedUserIds = new Set(parties.flatMap((p) => p.members.map((m) => m.userId)));
  const unassigned = attendees.filter((u) => !assignedUserIds.has(u.id));
  const totalAssigned = assignedUserIds.size;
  const isOverMax = maxParticipants ? totalAssigned > maxParticipants : false;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const userId = Number(String(event.active.id).replace("member-", ""));
    const user = attendees.find((u) => u.id === userId);
    if (user) setActiveUser(user);
  }, [attendees]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveUser(null);
    const { active, over } = event;
    if (!over) return;

    const userId = Number(String(active.id).replace("member-", ""));
    const overId = String(over.id);

    let targetPartyId: number | null = null;
    if (overId.startsWith("party-")) {
      targetPartyId = Number(overId.replace("party-", ""));
    } else if (overId.startsWith("member-")) {
      const overUserId = Number(overId.replace("member-", ""));
      const containingParty = parties.find((p) => p.members.some((m) => m.userId === overUserId));
      if (containingParty) targetPartyId = containingParty.id;
    }

    if (overId === "pool") {
      const sourceParty = parties.find((p) => p.members.some((m) => m.userId === userId));
      if (sourceParty) {
        const updated = parties.map((p) =>
          p.id === sourceParty.id ? { ...p, members: p.members.filter((m) => m.userId !== userId) } : p
        );
        setParties(updated);
        await savePartyMembers(sourceParty.id, updated.find((p) => p.id === sourceParty.id)!.members);
      }
      return;
    }

    if (!targetPartyId) return;

    const targetParty = parties.find((p) => p.id === targetPartyId);
    if (!targetParty) return;
    if (targetParty.members.length >= 20 && !targetParty.members.some((m) => m.userId === userId)) return;

    const sourceParty = parties.find((p) => p.members.some((m) => m.userId === userId));
    const user = attendees.find((u) => u.id === userId)!;

    let updated = [...parties];
    if (sourceParty) {
      updated = updated.map((p) =>
        p.id === sourceParty.id ? { ...p, members: p.members.filter((m) => m.userId !== userId) } : p
      );
    }
    updated = updated.map((p) =>
      p.id === targetPartyId ? { ...p, members: [...p.members, { id: 0, userId, user }] } : p
    );
    setParties(updated);

    await savePartyMembers(targetPartyId, updated.find((p) => p.id === targetPartyId)!.members);
    if (sourceParty && sourceParty.id !== targetPartyId) {
      await savePartyMembers(sourceParty.id, updated.find((p) => p.id === sourceParty.id)!.members);
    }
  }, [parties, attendees, warId]);

  async function savePartyMembers(partyId: number, members: { userId: number }[]) {
    setSaveStatus("Kaydediliyor...");
    await fetch(`/api/wars/${warId}/parties/${partyId}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: members.map((m) => m.userId) }),
    });
    setSaveStatus("Kaydedildi ✓");
    setTimeout(() => setSaveStatus(null), 2000);
  }

  async function addParty() {
    const name = `Parti ${parties.length + 1}`;
    const res = await fetch(`/api/wars/${warId}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const party = await res.json();
      setParties([...parties, party]);
    }
  }

  async function renameParty(partyId: number, name: string) {
    await fetch(`/api/wars/${warId}/parties/${partyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setParties(parties.map((p) => (p.id === partyId ? { ...p, name } : p)));
  }

  async function toggleDefense(partyId: number, isDefense: boolean): Promise<{ error?: string }> {
    const res = await fetch(`/api/wars/${warId}/parties/${partyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefense }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { error: data.error ?? "Hata oluştu" };
    }
    setParties(parties.map((p) => (p.id === partyId ? { ...p, isDefense } : p)));
    return {};
  }

  async function deleteParty(partyId: number) {
    await fetch(`/api/wars/${warId}/parties/${partyId}`, { method: "DELETE" });
    setParties(parties.filter((p) => p.id !== partyId));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={customCollision} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm text-bdo-text-muted uppercase">Atanmamış Üyeler ({unassigned.length})</h3>
            {maxParticipants && (
              <span className={`text-xs px-2 py-0.5 rounded ${
                isOverMax ? "bg-red-500/20 text-red-400" : totalAssigned === maxParticipants ? "bg-bdo-gold/20 text-bdo-gold" : "bg-bdo-surface text-bdo-text-muted"
              }`}>
                Partilerde: {totalAssigned}/{maxParticipants}
                {isOverMax && " ⚠️ Limit aşıldı!"}
              </span>
            )}
          </div>
          <SortableContext items={unassigned.map((u) => `member-${u.id}`)} strategy={horizontalListSortingStrategy}>
            <DroppablePool>
              {unassigned.length === 0 && <span className="text-xs text-bdo-text-muted">Tüm üyeler atandı</span>}
              {unassigned.map((user) => (
                <MemberChip key={`member-${user.id}`} id={`member-${user.id}`} user={user} />
              ))}
            </DroppablePool>
          </SortableContext>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm text-bdo-text-muted uppercase">Partiler</h3>
              {saveStatus && (
                <span className="text-xs text-bdo-gold">{saveStatus}</span>
              )}
            </div>
            <button
              onClick={addParty}
              className="text-xs bg-bdo-gold/10 text-bdo-gold px-3 py-1 rounded hover:bg-bdo-gold/20 transition-colors"
            >
              + Yeni Parti
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {parties.map((party) => (
              <PartyColumn key={party.id} party={party} onRename={renameParty} onDelete={deleteParty} onToggleDefense={toggleDefense} />
            ))}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeUser && <MemberChip id={`overlay-${activeUser.id}`} user={activeUser} isDragOverlay />}
      </DragOverlay>
    </DndContext>
  );
}
