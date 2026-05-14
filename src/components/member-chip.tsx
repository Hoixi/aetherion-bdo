"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BDO_CLASSES } from "@/lib/classes";

interface MemberChipProps {
  id: string;
  user: { id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string };
  isDragOverlay?: boolean;
}

export function MemberChip({ id, user, isDragOverlay }: MemberChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

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
      {...attributes}
      {...listeners}
      className={`flex items-center gap-2 bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing select-none ${
        isDragOverlay ? "shadow-lg border-bdo-gold/50" : "hover:border-bdo-gold/30"
      }`}
    >
      {user.avatarUrl && <img src={user.avatarUrl} alt="" className="w-6 h-6 rounded-full" />}
      <span className="text-sm text-bdo-text-primary whitespace-nowrap">{user.familyName}</span>
      <span className="text-xs text-bdo-text-muted">({className})</span>
      <span className="text-xs text-bdo-gold font-mono ml-auto">{user.ap}/{user.dp}</span>
    </div>
  );
}
