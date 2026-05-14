"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BDO_CLASSES, getClassByID, getClassImageUrl } from "@/lib/classes";

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

interface MemberTableProps {
  members: Member[];
}

type SortField = "gs" | "ap" | "dp" | "katılım";

export function MemberTable({ members }: MemberTableProps) {
  const [sortBy, setSortBy] = useState<SortField>("gs");
  const [filterClass, setFilterClass] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let result = members;
    if (filterClass) result = result.filter((m) => m.class === filterClass);
    if (search) result = result.filter((m) => m.familyName.toLowerCase().includes(search.toLowerCase()));
    result = [...result].sort((a, b) => {
      if (sortBy === "gs") return (b.ap + b.dp) - (a.ap + a.dp);
      if (sortBy === "ap") return b.ap - a.ap;
      if (sortBy === "dp") return b.dp - a.dp;
      if (sortBy === "katılım") return (b._count?.participations ?? 0) - (a._count?.participations ?? 0);
      return b.dp - a.dp;
    });
    return result;
  }, [members, sortBy, filterClass, search]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
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
        <div className="flex gap-1">
          {(["gs", "ap", "dp", "katılım"] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => setSortBy(field)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold uppercase transition-colors ${
                sortBy === field ? "bg-bdo-gold text-bdo-bg" : "bg-bdo-surface text-bdo-text-muted hover:text-bdo-gold"
              }`}
            >
              {field}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((member, index) => {
          const classData = getClassByID(member.class);
          const splashUrl = classData
            ? getClassImageUrl(
                classData.classType,
                member.spec === "succession" && classData.hasSuccession ? "succession" : "awakening"
              )
            : null;

          const rank = index + 1;

          return (
            <div
              key={member.id}
              className="group relative overflow-hidden rounded-xl border border-bdo-border/60 bg-bdo-surface hover:border-bdo-gold/40 transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,168,83,0.08)]"
              style={{ minHeight: '80px' }}
            >
              {/* Character splash background - centered, covering good portion */}
              {splashUrl && (
                <>
                  <img
                    src={splashUrl}
                    alt=""
                    className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-[45%] h-[280%] w-auto object-cover opacity-[0.12] group-hover:opacity-[0.22] transition-opacity duration-500 pointer-events-none select-none blur-[0.5px]"
                  />
                  {/* Left dark fade - protects text */}
                  <div className="absolute inset-0 bg-gradient-to-r from-bdo-surface via-bdo-surface/85 to-transparent pointer-events-none" style={{ width: '35%' }} />
                  {/* Right dark fade - protects stats */}
                  <div className="absolute inset-0 bg-gradient-to-l from-bdo-surface via-bdo-surface/85 to-transparent pointer-events-none" style={{ left: '65%' }} />
                  {/* Top & bottom vignette */}
                  <div className="absolute inset-0 bg-gradient-to-b from-bdo-surface/60 via-transparent to-bdo-surface/60 pointer-events-none" />
                </>
              )}

              {/* Subtle top gold line on hover */}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-bdo-gold/0 to-transparent group-hover:via-bdo-gold/40 transition-all duration-500" />

              {/* Content row */}
              <div className="relative flex items-center gap-2 sm:gap-4 px-3 sm:px-5 py-3 sm:py-4">
                {/* Rank badge */}
                <div className="flex-shrink-0 w-6 sm:w-7 text-center">
                  <span className={`text-[10px] sm:text-xs font-bold font-mono ${
                    rank === 1 ? "text-yellow-400" :
                    rank === 2 ? "text-gray-300" :
                    rank === 3 ? "text-amber-600" :
                    "text-bdo-text-muted/40"
                  }`}>
                    #{rank}
                  </span>
                </div>

                {/* Avatar & Name */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-none sm:min-w-[180px]">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="" className="w-10 h-10 rounded-full border-2 border-bdo-border/60 group-hover:border-bdo-gold/30 shadow-lg transition-colors duration-300" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-bdo-border/30 border-2 border-bdo-border/60" />
                  )}
                  <div className="flex flex-col">
                    <Link href={`/members/${member.id}`} className="text-sm font-bold text-bdo-text-primary group-hover:text-bdo-gold/90 transition-colors duration-300 hover:underline">
                      {member.familyName}
                    </Link>
                    {member.siteRole && (
                      <span className="text-[10px] font-semibold leading-tight" style={{ color: member.siteRole.color }}>
                        {member.siteRole.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Class name */}
                <div className="hidden sm:flex items-center gap-2 min-w-[120px]">
                  <span className="text-xs text-bdo-text-muted font-medium">
                    {classData?.name ?? member.class}
                  </span>
                  <span className="text-[9px] text-bdo-text-muted/50 uppercase">
                    {member.spec === "succession" && classData?.hasSuccession ? "SUC" : "AWK"}
                  </span>
                </div>

                {/* Stats - pushed to right */}
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
    </div>
  );
}
