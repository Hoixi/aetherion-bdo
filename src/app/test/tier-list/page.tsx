"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ListOrdered, Plus, Vote, Clock, Search } from "lucide-react";
import { TestShell, Card, Empty, loadJson } from "@/components/test-shell";

/**
 * Tier list koleksiyonu.
 *
 * Her kart kendi kademelerini renk şeridi olarak gösteriyor: listeyi
 * açmadan kaç kademe var, hangileri dolu, bir bakışta görünüyor. Oylama
 * açık olanlar öne alınıyor, çünkü zamana bağlı olan tek şey o.
 */

const TAG_LABELS: Record<string, string> = {
  PVE: "PvE", NODE_WAR: "Node War", ONE_V_ONE: "1v1", ONE_V_X: "1vX", AOS: "AoS",
};

const TAG_COLORS: Record<string, string> = {
  PVE: "#38d07f", NODE_WAR: "#e8b451", ONE_V_ONE: "#ef5f5f", ONE_V_X: "#b98cff", AOS: "#6b93ff",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  if (h < 24) return `${h} sa önce`;
  if (d < 30) return `${d} gün önce`;
  return new Date(date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

interface TierListItem {
  id: number;
  title: string;
  description: string | null;
  tags: string;
  isVoting: boolean;
  createdAt: string;
  creator: { familyName: string; avatarUrl: string };
  _count: { votes: number };
  tiers: { id: number; name: string; color: string; _count: { entries: number } }[];
}

export default function TierListPage() {
  const { data: session } = useSession();
  const [lists, setLists] = useState<TierListItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string>("hepsi");

  useEffect(() => {
    loadJson<TierListItem[]>("/api/tier-lists")
      .then(setLists)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const usedTags = useMemo(() => {
    const seen = new Set<string>();
    for (const l of lists ?? []) {
      for (const t of (l.tags ?? "").split(",").map((x) => x.trim()).filter(Boolean)) seen.add(t);
    }
    return Array.from(seen);
  }, [lists]);

  const shown = useMemo(() => {
    let out = lists ?? [];
    if (tag !== "hepsi") out = out.filter((l) => (l.tags ?? "").includes(tag));
    const needle = q.trim().toLocaleLowerCase("tr");
    if (needle) {
      out = out.filter((l) =>
        l.title.toLocaleLowerCase("tr").includes(needle) ||
        (l.description ?? "").toLocaleLowerCase("tr").includes(needle));
    }
    // Oylaması açık olanlar önce — süreye bağlı tek şey o
    return [...out].sort((a, b) =>
      Number(b.isVoting) - Number(a.isVoting) || +new Date(b.createdAt) - +new Date(a.createdAt));
  }, [lists, q, tag]);

  const voting = (lists ?? []).filter((l) => l.isVoting).length;

  return (
    <TestShell
      title="Tier List"
      subtitle={
        lists
          ? `Class sıralamaları ve meta değerlendirmeleri · ${lists.length} liste${voting ? `, ${voting} oylama açık` : ""}`
          : "Yükleniyor…"
      }
      aside={session && (
        <Link href="/test/tier-list/yeni" className="t-tab" data-on>
          <Plus className="w-3.5 h-3.5" /> Yeni liste
        </Link>
      )}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--t-faint)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Liste ara"
                 className="pl-9 pr-3 h-[34px] rounded-full text-[12px] w-[220px] outline-none"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                          color: "var(--t-text)" }} />
        </div>
        <button className="t-tab" data-on={tag === "hepsi"} onClick={() => setTag("hepsi")}>Hepsi</button>
        {usedTags.map((t) => (
          <button key={t} className="t-tab" data-on={tag === t} onClick={() => setTag(t)}>
            <span style={{ color: TAG_COLORS[t] ?? "var(--t-dim)" }}>{TAG_LABELS[t] ?? t}</span>
          </button>
        ))}
      </div>

      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
      {!lists && !err && <Empty>Listeler geliyor…</Empty>}
      {lists && shown.length === 0 && (
        <Empty>{q || tag !== "hepsi" ? "Aramaya uyan liste yok." : "Henüz tier list yok."}</Empty>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {shown.map((l) => {
          const tags = (l.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean);
          const totalEntries = l.tiers.reduce((s, t) => s + t._count.entries, 0);
          return (
            <Link key={l.id} href={`/test/tier-list/${l.id}`}>
              <Card hi={l.isVoting}
                    className="p-4 h-full flex flex-col transition-colors hover:border-[rgba(232,180,81,.3)]">
                <div className="flex items-start gap-2">
                  <ListOrdered className="w-4 h-4 flex-shrink-0 mt-0.5"
                               strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[14px] font-semibold truncate">{l.title}</h3>
                    {l.description && (
                      <p className="text-[11.5px] mt-1 line-clamp-2" style={{ color: "var(--t-dim)" }}>
                        {l.description}
                      </p>
                    )}
                  </div>
                  {l.isVoting && (
                    <span className="t-chip flex-shrink-0 flex items-center gap-1"
                          style={{ color: "var(--t-gold)", borderColor: "rgba(232,180,81,.4)" }}>
                      <Vote className="w-3 h-3" /> Açık
                    </span>
                  )}
                </div>

                {/* Kademe şeridi — listeyi açmadan doluluğu göstermek için */}
                {l.tiers.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <div className="flex gap-1">
                      {l.tiers.map((t) => (
                        <div key={t.id} className="flex-1 h-1.5 rounded-full"
                             title={`${t.name}: ${t._count.entries} class`}
                             style={{ background: t.color, opacity: t._count.entries > 0 ? 1 : 0.25 }} />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      {l.tiers.map((t) => (
                        <span key={t.id} className="flex-1 text-[9px] font-bold text-center truncate"
                              style={{ color: t._count.entries > 0 ? t.color : "var(--t-faint)" }}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5 flex-wrap mt-3">
                  {tags.map((t) => (
                    <span key={t} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{ color: TAG_COLORS[t] ?? "var(--t-dim)",
                                   background: (TAG_COLORS[t] ?? "#888") + "18" }}>
                      {TAG_LABELS[t] ?? t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-3 mt-auto pt-3 text-[11px]"
                     style={{ color: "var(--t-faint)", borderTop: "1px solid var(--t-line)" }}>
                  <span className="truncate">{l.creator.familyName}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{timeAgo(l.createdAt)}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span title="Sıralanan class">{totalEntries} class</span>
                    <span className="flex items-center gap-1" title="Oy"><Vote className="w-3 h-3" />{l._count.votes}</span>
                  </span>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="pb-6" />
    </TestShell>
  );
}
