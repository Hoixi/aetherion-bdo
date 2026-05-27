"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { BDO_CLASSES, getPortraitUrl } from "@/lib/classes";

const TAG_LABELS: Record<string, string> = {
  PVE: "PvE", NODE_WAR: "Node War", ONE_V_ONE: "1v1", ONE_V_X: "1vX", AOS: "AoS",
};
const TAG_COLORS: Record<string, string> = {
  PVE: "#22c55e", NODE_WAR: "#f97316", ONE_V_ONE: "#ef4444", ONE_V_X: "#a855f7", AOS: "#3b82f6",
};

function getAllClassSpecs() {
  const out: { classId: string; name: string; spec: "awakening" | "succession" }[] = [];
  for (const c of BDO_CLASSES) {
    out.push({ classId: c.id, name: c.name, spec: "awakening" });
    if (c.hasSuccession) out.push({ classId: c.id, name: c.name, spec: "succession" });
  }
  return out;
}
const ALL_SPECS = getAllClassSpecs();

interface TierEntry { id: number; classId: string; spec: string; note: string | null; }
interface TierVoteRow { id: number; userId: number; classId: string; spec: string; tierId: number; note: string | null; }
interface TierRow { id: number; name: string; color: string; order: number; entries: TierEntry[]; votes: TierVoteRow[]; }
interface TierListData {
  id: number; title: string; description: string | null; tags: string; isVoting: boolean;
  createdBy: number; createdAt: string;
  creator: { id: number; familyName: string; avatarUrl: string };
  tiers: TierRow[];
  votes: (TierVoteRow & { user: { id: number; familyName: string; avatarUrl: string } })[];
}
interface NoteModalState { classId: string; spec: string; tierId: number; existing: string; }

// ── Draggable class card ──────────────────────────────────────

function DraggableCard({
  classId, name, spec, note, voteCount, canEdit, onRemove, overlay = false,
}: {
  classId: string; name: string; spec: string; note: string | null;
  voteCount: number | null; canEdit: boolean; onRemove: (() => void) | null; overlay?: boolean;
}) {
  const id = `${classId}__${spec}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !canEdit });
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging && !overlay ? 0.3 : 1 };
  const imgUrl = getPortraitUrl(classId, spec);
  const specLabel = spec === "succession" ? "Akt." : "Uyş.";
  const [showNote, setShowNote] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canEdit ? { ...listeners, ...attributes } : {})}
      className={`relative group flex flex-col items-center rounded-lg overflow-hidden select-none
        ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
        ${overlay ? "shadow-2xl ring-2 ring-bdo-gold scale-110" : ""}
      `}
      style={{ ...style, width: 64, touchAction: "none" }}
    >
      <div className="relative w-16 h-[72px] bg-bdo-bg overflow-hidden">
        {imgUrl ? (
          <img src={imgUrl} alt={name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-bdo-text-muted text-xs">{name[0]}</div>
        )}
        <div className="absolute bottom-0 right-0 text-[9px] font-bold px-1 py-0.5 bg-bdo-bg/80 text-bdo-text-muted leading-none">
          {specLabel}
        </div>
        {note && (
          <div
            className="absolute top-0.5 left-0.5 w-2 h-2 rounded-full bg-bdo-gold z-10"
            onMouseEnter={() => setShowNote(true)}
            onMouseLeave={() => setShowNote(false)}
          />
        )}
        {showNote && note && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-50 bg-bdo-bg border border-bdo-border rounded-lg px-2 py-1.5 text-xs text-bdo-text-primary w-36 text-center pointer-events-none whitespace-pre-wrap">
            {note}
          </div>
        )}
        {voteCount !== null && voteCount > 0 && (
          <div className="absolute top-0.5 right-0.5 text-[9px] font-bold bg-bdo-gold/90 text-bdo-bg px-1 rounded">
            {voteCount}
          </div>
        )}
        {canEdit && onRemove && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-red-500/80 text-white text-[10px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center leading-none z-20"
          >
            ✕
          </button>
        )}
      </div>
      <div className="w-full bg-bdo-bg/90 text-[9px] text-center text-bdo-text-muted px-1 py-0.5 truncate">
        {name}
      </div>
    </div>
  );
}

// ── Droppable tier row ────────────────────────────────────────

function DroppableTierRow({
  tier, children, isEditing,
}: {
  tier: TierRow; children: React.ReactNode; isEditing: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier__${tier.id}`, disabled: !isEditing });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[88px] border-b border-bdo-border last:border-b-0 transition-colors ${isOver ? "bg-bdo-gold/10" : ""}`}
    >
      <div
        className="flex items-center justify-center font-black text-lg w-16 flex-shrink-0"
        style={{ backgroundColor: `${tier.color}20`, color: tier.color, borderRight: `2px solid ${tier.color}40` }}
      >
        {tier.name}
      </div>
      <div className="flex flex-wrap gap-2 p-2 flex-1 items-start content-start">
        {children}
        {isOver && (
          <div className="border-2 border-dashed border-bdo-gold/60 rounded-lg w-16 h-[88px] flex items-center justify-center text-bdo-gold/60 text-lg animate-pulse">
            +
          </div>
        )}
      </div>
    </div>
  );
}

// ── Droppable pool ────────────────────────────────────────────

function DroppablePool({ children, isEditing }: { children: React.ReactNode; isEditing: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool", disabled: !isEditing });
  return (
    <div
      ref={setNodeRef}
      className={`bg-bdo-surface border border-bdo-border rounded-xl p-4 transition-colors ${isOver ? "border-bdo-gold/50 bg-bdo-gold/5" : ""}`}
    >
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function TierListDetailPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const router = useRouter();
  const listId = params.id;
  const [data, setData] = useState<TierListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "my">("list");
  const [noteModal, setNoteModal] = useState<NoteModalState | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const loadData = useCallback(async () => {
    const res = await fetch(`/api/tier-lists/${listId}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [listId]);

  useEffect(() => { loadData(); }, [loadData]);

  const meId = session?.user?.id ? Number(session.user.id) : undefined;
  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin ?? false;
  const isCreator = meId !== undefined && data?.createdBy === meId;
  const canEdit = !!(isCreator || isAdmin) && !data?.isVoting;
  const canVote = !!session?.user && !!data?.isVoting;
  const isEditing = !!(canEdit || (canVote && viewMode === "my"));

  function getPlacedMap(): Map<string, { tierId: number; note: string | null }> {
    const map = new Map<string, { tierId: number; note: string | null }>();
    if (!data) return map;
    if (data.isVoting && viewMode === "my") {
      const myVotes = data.votes.filter((v) => v.userId === meId);
      for (const v of myVotes) map.set(`${v.classId}__${v.spec}`, { tierId: v.tierId, note: v.note });
    } else if (data.isVoting && viewMode === "list") {
      const counts = new Map<string, Map<number, number>>();
      for (const v of data.votes) {
        const key = `${v.classId}__${v.spec}`;
        if (!counts.has(key)) counts.set(key, new Map());
        const tc = counts.get(key)!;
        tc.set(v.tierId, (tc.get(v.tierId) ?? 0) + 1);
      }
      for (const [key, tc] of Array.from(counts)) {
        let maxCount = 0; let maxTier = 0;
        for (const [tierId, count] of Array.from(tc)) {
          if (count > maxCount) { maxCount = count; maxTier = tierId; }
        }
        map.set(key, { tierId: maxTier, note: null });
      }
    } else {
      for (const tier of data.tiers) {
        for (const e of tier.entries) {
          map.set(`${e.classId}__${e.spec}`, { tierId: tier.id, note: e.note });
        }
      }
    }
    return map;
  }

  const placedMap = getPlacedMap();

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const draggedId = String(event.active.id); // "classId__spec"
    const overId = String(event.over.id);      // "tier__123" or "pool"

    if (overId === "pool") {
      // Havuza geri at
      const [classId, spec] = draggedId.split("__");
      removeEntry(classId, spec);
      return;
    }

    if (overId.startsWith("tier__")) {
      const tierId = Number(overId.replace("tier__", ""));
      const [classId, spec] = draggedId.split("__");
      const currentTierId = placedMap.get(draggedId)?.tierId;
      if (currentTierId === tierId) return; // aynı tier, hareket yok
      const existing = placedMap.get(draggedId)?.note ?? "";
      setNoteModal({ classId, spec, tierId, existing });
      setNoteText(existing);
    }
  }

  async function confirmPlace(note: string) {
    if (!noteModal || !data) return;
    setSaving(true);
    const endpoint = data.isVoting
      ? `/api/tier-lists/${data.id}/vote`
      : `/api/tier-lists/${data.id}/entries`;
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId: noteModal.tierId, classId: noteModal.classId, spec: noteModal.spec, note }),
    });
    setNoteModal(null);
    setSaving(false);
    await loadData();
  }

  async function removeEntry(classId: string, spec: string) {
    if (!data) return;
    const endpoint = data.isVoting
      ? `/api/tier-lists/${data.id}/vote`
      : `/api/tier-lists/${data.id}/entries`;
    await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, spec }),
    });
    await loadData();
  }

  async function deleteList() {
    if (!data || !confirm("Bu tier list'i silmek istediğine emin misin?")) return;
    await fetch(`/api/tier-lists/${data.id}`, { method: "DELETE" });
    router.push("/tier-list");
  }

  if (loading) return <div className="text-center py-16 text-bdo-text-muted text-sm">Yükleniyor...</div>;
  if (!data) return <div className="text-center py-16 text-bdo-text-muted">Tier list bulunamadı.</div>;

  const tags = data.tags ? data.tags.split(",").filter(Boolean) : [];
  const poolItems = ALL_SPECS.filter((s) => !placedMap.has(`${s.classId}__${s.spec}`));

  const activeSpec = activeId ? ALL_SPECS.find((s) => `${s.classId}__${s.spec}` === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <button onClick={() => router.back()} className="text-bdo-text-muted hover:text-bdo-text-primary text-sm mb-2 block">← Geri</button>
            <div className="flex items-center gap-2 flex-wrap">
              {data.isVoting && (
                <span className="text-[10px] bg-bdo-sapphire/20 text-bdo-sapphire px-1.5 py-0.5 rounded font-bold border border-bdo-sapphire/30">🗳 OYLAMALI</span>
              )}
              <h1 className="text-xl font-bold text-bdo-text-primary">{data.title}</h1>
            </div>
            {data.description && <p className="text-sm text-bdo-text-muted mt-1">{data.description}</p>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                    style={{ color: TAG_COLORS[tag] ?? "#d4a030", borderColor: `${TAG_COLORS[tag] ?? "#d4a030"}40`, backgroundColor: `${TAG_COLORS[tag] ?? "#d4a030"}15` }}>
                    {TAG_LABELS[tag] ?? tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 mt-2 text-xs text-bdo-text-muted">
              {data.creator.avatarUrl
                ? <img src={data.creator.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                : <div className="w-4 h-4 rounded-full bg-bdo-border" />}
              <span>{data.creator.familyName}</span>
              {data.isVoting && <span>· {new Set(data.votes.map((v) => v.userId)).size} katılımcı</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {data.isVoting && session?.user && (
              <div className="flex rounded-lg overflow-hidden border border-bdo-border">
                <button onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-muted hover:text-bdo-text-primary"}`}>
                  Genel
                </button>
                <button onClick={() => setViewMode("my")}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "my" ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-muted hover:text-bdo-text-primary"}`}>
                  Oyum
                </button>
              </div>
            )}
            {(isCreator || isAdmin) && (
              <button onClick={deleteList} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-400/30 hover:border-red-400/60 transition-colors">
                Sil
              </button>
            )}
          </div>
        </div>

        {isEditing && (
          <p className="text-xs text-bdo-text-muted mb-3 flex items-center gap-1.5">
            <span className="text-bdo-gold">↕</span> Classları havuzdan tier&apos;a sürükle · Kaldırmak için havuza geri sürükle
          </p>
        )}

        {/* Tier Board */}
        <div className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden mb-4">
          {data.tiers.map((tier) => {
            const tierEntries = ALL_SPECS.filter((s) => placedMap.get(`${s.classId}__${s.spec}`)?.tierId === tier.id);
            return (
              <DroppableTierRow key={tier.id} tier={tier} isEditing={isEditing}>
                {tierEntries.map((s) => {
                  const key = `${s.classId}__${s.spec}`;
                  const entry = placedMap.get(key);
                  const voteCount = data.isVoting && viewMode === "list"
                    ? data.votes.filter((v) => v.classId === s.classId && v.spec === s.spec && v.tierId === tier.id).length
                    : null;
                  return (
                    <DraggableCard
                      key={key}
                      classId={s.classId}
                      name={s.name}
                      spec={s.spec}
                      note={entry?.note ?? null}
                      voteCount={voteCount}
                      canEdit={isEditing}
                      onRemove={isEditing ? () => removeEntry(s.classId, s.spec) : null}
                    />
                  );
                })}
              </DroppableTierRow>
            );
          })}
        </div>

        {/* Class Havuzu */}
        {(isEditing || poolItems.length > 0) && (
          <DroppablePool isEditing={isEditing}>
            <p className="text-xs text-bdo-text-muted mb-3 font-semibold uppercase tracking-wider">
              {isEditing ? `Havuz (${poolItems.length}) — tier satırına sürükle` : `Yerleştirilmemiş (${poolItems.length})`}
            </p>
            <div className="flex flex-wrap gap-2">
              {poolItems.map((s) => (
                <DraggableCard
                  key={`${s.classId}__${s.spec}`}
                  classId={s.classId}
                  name={s.name}
                  spec={s.spec}
                  note={null}
                  voteCount={null}
                  canEdit={isEditing}
                  onRemove={null}
                />
              ))}
            </div>
          </DroppablePool>
        )}

        {/* Drag overlay */}
        <DragOverlay>
          {activeSpec && (
            <DraggableCard
              classId={activeSpec.classId}
              name={activeSpec.name}
              spec={activeSpec.spec}
              note={null}
              voteCount={null}
              canEdit={false}
              onRemove={null}
              overlay
            />
          )}
        </DragOverlay>
      </div>

      {/* Not Modalı */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setNoteModal(null)}>
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              {(() => {
                const s = ALL_SPECS.find((s) => s.classId === noteModal.classId && s.spec === noteModal.spec);
                const imgUrl = s ? getPortraitUrl(s.classId, s.spec) : "";
                return imgUrl
                  ? <img src={imgUrl} className="w-12 h-16 object-cover object-top rounded-lg" alt="" />
                  : <div className="w-12 h-16 rounded-lg bg-bdo-border" />;
              })()}
              <div>
                <p className="font-bold text-bdo-text-primary text-sm">
                  {ALL_SPECS.find((s) => s.classId === noteModal.classId)?.name}
                </p>
                <p className="text-xs text-bdo-text-muted capitalize">
                  {noteModal.spec === "succession" ? "Aktarım" : "Uyanış"}
                </p>
              </div>
            </div>
            <label className="block text-xs text-bdo-text-muted mb-1.5">Not <span className="text-bdo-text-muted/50">(isteğe bağlı)</span></label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Bu yerleştirme için not..."
              rows={3}
              autoFocus
              className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none text-sm resize-none mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => confirmPlace(noteText)}
                disabled={saving}
                className="flex-1 bg-bdo-gold text-bdo-bg font-semibold py-2 rounded-lg text-sm hover:bg-bdo-gold-dim transition-colors disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Yerleştir"}
              </button>
              <button onClick={() => setNoteModal(null)} className="px-4 py-2 text-sm text-bdo-text-muted hover:text-bdo-text-primary">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
