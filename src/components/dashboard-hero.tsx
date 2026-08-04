"use client";

import { useState } from "react";
import { getClassByID, getClassBannerUrl, getClassIconUrl } from "@/lib/classes";
import { Shield, Swords, Sparkles } from "lucide-react";

interface DashboardHeroProps {
  familyName: string;
  classId: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl?: string;
  guildName?: string | null;
  guildTag?: string | null;
  guildColor?: string | null;
}

export function DashboardHero({
  familyName, classId, spec, ap, dp, avatarUrl,
  guildName, guildTag, guildColor,
}: DashboardHeroProps) {
  const [bannerFailed, setBannerFailed] = useState(false);

  const classData = getClassByID(classId);
  const specKey = spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
  // Banner tek görsel — awk/succ ayrımı yok
  const bannerUrl = classData && !bannerFailed ? getClassBannerUrl(classData.classType) : null;
  const iconUrl = getClassIconUrl(classId);
  const gs = ap + dp;

  return (
    <div className="card card-accent relative overflow-hidden mb-4 h-[190px] sm:h-[210px]">
      {/* Tam genişlik karakter banner'ı */}
      {bannerUrl && (
        <>
          <img
            src={bannerUrl}
            alt=""
            onError={() => setBannerFailed(true)}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
            style={{ objectPosition: "center 28%" }}
          />
          {/* soldan sağa okunabilirlik gradyanı */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0f15] via-[#0c0f15]/70 to-[#0c0f15]/15" />
          {/* alt zemin — stat kutuları için */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0c0f15] via-[#0c0f15]/70 to-transparent" />
          {/* üst kenar yumuşatma */}
          <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#0c0f15]/80 to-transparent" />
        </>
      )}

      {/* İçerik */}
      <div className="relative h-full flex flex-col justify-between p-4">
        {/* Üst: kimlik */}
        <div className="flex items-center gap-3">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-11 h-11 rounded-xl ring-1 ring-white/15 flex-shrink-0 shadow-lg shadow-black/60" />
            : <div className="w-11 h-11 rounded-xl bg-bdo-surface-2 ring-1 ring-white/10 flex-shrink-0" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-bold text-white leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                {familyName || "Kahraman"}
              </h2>
              {guildTag && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border backdrop-blur-sm"
                  style={{
                    color: guildColor ?? "#d4a030",
                    borderColor: `${guildColor ?? "#d4a030"}50`,
                    backgroundColor: `${guildColor ?? "#d4a030"}20`,
                  }}
                  title={guildName ?? undefined}
                >
                  {guildTag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {iconUrl && <img src={iconUrl} alt="" className="w-3.5 h-3.5 opacity-70 flex-shrink-0 drop-shadow" />}
              <span className="text-[12px] text-white/70 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                {classData?.name ?? "Class seçilmemiş"}
              </span>
              {classData && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-white/60 border border-white/20 bg-black/30 backdrop-blur-sm rounded px-1 py-0.5">
                  {specKey === "succession" ? "SUC" : "AWK"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Alt: statlar */}
        <div className="flex items-end gap-2">
          <StatBox icon={Swords} label="AP" value={ap} tone="text-red-400" />
          <StatBox icon={Shield} label="DP" value={dp} tone="text-[#6b93ff]" />
          <StatBox icon={Sparkles} label="GS" value={gs} tone="text-bdo-gold" accent />
        </div>
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon, label, value, tone, accent,
}: {
  icon: typeof Shield; label: string; value: number; tone: string; accent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-1.5 min-w-[74px] backdrop-blur-md border ${
        accent
          ? "bg-bdo-gold/[0.12] border-bdo-gold/30"
          : "bg-black/45 border-white/10"
      }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className={`w-2.5 h-2.5 ${accent ? "text-bdo-gold/70" : "text-white/45"}`} strokeWidth={2} />
        <span className={`text-[9px] uppercase tracking-wider ${accent ? "text-bdo-gold/70" : "text-white/45"}`}>
          {label}
        </span>
      </div>
      <p className={`text-[19px] font-bold font-mono leading-none drop-shadow ${tone}`}>{value}</p>
    </div>
  );
}
