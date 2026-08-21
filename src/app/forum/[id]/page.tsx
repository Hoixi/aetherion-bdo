"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { RichTextContent } from "@/components/rich-text-editor";
import {
  ArrowLeft, Pin, PinOff, Pencil, Trash2, MessagesSquare, Send, X, Clock,
} from "lucide-react";
import { TestShell, Card, Empty, GuildTag, loadJson, type Guild } from "@/components/app-shell";

/**
 * Forum konusu.
 *
 * Gövde solda geniş bir sütunda, konu bilgisi sağda sabit bir kenar
 * çubuğunda: kim açmış, ne zaman, kaç yanıt, hangi etiketler, yönetim
 * işlemleri. Eski hâli her şeyi dar tek bir kolona diziyordu.
 */

const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="rounded-xl h-64 animate-pulse"
                                    style={{ background: "var(--t-raised)" }} /> },
);

interface Tag { id: number; name: string; slug: string; type: string; color: string }
interface Author {
  id: number; familyName: string; avatarUrl: string;
  siteRole: { name: string; color: string } | null;
  guild?: Guild | null;
}
interface Comment { id: number; content: string; createdAt: string; author: Author }
interface Post {
  id: number; title: string; content: string; pinned: boolean; viewCount: number;
  createdAt: string; updatedAt: string;
  author: Author;
  tags: { tag: Tag }[];
  comments: Comment[];
  reactions: { emoji: string; user: { id: number } }[];
}

const EMOJIS = ["👍", "❤️", "🔥", "⚔️", "😂"];

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m} dk önce`;
  if (h < 24) return `${h} sa önce`;
  return new Date(date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function Who({ a, size = 32 }: { a: Author; size?: number }) {
  return (
    <Link href={`/uyeler/${a.id}`} className="flex items-center gap-2 min-w-0 group">
      {a.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.avatarUrl} alt="" className="rounded-full flex-shrink-0"
             style={{ width: size, height: size, outline: "1px solid var(--t-line)" }} />
      ) : (
        <div className="rounded-full flex-shrink-0"
             style={{ width: size, height: size, background: "var(--t-raised)" }} />
      )}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-medium truncate group-hover:underline"
                style={{ color: a.siteRole?.color ?? "var(--t-text)" }}>
            {a.familyName}
          </span>
          <GuildTag g={a.guild ?? null} />
        </span>
        {a.siteRole && (
          <span className="block text-[10px]" style={{ color: "var(--t-faint)" }}>
            {a.siteRole.name}
          </span>
        )}
      </span>
    </Link>
  );
}

export default function ForumPostPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [post, setPost] = useState<Post | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    if (!params?.id) return;
    loadJson<Post>(`/api/forum/posts/${params.id}`)
      .then((p) => { setPost(p); setEditTitle(p.title); setEditBody(p.content); })
      .catch((e: Error) => setErr(e.message));
  }, [params?.id]);

  const isAuthor = post && session?.user.id === post.author.id;
  const isAdmin = session?.user.isAdmin;
  const canManage = Boolean(isAuthor || isAdmin);

  /** Emoji başına sayı ve bizim basıp basmadığımız */
  const reactions = EMOJIS.map((e) => ({
    emoji: e,
    count: post?.reactions.filter((r) => r.emoji === e).length ?? 0,
    mine: post?.reactions.some((r) => r.emoji === e && r.user.id === session?.user.id) ?? false,
  }));

  async function react(emoji: string) {
    if (!post) return;
    const res = await fetch(`/api/forum/posts/${post.id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) setPost(await loadJson<Post>(`/api/forum/posts/${post.id}`));
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!post || !comment.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/forum/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: comment }),
    });
    if (res.ok) {
      setComment("");
      setPost(await loadJson<Post>(`/api/forum/posts/${post.id}`));
    }
    setBusy(false);
  }

  async function deleteComment(commentId: number) {
    if (!post || !window.confirm("Yorum silinsin mi?")) return;
    await fetch(`/api/forum/posts/${post.id}/comments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commentId }),
    });
    setPost(await loadJson<Post>(`/api/forum/posts/${post.id}`));
  }

  async function deletePost() {
    if (!post || !window.confirm("Konu silinsin mi? Geri alınamaz.")) return;
    await fetch(`/api/forum/posts/${post.id}`, { method: "DELETE" });
    router.push("/forum");
  }

  async function togglePin() {
    if (!post) return;
    const res = await fetch(`/api/forum/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !post.pinned }),
    });
    if (res.ok) setPost({ ...post, pinned: !post.pinned });
  }

  async function saveEdit() {
    if (!post || !editTitle.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/forum/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, content: editBody }),
    });
    if (res.ok) {
      setEditing(false);
      setPost(await loadJson<Post>(`/api/forum/posts/${post.id}`));
    }
    setBusy(false);
  }

  return (
    <TestShell
      title={post?.title ?? "Konu"}
      subtitle={post ? `${post.comments.length} yanıt · ${post.viewCount} görüntülenme` : "Yükleniyor…"}
      aside={
        <Link href="/forum" className="t-tab">
          <ArrowLeft className="w-3.5 h-3.5" /> Forum
        </Link>
      }
    >
      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
      {!post && !err && <Empty>Konu geliyor…</Empty>}

      {post && (
        <div className="grid lg:grid-cols-[1fr_280px] gap-5 items-start">
          <div className="min-w-0 space-y-4">
            {/* Gövde */}
            <Card className="overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-3"
                   style={{ borderBottom: "1px solid var(--t-line)" }}>
                <Who a={post.author} size={36} />
                <span className="ml-auto flex items-center gap-1.5 text-[11px]"
                      style={{ color: "var(--t-faint)" }}>
                  <Clock className="w-3 h-3" /> {timeAgo(post.createdAt)}
                </span>
              </div>

              <div className="p-5">
                {editing ? (
                  <div className="space-y-3">
                    <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                           className="w-full px-3 py-2 rounded-lg text-[15px] font-semibold outline-none"
                           style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                    color: "var(--t-text)" }} />
                    <RichTextEditor content={editBody} onChange={setEditBody} />
                    <div className="flex gap-2">
                      <button className="t-tab" data-on onClick={saveEdit} disabled={busy}>
                        {busy ? "Kaydediliyor…" : "Kaydet"}
                      </button>
                      <button className="t-tab" onClick={() => setEditing(false)}>
                        <X className="w-3.5 h-3.5" /> Vazgeç
                      </button>
                    </div>
                  </div>
                ) : (
                  <RichTextContent html={post.content} />
                )}
              </div>

              {!editing && (
                <div className="px-5 pb-4 flex items-center gap-1.5 flex-wrap">
                  {reactions.map((r) => (
                    <button key={r.emoji} onClick={() => react(r.emoji)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full text-[12px] transition-colors"
                            style={{
                              background: r.mine ? "var(--t-gold-soft)" : "var(--t-raised)",
                              border: `1px solid ${r.mine ? "rgba(232,180,81,.4)" : "var(--t-line)"}`,
                            }}>
                      <span>{r.emoji}</span>
                      {r.count > 0 && (
                        <span className="t-num" style={{ color: "var(--t-dim)" }}>{r.count}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Yanıtlar */}
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3.5"
                   style={{ borderBottom: "1px solid var(--t-line)" }}>
                <MessagesSquare className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                <h2 className="text-[14px] font-semibold">Yanıtlar</h2>
                <span className="t-chip ml-auto">{post.comments.length}</span>
              </div>

              {post.comments.length === 0 ? (
                <p className="px-5 py-10 text-center text-[13px]" style={{ color: "var(--t-dim)" }}>
                  Henüz yanıt yok. İlk yazan sen ol.
                </p>
              ) : post.comments.map((c) => (
                <div key={c.id} className="px-5 py-4 flex gap-3"
                     style={{ borderBottom: "1px solid var(--t-line)" }}>
                  <div className="flex-shrink-0">
                    {c.author.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.author.avatarUrl} alt="" className="w-8 h-8 rounded-full"
                           style={{ outline: "1px solid var(--t-line)" }} />
                    ) : (
                      <div className="w-8 h-8 rounded-full" style={{ background: "var(--t-raised)" }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/uyeler/${c.author.id}`}
                            className="text-[12.5px] font-medium hover:underline"
                            style={{ color: c.author.siteRole?.color ?? "var(--t-text)" }}>
                        {c.author.familyName}
                      </Link>
                      <GuildTag g={c.author.guild ?? null} />
                      <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                        {timeAgo(c.createdAt)}
                      </span>
                      {(isAdmin || session?.user.id === c.author.id) && (
                        <button onClick={() => deleteComment(c.id)}
                                className="ml-auto text-[11px] flex items-center gap-1 hover:opacity-80"
                                style={{ color: "var(--t-faint)" }}>
                          <Trash2 className="w-3 h-3" /> Sil
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-wrap"
                         style={{ color: "var(--t-dim)" }}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}

              {/* Yanıt yaz */}
              {session ? (
                <form onSubmit={submitComment} className="p-5">
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                            placeholder="Yanıtını yaz…" rows={3}
                            className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none resize-y"
                            style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                     color: "var(--t-text)" }} />
                  <div className="flex justify-end mt-2">
                    <button type="submit" className="t-tab" data-on disabled={busy || !comment.trim()}>
                      <Send className="w-3.5 h-3.5" /> {busy ? "Gönderiliyor…" : "Gönder"}
                    </button>
                  </div>
                </form>
              ) : (
                <p className="px-5 py-6 text-center text-[12px]" style={{ color: "var(--t-faint)" }}>
                  Yanıt yazmak için giriş yapman gerekiyor.
                </p>
              )}
            </Card>
          </div>

          {/* Kenar çubuğu */}
          <div className="space-y-4 lg:sticky lg:top-[84px]">
            <Card className="p-4">
              <div className="text-[10px] uppercase tracking-[0.08em] mb-3"
                   style={{ color: "var(--t-faint)" }}>Konu</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Yanıt", String(post.comments.length)],
                  ["Görüntülenme", String(post.viewCount)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>{k}</div>
                    <div className="t-num text-[18px] font-bold leading-none mt-1">{v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 space-y-2" style={{ borderTop: "1px solid var(--t-line)" }}>
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--t-faint)" }}>
                  <Clock className="w-3 h-3" />
                  {new Date(post.createdAt).toLocaleString("tr-TR",
                    { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
                {post.pinned && (
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--t-gold)" }}>
                    <Pin className="w-3 h-3" /> Sabitlenmiş
                  </div>
                )}
              </div>
            </Card>

            {post.tags.length > 0 && (
              <Card className="p-4">
                <div className="text-[10px] uppercase tracking-[0.08em] mb-2.5"
                     style={{ color: "var(--t-faint)" }}>Etiketler</div>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map(({ tag }) => (
                    <span key={tag.id}
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                          style={{ color: tag.color, background: tag.color + "18" }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {canManage && !editing && (
              <Card className="p-2">
                {isAuthor && (
                  <button onClick={() => setEditing(true)}
                          className="flex items-center gap-2 w-full px-2.5 py-2 rounded-[var(--t-r-sm)]
                                     text-[12.5px] transition-colors"
                          style={{ color: "var(--t-dim)" }}>
                    <Pencil className="w-3.5 h-3.5" /> Düzenle
                  </button>
                )}
                {isAdmin && (
                  <button onClick={togglePin}
                          className="flex items-center gap-2 w-full px-2.5 py-2 rounded-[var(--t-r-sm)]
                                     text-[12.5px] transition-colors"
                          style={{ color: "var(--t-dim)" }}>
                    {post.pinned
                      ? <><PinOff className="w-3.5 h-3.5" /> Sabitlemeyi kaldır</>
                      : <><Pin className="w-3.5 h-3.5" /> Sabitle</>}
                  </button>
                )}
                <button onClick={deletePost}
                        className="flex items-center gap-2 w-full px-2.5 py-2 rounded-[var(--t-r-sm)]
                                   text-[12.5px] transition-colors"
                        style={{ color: "var(--t-bad)" }}>
                  <Trash2 className="w-3.5 h-3.5" /> Konuyu sil
                </button>
              </Card>
            )}
          </div>
        </div>
      )}

      <div className="pb-6" />
    </TestShell>
  );
}
