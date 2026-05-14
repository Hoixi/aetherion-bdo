"use client";

import { getClassByID, getClassImageUrl } from "@/lib/classes";

interface CharacterCardProps {
  familyName: string;
  className: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl?: string;
}

export function CharacterCard({ familyName, className, spec, ap, dp, avatarUrl }: CharacterCardProps) {
  const classData = getClassByID(className);
  const gs = ap + dp;

  const classImageUrl = classData
    ? getClassImageUrl(classData.classType, spec === "succession" && classData.hasSuccession ? "succession" : "awakening")
    : null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-bdo-gold/30 bg-gradient-to-br from-bdo-surface via-bdo-bg to-bdo-surface min-h-[180px]">
      {/* Background character splash */}
      {classImageUrl && (
        <>
          <img
            src={classImageUrl}
            alt=""
            className="absolute right-0 top-0 h-full w-3/5 object-cover object-top opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-bdo-bg via-bdo-bg/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-bdo-bg/90 via-transparent to-bdo-bg/30" />
        </>
      )}

      {/* Content */}
      <div className="relative flex flex-col justify-between h-full p-6">
        {/* Top section - Name & Class */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            {avatarUrl && (
              <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full border-2 border-bdo-gold/40 shadow-lg" />
            )}
            <div>
              <h2 className="text-xl font-bold text-bdo-gold">
                {familyName || "Kahraman"}
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-bdo-text-secondary">
                  {classData?.name ?? "Class seçilmemiş"}
                </span>
                {classData && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-bdo-gold/10 border border-bdo-gold/30 text-bdo-gold px-2 py-0.5 rounded-full">
                    {spec === "succession" && classData.hasSuccession ? "Succession" : "Awakening"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom section - Stats */}
        <div className="flex gap-3 mt-6">
          <div className="text-center bg-bdo-bg/70 backdrop-blur-sm border border-bdo-border rounded-lg py-2 px-4 min-w-[70px]">
            <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">AP</div>
            <div className="text-xl font-bold font-mono text-red-400">{ap}</div>
          </div>
          <div className="text-center bg-bdo-bg/70 backdrop-blur-sm border border-bdo-border rounded-lg py-2 px-4 min-w-[70px]">
            <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">DP</div>
            <div className="text-xl font-bold font-mono text-blue-400">{dp}</div>
          </div>
          <div className="text-center bg-bdo-bg/70 backdrop-blur-sm border border-bdo-gold/30 rounded-lg py-2 px-4 min-w-[70px]">
            <div className="text-[10px] uppercase text-bdo-gold/80 tracking-wider">GS</div>
            <div className="text-xl font-bold font-mono text-bdo-gold">{gs}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
