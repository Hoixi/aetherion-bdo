"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext, DragOverlay, rectIntersection, pointerWithin, PointerSensor,
  useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Search, Plus, Users, AlertTriangle } from "lucide-react";
import { MemberChip, UserPerfStats, scoreColor } from "./member-chip";
import { PartyColumn, ROLES, type PartyMemberData } from "./party-column";
import { getClassByID } from "@/lib/classes";
import type { WarAttendanceSummary, AttendanceStatus } from "@/app/api/wars/attendance-history/route";

/**
 * Parti kurma ekranı.
 *
 * Kalabalık olmasın diye ölçü şu: sürekli lazım olan üstte ve sabit
 * (kim atanmadı, ne kadar doldu, roller nasıl dağıldı), geri kalan
 * ayrıntı karta üstüne gelince açılıyor.
 *
 * Havuzda altmış kişi olabiliyor; aranacak kişiyi gözle bulmak asıl
 * zorluktu, o yüzden arama ve sıralama havuzun kendi başlığında duruyor.
 */

// Havuz geniş alan olduğu için rectIntersection ile yakalanıyor;
// parti ve üyeler için imleç konumu daha isabetli
const collide: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

interface User {
  id: number;
  familyName: string;
  class: string;
  ap: number;
  dp: number;
  avatarUrl: string;
  guild?: { tag: string; color: string } | null;
}

interface PartyData {
  id: number;
  name: string;
  isDefense: boolean;
  role?: string;
  members: PartyMemberData[];
}

interface PartyBuilderProps {
  warId: number;
  attendees: User[];
  initialParties: PartyData[];
  maxParticipants?: number | null;
  memberStats?: Record<number, UserPerfStats>;
  attendanceHistory?: WarAttendanceSummary[];
  currentStatuses?: Record<number, AttendanceStatus>;
}

type PoolSort = "gs" | "score" | "name" | "class";

const POOL_SORTS: [PoolSort, string][] = [
  ["gs", "Gear"],
  ["score", "Puan"],
  ["class", "Class"],
  ["name", "İsim"],
];

function DroppablePool({ children, empty }: { children: React.ReactNode; empty: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: "pool" });
  return (
    <div ref={setNodeRef}
         className={`flex gap-1.5 flex-wrap p-3 rounded-xl border border-dashed transition-colors
                     min-h-[68px] ${isOver ? "border-bdo-gold bg-bdo-gold/5" : "border-bdo-border bg-bdo-bg"}`}>
      {empty
        ? <span className="text-[11px] text-bdo-text-secondary self-center">Herkes bir partiye atandı.</span>
        : children}
    </div>
  );
}

export function PartyBuilder({
  warId, attendees, initialParties, maxParticipants, memberStats,
  attendanceHistory, currentStatuses,
}: PartyBuilderProps) {
  const [parties, setParties] = useState<PartyData[]>(initialParties);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<PoolSort>("gs");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const assigned = new Set(parties.flatMap((p) => p.members.map((m) => m.userId)));
  const totalAssigned = assigned.size;
  const isOverMax = maxParticipants ? totalAssigned > maxParticipants : false;

  const unassigned = useMemo(() => {
    let list = attendees.filter((u) => !assigned.has(u.id));
    const needle = q.trim().toLocaleLowerCase("tr");
    if (needle) {
      list = list.filter((u) => {
        const cls = getClassByID(u.class)?.name ?? u.class;
        return u.familyName.toLocaleLowerCase("tr").includes(needle)
            || cls.toLocaleLowerCase("tr").includes(needle);
      });
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return a.familyName.localeCompare(b.familyName, "tr");
      if (sort === "score") return (memberStats?.[b.id]?.score ?? -99) - (memberStats?.[a.id]?.score ?? -99);
      if (sort === "class") {
        const an = getClassByID(a.class)?.name ?? a.class;
        const bn = getClassByID(b.class)?.name ?? b.class;
        return an.localeCompare(bn, "tr") || b.ap + b.dp - (a.ap + a.dp);
      }
      return b.ap + b.dp - (a.ap + a.dp);
    });
    // `assigned` her render'da yeniden kuruluyor; parties'e bağlamak yeterli
  }, [attendees, parties, q, sort, memberStats]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Üstteki özet — rol ve klan dağılımı tek bakışta */
  const summary = useMemo(() => {
    const byRole = new Map<string, number>();
    const byGuild = new Map<string, { tag: string; color: string; n: number }>();
    let gsSum = 0;
    for (const p of parties) {
      const role = p.role ?? (p.isDefense ? "DEFENSE" : "MAIN");
      byRole.set(role, (byRole.get(role) ?? 0) + p.members.length);
      for (const m of p.members) {
        gsSum += m.user.ap + m.user.dp;
        const g = m.user.guild;
        if (!g) continue;
        const cur = byGuild.get(g.tag) ?? { tag: g.tag, color: g.color, n: 0 };
        cur.n++;
        byGuild.set(g.tag, cur);
      }
    }
    return {
      byRole,
      guilds: Array.from(byGuild.values()).sort((a, b) => b.n - a.n),
      avgGs: totalAssigned ? Math.round(gsSum / totalAssigned) : 0,
    };
  }, [parties, totalAssigned]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const userId = Number(String(e.active.id).replace("member-", ""));
    const user = attendees.find((u) => u.id === userId);
    if (user) setActiveUser(user);
  }, [attendees]);

  const savePartyMembers = useCallback(async (partyId: number, members: { userId: number }[]) => {
    setSaveStatus("Kaydediliyor…");
    await fetch(`/api/wars/${warId}/parties/${partyId}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: members.map((m) => m.userId) }),
    });
    setSaveStatus("Kaydedildi");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [warId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveUser(null);
    const { active, over } = event;
    if (!over) return;

    const userId = Number(String(active.id).replace("member-", ""));
    const overId = String(over.id);

    if (overId === "pool") {
      const source = parties.find((p) => p.members.some((m) => m.userId === userId));
      if (!source) return;
      const updated = parties.map((p) =>
        p.id === source.id ? { ...p, members: p.members.filter((m) => m.userId !== userId) } : p);
      setParties(updated);
      await savePartyMembers(source.id, updated.find((p) => p.id === source.id)!.members);
      return;
    }

    let targetId: number | null = null;
    if (overId.startsWith("party-")) {
      targetId = Number(overId.replace("party-", ""));
    } else if (overId.startsWith("member-")) {
      const overUserId = Number(overId.replace("member-", ""));
      targetId = parties.find((p) => p.members.some((m) => m.userId === overUserId))?.id ?? null;
    }
    if (!targetId) return;

    const target = parties.find((p) => p.id === targetId);
    if (!target) return;
    if (target.members.length >= 20 && !target.members.some((m) => m.userId === userId)) return;

    const source = parties.find((p) => p.members.some((m) => m.userId === userId));
    const user = attendees.find((u) => u.id === userId)!;

    let updated = [...parties];
    if (source) {
      updated = updated.map((p) =>
        p.id === source.id ? { ...p, members: p.members.filter((m) => m.userId !== userId) } : p);
    }
    updated = updated.map((p) =>
      p.id === targetId ? { ...p, members: [...p.members, { id: 0, userId, user }] } : p);
    setParties(updated);

    await savePartyMembers(targetId, updated.find((p) => p.id === targetId)!.members);
    if (source && source.id !== targetId) {
      await savePartyMembers(source.id, updated.find((p) => p.id === source.id)!.members);
    }
  }, [parties, attendees, savePartyMembers]);

  async function addParty() {
    const res = await fetch(`/api/wars/${warId}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Parti ${parties.length + 1}` }),
    });
    if (res.ok) setParties([...parties, await res.json()]);
  }

  async function renameParty(partyId: number, name: string) {
    await fetch(`/api/wars/${warId}/parties/${partyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setParties(parties.map((p) => (p.id === partyId ? { ...p, name } : p)));
  }

  async function setRole(partyId: number, role: string): Promise<{ error?: string }> {
    const res = await fetch(`/api/wars/${warId}/parties/${partyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error ?? "Rol değiştirilemedi." };
    }
    setParties(parties.map((p) =>
      p.id === partyId ? { ...p, role, isDefense: role === "DEFENSE" } : p));
    return {};
  }

  async function deleteParty(partyId: number) {
    const p = parties.find((x) => x.id === partyId);
    if (p && p.members.length > 0 &&
        !window.confirm(`${p.name} içinde ${p.members.length} kişi var. Silinsin mi?`)) return;
    await fetch(`/api/wars/${warId}/parties/${partyId}`, { method: "DELETE" });
    setParties(parties.filter((x) => x.id !== partyId));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collide}
                onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Özet — sayfayı kaydırmadan durumu görebilmek için */}
        <div className="flex items-center gap-x-5 gap-y-2 flex-wrap px-3.5 py-2.5
                        rounded-xl bg-bdo-surface border border-bdo-border">
          <span className="flex items-center gap-1.5 text-[12px]">
            <Users className="w-3.5 h-3.5 text-bdo-text-secondary" />
            <span className="font-mono font-bold text-bdo-text-primary">{totalAssigned}</span>
            {maxParticipants && (
              <span className="font-mono text-bdo-text-secondary">/ {maxParticipants}</span>
            )}
            <span className="text-bdo-text-muted">partilerde</span>
          </span>

          {ROLES.map((r) => {
            const n = summary.byRole.get(r.key) ?? 0;
            if (!n) return null;
            return (
              <span key={r.key} className="flex items-center gap-1.5 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.tone }} />
                <span className="text-bdo-text-muted">{r.label}</span>
                <span className="font-mono font-bold" style={{ color: r.tone }}>{n}</span>
              </span>
            );
          })}

          {summary.avgGs > 0 && (
            <span className="text-[12px] text-bdo-text-muted">
              Ort. GS <span className="font-mono font-bold text-bdo-gold">{summary.avgGs}</span>
            </span>
          )}

          {summary.guilds.map((g) => (
            <span key={g.tag} className="text-[12px] font-mono" style={{ color: g.color }}>
              {g.tag} {g.n}
            </span>
          ))}

          {isOverMax && (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Katılım sınırı aşıldı
            </span>
          )}

          {saveStatus && (
            <span className="ml-auto text-[11px] text-bdo-gold">{saveStatus}</span>
          )}
        </div>

        {/* Havuz */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-[12px] font-semibold text-bdo-text-muted uppercase tracking-wider">
              Atanmamış <span className="font-mono text-bdo-text-primary">{unassigned.length}</span>
            </h3>

            <div className="relative ml-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2
                                 text-bdo-text-secondary" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim ya da class ara"
                     className="pl-8 pr-2 h-[30px] w-[200px] rounded-lg text-[12px] bg-bdo-bg
                                border border-bdo-border focus:border-bdo-gold focus:outline-none" />
            </div>

            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-bdo-text-secondary mr-1">
                Sırala
              </span>
              {POOL_SORTS.map(([k, label]) => (
                <button key={k} onClick={() => setSort(k)}
                        className="text-[11px] px-2 py-1 rounded-md transition-colors"
                        style={sort === k
                          ? { background: "rgb(var(--bdo-gold) / .14)", color: "rgb(var(--bdo-gold))" }
                          : { color: "#5e5e66" }}>
                  {label}
                </button>
              ))}
              <button onClick={addParty}
                      className="ml-2 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md
                                 bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20 transition-colors">
                <Plus className="w-3 h-3" /> Yeni parti
              </button>
            </div>
          </div>

          <SortableContext items={unassigned.map((u) => `member-${u.id}`)}
                           strategy={horizontalListSortingStrategy}>
            <DroppablePool empty={unassigned.length === 0 && q.trim() === ""}>
              {unassigned.map((user) => (
                <MemberChip key={`member-${user.id}`} id={`member-${user.id}`} user={user}
                            perf={memberStats?.[user.id]} attendanceHistory={attendanceHistory}
                            currentStatus={currentStatuses?.[user.id]} compact />
              ))}
              {unassigned.length === 0 && q.trim() !== "" && (
                <span className="text-[11px] text-bdo-text-secondary self-center">
                  Aramaya uyan kimse yok.
                </span>
              )}
            </DroppablePool>
          </SortableContext>
        </div>

        {/* Partiler */}
        {parties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-bdo-border py-10 text-center">
            <p className="text-[13px] text-bdo-text-muted">Henüz parti yok.</p>
            <button onClick={addParty}
                    className="mt-3 inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-lg
                               bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> İlk partiyi oluştur
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {parties.map((party) => (
              <PartyColumn key={party.id} party={party} onRename={renameParty}
                           onDelete={deleteParty} onSetRole={setRole}
                           memberStats={memberStats} attendanceHistory={attendanceHistory}
                           currentStatuses={currentStatuses} />
            ))}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeUser && (
          <MemberChip id={`overlay-${activeUser.id}`} user={activeUser}
                      perf={memberStats?.[activeUser.id]} isDragOverlay compact />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export { scoreColor };
