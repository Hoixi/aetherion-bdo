"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, useDroppable, useDraggable,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronLeft, Vote, Trash2, X, Plus, MoveVertical } from "lucide-react";
import { BDO_CLASSES, getPortraitUrl } from "@/lib/classes";
import { TestShell, Card, Empty } from "@/components/test-shell";

/**
 * Tier list tahtası.
 *
 * İki mod var: sahibinin düzenlediği sabit liste ve herkesin oy verdiği
 * liste. Oylamalıda "Genel" görünümü her class'ı en çok oy aldığı tier'a
 * koyuyor, "Oyum" kendi yerleştirmeni gösteriyor.
 */

const TAG_LABEL: Record<string, string> = {
  PVE: "PvE", NODE_WAR: "Node War", ONE_V_ONE: "1v1", ONE_V_X: "1vX", AOS: "AoS",
};
const TAG_COLOR: Record<string, string> = {
  PVE: "#2bca6e", NODE_WAR: "#f0994c", ONE_V_ONE: "#ef5f5f", ONE_V_X: "#a855f7", AOS: "#6b93ff",
};

type ClassSpec = { classId: string; name: string; spec: "awakening" | "succession" };

/** Her class'ın oynanabilir her hâli ayrı kart — awakening ve succession farklı oynanıyor */
const ALL_SPECS: ClassSpec[] = (() => {
  const out: ClassSpec[] = [];
  for (const c of BDO_CLASSES) {
    out.push({ classId: c.id, name: c.name, spec: "awakening" });
    if (c.hasSuccession) out.push({ classId: c.id, name: c.name, spec: "succession" });
  }
  return out;
})();

type TierEntry = { id: number; classId: string; spec: string; note: string | null };
type TierVoteRow = { id: number; userId: number; classId: string; spec: string; tierId: number; note: string | null };
type TierRow = { id: number; name: string; color: string; order: number; entries: TierEntry[]; votes: TierVoteRow[] };

type TierListData = {
  id: number; title: string; description: string | null; tags: string; isVoting: boolean;
  createdBy: number; createdAt: string;
  creator: { id: number; familyName: string; avatarUrl: string };
  tiers: TierRow[];
  votes: (TierVoteRow & { user: { id: number; familyName: string; avatarUrl: string } })[];
};

type NoteModal = { classId: string; spec: string; tierId: number };

export default function TierListDetayPage({ params }: { params: { id: string } }) {
  const { data: session } = useSession();
  const router = useRouter();

  const [data, setData] = useState<TierListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "my">("list");
  const [modal, setModal] = useState<NoteModal | null>(null);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    // Dokunmatikte gecikme olmadan sayfa kaydırması sürüklemeye dönüşüyor
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const load = useCallback(async () => {
    const res = await fetch(`/api/tier-lists/${params.id}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const meId = session?.user?.id ? Number(session.user.id) : undefined;
  const isAdmin = !!session?.user?.isAdmin;
  const isCreator = meId !== undefined && data?.createdBy === meId;
  const canEdit = !!(isCreator || isAdmin) && !data?.isVoting;
  const canVote = !!session?.user && !!data?.isVoting;
  const editing = !!(canEdit || (canVote && view === "my"));

  /** class__spec → hangi tier'da ve notu ne */
  function placed(): Map<string, { tierId: number; note: string | null }> {
    const map = new Map<string, { tierId: number; note: string | null }>();
    if (!data) return map;

    if (data.isVoting && view === "my") {
      for (const v of data.votes.filter((v) => v.userId === meId)) {
        map.set(`${v.classId}__${v.spec}`, { tierId: v.tierId, note: v.note });
      }
      return map;
    }

    if (data.isVoting) {
      // Genel görünüm: her class en çok oy aldığı tier'a düşüyor
      const counts = new Map<string, Map<number, number>>();
      for (const v of data.votes) {
        const key = `${v.classId}__${v.spec}`;
        if (!counts.has(key)) counts.set(key, new Map());
        const tc = counts.get(key)!;
        tc.set(v.tierId, (tc.get(v.tierId) ?? 0) + 1);
      }
      counts.forEach((tc, key) => {
        let best = 0, bestTier = 0;
        tc.forEach((count, tierId) => { if (count > best) { best = count; bestTier = tierId; } });
        map.set(key, { tierId: bestTier, note: null });
      });
      return map;
    }

    for (const tier of data.tiers) {
      for (const e of tier.entries) map.set(`${e.classId}__${e.spec}`, { tierId: tier.id, note: e.note });
    }
    return map;
  }

  const map = placed();

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    if (!event.over) return;

    const draggedId = String(event.active.id);   // "classId__spec"
    const overId = String(event.over.id);        // "tier__123" | "pool"
    const [classId, spec] = draggedId.split("__");

    if (overId === "pool") { remove(classId, spec); return; }

    if (overId.startsWith("tier__")) {
      const tierId = Number(overId.replace("tier__", ""));
      if (map.get(draggedId)?.tierId === tierId) return;
      setModal({ classId, spec, tierId });
      setNoteText(map.get(draggedId)?.note ?? "");
    }
  }

  async function place(note: string) {
    if (!modal || !data) return;
    setSaving(true);
    const endpoint = data.isVoting
      ? `/api/tier-lists/${data.id}/vote`
      : `/api/tier-lists/${data.id}/entries`;
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierId: modal.tierId, classId: modal.classId, spec: modal.spec, note }),
    });
    setModal(null);
    setSaving(false);
    await load();
  }

  async function remove(classId: string, spec: string) {
    if (!data) return;
    const endpoint = data.isVoting
      ? `/api/tier-lists/${data.id}/vote`
      : `/api/tier-lists/${data.id}/entries`;
    await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId, spec }),
    });
    await load();
  }

  async function deleteList() {
    if (!data || !confirm("Bu tier list'i silmek istediğine emin misin?")) return;
    await fetch(`/api/tier-lists/${data.id}`, { method: "DELETE" });
    router.push("/test/tier-list");
  }

  if (loading) {
    return <TestShell title="Tier List" subtitle="Yükleniyor…"><Empty>Tier list geliyor…</Empty></TestShell>;
  }
  if (!data) {
    return <TestShell title="Tier List" subtitle="Bulunamadı"><Empty>Bu tier list bulunamadı.</Empty></TestShell>;
  }

  const tags = data.tags ? data.tags.split(",").filter(Boolean) : [];
  const pool = ALL_SPECS.filter((s) => !map.has(`${s.classId}__${s.spec}`));
  const active = dragging ? ALL_SPECS.find((s) => `${s.classId}__${s.spec}` === dragging) : null;
  const voterCount = new Set(data.votes.map((v) => v.userId)).size;

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragging(String(e.active.id))}
                onDragEnd={onDragEnd}>
      <TestShell bare title={data.title}>
        <div className="space-y-4 pb-8">
          <Link href="/test/tier-list"
                className="inline-flex items-center gap-1 text-[12px] transition-colors hover:opacity-80"
                style={{ color: "var(--t-dim)" }}>
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.2} /> Tier listeler
          </Link>

          {/* ── Künye ────────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {data.isVoting && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{ color: "#6b93ff", background: "rgba(107,147,255,.12)",
                                 border: "1px solid rgba(107,147,255,.25)" }}>
                    <Vote className="w-3 h-3" strokeWidth={2} /> OYLAMALI
                  </span>
                )}
                <h1 className="text-[26px] font-bold tracking-tight leading-none">{data.title}</h1>
              </div>

              {data.description && (
                <p className="text-[13px] mt-2" style={{ color: "var(--t-dim)" }}>{data.description}</p>
              )}

              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {tags.map((tag) => {
                    const c = TAG_COLOR[tag] ?? "var(--t-gold)";
                    return (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                            style={{ color: c, borderColor: c + "30", background: c + "12" }}>
                        {TAG_LABEL[tag] ?? tag}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-2 mt-2.5 text-[11px]" style={{ color: "var(--t-faint)" }}>
                {data.creator.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.creator.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <span className="w-4 h-4 rounded-full" style={{ background: "var(--t-raised)" }} />
                )}
                <span style={{ color: "var(--t-dim)" }}>{data.creator.familyName}</span>
                {data.isVoting && <span>· {voterCount} katılımcı</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {data.isVoting && session?.user && (
                <div className="flex gap-0.5 p-0.5 rounded-[var(--t-r-sm)]"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                  {([["list", "Genel"], ["my", "Oyum"]] as const).map(([m, label]) => (
                    <button key={m} onClick={() => setView(m)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors"
                            style={view === m
                              ? { color: "var(--t-gold)", background: "var(--t-gold-soft)" }
                              : { color: "var(--t-faint)" }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {(isCreator || isAdmin) && (
                <button onClick={deleteList}
                        className="text-[12px] font-semibold px-3 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5"
                        style={{ color: "var(--t-bad)", background: "rgba(239,95,95,.10)",
                                 border: "1px solid rgba(239,95,95,.25)" }}>
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={2} /> Sil
                </button>
              )}
            </div>
          </div>

          {editing && (
            <p className="text-[11.5px] flex items-center gap-1.5" style={{ color: "var(--t-faint)" }}>
              <MoveVertical className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} style={{ color: "var(--t-gold)" }} />
              Classları havuzdan tier&apos;a sürükle · kaldırmak için havuza geri sürükle
            </p>
          )}

          {/* ── Tahta ────────────────────────────────────────────── */}
          <Card className="overflow-hidden">
            {data.tiers.map((tier) => {
              const inTier = ALL_SPECS.filter((s) => map.get(`${s.classId}__${s.spec}`)?.tierId === tier.id);
              return (
                <TierRowDrop key={tier.id} tier={tier} editing={editing}>
                  {inTier.map((s) => {
                    const key = `${s.classId}__${s.spec}`;
                    const votes = data.isVoting && view === "list"
                      ? data.votes.filter((v) => v.classId === s.classId && v.spec === s.spec && v.tierId === tier.id).length
                      : null;
                    return (
                      <ClassCard key={key} classId={s.classId} name={s.name} spec={s.spec}
                                 note={map.get(key)?.note ?? null} votes={votes}
                                 editing={editing}
                                 onRemove={editing ? () => remove(s.classId, s.spec) : null} />
                    );
                  })}
                </TierRowDrop>
              );
            })}
          </Card>

          {/* ── Havuz ────────────────────────────────────────────── */}
          {(editing || pool.length > 0) && (
            <PoolDrop editing={editing}>
              <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
                <h2 className="text-[14px] font-semibold">{editing ? "Havuz" : "Yerleştirilmemiş"}</h2>
                <span className="t-chip ml-auto">
                  {pool.length}{editing ? " · TIER SATIRINA SÜRÜKLE" : ""}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 p-3">
                {pool.map((s) => (
                  <ClassCard key={`${s.classId}__${s.spec}`} classId={s.classId} name={s.name}
                             spec={s.spec} note={null} votes={null} editing={editing} onRemove={null} />
                ))}
              </div>
            </PoolDrop>
          )}
        </div>

        <DragOverlay>
          {active && (
            <ClassCard classId={active.classId} name={active.name} spec={active.spec}
                       note={null} votes={null} editing={false} onRemove={null} overlay />
          )}
        </DragOverlay>

        {/* ── Not penceresi ────────────────────────────────────── */}
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
               style={{ background: "rgba(0,0,0,.72)", backdropFilter: "blur(4px)" }}
               onClick={() => setModal(null)}>
            <Card className="w-full max-w-sm overflow-hidden" >
              <div onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
                  <h2 className="text-[14px] font-semibold">Tier&apos;a yerleştir</h2>
                  <button onClick={() => setModal(null)} aria-label="Kapat"
                          className="ml-auto p-1 rounded-md" style={{ color: "var(--t-faint)" }}>
                    <X className="w-3.5 h-3.5" strokeWidth={2.2} />
                  </button>
                </div>

                <div className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    {(() => {
                      const url = getPortraitUrl(modal.classId, modal.spec);
                      return url ? (
                        <Image src={url} width={48} height={64} alt=""
                               className="w-12 h-16 object-cover object-top rounded-lg"
                               style={{ outline: "1px solid var(--t-line)" }} />
                      ) : (
                        <div className="w-12 h-16 rounded-lg" style={{ background: "var(--t-raised)" }} />
                      );
                    })()}
                    <div>
                      <p className="text-[14px] font-semibold">
                        {ALL_SPECS.find((s) => s.classId === modal.classId)?.name}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                        {modal.spec === "succession" ? "Aktarım" : "Uyanış"}
                      </p>
                    </div>
                  </div>

                  <label className="block text-[10px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--t-faint)" }}>
                    Not <span className="normal-case opacity-60">(isteğe bağlı)</span>
                  </label>
                  <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} rows={3} autoFocus
                            placeholder="Bu yerleştirme için not…"
                            className="w-full px-3 py-2 rounded-[var(--t-r-sm)] text-[13px] outline-none resize-none mb-4"
                            style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                     color: "var(--t-text)" }} />

                  <div className="flex gap-2">
                    <button onClick={() => place(noteText)} disabled={saving}
                            className="flex-1 text-[12.5px] font-semibold h-[36px] rounded-[var(--t-r-sm)] disabled:opacity-50"
                            style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
                      {saving ? "Kaydediliyor…" : "Yerleştir"}
                    </button>
                    <button onClick={() => setModal(null)}
                            className="text-[12.5px] font-semibold px-4 h-[36px] rounded-[var(--t-r-sm)]"
                            style={{ color: "var(--t-dim)", background: "var(--t-raised)",
                                     border: "1px solid var(--t-line)" }}>
                      İptal
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </TestShell>
    </DndContext>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function ClassCard({ classId, name, spec, note, votes, editing, onRemove, overlay = false }: {
  classId: string; name: string; spec: string; note: string | null;
  votes: number | null; editing: boolean; onRemove: (() => void) | null; overlay?: boolean;
}) {
  const id = `${classId}__${spec}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: !editing });
  const [tip, setTip] = useState(false);

  const url = getPortraitUrl(classId, spec);
  const specLabel = spec === "succession" ? "Akt." : "Uyş.";

  return (
    <div ref={setNodeRef} {...(editing ? { ...listeners, ...attributes } : {})}
         className={`relative group flex flex-col items-center rounded-lg overflow-hidden select-none
           ${editing ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
         style={{
           transform: CSS.Translate.toString(transform),
           opacity: isDragging && !overlay ? 0.3 : 1,
           width: 64, touchAction: "none",
           ...(overlay ? { boxShadow: "0 18px 40px rgba(0,0,0,.7)", outline: "2px solid var(--t-gold)" } : {}),
         }}>
      <div className="relative w-16 h-[72px] overflow-hidden"
           style={{ background: "var(--t-raised)", outline: "1px solid var(--t-line)" }}>
        {url ? (
          <Image src={url} alt={name} fill sizes="64px" className="object-cover object-top" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[12px]" style={{ color: "var(--t-faint)" }}>
            {name[0]}
          </div>
        )}

        <span className="absolute bottom-0 right-0 text-[8px] font-bold px-1 py-0.5 leading-none rounded-tl"
              style={{ background: "rgba(5,5,5,.85)", color: "var(--t-faint)" }}>
          {specLabel}
        </span>

        {note && (
          <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full z-10"
                style={{ background: "var(--t-gold)", boxShadow: "0 0 0 2px rgba(5,5,5,.6)" }}
                onMouseEnter={() => setTip(true)} onMouseLeave={() => setTip(false)} />
        )}
        {tip && note && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 rounded-lg px-2 py-1.5 text-[11px] w-36 text-center pointer-events-none whitespace-pre-wrap"
               style={{ background: "var(--t-surface)", border: "1px solid var(--t-line-strong)",
                        boxShadow: "0 10px 30px rgba(0,0,0,.7)" }}>
            {note}
          </div>
        )}

        {votes !== null && votes > 0 && (
          <span className="t-num absolute top-1 right-1 text-[9px] font-bold px-1 rounded leading-tight"
                style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
            {votes}
          </span>
        )}

        {editing && onRemove && (
          <button onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                  aria-label="Havuza geri al"
                  className="absolute top-1 left-1 w-4 h-4 rounded-full grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                  style={{ background: "var(--t-bad)", color: "#fff" }}>
            <X className="w-2.5 h-2.5" strokeWidth={3} />
          </button>
        )}
      </div>

      <div className="w-full text-[9px] text-center px-1 py-0.5 truncate"
           style={{ background: "var(--t-surface)", color: "var(--t-faint)",
                    borderLeft: "1px solid var(--t-line)", borderRight: "1px solid var(--t-line)",
                    borderBottom: "1px solid var(--t-line)" }}>
        {name}
      </div>
    </div>
  );
}

function TierRowDrop({ tier, children, editing }: {
  tier: TierRow; children: React.ReactNode; editing: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier__${tier.id}`, disabled: !editing });
  return (
    <div ref={setNodeRef} className="flex min-h-[92px] transition-colors"
         style={{
           borderBottom: "1px solid var(--t-line)",
           background: isOver ? "rgba(232,180,81,.07)" : undefined,
         }}>
      <div className="flex items-center justify-center font-black text-[19px] w-14 flex-shrink-0"
           style={{
             background: `linear-gradient(160deg, ${tier.color}28, ${tier.color}10)`,
             color: tier.color,
             borderRight: `1px solid ${tier.color}30`,
           }}>
        {tier.name}
      </div>
      <div className="flex flex-wrap gap-2 p-2.5 flex-1 items-start content-start">
        {children}
        {isOver && (
          <div className="rounded-lg w-16 h-[88px] grid place-items-center animate-pulse"
               style={{ border: "1px dashed rgba(232,180,81,.5)", color: "rgba(232,180,81,.5)" }}>
            <Plus className="w-4 h-4" strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}

function PoolDrop({ children, editing }: { children: React.ReactNode; editing: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pool", disabled: !editing });
  return (
    <div ref={setNodeRef}>
      <Card className="overflow-hidden transition-colors"
            hi={isOver}>
        {children}
      </Card>
    </div>
  );
}
