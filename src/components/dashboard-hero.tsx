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
    /* -mx-4: container padding'i kır, sol-sağ kenara kadar uzan */
    <div
      className="-mx-4 relative overflow-hidden border-y border-bdo-gold/20"
      style={{
        background: "linear-gradient(110deg, #06060f 0%, #0b0b18 55%, #0e0e1e 100%)",
      }}
    >
      {/* Üst gold çizgi */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-bdo-gold/70 via-bdo-gold/25 to-transparent pointer-events-none" />
      {/* Alt gold çizgi */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-bdo-gold/35 via-bdo-gold/10 to-transparent pointer-events-none" />

      {/* Portre arkası ambient glow */}
      {portraitUrl && (
        <div
          className="absolute left-0 top-0 bottom-0 pointer-events-none"
          style={{ width: "260px", background: "radial-gradient(ellipse at left center, rgba(212,168,83,0.07) 0%, transparent 70%)" }}
        />
      )}

      <div className="flex items-end" style={{ minHeight: "220px" }}>

        {/* ── Portre — sol kenara yapışık, padding yok ── */}
        {portraitUrl ? (
          <div
            className="relative flex-shrink-0 self-end"
            style={{ width: "clamp(140px, 22vw, 220px)", height: "clamp(190px, 30vw, 280px)" }}
          >
            <img
              src={portraitUrl}
              alt=""
              className="w-full h-full object-cover object-top pointer-events-none select-none"
            />
            {/* Sağa geçiş fade */}
            <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#0b0b18] to-transparent" />
            {/* Alta geçiş fade */}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0b0b18] to-transparent" />
          </div>
        ) : (
          /* Portre yoksa boşluk */
          <div className="flex-shrink-0" style={{ width: "24px" }} />
        )}

        {/* ── İçerik ── */}
        <div className="flex-1 px-5 pb-6 pt-6">

          {/* Üst: avatar + isim + class */}
          <div className="flex items-center gap-3 mb-4">
            {avatarUrl && (
              <img
                src={avatarUrl}
                alt=""
                className="w-11 h-11 rounded-full border-2 border-bdo-gold/40 shadow-lg shadow-black/50 flex-shrink-0"
              />
            )}
            <div>
              <h2 className="text-2xl font-black text-white leading-tight drop-shadow-md">
                {familyName || "Kahraman"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                {iconUrl && (
                  <img src={iconUrl} alt="" className="w-4 h-4 opacity-55 flex-shrink-0" />
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
            <div className="text-center bg-black/40 border border-bdo-border rounded-lg py-1.5 px-3 min-w-[60px]">
              <div className="text-[9px] uppercase text-bdo-text-muted tracking-wider">AP</div>
              <div className="text-lg font-bold font-mono text-red-400">{ap}</div>
            </div>
            <div className="text-center bg-black/40 border border-bdo-border rounded-lg py-1.5 px-3 min-w-[60px]">
              <div className="text-[9px] uppercase text-bdo-text-muted tracking-wider">DP</div>
              <div className="text-lg font-bold font-mono text-blue-400">{dp}</div>
            </div>
            <div className="text-center bg-bdo-gold/5 border border-bdo-gold/25 rounded-lg py-1.5 px-3 min-w-[60px]">
              <div className="text-[9px] uppercase text-bdo-gold/70 tracking-wider">GS</div>
              <div className="text-lg font-bold font-mono text-bdo-gold">{gs}</div>
            </div>
          </div>
        </div>

        {/* ── Profil linki — sağ üst ── */}
        <div className="hidden md:flex flex-col items-end self-start pt-5 pr-5 gap-1.5 flex-shrink-0">
          <Link
            href="/profile"
            className="text-xs text-bdo-text-muted hover:text-bdo-gold transition-colors"
          >
            Profili Düzenle →
          </Link>
        </div>

      </div>
    </div>
  );
}
