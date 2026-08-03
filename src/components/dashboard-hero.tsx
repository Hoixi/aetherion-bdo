"use client";

import { getClassByID, getClassIconUrl } from "@/lib/classes";

interface DashboardHeroProps {
  familyName: string;
  classId: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl?: string;
}

export function DashboardHero({ familyName, classId, spec, ap, dp, avatarUrl }: DashboardHeroProps) {
  const classData = getClassByID(classId);
  const specKey = spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
  const iconUrl = getClassIconUrl(classId);
  const gs = ap + dp;

  return (
    <div className="flex items-center gap-4 py-1 mb-6">
      {avatarUrl
        ? <img src={avatarUrl} alt="" className="w-11 h-11 rounded-xl ring-1 ring-bdo-border flex-shrink-0" />
        : <div className="w-11 h-11 rounded-xl bg-bdo-surface ring-1 ring-bdo-border flex-shrink-0" />
      }
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-sm font-bold text-bdo-text-primary">{familyName || "Kahraman"}</h1>
          {iconUrl && <img src={iconUrl} alt="" className="w-3.5 h-3.5 opacity-40 flex-shrink-0" />}
          <span className="text-xs text-bdo-text-muted">{classData?.name ?? "—"}</span>
          {classData && (
            <span className="text-[10px] font-semibold bg-bdo-surface border border-bdo-border text-bdo-text-muted px-1.5 py-0.5 rounded">
              {specKey === "succession" ? "SUC" : "AWK"}
            </span>
          )}
        </div>
        <p className="text-[11px] text-bdo-text-secondary mt-0.5">Aetherion Guild</p>
      </div>
      <div className="ml-auto flex items-center gap-2 flex-shrink-0">
        <div className="stat-badge">AP <span className="text-red-400 font-mono font-semibold ml-1">{ap}</span></div>
        <div className="stat-badge">DP <span className="text-[#4a7cf5] font-mono font-semibold ml-1">{dp}</span></div>
        <div className="stat-badge border-bdo-gold/20">GS <span className="text-bdo-gold font-mono font-bold ml-1">{gs}</span></div>
      </div>
    </div>
  );
}
