"use client";

import { useState } from "react";
import { getClassByID, getPortraitUrl, hasClassVariants } from "@/lib/classes";

interface PortraitPanelProps {
  classId: string;
  spec: string;          // "awakening" | "succession"
  ap: number;
  dp: number;
  roleName?: string | null;
  roleColor?: string | null;
  /** If provided, overrides the internal spec toggle (controlled mode for edit form) */
  controlledSpec?: string;
  onSpecChange?: (spec: string) => void;
}

export function PortraitPanel({
  classId,
  spec,
  ap,
  dp,
  roleName,
  roleColor,
  controlledSpec,
  onSpecChange,
}: PortraitPanelProps) {
  // Local "display" spec — cosmetic toggle in view mode
  const [displaySpec, setDisplaySpec] = useState(spec);
  const activeSpec = controlledSpec ?? displaySpec;

  const classData   = getClassByID(classId);
  const canToggle   = hasClassVariants(classId);
  const portraitSrc = getPortraitUrl(classId, activeSpec);
  const specLabel   = activeSpec === "succession" ? "Succession" : "Awakening";

  function toggle(s: string) {
    if (onSpecChange) {
      onSpecChange(s); // controlled mode (edit form)
    } else {
      setDisplaySpec(s); // cosmetic mode (view)
    }
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-bdo-border/60 bg-bdo-surface flex flex-col">
      {/* Spec toggle */}
      {canToggle && (
        <div className="absolute top-3 left-3 z-10 flex gap-1 bg-black/55 backdrop-blur-sm rounded-lg p-1 border border-white/8">
          <button
            onClick={() => toggle("awakening")}
            className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wide transition-all ${
              activeSpec !== "succession"
                ? "bg-bdo-gold text-bdo-bg shadow"
                : "text-white/45 hover:text-white/70"
            }`}
          >
            Awak
          </button>
          <button
            onClick={() => toggle("succession")}
            className={`px-3 py-1 rounded-md text-[11px] font-bold tracking-wide transition-all ${
              activeSpec === "succession"
                ? "bg-bdo-gold text-bdo-bg shadow"
                : "text-white/45 hover:text-white/70"
            }`}
          >
            Succ
          </button>
        </div>
      )}

      {/* Portrait image — fixed aspect ratio, never stretches */}
      <div className="relative overflow-hidden" style={{ height: "360px" }}>
        {portraitSrc ? (
          <img
            src={portraitSrc}
            alt={classData?.name ?? ""}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-b from-bdo-border/20 to-transparent flex items-center justify-center">
            <span className="text-5xl opacity-20">⚔️</span>
          </div>
        )}
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bdo-surface to-transparent" />
      </div>

      {/* Info section */}
      <div className="px-4 pb-4 pt-2">
        {roleName && (
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold mb-2 px-2.5 py-0.5 rounded-full border"
            style={{
              color: roleColor ?? "#a78bfa",
              borderColor: `${roleColor ?? "#a78bfa"}33`,
              background: `${roleColor ?? "#a78bfa"}11`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: roleColor ?? "#a78bfa" }}
            />
            {roleName}
          </div>
        )}

        <div className="text-xl font-black text-white leading-tight">
          {classData?.name ?? "—"}
        </div>
        <div className="text-[11px] text-bdo-gold uppercase tracking-widest mt-0.5 mb-3">
          {specLabel}
        </div>

        {/* AP / DP / GS */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-bdo-bg/60 border border-bdo-border rounded-lg py-2 text-center">
            <div className="text-[9px] uppercase text-white/35 tracking-wider mb-0.5">AP</div>
            <div className="text-base font-bold font-mono text-white/90">{ap}</div>
          </div>
          <div className="bg-bdo-bg/60 border border-bdo-border rounded-lg py-2 text-center">
            <div className="text-[9px] uppercase text-white/35 tracking-wider mb-0.5">DP</div>
            <div className="text-base font-bold font-mono text-white/90">{dp}</div>
          </div>
          <div className="bg-bdo-gold/8 border border-bdo-gold/25 rounded-lg py-2 text-center">
            <div className="text-[9px] uppercase text-bdo-gold/60 tracking-wider mb-0.5">GS</div>
            <div className="text-base font-bold font-mono text-bdo-gold">{ap + dp}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
