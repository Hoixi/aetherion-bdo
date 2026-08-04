"use client";

import { useState } from "react";
import Link from "next/link";
import { getTypeName } from "@/lib/classes";
import { Swords, Castle, Skull, Pin, Check, X, LucideIcon } from "lucide-react";

interface WarCardProps {
  war: {
    id: number;
    title: string;
    type: string;
    date: string;
    deadline: string | null;
    _count: { participants: number };
    participants: { status: string }[];
  };
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  NODE_WAR: Swords,
  SIEGE: Castle,
  KARA_TAPINAK: Skull,
  OTHER: Pin,
};

export function WarCard({ war }: WarCardProps) {
  const currentStatus = war.participants[0]?.status ?? null;
  const [status, setStatus] = useState<string | null>(currentStatus);
  const [loading, setLoading] = useState(false);

  const deadlinePassed = war.deadline ? new Date() > new Date(war.deadline) : false;
  const warDate = new Date(war.date);
  const isPast = warDate < new Date();
  const attending = war._count.participants;
  const TypeIcon = TYPE_ICONS[war.type] ?? Pin;

  async function handleParticipate(newStatus: string) {
    setLoading(true);
    const res = await fetch(`/api/wars/${war.id}/participate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) setStatus(newStatus);
    setLoading(false);
  }

  return (
    <div className="card-row items-start gap-3">
      {/* Date column */}
      <div className="flex-shrink-0 w-9 text-center pt-0.5">
        <p className="text-[9px] uppercase text-bdo-text-secondary font-semibold tracking-wider leading-none">
          {warDate.toLocaleDateString("tr-TR", { month: "short" })}
        </p>
        <p className="text-base font-bold text-bdo-text-primary leading-tight">
          {warDate.getDate()}
        </p>
        <p className="text-[9px] text-bdo-text-secondary">
          {warDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      {/* Icon */}
      <div className="w-8 h-8 rounded-lg bg-bdo-surface-2 border border-bdo-border flex items-center justify-center flex-shrink-0 mt-0.5">
        <TypeIcon className="w-3.5 h-3.5 text-bdo-gold/70" strokeWidth={1.75} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5">
        <Link href={`/wars/${war.id}`} className="text-[13px] font-medium text-bdo-text-primary hover:text-bdo-gold transition-colors block leading-snug">
          {war.title}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-bdo-text-muted">{getTypeName(war.type)}</span>
          <span className="text-[11px] text-bdo-text-secondary">·</span>
          <span className="text-[11px] text-bdo-text-muted">{attending} katılımcı</span>
          {status === "ATTENDING" && <span className="text-[10px] text-emerald-400 font-semibold">· Katılıyorum</span>}
          {status === "DECLINED" && <span className="text-[10px] text-red-400 font-semibold">· Katılmıyorum</span>}
        </div>
      </div>

      {/* Actions */}
      {!isPast && !deadlinePassed && (
        <div className="flex gap-1.5 flex-shrink-0 pt-0.5">
          <button
            onClick={() => handleParticipate("ATTENDING")}
            disabled={loading || status === "ATTENDING"}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              status === "ATTENDING"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                : "bg-bdo-surface-2 text-bdo-text-muted border border-bdo-border hover:text-emerald-400 hover:border-emerald-500/30"
            } disabled:opacity-50`}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => handleParticipate("DECLINED")}
            disabled={loading || status === "DECLINED"}
            className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
              status === "DECLINED"
                ? "bg-red-500/15 text-red-400 border border-red-500/25"
                : "bg-bdo-surface-2 text-bdo-text-muted border border-bdo-border hover:text-red-400 hover:border-red-500/30"
            } disabled:opacity-50`}
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
      )}
      {(isPast || deadlinePassed) && (
        <span className={`text-[10px] flex-shrink-0 pt-1.5 ${isPast ? "text-bdo-text-secondary" : "text-red-400/60"}`}>
          {isPast ? "Tamamlandı" : "Süre doldu"}
        </span>
      )}
    </div>
  );
}
