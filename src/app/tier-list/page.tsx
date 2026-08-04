"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ListOrdered, Plus, Vote, Trophy } from "lucide-react";
import { PageHeader, Button, Empty, Avatar, Loading } from "@/components/ui";

const TAG_LABELS: Record<string, string> = {
  PVE: "PvE", NODE_WAR: "Node War", ONE_V_ONE: "1v1", ONE_V_X: "1vX", AOS: "AoS",
};

const TAG_COLORS: Record<string, string> = {
  PVE: "#2bca6e", NODE_WAR: "#e09832", ONE_V_ONE: "#e05252", ONE_V_X: "#a855f7", AOS: "#4a7cf5",
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
    <div>
      <PageHeader
        title="Tier List"
        desc="Class sıralamaları, oylamalar ve meta değerlendirmeleri."
        icon={ListOrdered}
        action={session && (
          <Link href="/tier-list/yeni">
            <Button variant="primary" icon={Plus}>Yeni Tier List</Button>
          </Link>
        )}
      />

      {loading ? (
        <Loading />
      ) : lists.length === 0 ? (
        <div className="card">
          <Empty
            icon={Trophy}
            text="Henüz tier list yok."
            action={session && (
              <Link href="/tier-list/yeni">
                <Button variant="primary" icon={Plus}>Tier list oluştur</Button>
              </Link>
            )}
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lists.map((list) => {
            const tags = list.tags ? list.tags.split(",").filter(Boolean) : [];
            const totalEntries = list.tiers.reduce((s, t) => s + t._count.entries, 0);
            return (
              <Link key={list.id} href={`/tier-list/${list.id}`} className="card p-4 hover:border-bdo-gold/30 transition-colors">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {list.isVoting && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-[#4a7cf5]/10 text-[#6b93ff] px-1.5 py-0.5 rounded font-semibold border border-[#4a7cf5]/20">
                      <Vote className="w-3 h-3" strokeWidth={2} />
                      OYLAMALI
                    </span>
                  )}
                  <p className="text-[13px] font-semibold text-bdo-text-primary truncate">{list.title}</p>
                </div>

                {list.description && (
                  <p className="text-[11px] text-bdo-text-secondary line-clamp-1 mb-2">{list.description}</p>
                )}

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {tags.map((tag) => {
                      const c = TAG_COLORS[tag] ?? "#d4a030";
                      return (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                          style={{ color: c, borderColor: `${c}30`, backgroundColor: `${c}12` }}
                        >
                          {TAG_LABELS[tag] ?? tag}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-1 mb-3">
                  {list.tiers.slice(0, 6).map((tier) => (
                    <div
                      key={tier.id}
                      className="flex-1 text-center py-1 rounded text-[10px] font-bold"
                      style={{ backgroundColor: `${tier.color}20`, color: tier.color, border: `1px solid ${tier.color}30` }}
                    >
                      {tier.name}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-bdo-text-secondary pt-2 border-t border-bdo-border">
                  <Avatar src={list.creator.avatarUrl} size={16} ring={false} />
                  <span className="text-bdo-text-muted">{list.creator.familyName || "?"}</span>
                  <span>·</span>
                  <span>{timeAgo(list.createdAt)}</span>
                  <span className="ml-auto font-mono">
                    {list.isVoting ? `${list._count.votes} oy` : `${totalEntries} class`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
