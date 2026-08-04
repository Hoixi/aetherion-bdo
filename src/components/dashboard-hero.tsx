"use client";

import { getClassByID, getClassImageUrl, getClassIconUrl } from "@/lib/classes";
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
  const classData = getClassByID(classId);
  const specKey = spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
  const splashUrl = classData ? getClassImageUrl(classData.classType, specKey) : null;
  const iconUrl = getClassIconUrl(classId);
  const gs = ap + dp;

  return (
    <div className="card card-accent relative overflow-hidden mb-4" style={{ height: "170px" }}>
      {/* Splash art */}
      {splashUrl && (
        <div className="absolute right-0 top-0 bottom-0 w-[62%] overflow-hidden">
          <img
            src={splashUrl}
            alt=""
            className="h-full w-full object-cover object-top pointer-events-none select-none opacity-90"
          />
          {/* left fade into card */}
          <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-[#131820] via-[#131820]/85 to-transparent" />
          {/* top / bottom vignette */}
          <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-[#1a2233] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#10151d] to-transparent" />
          {/* right edge */}
          <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#10151d]/70 to-transparent" />
        </div>
      )}

      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-4">
        {/* Top: identity */}
        <div className="flex items-center gap-3">
          {avatarUrl
            ? <img src={avatarUrl} alt="" className="w-11 h-11 rounded-xl ring-1 ring-bdo-border-2 flex-shrink-0 shadow-lg shadow-black/40" />
            : <div className="w-11 h-11 rounded-xl bg-bdo-surface-2 ring-1 ring-bdo-border flex-shrink-0" />
          }
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[17px] font-bold text-bdo-text-primary leading-tight drop-shadow">
                {familyName || "Kahraman"}
              </h2>
              {guildTag && (
                <span
                  className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                  style={{
                    color: guildColor ?? "#d4a030",
                    borderColor: `${guildColor ?? "#d4a030"}40`,
                    backgroundColor: `${guildColor ?? "#d4a030"}15`,
                  }}
                  title={guildName ?? undefined}
                >
                  {guildTag}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {iconUrl && <img src={iconUrl} alt="" className="w-3.5 h-3.5 opacity-50 flex-shrink-0" />}
              <span className="text-[12px] text-bdo-text-muted">{classData?.name ?? "Class seçilmemiş"}</span>
              {classData && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-bdo-text-secondary border border-bdo-border rounded px-1 py-0.5">
                  {specKey === "succession" ? "SUC" : "AWK"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: stats */}
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
      className={`rounded-lg px-3 py-1.5 min-w-[72px] backdrop-blur-sm border ${
        accent
          ? "bg-bdo-gold/[0.08] border-bdo-gold/25"
          : "bg-bdo-bg/70 border-bdo-border"
      }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className={`w-2.5 h-2.5 ${accent ? "text-bdo-gold/60" : "text-bdo-text-secondary"}`} strokeWidth={2} />
        <span className={`text-[9px] uppercase tracking-wider ${accent ? "text-bdo-gold/60" : "text-bdo-text-secondary"}`}>
          {label}
        </span>
      </div>
      <p className={`text-[19px] font-bold font-mono leading-none ${tone}`}>{value}</p>
    </div>
  );
}
