"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { RichTextContent } from "@/components/rich-text-editor";
import { ArrowLeft, Pin, PinOff, Pencil, Trash2, Eye, MessagesSquare, Send, X } from "lucide-react";
import { Card, CardHeader, Button, Loading, Empty, Avatar, GuildTag, type GuildInfo } from "@/components/ui";

const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="border border-bdo-border rounded-xl h-64 animate-pulse bg-bdo-bg" /> }
);

interface Tag { id: number; name: string; slug: string; type: string; color: string }
interface Author { id: number; familyName: string; avatarUrl: string; siteRole: { name: string; color: string } | null; guild?: GuildInfo | null }
interface Comment { id: number; content: string; createdAt: string; author: Author }
interface Reaction { emoji: string; count: number }

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
  if (m < 60) return `${m}dk önce`;
  if (h < 24) return `${h}sa önce`;
  return new Date(date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
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

  if (!post) return <Loading />;

  const canEdit = session?.user.id === post.author.id || session?.user.isAdmin;
  const isAdmin = session?.user.isAdmin;

  return (
    // Dar bir kolona sıkışmak yerine sayfanın genişliğini kullanıyor;
    // üst kabuk zaten 1500px'te sınırlıyor
    <div>
      <button
        onClick={() => router.push("/forum")}
        className="inline-flex items-center gap-1.5 text-[12px] text-bdo-text-secondary hover:text-bdo-gold transition-colors mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
        Foruma dön
      </button>

      {/* Post */}
      <div className={`card mb-4 ${post.pinned ? "card-accent" : ""}`}>
        <div className="card-header">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar src={post.author.avatarUrl} size={30} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[13px] font-semibold text-bdo-text-primary">{post.author.familyName || "?"}</span>
                <GuildTag guild={post.author.guild} />
                {post.author.siteRole && (
                  <span className="text-[10px] font-bold" style={{ color: post.author.siteRole.color }}>
                    {post.author.siteRole.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-bdo-text-secondary leading-tight mt-0.5">
                <span>{timeAgo(post.createdAt)}</span>
                {post.updatedAt !== post.createdAt && <span className="italic">· düzenlendi</span>}
                <span className="flex items-center gap-1">
                  · <Eye className="w-3 h-3" strokeWidth={1.75} /> {post.viewCount}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {post.pinned && !isAdmin && (
              <Pin className="w-3.5 h-3.5 text-bdo-gold" strokeWidth={2.5} fill="currentColor" />
            )}
            {isAdmin && (
              <Button variant="ghost" size="xs" icon={post.pinned ? PinOff : Pin} onClick={togglePin} />
            )}
            {canEdit && !editing && (
              <Button
                variant="ghost" size="xs" icon={Pencil}
                onClick={() => { setEditTitle(post.title); setEditContent(post.content); setEditing(true); }}
              />
            )}
            {canEdit && <Button variant="danger" size="xs" icon={Trash2} onClick={deletePost} />}
          </div>
        </div>

        <div className="p-4">
          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={120}
                className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2.5 text-bdo-text-primary focus:border-bdo-gold/40 focus:outline-none text-[14px] font-semibold transition-colors"
              />
              <RichTextEditor content={editContent} onChange={setEditContent} minHeight={200} />
              <div className="flex gap-2">
                <Button variant="primary" size="md" onClick={saveEdit} disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
                <Button variant="ghost" size="md" icon={X} onClick={() => setEditing(false)}>İptal</Button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="text-[17px] font-bold text-bdo-text-primary leading-snug mb-2">{post.title}</h1>
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {post.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="text-[10px] px-2 py-0.5 rounded font-medium border"
                      style={{ color: tag.color, borderColor: `${tag.color}30`, backgroundColor: `${tag.color}12` }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="border-t border-bdo-border pt-4">
                <RichTextContent html={post.content} />
              </div>
            </>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1.5 px-4 py-3 border-t border-bdo-border flex-wrap">
            {EMOJIS.map((emoji) => {
              const r = reactions.find((x) => x.emoji === emoji);
              const mine = myReactions.includes(emoji);
              return (
                <button
                  key={emoji}
                  onClick={() => react(emoji)}
                  className={`flex items-center gap-1.5 text-[13px] px-2.5 py-1 rounded-lg border transition-all ${
                    mine
                      ? "border-bdo-gold/40 bg-bdo-gold/10"
                      : "border-bdo-border bg-bdo-bg hover:border-bdo-border-2"
                  }`}
                >
                  <span>{emoji}</span>
                  {r && (
                    <span className={`text-[11px] font-mono font-semibold ${mine ? "text-bdo-gold" : "text-bdo-text-secondary"}`}>
                      {r.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Comments */}
      <Card className="mb-4">
        <CardHeader title="Yorumlar" icon={MessagesSquare} meta={`${post.comments.length}`} />
        {post.comments.length === 0 ? (
          <Empty icon={MessagesSquare} text="Henüz yorum yok. İlk yorumu sen yaz." />
        ) : (
          post.comments.map((c) => (
            <div key={c.id} className="card-row items-start gap-2.5 py-3">
              <Avatar src={c.author.avatarUrl} size={26} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-semibold text-bdo-text-primary">{c.author.familyName || "?"}</span>
                  <GuildTag guild={c.author.guild} />
                  {c.author.siteRole && (
                    <span className="text-[10px] font-bold" style={{ color: c.author.siteRole.color }}>
                      {c.author.siteRole.name}
                    </span>
                  )}
                  <span className="text-[11px] text-bdo-text-secondary">{timeAgo(c.createdAt)}</span>
                  {(session?.user.id === c.author.id || isAdmin) && (
                    <button
                      onClick={() => deleteComment(c.id)}
                      className="ml-auto p-1 rounded text-bdo-text-secondary/50 hover:text-red-400 hover:bg-red-400/8 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" strokeWidth={2} />
                    </button>
                  )}
                </div>
                <p className="text-[13px] text-bdo-text-muted leading-relaxed whitespace-pre-wrap mt-1">{c.content}</p>
              </div>
            </div>
          ))
        )}
      </Card>

      {/* New comment */}
      <Card>
        <CardHeader title="Yorum Yaz" />
        <form onSubmit={submitComment} className="p-4">
          <textarea
            ref={commentRef}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Yorumunu buraya yaz..."
            rows={3}
            className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2.5 text-[13px] text-bdo-text-primary placeholder-bdo-text-secondary focus:border-bdo-gold/40 focus:outline-none resize-none transition-colors"
          />
          <div className="flex justify-end mt-2.5">
            <Button type="submit" variant="primary" size="md" icon={Send} disabled={submitting || !comment.trim()}>
              {submitting ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
