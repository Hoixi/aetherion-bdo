"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { ChevronLeft, Send, Check } from "lucide-react";
import { TestShell, Card, Empty } from "@/components/test-shell";

/**
 * Yeni forum gönderisi.
 *
 * Editör tarayıcıya bağımlı olduğu için sunucuda çizilmiyor; yükleninceye
 * kadar aynı yükseklikte bir yer tutucu duruyor ki form zıplamasın.
 */

const RichTextEditor = dynamic(
  () => import("@/components/rich-text-editor").then((m) => m.RichTextEditor),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[var(--t-r)] h-64 animate-pulse"
           style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }} />
    ),
  },
);

type Tag = {
  id: number;
  name: string;
  slug: string;
  type: "CATEGORY" | "CLASS";
  color: string;
};

/** Class tagları kendi renklerini taşımıyor; hepsi aynı morda */
const CLASS_TAG_COLOR = "#a855f7";

export default function YeniGonderiPage() {
  const { status } = useSession();
  const router = useRouter();

  const [tags, setTags] = useState<Tag[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/forum/tags").then((r) => r.json()).then(setTags).catch(() => {});
  }, []);

  function toggle(id: number) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Başlık zorunlu.");
    // Editör boşken bile <p></p> döndürüyor; etiketleri atıp bakıyoruz
    if (!content.replace(/<[^>]+>/g, "").trim()) return setError("İçerik zorunlu.");
    if (picked.length === 0) return setError("En az bir tag seçmelisin.");

    setSaving(true);
    setError(null);
    const res = await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, tagIds: picked }),
    });

    if (res.ok) {
      const post = await res.json();
      router.push(`/test/forum/${post.id}`);
      return;
    }

    let text = "Gönderi oluşturulamadı.";
    try {
      text = (await res.json()).error ?? text;
    } catch {
      if (res.status === 413) text = "İçerik çok büyük. Resimleri küçültüp tekrar dene.";
    }
    setError(text);
    setSaving(false);
  }

  if (status === "unauthenticated") {
    return (
      <TestShell title="Yeni Gönderi" subtitle="Giriş gerekiyor">
        <Empty>Gönderi açmak için giriş yapman gerekiyor.</Empty>
      </TestShell>
    );
  }

  const categories = tags.filter((t) => t.type === "CATEGORY");
  const classes = tags.filter((t) => t.type === "CLASS");
  const pickedNames = tags.filter((t) => picked.includes(t.id)).map((t) => t.name);

  return (
    <TestShell bare title="Yeni Gönderi">
      <div className="max-w-3xl mx-auto space-y-5 pb-8">
        <Link href="/test/forum"
              className="inline-flex items-center gap-1 text-[12px] transition-colors hover:opacity-80"
              style={{ color: "var(--t-dim)" }}>
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.2} /> Foruma dön
        </Link>

        <h1 className="text-[26px] font-bold tracking-tight leading-none">Yeni Gönderi</h1>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label>Başlık</Label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120}
                   placeholder="Gönderinin başlığı…"
                   className="w-full h-[42px] px-4 rounded-[var(--t-r-sm)] text-[14px] outline-none"
                   style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)",
                            color: "var(--t-text)" }} />
          </div>

          <div>
            <Label>İçerik</Label>
            <RichTextEditor content={content} onChange={setContent} minHeight={300}
                            placeholder="Gönderini buraya yaz… (resim, başlık, liste ekleyebilirsin)" />
            <p className="text-[11px] mt-1.5" style={{ color: "var(--t-faint)" }}>
              Resimler en fazla 2MB olabilir (JPG/PNG). Daha büyükleri sıkıştırıp yükle.
            </p>
          </div>

          <div>
            <Label>
              Taglar <span className="normal-case opacity-60">(birden fazla seçebilirsin)</span>
            </Label>

            <Card className="p-4 space-y-4">
              <TagGroup title="Kategori">
                {categories.map((tag) => (
                  <TagChip key={tag.id} label={tag.name} color={tag.color}
                           on={picked.includes(tag.id)} onClick={() => toggle(tag.id)} />
                ))}
              </TagGroup>

              <TagGroup title="Class">
                {classes.map((tag) => (
                  <TagChip key={tag.id} label={tag.name} color={CLASS_TAG_COLOR} small
                           on={picked.includes(tag.id)} onClick={() => toggle(tag.id)} />
                ))}
              </TagGroup>
            </Card>

            {picked.length > 0 && (
              <p className="text-[11.5px] mt-1.5" style={{ color: "var(--t-faint)" }}>
                {picked.length} tag seçildi: {pickedNames.join(", ")}
              </p>
            )}
          </div>

          {error && <p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-2 font-semibold px-5 h-[38px] rounded-[var(--t-r-sm)] text-[13px] disabled:opacity-50"
                    style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
              {saving ? "Gönderiliyor…" : "Gönder"}
            </button>
            <button type="button" onClick={() => router.back()}
                    className="text-[12px] transition-colors hover:opacity-80" style={{ color: "var(--t-faint)" }}>
              İptal
            </button>
          </div>
        </form>
      </div>
    </TestShell>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--t-faint)" }}>
      {children}
    </label>
  );
}

function TagGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase font-semibold tracking-[0.08em] mb-2" style={{ color: "var(--t-faint)" }}>
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function TagChip({ label, color, on, onClick, small }: {
  label: string; color: string; on: boolean; onClick: () => void; small?: boolean;
}) {
  return (
    <button type="button" onClick={onClick}
            className={`inline-flex items-center gap-1 rounded-full font-medium transition-colors ${
              small ? "text-[11px] px-2.5 py-1" : "text-[12px] px-3 py-1.5"}`}
            style={on
              ? { color, borderColor: color, background: color + "22", border: `1px solid ${color}` }
              : { color: "var(--t-faint)", border: "1px solid var(--t-line-strong)", background: "transparent" }}>
      {on && <Check className="w-3 h-3" strokeWidth={2.6} />}
      {label}
    </button>
  );
}
