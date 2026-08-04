"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageSquare, Plus, Pin, Eye, MessagesSquare, Inbox, Layers } from "lucide-react";
import { PageHeader, Button, Empty, Avatar } from "@/components/ui";

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

  const filterBtn = (active: boolean) =>
    `w-full text-left text-[12px] px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${
      active ? "bg-bdo-surface-2 text-bdo-text-primary font-medium" : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-surface-2/50"
    }`;

  return (
    <div>
      <PageHeader
        title="Forum"
        desc="Klan içi tartışmalar, rehberler ve duyurular."
        icon={MessageSquare}
        action={
          <Link href="/forum/yeni">
            <Button variant="primary" icon={Plus}>Yeni Gönderi</Button>
          </Link>
        }
      />

      <div className="grid md:grid-cols-[200px_1fr] gap-4">
        {/* Filters */}
        <div className="card p-2 h-fit">
          <button onClick={() => { setActiveTag(null); setPage(1); }} className={filterBtn(!activeTag)}>
            <Layers className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
            Tüm Gönderiler
            <span className="ml-auto text-[10px] text-bdo-text-secondary font-mono">{total}</span>
          </button>

          <p className="text-[10px] uppercase text-bdo-text-secondary font-semibold tracking-widest px-2.5 mt-3 mb-1">
            Kategori
          </p>
          <div className="space-y-0.5">
            {categoryTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => { setActiveTag(activeTag === tag.slug ? null : tag.slug); setPage(1); }}
                className={filterBtn(activeTag === tag.slug)}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
          </div>

          <p className="text-[10px] uppercase text-bdo-text-secondary font-semibold tracking-widest px-2.5 mt-3 mb-1">
            Class
          </p>
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
            {classTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => { setActiveTag(activeTag === tag.slug ? null : tag.slug); setPage(1); }}
                className={filterBtn(activeTag === tag.slug)}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-bdo-text-secondary" />
                <span className="truncate">{tag.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div>
          {loading ? (
            <div className="card"><Empty text="Yükleniyor..." /></div>
          ) : posts.length === 0 ? (
            <div className="card">
              <Empty
                icon={Inbox}
                text="Henüz gönderi yok."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => router.push("/forum/yeni")}>
                    İlk gönderiyi oluştur
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="card">
              {posts.map((post) => (
                <Link key={post.id} href={`/forum/${post.id}`} className="card-row items-start gap-3 py-3">
                  <Avatar src={post.author.avatarUrl} size={30} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {post.pinned && (
                        <Pin className="w-3 h-3 text-bdo-gold flex-shrink-0" strokeWidth={2.5} fill="currentColor" />
                      )}
                      <p className="text-[13px] font-medium text-bdo-text-primary truncate">{post.title}</p>
                    </div>

                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {post.tags.map(({ tag }) => (
                          <span
                            key={tag.id}
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                            style={{ color: tag.color, borderColor: `${tag.color}30`, backgroundColor: `${tag.color}12` }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-bdo-text-secondary">
                      <span className="text-bdo-text-muted font-medium">{post.author.familyName || "?"}</span>
                      {post.author.siteRole && (
                        <span className="font-semibold" style={{ color: post.author.siteRole.color }}>
                          {post.author.siteRole.name}
                        </span>
                      )}
                      <span>·</span>
                      <span>{timeAgo(post.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-bdo-text-secondary flex-shrink-0 pt-0.5">
                    <span className="flex items-center gap-1">
                      <MessagesSquare className="w-3 h-3" strokeWidth={1.75} />
                      {post._count.comments}
                    </span>
                    <span className="hidden sm:flex items-center gap-1">
                      <Eye className="w-3 h-3" strokeWidth={1.75} />
                      {post.viewCount}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="flex justify-center gap-1.5 pt-4">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded-lg text-[12px] font-mono transition-colors ${
                    p === page
                      ? "bg-bdo-gold text-bdo-bg font-bold"
                      : "bg-bdo-surface border border-bdo-border text-bdo-text-muted hover:border-bdo-border-2"
                  }`}
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
