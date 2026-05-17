"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Tag {
  id: number;
  name: string;
  slug: string;
  type: "CATEGORY" | "CLASS";
  color: string;
}

interface Post {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  viewCount: number;
  createdAt: string;
  author: { id: number; familyName: string; avatarUrl: string; siteRole: { name: string; color: string } | null };
  tags: { tag: Tag }[];
  _count: { comments: number; reactions: number };
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk önce`;
  if (h < 24) return `${h}sa önce`;
  return `${d}g önce`;
}

export default function ForumPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/forum/tags").then((r) => r.json()).then(setTags);
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (activeTag) params.set("tag", activeTag);
    const res = await fetch(`/api/forum/posts?${params}`);
    const data = await res.json();
    setPosts(data.posts ?? []);
    setTotal(data.total ?? 0);
    setPages(data.pages ?? 1);
    setLoading(false);
  }, [page, activeTag]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const categoryTags = tags.filter((t) => t.type === "CATEGORY");
  const classTags = tags.filter((t) => t.type === "CLASS");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-bdo-text-primary">Forum</h1>
          <p className="text-sm text-bdo-text-muted mt-0.5">{total} gönderi</p>
        </div>
        <Link
          href="/forum/yeni"
          className="bg-bdo-gold text-bdo-bg font-semibold px-4 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors text-sm"
        >
          + Yeni Gönderi
        </Link>
      </div>

      <div className="grid md:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar — Tag Filtreleri */}
        <div className="space-y-4">
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <button
              onClick={() => { setActiveTag(null); setPage(1); }}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg transition-colors mb-2 ${!activeTag ? "bg-bdo-gold/20 text-bdo-gold font-semibold" : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-bg"}`}
            >
              🗂 Tüm Gönderiler
            </button>

            <p className="text-[10px] uppercase text-bdo-text-muted font-semibold tracking-wider px-1 mb-2 mt-3">Kategori</p>
            {categoryTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => { setActiveTag(activeTag === tag.slug ? null : tag.slug); setPage(1); }}
                className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${activeTag === tag.slug ? "bg-bdo-gold/10 font-semibold" : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-bg"}`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span style={{ color: activeTag === tag.slug ? tag.color : undefined }}>{tag.name}</span>
              </button>
            ))}

            <p className="text-[10px] uppercase text-bdo-text-muted font-semibold tracking-wider px-1 mb-2 mt-4">Class</p>
            <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
              {classTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => { setActiveTag(activeTag === tag.slug ? null : tag.slug); setPage(1); }}
                  className={`w-full text-left text-xs px-3 py-1 rounded-lg transition-colors flex items-center gap-2 ${activeTag === tag.slug ? "bg-purple-500/10 text-purple-400 font-semibold" : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-bg"}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-purple-400/60" />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Post Listesi */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-bdo-text-muted text-sm">Yükleniyor...</div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-bdo-text-muted">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-sm">Henüz gönderi yok.</p>
              <button onClick={() => router.push("/forum/yeni")} className="mt-3 text-bdo-gold text-sm hover:underline">İlk gönderiyi sen oluştur →</button>
            </div>
          ) : (
            posts.map((post) => (
              <Link key={post.id} href={`/forum/${post.id}`} className="block">
                <div className={`bg-bdo-surface border rounded-xl p-4 hover:border-bdo-gold/40 transition-all ${post.pinned ? "border-bdo-gold/30 bg-bdo-gold/5" : "border-bdo-border"}`}>
                  <div className="flex items-start gap-3">
                    {post.author.avatarUrl
                      ? <img src={post.author.avatarUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0 mt-0.5" />
                      : <div className="w-9 h-9 rounded-full bg-bdo-border flex-shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {post.pinned && <span className="text-[10px] bg-bdo-gold/20 text-bdo-gold px-1.5 py-0.5 rounded font-bold">📌 SABİT</span>}
                        <h2 className="text-sm font-semibold text-bdo-text-primary hover:text-bdo-gold transition-colors truncate">{post.title}</h2>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {post.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium border"
                            style={{ color: tag.color, borderColor: `${tag.color}40`, backgroundColor: `${tag.color}15` }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>

                      {/* Footer */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-bdo-text-muted">
                        <span className="font-medium text-bdo-text-secondary">{post.author.familyName || "?"}</span>
                        {post.author.siteRole && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ color: post.author.siteRole.color }}>
                            {post.author.siteRole.name}
                          </span>
                        )}
                        <span>{timeAgo(post.createdAt)}</span>
                        <span className="ml-auto flex items-center gap-3">
                          <span>💬 {post._count.comments}</span>
                          <span>👁 {post.viewCount}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2 pt-2">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-mono ${p === page ? "bg-bdo-gold text-bdo-bg font-bold" : "bg-bdo-surface border border-bdo-border text-bdo-text-muted hover:border-bdo-gold/40"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
