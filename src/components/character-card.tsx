"use client";

import { getClassByID, getClassImageUrl, getPortraitUrl, getClassIconUrl } from "@/lib/classes";

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
  const specKey = spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
  const splashUrl = classData ? getClassImageUrl(classData.classType, specKey) : null;
  const portraitUrl = getPortraitUrl(className, spec);
  const iconUrl = getClassIconUrl(className);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-bdo-gold/30 bg-gradient-to-br from-bdo-surface via-bdo-bg to-bdo-surface"
      style={{ minHeight: "220px" }}
    >
      {/* Full-width splash background — higher opacity */}
      {splashUrl && (
        <img
          src={splashUrl}
          alt=""
          className="absolute right-0 top-0 h-full w-4/5 object-cover object-top opacity-55 pointer-events-none select-none"
        />
      )}

      {/* Left-to-center dark gradient protecting text */}
      <div className="absolute inset-0 bg-gradient-to-r from-bdo-bg via-bdo-bg/80 to-transparent pointer-events-none" />
      {/* Top & bottom vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-bdo-bg/80 via-transparent to-bdo-bg/30 pointer-events-none" />

      {/* Portrait image — right edge, tall */}
      {portraitUrl && (
        <>
          <img
            src={portraitUrl}
            alt=""
            className="absolute right-0 bottom-0 h-[115%] w-auto object-cover object-top pointer-events-none select-none"
            style={{ maxWidth: "260px" }}
          />
          {/* Fade portrait into card edges */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-bdo-bg/10 pointer-events-none" />
          <div
            className="absolute right-0 inset-y-0 bg-gradient-to-l from-bdo-bg/30 to-transparent pointer-events-none"
            style={{ width: "80px" }}
          />
        </>
      )}

      {/* Gold top line accent */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-bdo-gold/60 via-bdo-gold/20 to-transparent pointer-events-none" />

      {/* Content */}
      <div className="relative flex flex-col justify-between h-full p-6" style={{ minHeight: "220px" }}>
        {/* Top: avatar + name + class */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                className="w-11 h-11 rounded-full border-2 border-bdo-gold/40 shadow-lg shadow-black/40"
              />
            )}
            <div>
              <h2 className="text-2xl font-black text-white leading-tight drop-shadow-md">
                {familyName || "Kahraman"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {iconUrl && (
                  <img src={iconUrl} alt="" className="w-4 h-4 opacity-70" />
                )}
                <span className="text-sm text-bdo-text-secondary">
                  {classData?.name ?? "Class seçilmemiş"}
                </span>
                {classData && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-bdo-gold/10 border border-bdo-gold/30 text-bdo-gold px-2 py-0.5 rounded-full">
                    {specKey === "succession" ? "Succession" : "Awakening"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: AP / DP / GS */}
        <div className="flex gap-3 mt-6">
          <div className="text-center bg-bdo-bg/70 backdrop-blur-sm border border-bdo-border rounded-lg py-2 px-4 min-w-[72px]">
            <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">AP</div>
            <div className="text-xl font-bold font-mono text-red-400">{ap}</div>
          </div>
          <div className="text-center bg-bdo-bg/70 backdrop-blur-sm border border-bdo-border rounded-lg py-2 px-4 min-w-[72px]">
            <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider">DP</div>
            <div className="text-xl font-bold font-mono text-blue-400">{dp}</div>
          </div>
          <div className="text-center bg-bdo-bg/70 backdrop-blur-sm border border-bdo-gold/30 rounded-lg py-2 px-4 min-w-[72px]">
            <div className="text-[10px] uppercase text-bdo-gold/80 tracking-wider">GS</div>
            <div className="text-xl font-bold font-mono text-bdo-gold">{gs}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
