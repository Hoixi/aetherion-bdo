"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const TAG_LABELS: Record<string, string> = {
  PVE: "PvE",
  NODE_WAR: "Node War",
  ONE_V_ONE: "1v1",
  ONE_V_X: "1vX",
  AOS: "AoS",
};

const TAG_COLORS: Record<string, string> = {
  PVE: "#22c55e",
  NODE_WAR: "#f97316",
  ONE_V_ONE: "#ef4444",
  ONE_V_X: "#a855f7",
  AOS: "#3b82f6",
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk önce`;
  if (h < 24) return `${h}sa önce`;
  return `${d}g önce`;
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
  const [lists, setLists] = useState<TierListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tier-lists")
      .then((r) => r.json())
      .then((data) => { setLists(data); setLoading(false); });
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bdo-text-primary">Tier List</h1>
          <p className="text-sm text-bdo-text-muted mt-0.5">{lists.length} tier list</p>
        </div>
        {session && (
          <Link
            href="/tier-list/yeni"
            className="bg-bdo-gold text-bdo-bg font-semibold px-4 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors text-sm"
          >
            + Yeni Tier List
          </Link>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-bdo-text-muted text-sm">Yükleniyor...</div>
      ) : lists.length === 0 ? (
        <div className="text-center py-16 text-bdo-text-muted">
          <p className="text-5xl mb-4">🏆</p>
          <p className="text-base font-semibold text-bdo-text-primary mb-1">Henüz tier list yok</p>
          <p className="text-sm mb-4">İlk tier list&apos;i sen oluştur!</p>
          {session && (
            <Link href="/tier-list/yeni" className="text-bdo-gold text-sm hover:underline">
              Tier list oluştur →
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {lists.map((list) => {
            const tags = list.tags ? list.tags.split(",").filter(Boolean) : [];
            const totalEntries = list.tiers.reduce((s, t) => s + t._count.entries, 0);
            return (
              <Link key={list.id} href={`/tier-list/${list.id}`}>
                <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 hover:border-bdo-gold/40 transition-all cursor-pointer h-full">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        {list.isVoting && (
                          <span className="text-[10px] bg-bdo-sapphire/20 text-bdo-sapphire px-1.5 py-0.5 rounded font-bold border border-bdo-sapphire/30">
                            🗳 OYLAMALI
                          </span>
                        )}
                        <h2 className="text-sm font-bold text-bdo-text-primary truncate">{list.title}</h2>
                      </div>
                      {list.description && (
                        <p className="text-xs text-bdo-text-muted line-clamp-1">{list.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                          style={{
                            color: TAG_COLORS[tag] ?? "#d4a030",
                            borderColor: `${TAG_COLORS[tag] ?? "#d4a030"}40`,
                            backgroundColor: `${TAG_COLORS[tag] ?? "#d4a030"}15`,
                          }}
                        >
                          {TAG_LABELS[tag] ?? tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tier önizleme */}
                  <div className="flex gap-1 mb-3">
                    {list.tiers.slice(0, 6).map((tier) => (
                      <div
                        key={tier.id}
                        className="flex-1 text-center py-1 rounded text-[10px] font-bold"
                        style={{ backgroundColor: `${tier.color}25`, color: tier.color, border: `1px solid ${tier.color}40` }}
                      >
                        {tier.name}
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-3 text-xs text-bdo-text-muted">
                    <div className="flex items-center gap-1.5">
                      {list.creator.avatarUrl
                        ? <img src={list.creator.avatarUrl} className="w-4 h-4 rounded-full" alt="" />
                        : <div className="w-4 h-4 rounded-full bg-bdo-border" />
                      }
                      <span>{list.creator.familyName || "?"}</span>
                    </div>
                    <span>{timeAgo(list.createdAt)}</span>
                    <span className="ml-auto">
                      {list.isVoting
                        ? `${list._count.votes} oy`
                        : `${totalEntries} class`
                      }
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
