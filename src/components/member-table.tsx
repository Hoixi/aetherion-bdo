"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BDO_CLASSES, getClassByID, getClassImageUrl, getPortraitUrl, getClassIconUrl } from "@/lib/classes";

interface Member {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl: string;
  siteRole?: { name: string; color: string } | null;
  _count?: { participations: number };
}

type SortField = "gs" | "ap" | "dp" | "katılım";
type ViewMode  = "list" | "card";

export function MemberTable({ members }: { members: Member[] }) {
  const [sortBy, setSortBy]       = useState<SortField>("gs");
  const [filterClass, setFilterClass] = useState("");
  const [search, setSearch]       = useState("");
  const [viewMode, setViewMode]   = useState<ViewMode>("list");

  const filtered = useMemo(() => {
    let result = members;
    if (filterClass) result = result.filter((m) => m.class === filterClass);
    if (search) result = result.filter((m) => m.familyName.toLowerCase().includes(search.toLowerCase()));
    result = [...result].sort((a, b) => {
      if (sortBy === "gs")      return (b.ap + b.dp) - (a.ap + a.dp);
      if (sortBy === "ap")      return b.ap - a.ap;
      if (sortBy === "dp")      return b.dp - a.dp;
      if (sortBy === "katılım") return (b._count?.participations ?? 0) - (a._count?.participations ?? 0);
      return 0;
    });
    return result;
  }, [members, sortBy, filterClass, search]);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="text"
          placeholder="Aile adı ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
        />
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
        >
          <option value="">Tüm Classlar</option>
          {BDO_CLASSES.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Sort buttons */}
        <div className="flex gap-1">
          {(["gs", "ap", "dp", "katılım"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => setSortBy(field)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase transition-colors ${
                sortBy === field
                  ? "bg-bdo-gold text-bdo-bg"
                  : "bg-bdo-surface text-bdo-text-muted hover:text-bdo-gold"
              }`}
            >
              {field}
            </button>
          ))}
        </div>

        {/* View toggle — pushed to right */}
        <div className="ml-auto flex gap-1 bg-bdo-surface border border-bdo-border rounded-lg p-1">
          <button
            onClick={() => setViewMode("list")}
            title="Liste görünümü"
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "list"
                ? "bg-bdo-gold text-bdo-bg"
                : "text-bdo-text-muted hover:text-bdo-gold"
            }`}
          >
            ≡ Liste
          </button>
          <button
            onClick={() => setViewMode("card")}
            title="Kart görünümü"
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === "card"
                ? "bg-bdo-gold text-bdo-bg"
                : "text-bdo-text-muted hover:text-bdo-gold"
            }`}
          >
            ⊞ Kart
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && (
        <div className="space-y-2">
          {filtered.map((member, index) => {
            const classData = getClassByID(member.class);
            const specKey   = member.spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
            const splashUrl = classData ? getClassImageUrl(classData.classType, specKey) : null;
            const iconUrl   = getClassIconUrl(member.class);
            const rank      = index + 1;

            return (
              <div
                key={member.id}
                className="group relative overflow-hidden rounded-xl border border-bdo-border/60 bg-bdo-surface hover:border-bdo-gold/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]"
                style={{ minHeight: "80px" }}
              >
                {/* Character splash — more prominent */}
                {splashUrl && (
                  <>
                    <img
                      src={splashUrl}
                      alt=""
                      className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-[45%] h-[280%] w-auto object-cover opacity-[0.18] group-hover:opacity-[0.30] transition-opacity duration-500 pointer-events-none select-none"
                    />
                    {/* Left fade — protects name text */}
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-bdo-surface via-bdo-surface/90 to-transparent pointer-events-none" style={{ width: "42%" }} />
                    {/* Right fade — protects stats */}
                    <div className="absolute inset-y-0 right-0 bg-gradient-to-l from-bdo-surface via-bdo-surface/90 to-transparent pointer-events-none" style={{ width: "38%" }} />
                    {/* Top/bottom vignette */}
                    <div className="absolute inset-0 bg-gradient-to-b from-bdo-surface/70 via-transparent to-bdo-surface/70 pointer-events-none" />
                  </>
                )}

                {/* Gold top line on hover */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-bdo-gold/0 to-transparent group-hover:via-bdo-gold/40 transition-all duration-500" />

                {/* Row content */}
                <div className="relative flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-6 sm:w-7 text-center">
                    <span className={`text-[10px] sm:text-xs font-bold font-mono ${
                      rank === 1 ? "text-yellow-400" :
                      rank === 2 ? "text-gray-300" :
                      rank === 3 ? "text-amber-600" :
                      "text-bdo-text-muted/40"
                    }`}>#{rank}</span>
                  </div>

                  {/* Avatar + name */}
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-none sm:min-w-[180px]">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt="" className="w-10 h-10 rounded-full border-2 border-bdo-border/60 group-hover:border-bdo-gold/30 shadow-lg transition-colors duration-300" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-bdo-border/30 border-2 border-bdo-border/60" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <Link href={`/members/${member.id}`} className="text-sm font-bold text-bdo-text-primary group-hover:text-bdo-gold/90 transition-colors duration-300 hover:underline truncate">
                        {member.familyName}
                      </Link>
                      {member.siteRole && (
                        <span className="text-[10px] font-semibold leading-tight truncate" style={{ color: member.siteRole.color }}>
                          {member.siteRole.name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Class + icon */}
                  <div className="hidden sm:flex items-center gap-1.5 min-w-[130px]">
                    {iconUrl && (
                      <img src={iconUrl} alt="" className="w-5 h-5 opacity-60 flex-shrink-0" />
                    )}
                    <span className="text-xs text-bdo-text-muted font-medium truncate">
                      {classData?.name ?? member.class}
                    </span>
                    <span className="text-[9px] text-bdo-text-muted/50 uppercase flex-shrink-0">
                      {specKey === "succession" ? "SUC" : "AWK"}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-2 sm:gap-4 ml-auto flex-shrink-0">
                    <div className="hidden sm:flex items-center gap-3">
                      <div className="text-center min-w-[36px]">
                        <div className="text-[8px] uppercase text-bdo-text-muted/60 tracking-wider leading-none mb-0.5">AP</div>
                        <div className="text-sm font-mono font-bold text-red-400">{member.ap}</div>
                      </div>
                      <div className="text-center min-w-[36px]">
                        <div className="text-[8px] uppercase text-bdo-text-muted/60 tracking-wider leading-none mb-0.5">DP</div>
                        <div className="text-sm font-mono font-bold text-blue-400">{member.dp}</div>
                      </div>
                    </div>
                    <div className="text-center min-w-[40px] sm:min-w-[44px] bg-bdo-gold/5 border border-bdo-gold/10 rounded-lg px-1.5 sm:px-2 py-1">
                      <div className="text-[7px] sm:text-[8px] uppercase text-bdo-gold/60 tracking-wider leading-none mb-0.5">GS</div>
                      <div className="text-sm sm:text-base font-mono font-black text-bdo-gold">{member.ap + member.dp}</div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center gap-1 bg-bdo-gold/8 border border-bdo-gold/10 text-bdo-gold text-[10px] sm:text-xs font-mono font-semibold px-1.5 sm:px-2.5 py-1 rounded-lg">
                        ⚔️ {member._count?.participations ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CARD VIEW ── */}
      {viewMode === "card" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((member) => {
            const classData   = getClassByID(member.class);
            const specKey     = member.spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
            const portraitUrl = getPortraitUrl(member.class, member.spec);
            const iconUrl     = getClassIconUrl(member.class);

            return (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="group relative overflow-hidden rounded-xl border border-bdo-border/60 bg-bdo-surface hover:border-bdo-gold/40 transition-all duration-300 hover:shadow-[0_0_24px_rgba(212,168,83,0.12)] flex flex-col"
                style={{ minHeight: "240px" }}
              >
                {/* Portrait image — fills top portion */}
                {portraitUrl ? (
                  <div className="relative flex-1 overflow-hidden" style={{ minHeight: "170px" }}>
                    <img
                      src={portraitUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Bottom fade into card */}
                    <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-bdo-surface via-bdo-surface/60 to-transparent" />
                    {/* Spec badge */}
                    <div className="absolute top-2 right-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-sm text-bdo-gold/90 px-1.5 py-0.5 rounded border border-bdo-gold/20">
                        {specKey === "succession" ? "SUC" : "AWK"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 bg-gradient-to-b from-bdo-border/20 to-transparent" style={{ minHeight: "170px" }} />
                )}

                {/* Bottom info */}
                <div className="p-3 pt-0">
                  {/* Role */}
                  {member.siteRole && (
                    <div className="text-[9px] font-semibold mb-0.5 truncate" style={{ color: member.siteRole.color }}>
                      {member.siteRole.name}
                    </div>
                  )}
                  {/* Family name */}
                  <div className="text-sm font-bold text-bdo-text-primary group-hover:text-bdo-gold transition-colors truncate">
                    {member.familyName || "—"}
                  </div>
                  {/* Class + icon */}
                  <div className="flex items-center gap-1 mt-0.5">
                    {iconUrl && <img src={iconUrl} alt="" className="w-3.5 h-3.5 opacity-50" />}
                    <span className="text-[10px] text-bdo-text-muted truncate">{classData?.name ?? member.class}</span>
                  </div>
                  {/* GS */}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs font-mono font-black text-bdo-gold">
                      {member.ap + member.dp} <span className="text-[9px] text-bdo-gold/50 font-normal">GS</span>
                    </div>
                    <div className="text-[9px] text-bdo-text-muted font-mono">
                      {member.ap}AP · {member.dp}DP
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-center text-bdo-text-muted py-12">Üye bulunamadı.</p>
      )}
    </div>
  );
}
