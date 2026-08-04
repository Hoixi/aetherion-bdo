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
import { ArrowLeft, Vote, Trash2, X, Plus, MoveVertical } from "lucide-react";
import { Loading, Empty, Button, Avatar } from "@/components/ui";

const TAG_LABELS: Record<string, string> = {
  PVE: "PvE", NODE_WAR: "Node War", ONE_V_ONE: "1v1", ONE_V_X: "1vX", AOS: "AoS",
};
const TAG_COLORS: Record<string, string> = {
  PVE: "#2bca6e", NODE_WAR: "#e09832", ONE_V_ONE: "#e05252", ONE_V_X: "#a855f7", AOS: "#4a7cf5",
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
      {...(canEdit ? { ...listeners, ...attributes } : {})}
      className={`relative group flex flex-col items-center rounded-lg overflow-hidden select-none
        ${canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-default"}
        ${overlay ? "shadow-2xl ring-2 ring-bdo-gold scale-110" : ""}
      `}
      style={{ ...style, width: 64, touchAction: "none" }}
    >
      <div className="relative w-16 h-[72px] bg-bdo-surface-2 overflow-hidden ring-1 ring-bdo-border">
        {imgUrl ? (
          <img src={imgUrl} alt={name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-bdo-text-secondary text-xs">{name[0]}</div>
        )}
        <div className="absolute bottom-0 right-0 text-[8px] font-bold px-1 py-0.5 bg-bdo-bg/85 backdrop-blur-sm text-bdo-text-secondary leading-none rounded-tl">
          {specLabel}
        </div>
        {note && (
          <div
            className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-bdo-gold z-10 ring-2 ring-bdo-bg/50"
            onMouseEnter={() => setShowNote(true)}
            onMouseLeave={() => setShowNote(false)}
          />
        )}
        {showNote && note && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 bg-bdo-surface border border-bdo-border-2 rounded-lg px-2 py-1.5 text-[11px] text-bdo-text-primary w-36 text-center pointer-events-none whitespace-pre-wrap shadow-xl">
            {note}
          </div>
        )}
        {voteCount !== null && voteCount > 0 && (
          <div className="absolute top-1 right-1 text-[9px] font-bold bg-bdo-gold text-bdo-bg px-1 rounded leading-tight">
            {voteCount}
          </div>
        )}
        {canEdit && onRemove && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="absolute top-1 left-1 w-4 h-4 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20"
          >
            <X className="w-2.5 h-2.5" strokeWidth={3} />
          </button>
        )}
      </div>
      <div className="w-full bg-bdo-surface text-[9px] text-center text-bdo-text-secondary px-1 py-0.5 truncate border-x border-b border-bdo-border">
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
      className={`flex min-h-[92px] border-b border-bdo-border last:border-b-0 transition-colors ${isOver ? "bg-bdo-gold/[0.07]" : ""}`}
    >
      <div
        className="flex items-center justify-center font-black text-lg w-14 flex-shrink-0"
        style={{
          background: `linear-gradient(160deg, ${tier.color}28, ${tier.color}10)`,
          color: tier.color,
          borderRight: `1px solid ${tier.color}30`,
        }}
      >
        {tier.name}
      </div>
      <div className="flex flex-wrap gap-2 p-2.5 flex-1 items-start content-start">
        {children}
        {isOver && (
          <div className="border border-dashed border-bdo-gold/50 rounded-lg w-16 h-[88px] flex items-center justify-center text-bdo-gold/50 animate-pulse">
            <Plus className="w-4 h-4" strokeWidth={2} />
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
    <div ref={setNodeRef} className={`card transition-colors ${isOver ? "border-bdo-gold/40" : ""}`}>
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

  if (loading) return <Loading />;
  if (!data) return <div className="card"><Empty text="Tier list bulunamadı." /></div>;

  const tags = data.tags ? data.tags.split(",").filter(Boolean) : [];
  const poolItems = ALL_SPECS.filter((s) => !placedMap.has(`${s.classId}__${s.spec}`));

  const activeSpec = activeId ? ALL_SPECS.find((s) => `${s.classId}__${s.spec}` === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-[12px] text-bdo-text-secondary hover:text-bdo-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Geri
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {data.isVoting && (
                <span className="inline-flex items-center gap-1 text-[10px] bg-[#4a7cf5]/10 text-[#6b93ff] px-1.5 py-0.5 rounded font-semibold border border-[#4a7cf5]/20">
                  <Vote className="w-3 h-3" strokeWidth={2} />
                  OYLAMALI
                </span>
              )}
              <h1 className="section-title">{data.title}</h1>
            </div>
            {data.description && <p className="section-desc">{data.description}</p>}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map((tag) => {
                  const c = TAG_COLORS[tag] ?? "#d4a030";
                  return (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                      style={{ color: c, borderColor: `${c}30`, backgroundColor: `${c}12` }}>
                      {TAG_LABELS[tag] ?? tag}
                    </span>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2 mt-2 text-[11px] text-bdo-text-secondary">
              <Avatar src={data.creator.avatarUrl} size={16} ring={false} />
              <span className="text-bdo-text-muted">{data.creator.familyName}</span>
              {data.isVoting && <span>· {new Set(data.votes.map((v) => v.userId)).size} katılımcı</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {data.isVoting && session?.user && (
              <div className="flex gap-0.5 bg-bdo-surface border border-bdo-border rounded-lg p-0.5">
                {([["list", "Genel"], ["my", "Oyum"]] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      viewMode === mode ? "bg-bdo-surface-2 text-bdo-gold" : "text-bdo-text-secondary hover:text-bdo-text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {(isCreator || isAdmin) && (
              <Button variant="danger" icon={Trash2} onClick={deleteList}>Sil</Button>
            )}
          </div>
        </div>

        {isEditing && (
          <p className="text-[11px] text-bdo-text-secondary mb-3 flex items-center gap-1.5">
            <MoveVertical className="w-3.5 h-3.5 text-bdo-gold/60 flex-shrink-0" strokeWidth={1.75} />
            Classları havuzdan tier&apos;a sürükle · kaldırmak için havuza geri sürükle
          </p>
        )}

        {/* Tier Board */}
        <div className="card mb-4">
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
            <div className="card-header">
              <span className="card-title">{isEditing ? "Havuz" : "Yerleştirilmemiş"}</span>
              <span className="card-meta">
                {poolItems.length}{isEditing && " · tier satırına sürükle"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 p-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setNoteModal(null)}>
          <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <span className="card-title">Tier&apos;a Yerleştir</span>
              <button
                onClick={() => setNoteModal(null)}
                className="p-1 rounded-md text-bdo-text-secondary hover:text-bdo-text-primary hover:bg-bdo-surface-2 transition-colors"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const s = ALL_SPECS.find((s) => s.classId === noteModal.classId && s.spec === noteModal.spec);
                  const imgUrl = s ? getPortraitUrl(s.classId, s.spec) : "";
                  return imgUrl
                    ? <img src={imgUrl} className="w-12 h-16 object-cover object-top rounded-lg ring-1 ring-bdo-border" alt="" />
                    : <div className="w-12 h-16 rounded-lg bg-bdo-surface-2 ring-1 ring-bdo-border" />;
                })()}
                <div>
                  <p className="text-[14px] font-semibold text-bdo-text-primary">
                    {ALL_SPECS.find((s) => s.classId === noteModal.classId)?.name}
                  </p>
                  <p className="text-[11px] text-bdo-text-secondary">
                    {noteModal.spec === "succession" ? "Aktarım" : "Uyanış"}
                  </p>
                </div>
              </div>

              <label className="block text-[10px] uppercase text-bdo-text-secondary tracking-wider mb-1.5">
                Not <span className="normal-case opacity-60">(isteğe bağlı)</span>
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Bu yerleştirme için not..."
                rows={3}
                autoFocus
                className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-[13px] text-bdo-text-primary placeholder-bdo-text-secondary focus:border-bdo-gold/40 focus:outline-none resize-none mb-4 transition-colors"
              />

              <div className="flex gap-2">
                <Button variant="primary" size="md" className="flex-1" onClick={() => confirmPlace(noteText)} disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Yerleştir"}
                </Button>
                <Button variant="ghost" size="md" onClick={() => setNoteModal(null)}>İptal</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
