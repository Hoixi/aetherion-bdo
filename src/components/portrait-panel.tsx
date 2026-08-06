"use client";

import { useState } from "react";
import { getClassByID, getPortraitUrl, hasClassVariants } from "@/lib/classes";
import { Swords } from "lucide-react";
import Image from "next/image";

interface PortraitPanelProps {
  classId: string;
  spec: string;
  ap: number;
  dp: number;
  roleName?: string | null;
  roleColor?: string | null;
  controlledSpec?: string;
  onSpecChange?: (spec: string) => void;
}

export function PortraitPanel({
  classId, spec, ap, dp, roleName, roleColor, controlledSpec, onSpecChange,
}: PortraitPanelProps) {
  const [displaySpec, setDisplaySpec] = useState(spec);
  const activeSpec = controlledSpec ?? displaySpec;

  const classData = getClassByID(classId);
  const canToggle = hasClassVariants(classId);
  const portraitSrc = getPortraitUrl(classId, activeSpec);
  const specLabel = activeSpec === "succession" ? "Succession" : "Awakening";

  function toggle(s: string) {
    if (onSpecChange) onSpecChange(s);
    else setDisplaySpec(s);
  }

  return (
    <div className="card flex flex-col">
      <div className="relative overflow-hidden bg-bdo-surface-2" style={{ height: "330px" }}>
        {portraitSrc ? (
          <Image
            src={portraitSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 260px"
            priority
            className="object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Swords className="w-10 h-10 text-bdo-text-secondary/20" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bdo-surface to-transparent" />

        {canToggle && !onSpecChange && (
          <div className="absolute top-2.5 right-2.5 flex gap-0.5 bg-bdo-bg/70 backdrop-blur-sm border border-bdo-border rounded-lg p-0.5">
            {(["awakening", "succession"] as const).map((s) => (
              <button
                key={s}
                onClick={() => toggle(s)}
                className={`px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors ${
                  activeSpec === s ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-secondary hover:text-bdo-text-muted"
                }`}
              >
                {s === "succession" ? "SUC" : "AWK"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pb-4 -mt-4 relative">
        {roleName && (
          <div
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold mb-1.5 px-2 py-0.5 rounded-md border"
            style={{
              color: roleColor ?? "#7a8ba3",
              borderColor: `${roleColor ?? "#7a8ba3"}30`,
              background: `${roleColor ?? "#7a8ba3"}12`,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: roleColor ?? "#7a8ba3" }} />
            {roleName}
          </div>
        )}

        <p className="text-[15px] font-bold text-bdo-text-primary leading-tight">
          {classData?.name ?? "—"}
        </p>
        <p className="text-[10px] text-bdo-text-secondary uppercase tracking-widest mt-0.5 mb-3">
          {specLabel}
        </p>

        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: "AP", value: ap, tone: "text-red-400/90", border: "border-bdo-border" },
            { label: "DP", value: dp, tone: "text-[#6b93ff]/90", border: "border-bdo-border" },
            { label: "GS", value: ap + dp, tone: "text-bdo-gold", border: "border-bdo-gold/20" },
          ].map((s) => (
            <div key={s.label} className={`bg-bdo-bg border ${s.border} rounded-lg py-1.5 text-center`}>
              <p className="text-[9px] uppercase text-bdo-text-secondary tracking-wider">{s.label}</p>
              <p className={`text-[15px] font-bold font-mono ${s.tone} leading-tight`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
