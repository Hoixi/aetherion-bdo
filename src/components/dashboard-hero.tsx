"use client";

import Link from "next/link";
import { getClassByID, getPortraitUrl, getClassIconUrl } from "@/lib/classes";

interface DashboardHeroProps {
  familyName: string;
  classId: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl?: string;
}

export function DashboardHero({ familyName, classId, spec, ap, dp, avatarUrl }: DashboardHeroProps) {
  const classData   = getClassByID(classId);
  const specKey     = spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
  const portraitUrl = getPortraitUrl(classId, spec);
  const iconUrl     = getClassIconUrl(classId);
  const gs          = ap + dp;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-bdo-gold/30"
      style={{ height: "190px", background: "#0a0a14" }}
    >
      {/* Portre — sağda arka plan olarak, neredeyse tam görünür */}
      {portraitUrl && (
        <div className="absolute right-0 top-0 bottom-0 overflow-hidden" style={{ width: "55%" }}>
          <img
            src={portraitUrl}
            alt=""
            className="h-full w-full object-cover object-top pointer-events-none select-none"
          />
          {/* Sola doğru hafif geçiş */}
          <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-[#0a0a14] to-transparent" />
          {/* Üst kenar */}
          <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-[#0a0a14] to-transparent" />
          {/* Alt kenar */}
          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#0a0a14] to-transparent" />
        </div>
      )}

      {/* Üst gold çizgi */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-bdo-gold/60 via-bdo-gold/20 to-transparent pointer-events-none" />

      {/* İçerik */}
      <div className="relative flex flex-col justify-between h-full p-5">
        {/* Üst: avatar + isim + class */}
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

        {/* Alt: AP / DP / GS */}
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
