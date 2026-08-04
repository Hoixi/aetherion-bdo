"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { BDO_CLASSES, getClassByID, getPortraitUrl, getClassIconUrl } from "@/lib/classes";
import { Search, LayoutList, LayoutGrid, Swords, ArrowUpDown, UserX } from "lucide-react";
import { Avatar, Empty, GuildTag, type GuildInfo as Guild } from "./ui";

interface Member {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl: string;
  siteRole?: { name: string; color: string } | null;
  guild?: Guild | null;
  _count?: { participations: number };
}

type SortField = "gs" | "ap" | "dp" | "katilim";
type ViewMode = "list" | "card";

const SORT_LABELS: Record<SortField, string> = {
  gs: "GS", ap: "AP", dp: "DP", katilim: "Katılım",
};

export function MemberTable({ members }: { members: Member[] }) {
  const [sortBy, setSortBy] = useState<SortField>("gs");
  const [filterClass, setFilterClass] = useState("");
  const [filterGuild, setFilterGuild] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Guild listesi — sadece birden fazla guild varsa filtre göster
  const guilds = useMemo(() => {
    const map = new Map<number, Guild>();
    for (const m of members) if (m.guild) map.set(m.guild.id, m.guild);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [members]);

  const filtered = useMemo(() => {
    let result = members;
    if (filterClass) result = result.filter((m) => m.class === filterClass);
    if (filterGuild) result = result.filter((m) => String(m.guild?.id ?? "") === filterGuild);
    if (search) result = result.filter((m) => m.familyName.toLowerCase().includes(search.toLowerCase()));
    return [...result].sort((a, b) => {
      if (sortBy === "gs") return (b.ap + b.dp) - (a.ap + a.dp);
      if (sortBy === "ap") return b.ap - a.ap;
      if (sortBy === "dp") return b.dp - a.dp;
      return (b._count?.participations ?? 0) - (a._count?.participations ?? 0);
    });
  }, [members, sortBy, filterClass, filterGuild, search]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-bdo-text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Aile adı ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg pl-9 pr-3 py-1.5 text-[13px] text-bdo-text-primary placeholder-bdo-text-secondary focus:outline-none focus:border-bdo-gold/40 transition-colors"
          />
        </div>

        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="bg-bdo-surface border border-bdo-border rounded-lg px-3 py-1.5 text-[13px] text-bdo-text-muted focus:outline-none focus:border-bdo-gold/40 transition-colors"
        >
          <option value="">Tüm Classlar</option>
          {BDO_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {guilds.length > 1 && (
          <select
            value={filterGuild}
            onChange={(e) => setFilterGuild(e.target.value)}
            className="bg-bdo-surface border border-bdo-border rounded-lg px-3 py-1.5 text-[13px] text-bdo-text-muted focus:outline-none focus:border-bdo-gold/40 transition-colors"
          >
            <option value="">Tüm Klanlar</option>
            {guilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        )}

        <div className="flex items-center gap-0.5 bg-bdo-surface border border-bdo-border rounded-lg p-0.5">
          <ArrowUpDown className="w-3 h-3 text-bdo-text-secondary ml-1.5 mr-0.5" strokeWidth={1.75} />
          {(Object.keys(SORT_LABELS) as SortField[]).map((f) => (
            <button
              key={f}
              onClick={() => setSortBy(f)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                sortBy === f ? "bg-bdo-surface-2 text-bdo-gold" : "text-bdo-text-secondary hover:text-bdo-text-muted"
              }`}
            >
              {SORT_LABELS[f]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-0.5 bg-bdo-surface border border-bdo-border rounded-lg p-0.5">
          {([["list", LayoutList], ["card", LayoutGrid]] as const).map(([mode, Icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === mode ? "bg-bdo-surface-2 text-bdo-gold" : "text-bdo-text-secondary hover:text-bdo-text-muted"
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><Empty icon={UserX} text="Üye bulunamadı." /></div>
      ) : viewMode === "list" ? (
        /* ── LIST ── */
        <div className="card">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 border-b border-bdo-border text-[10px] uppercase tracking-wider text-bdo-text-secondary font-medium">
            <span className="w-6 text-center">#</span>
            <span className="w-6" />
            <span className="flex-1">Üye</span>
            <span className="w-32">Class</span>
            <span className="w-11 text-right">AP</span>
            <span className="w-11 text-right">DP</span>
            <span className="w-14 text-right">GS</span>
            <span className="w-12 text-right">Savaş</span>
          </div>
          {filtered.map((member, i) => {
            const classData = getClassByID(member.class);
            const specKey = member.spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
            const iconUrl = getClassIconUrl(member.class);
            const rank = i + 1;

            return (
              <Link key={member.id} href={`/members/${member.id}`} className="card-row gap-3">
                <span className={`w-6 text-center text-[11px] font-bold font-mono flex-shrink-0 ${
                  rank === 1 ? "text-yellow-400" : rank === 2 ? "text-gray-300" : rank === 3 ? "text-amber-600" : "text-bdo-text-secondary"
                }`}>{rank}</span>

                <Avatar src={member.avatarUrl} size={24} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-medium text-bdo-text-primary truncate leading-tight">
                      {member.familyName || "—"}
                    </p>
                    <GuildTag guild={member.guild} />
                  </div>
                  {member.siteRole && (
                    <p className="text-[10px] leading-tight truncate" style={{ color: member.siteRole.color }}>
                      {member.siteRole.name}
                    </p>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-1.5 w-32 flex-shrink-0">
                  {iconUrl && <img src={iconUrl} alt="" className="w-4 h-4 opacity-40 flex-shrink-0" />}
                  <span className="text-[11px] text-bdo-text-muted truncate">{classData?.name ?? member.class}</span>
                  <span className="text-[9px] text-bdo-text-secondary flex-shrink-0">
                    {specKey === "succession" ? "SUC" : "AWK"}
                  </span>
                </div>

                <span className="hidden sm:block w-11 text-right text-[12px] font-mono text-red-400/80 flex-shrink-0">{member.ap}</span>
                <span className="hidden sm:block w-11 text-right text-[12px] font-mono text-[#6b93ff]/80 flex-shrink-0">{member.dp}</span>
                <span className="w-14 text-right text-[13px] font-mono font-bold text-bdo-gold flex-shrink-0">{member.ap + member.dp}</span>
                <span className="hidden sm:flex w-12 justify-end items-center gap-1 text-[11px] font-mono text-bdo-text-muted flex-shrink-0">
                  <Swords className="w-3 h-3 opacity-50" strokeWidth={1.75} />
                  {member._count?.participations ?? 0}
                </span>
              </Link>
            );
          })}
        </div>
      ) : (
        /* ── CARDS ── */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((member) => {
            const classData = getClassByID(member.class);
            const specKey = member.spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
            const portraitUrl = getPortraitUrl(member.class, member.spec);
            const iconUrl = getClassIconUrl(member.class);

            return (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="card group hover:border-bdo-gold/30 transition-colors flex flex-col"
              >
                <div className="relative overflow-hidden bg-bdo-surface-2" style={{ height: "150px" }}>
                  {portraitUrl && (
                    <img
                      src={portraitUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover object-top group-hover:scale-[1.04] transition-transform duration-500"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-bdo-surface to-transparent" />
                  <span className="absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider bg-bdo-bg/70 backdrop-blur-sm text-bdo-text-muted px-1.5 py-0.5 rounded border border-bdo-border">
                    {specKey === "succession" ? "SUC" : "AWK"}
                  </span>
                  {member.guild && (
                    <span
                      className="absolute top-2 left-2 text-[9px] font-bold uppercase tracking-wider backdrop-blur-sm px-1.5 py-0.5 rounded border"
                      style={{
                        color: member.guild.color,
                        borderColor: `${member.guild.color}40`,
                        backgroundColor: `${member.guild.color}20`,
                      }}
                      title={member.guild.name}
                    >
                      {member.guild.tag}
                    </span>
                  )}
                </div>

                <div className="px-3 pb-3 -mt-3 relative">
                  {member.siteRole && (
                    <p className="text-[9px] font-semibold truncate leading-tight" style={{ color: member.siteRole.color }}>
                      {member.siteRole.name}
                    </p>
                  )}
                  <p className="text-[13px] font-semibold text-bdo-text-primary group-hover:text-bdo-gold transition-colors truncate leading-snug">
                    {member.familyName || "—"}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {iconUrl && <img src={iconUrl} alt="" className="w-3 h-3 opacity-40 flex-shrink-0" />}
                    <span className="text-[10px] text-bdo-text-secondary truncate">{classData?.name ?? member.class}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-bdo-border">
                    <span className="text-[13px] font-mono font-bold text-bdo-gold">{member.ap + member.dp}</span>
                    <span className="text-[10px] text-bdo-text-secondary font-mono">
                      {member.ap} / {member.dp}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
