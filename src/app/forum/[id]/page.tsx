"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { RichTextContent } from "@/components/rich-text-editor";

const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="border border-bdo-border rounded-xl h-64 animate-pulse bg-bdo-bg" /> }
);

interface Tag { id: number; name: string; slug: string; type: string; color: string; }
interface Author { id: number; familyName: string; avatarUrl: string; siteRole: { name: string; color: string } | null; }
interface Comment { id: number; content: string; createdAt: string; author: Author; }
interface Reaction { emoji: string; count: number; }

interface Post {
  id: number; title: string; content: string; pinned: boolean; viewCount: number; createdAt: string; updatedAt: string;
  author: Author;
  tags: { tag: Tag }[];
  comments: Comment[];
  reactions: { emoji: string; user: { id: number } }[];
}

const EMOJIS = ["👍", "❤️", "🔥", "⚔️", "😂"];

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk önce`;
  if (h < 24) return `${h}sa önce`;
  return new Date(date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function Avatar({ user }: { user: Author }) {
  return user.avatarUrl
    ? <img src={user.avatarUrl} alt="" className="w-9 h-9 rounded-full flex-shrink-0" />
    : <div className="w-9 h-9 rounded-full bg-bdo-border flex-shrink-0 flex items-center justify-center text-xs text-bdo-text-muted">{user.familyName?.[0] ?? "?"}</div>;
}

export default function ForumPostPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [myReactions, setMyReactions] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/forum/posts/${params.id}`)
      .then((r) => r.json())
      .then((data: Post) => {
        setPost(data);
        setEditTitle(data.title);
        setEditContent(data.content);
        const grouped: Record<string, number> = {};
        data.reactions.forEach((r) => { grouped[r.emoji] = (grouped[r.emoji] ?? 0) + 1; });
        setReactions(Object.entries(grouped).map(([emoji, count]) => ({ emoji, count })));
        if (session) {
          setMyReactions(data.reactions.filter((r) => r.user.id === session.user.id).map((r) => r.emoji));
        }
      });
  }, [params.id, session]);

  async function react(emoji: string) {
    if (!session) return;
    const res = await fetch(`/api/forum/posts/${params.id}/react`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }),
    });
    const data = await res.json();
    setReactions(data.reactions);
    setMyReactions(data.mine);
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/forum/posts/${params.id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: comment }),
    });
    if (res.ok) {
      const newComment: Comment = await res.json();
      setPost((p) => p ? { ...p, comments: [...p.comments, newComment] } : p);
      setComment("");
    }
    setSubmitting(false);
  }

  async function deleteComment(commentId: number) {
    if (!confirm("Yorumu silmek istediğinden emin misin?")) return;
    await fetch(`/api/forum/posts/${params.id}/comments`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ commentId }),
    });
    setPost((p) => p ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p);
  }

  async function deletePost() {
    if (!confirm("Bu gönderiyi silmek istediğinden emin misin?")) return;
    await fetch(`/api/forum/posts/${params.id}`, { method: "DELETE" });
    router.push("/forum");
  }

  async function togglePin() {
    if (!post) return;
    const res = await fetch(`/api/forum/posts/${params.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !post.pinned }),
    });
    if (res.ok) setPost((p) => p ? { ...p, pinned: !p.pinned } : p);
  }

  async function saveEdit() {
    if (!editTitle.trim()) return;
    const plainText = editContent.replace(/<[^>]+>/g, "").trim();
    if (!plainText) return;
    setSaving(true);
    const res = await fetch(`/api/forum/posts/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, content: editContent }),
    });
    if (res.ok) {
      setPost((p) => p ? { ...p, title: editTitle, content: editContent } : p);
      setEditing(false);
    }
    setSaving(false);
  }

  if (!post) return <div className="text-center py-20 text-bdo-text-muted">Yükleniyor...</div>;

  const canEdit = session?.user.id === post.author.id || session?.user.isAdmin;
  const isAdmin = session?.user.isAdmin;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 md:pb-6">
      {/* Back */}
      <button onClick={() => router.push("/forum")} className="text-sm text-bdo-text-muted hover:text-bdo-text-primary mb-4 block">
        ← Foruma Dön
      </button>

      {/* Post Card */}
      <div className={`bg-bdo-surface border rounded-xl p-6 mb-4 ${post.pinned ? "border-bdo-gold/40" : "border-bdo-border"}`}>
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar user={post.author} />
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-bdo-text-primary">{post.author.familyName || "?"}</span>
              {post.author.siteRole && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ color: post.author.siteRole.color }}>
                  {post.author.siteRole.name}
                </span>
              )}
              <span className="text-xs text-bdo-text-muted">{timeAgo(post.createdAt)}</span>
              {post.updatedAt !== post.createdAt && (
                <span className="text-xs text-bdo-text-muted italic">(düzenlendi)</span>
              )}
              <span className="text-xs text-bdo-text-muted">· 👁 {post.viewCount}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {post.pinned && <span className="text-[10px] bg-bdo-gold/20 text-bdo-gold px-1.5 py-0.5 rounded font-bold">📌</span>}
            {isAdmin && (
              <button onClick={togglePin} className="text-xs text-bdo-text-muted hover:text-bdo-gold px-2 py-1 rounded hover:bg-bdo-bg">
                {post.pinned ? "Sabitlemeyi Kaldır" : "Sabitle"}
              </button>
            )}
            {canEdit && !editing && (
              <button
                onClick={() => { setEditTitle(post.title); setEditContent(post.content); setEditing(true); }}
                className="text-xs text-bdo-text-muted hover:text-bdo-gold px-2 py-1 rounded hover:bg-bdo-bg"
              >
                Düzenle
              </button>
            )}
            {canEdit && (
              <button onClick={deletePost} className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded hover:bg-bdo-bg">
                Sil
              </button>
            )}
          </div>
        </div>

        {editing ? (
          /* Edit mode */
          <div className="space-y-4">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={120}
              className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-4 py-2.5 text-bdo-text-primary focus:border-bdo-gold focus:outline-none text-sm font-bold"
            />
            <RichTextEditor content={editContent} onChange={setEditContent} minHeight={200} />
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={saving}
                className="bg-bdo-gold text-bdo-bg text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-bdo-gold-dim disabled:opacity-50 transition-colors"
              >
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-bdo-text-muted hover:text-bdo-text-primary px-3 py-1.5"
              >
                İptal
              </button>
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            {/* Title + Tags */}
            <h1 className="text-xl font-bold text-bdo-text-primary mb-3">{post.title}</h1>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {post.tags.map(({ tag }) => (
                <span
                  key={tag.id}
                  className="text-xs px-2.5 py-0.5 rounded-full font-medium border"
                  style={{ color: tag.color, borderColor: `${tag.color}40`, backgroundColor: `${tag.color}15` }}
                >
                  {tag.name}
                </span>
              ))}
            </div>

            {/* Content */}
            <div className="border-t border-bdo-border pt-4">
              <RichTextContent html={post.content} />
            </div>
          </>
        )}

        {/* Reactions */}
        {!editing && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-bdo-border flex-wrap">
            {EMOJIS.map((emoji) => {
              const r = reactions.find((x) => x.emoji === emoji);
              const mine = myReactions.includes(emoji);
              return (
                <button
                  key={emoji}
                  onClick={() => react(emoji)}
                  className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded-full border transition-all ${mine ? "border-bdo-gold/60 bg-bdo-gold/10 text-bdo-gold" : "border-bdo-border bg-bdo-bg text-bdo-text-muted hover:border-bdo-gold/30"}`}
                >
                  <span>{emoji}</span>
                  {r && <span className="text-xs font-mono">{r.count}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="space-y-3 mb-4">
        <h2 className="text-sm font-semibold text-bdo-text-muted uppercase tracking-wider">
          💬 {post.comments.length} Yorum
        </h2>
        {post.comments.map((c) => (
          <div key={c.id} className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Avatar user={c.author} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-bdo-text-primary">{c.author.familyName || "?"}</span>
                  {c.author.siteRole && (
                    <span className="text-[10px] font-bold" style={{ color: c.author.siteRole.color }}>{c.author.siteRole.name}</span>
                  )}
                  <span className="text-xs text-bdo-text-muted">{timeAgo(c.createdAt)}</span>
                  {(session?.user.id === c.author.id || isAdmin) && (
                    <button onClick={() => deleteComment(c.id)} className="ml-auto text-xs text-red-400/40 hover:text-red-400">Sil</button>
                  )}
                </div>
                <p className="text-sm text-bdo-text-primary leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* New Comment */}
      <form onSubmit={submitComment} className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-bdo-text-muted mb-3">Yorum Yaz</h3>
        <textarea
          ref={commentRef}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Yorumunu buraya yaz..."
          rows={3}
          className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none resize-none"
        />
        <div className="flex justify-end mt-2">
          <button
            type="submit"
            disabled={submitting || !comment.trim()}
            className="bg-bdo-gold text-bdo-bg text-sm font-semibold px-4 py-2 rounded-lg hover:bg-bdo-gold-dim disabled:opacity-50 transition-colors"
          >
            {submitting ? "Gönderiliyor..." : "Gönder"}
          </button>
        </div>
      </form>
    </div>
  );
}
