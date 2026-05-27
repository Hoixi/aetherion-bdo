"use client";

import { getClassByID, getPortraitUrl, getClassIconUrl } from "@/lib/classes";

interface CharacterCardProps {
  familyName: string;
  className: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl?: string;
}

export function CharacterCard({ familyName, className, spec, ap, dp, avatarUrl }: CharacterCardProps) {
  const classData  = getClassByID(className);
  const gs         = ap + dp;
  const specKey    = spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
  const portraitUrl = getPortraitUrl(className, spec);
  const iconUrl    = getClassIconUrl(className);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-bdo-gold/30 bg-gradient-to-br from-bdo-surface via-bdo-bg to-bdo-surface"
      style={{ height: "190px" }}
    >
      {/* Portrait image — right side, fixed height, no stretch */}
      {portraitUrl && (
        <div
          className="absolute right-0 top-0 bottom-0 overflow-hidden"
          style={{ width: "160px" }}
        >
          <img
            src={portraitUrl}
            alt=""
            className="h-full w-full object-cover object-top pointer-events-none select-none"
          />
          {/* Fade left edge into card */}
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-bdo-bg to-transparent" />
          {/* Fade top & bottom */}
          <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-bdo-bg to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-bdo-bg to-transparent" />
        </div>
      )}

      {/* Gold top line accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-bdo-gold/50 via-bdo-gold/15 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative flex flex-col justify-between h-full p-5">
        {/* Top: avatar + name + class */}
        <div className="flex items-center gap-3">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt=""
              className="w-11 h-11 rounded-full border-2 border-bdo-gold/40 shadow-lg shadow-black/40 flex-shrink-0"
            />
          )}
          <div>
            <h2 className="text-xl font-black text-white leading-tight drop-shadow-md">
              {familyName || "Kahraman"}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              {iconUrl && (
                <img src={iconUrl} alt="" className="w-4 h-4 opacity-60 flex-shrink-0" />
              )}
              <span className="text-sm text-bdo-text-secondary">
                {classData?.name ?? "Class seçilmemiş"}
              </span>
              {classData && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-bdo-gold/10 border border-bdo-gold/30 text-bdo-gold px-2 py-0.5 rounded-full">
                  {specKey === "succession" ? "SUC" : "AWK"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: AP / DP / GS */}
        <div className="flex gap-2">
          <div className="text-center bg-bdo-bg/80 border border-bdo-border rounded-lg py-1.5 px-3 min-w-[64px]">
            <div className="text-[9px] uppercase text-bdo-text-muted tracking-wider">AP</div>
            <div className="text-lg font-bold font-mono text-red-400">{ap}</div>
          </div>
          <div className="text-center bg-bdo-bg/80 border border-bdo-border rounded-lg py-1.5 px-3 min-w-[64px]">
            <div className="text-[9px] uppercase text-bdo-text-muted tracking-wider">DP</div>
            <div className="text-lg font-bold font-mono text-blue-400">{dp}</div>
          </div>
          <div className="text-center bg-bdo-bg/80 border border-bdo-gold/25 rounded-lg py-1.5 px-3 min-w-[64px]">
            <div className="text-[9px] uppercase text-bdo-gold/70 tracking-wider">GS</div>
            <div className="text-lg font-bold font-mono text-bdo-gold">{gs}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
