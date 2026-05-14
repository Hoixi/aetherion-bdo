"use client";

import { useState } from "react";
import Link from "next/link";
import { getTypeName } from "@/lib/classes";

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

export function WarCard({ war }: WarCardProps) {
  const currentStatus = war.participants[0]?.status ?? null;
  const [status, setStatus] = useState<string | null>(currentStatus);
  const [loading, setLoading] = useState(false);

  const deadlinePassed = war.deadline ? new Date() > new Date(war.deadline) : false;

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
    <div className="bg-gradient-to-br from-bdo-surface to-bdo-gradient-end border border-bdo-border rounded-lg p-5 hover:border-bdo-gold/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <Link href={`/wars/${war.id}`} className="text-bdo-text-primary font-semibold hover:text-bdo-gold transition-colors">
          {war.title}
        </Link>
        <span className="text-xs bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded">
          {getTypeName(war.type)}
        </span>
      </div>
      <div className="text-sm text-bdo-text-muted mb-3">
        {new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-bdo-text-muted">{war._count.participants} katılımcı</span>
        {!deadlinePassed && (
          <div className="flex gap-2">
            <button
              onClick={() => handleParticipate("ATTENDING")}
              disabled={loading || status === "ATTENDING"}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                status === "ATTENDING"
                  ? "bg-bdo-gold text-bdo-bg"
                  : "bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20"
              } disabled:opacity-50`}
            >
              Katılıyorum
            </button>
            <button
              onClick={() => handleParticipate("DECLINED")}
              disabled={loading || status === "DECLINED"}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                status === "DECLINED"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-bdo-border text-bdo-text-muted hover:bg-red-500/10 hover:text-red-400"
              } disabled:opacity-50`}
            >
              Katılmıyorum
            </button>
          </div>
        )}
        {deadlinePassed && (
          <span className="text-xs text-red-400">Süre doldu</span>
        )}
      </div>
    </div>
  );
}
