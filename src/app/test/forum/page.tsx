"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquare, Plus, Pin, Eye, MessagesSquare, Layers, Search,
  Flame, Clock, ChevronLeft, ChevronRight, Hash,
} from "lucide-react";
import { TestShell, Card, Empty, GuildTag, loadJson, type Guild } from "@/components/test-shell";

/**
 * Forum listesi.
 *
 * Gerçek bir forum gibi: solda kategoriler kalıcı, ortada konular geniş
 * satırlar hâlinde, her satırda konuyu açmadan karar vermeye yetecek kadar
 * bilgi — kim açmış, ne zaman, kaç yanıt, kaç görüntülenme, hangi etiket
 * ve içeriğin ilk satırı.
 *
 * Eski hâli dar bir kolona sıkışıyordu; burada sayfanın genişliği
 * kullanılıyor ve sağda klanın forum özeti duruyor.
 */

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
  author: {
    id: number; familyName: string; avatarUrl: string;
    siteRole: { name: string; color: string } | null;
    guild?: Guild | null;
  };
  tags: { tag: Tag }[];
  _count: { comments: number; reactions: number };
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  if (h < 24) return `${h} sa önce`;
  if (d < 30) return `${d} gün önce`;
  return new Date(date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

/** Markdown/HTML kırıntılarını atıp ilk satırı çıkarır */
function preview(content: string, len = 160) {
  const flat = content
    .replace(/[#*_`>~\[\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > len ? flat.slice(0, len) + "…" : flat;
}

export default function ForumPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    loadJson<Tag[]>("/api/forum/tags").then(setTags).catch(() => { /* etiketsiz de çalışır */ });
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (activeTag) params.set("tag", activeTag);
      const data = await loadJson<{ posts: Post[]; total: number; pages: number }>(
        `/api/forum/posts?${params}`);
      setPosts(data.posts ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, activeTag]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const categoryTags = tags.filter((t) => t.type === "CATEGORY");
  const classTags = tags.filter((t) => t.type === "CLASS");

  // Arama sunucuda değil; sayfadaki konular üzerinde çalışıyor
  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return posts;
    return posts.filter((p) =>
      p.title.toLocaleLowerCase("tr").includes(needle) ||
      p.content.toLocaleLowerCase("tr").includes(needle) ||
      p.author.familyName.toLocaleLowerCase("tr").includes(needle));
  }, [posts, q]);

  const pinned = shown.filter((p) => p.pinned);
  const rest = shown.filter((p) => !p.pinned);

  const busiest = useMemo(
    () => [...posts].sort((a, b) => b._count.comments - a._count.comments).slice(0, 5),
    [posts],
  );

  const filterBtn = (active: boolean) =>
    `w-full text-left text-[12.5px] px-2.5 py-2 rounded-[var(--t-r-sm)] transition-colors
     flex items-center gap-2 ${active ? "font-medium" : ""}`;
  const filterStyle = (active: boolean) => active
    ? { background: "var(--t-raised)", color: "var(--t-text)" }
    : { color: "var(--t-dim)" };

  return (
    <TestShell
      title="Forum"
      subtitle={`Klan içi tartışmalar, rehberler ve duyurular · ${total} konu`}
      aside={
        <Link href="/test/forum/yeni" className="t-tab" data-on>
          <Plus className="w-3.5 h-3.5" /> Yeni konu
        </Link>
      }
    >
      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}

      <div className="grid lg:grid-cols-[210px_1fr_260px] gap-5 items-start">
        {/* Kategoriler */}
        <Card className="p-2 lg:sticky lg:top-[84px]">
          <button onClick={() => { setActiveTag(null); setPage(1); }}
                  className={filterBtn(!activeTag)} style={filterStyle(!activeTag)}>
            <Layers className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.9} />
            Tüm konular
            <span className="ml-auto text-[10px] font-mono" style={{ color: "var(--t-faint)" }}>
              {total}
            </span>
          </button>

          {categoryTags.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.08em] px-2.5 pt-3 pb-1"
                 style={{ color: "var(--t-faint)" }}>Kategoriler</p>
              {categoryTags.map((t) => (
                <button key={t.id} onClick={() => { setActiveTag(t.slug); setPage(1); }}
                        className={filterBtn(activeTag === t.slug)} style={filterStyle(activeTag === t.slug)}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.color }} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </>
          )}

          {classTags.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.08em] px-2.5 pt-3 pb-1"
                 style={{ color: "var(--t-faint)" }}>Class</p>
              {classTags.map((t) => (
                <button key={t.id} onClick={() => { setActiveTag(t.slug); setPage(1); }}
                        className={filterBtn(activeTag === t.slug)} style={filterStyle(activeTag === t.slug)}>
                  <Hash className="w-3 h-3 flex-shrink-0" style={{ color: t.color }} />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </>
          )}
        </Card>

        {/* Konular */}
        <div className="min-w-0 space-y-4">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                    style={{ color: "var(--t-faint)" }} />
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Bu sayfadaki konularda ara"
                   className="pl-9 pr-3 h-[36px] w-full rounded-full text-[12.5px] outline-none"
                   style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                            color: "var(--t-text)" }} />
          </div>

          {loading && posts.length === 0 && <Empty>Konular geliyor…</Empty>}
          {!loading && shown.length === 0 && (
            <Empty>{q ? "Aramaya uyan konu yok." : "Burada henüz konu yok."}</Empty>
          )}

          {pinned.length > 0 && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3"
                   style={{ borderBottom: "1px solid var(--t-line)" }}>
                <Pin className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                <span className="text-[12px] font-semibold uppercase tracking-wider"
                      style={{ color: "var(--t-dim)" }}>Sabitlenmiş</span>
              </div>
              {pinned.map((p) => <PostRow key={p.id} p={p} />)}
            </Card>
          )}

          {rest.length > 0 && (
            <Card className="overflow-hidden">
              {rest.map((p) => <PostRow key={p.id} p={p} />)}
            </Card>
          )}

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button className="t-tab" disabled={page <= 1}
                      onClick={() => setPage((n) => Math.max(1, n - 1))}>
                <ChevronLeft className="w-3.5 h-3.5" /> Önceki
              </button>
              <span className="text-[12px]" style={{ color: "var(--t-dim)" }}>
                {page} / {pages}
              </span>
              <button className="t-tab" disabled={page >= pages}
                      onClick={() => setPage((n) => Math.min(pages, n + 1))}>
                Sonraki <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Özet */}
        <div className="space-y-4 lg:sticky lg:top-[84px]">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
              <h2 className="text-[13px] font-semibold">Forum</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Konu", String(total)],
                ["Bu sayfada", String(posts.length)],
                ["Yanıt", String(posts.reduce((s, p) => s + p._count.comments, 0))],
                ["Görüntülenme", String(posts.reduce((s, p) => s + p.viewCount, 0))],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className="text-[10px] uppercase tracking-[0.08em]"
                       style={{ color: "var(--t-faint)" }}>{k}</div>
                  <div className="t-num text-[18px] font-bold leading-none mt-1">{v}</div>
                </div>
              ))}
            </div>
          </Card>

          {busiest.length > 0 && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3"
                   style={{ borderBottom: "1px solid var(--t-line)" }}>
                <Flame className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-ember)" }} />
                <span className="text-[13px] font-semibold">En çok konuşulan</span>
              </div>
              {busiest.map((p) => (
                <Link key={p.id} href={`/test/forum/${p.id}`} className="t-row px-4 py-2.5 block">
                  <div className="text-[12.5px] truncate">{p.title}</div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px]"
                       style={{ color: "var(--t-faint)" }}>
                    <MessagesSquare className="w-3 h-3" /> {p._count.comments}
                    <Clock className="w-3 h-3 ml-1" /> {timeAgo(p.createdAt)}
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </div>
      </div>

      <div className="pb-6" />
    </TestShell>
  );
}

function PostRow({ p }: { p: Post }) {
  return (
    <Link href={`/test/forum/${p.id}`} className="t-row px-5 py-4 flex gap-4 items-start">
      {p.author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.author.avatarUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0 mt-0.5"
             style={{ outline: "1px solid var(--t-line)" }} />
      ) : (
        <div className="w-9 h-9 rounded-full flex-shrink-0 mt-0.5"
             style={{ background: "var(--t-raised)" }} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {p.pinned && <Pin className="w-3 h-3 flex-shrink-0" style={{ color: "var(--t-gold)" }} />}
          <span className="text-[14px] font-semibold truncate">{p.title}</span>
          {p.tags.map(({ tag }) => (
            <span key={tag.id} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ color: tag.color, background: tag.color + "18" }}>
              {tag.name}
            </span>
          ))}
        </div>

        <p className="text-[12px] mt-1 line-clamp-2" style={{ color: "var(--t-dim)" }}>
          {preview(p.content)}
        </p>

        <div className="flex items-center gap-2 mt-2 text-[11px]" style={{ color: "var(--t-faint)" }}>
          <span style={{ color: p.author.siteRole?.color ?? "var(--t-dim)" }}>
            {p.author.familyName}
          </span>
          <GuildTag g={p.author.guild ?? null} />
          <span>·</span>
          <span>{timeAgo(p.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0 self-center">
        <div className="text-center w-12">
          <div className="t-num text-[15px] font-bold"
               style={{ color: p._count.comments > 0 ? "var(--t-text)" : "var(--t-faint)" }}>
            {p._count.comments}
          </div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--t-faint)" }}>
            yanıt
          </div>
        </div>
        <div className="text-center w-12 hidden sm:block">
          <div className="t-num text-[15px] font-bold" style={{ color: "var(--t-dim)" }}>
            {p.viewCount}
          </div>
          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--t-faint)" }}>
            <Eye className="w-3 h-3 inline" />
          </div>
        </div>
      </div>
    </Link>
  );
}
