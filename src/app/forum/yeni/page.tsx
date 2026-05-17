"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Tag {
  id: number;
  name: string;
  slug: string;
  type: "CATEGORY" | "CLASS";
  color: string;
}

export default function NewPostPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tags, setTags] = useState<Tag[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/forum/tags").then((r) => r.json()).then(setTags);
  }, []);

  if (!session) return null;

  const categoryTags = tags.filter((t) => t.type === "CATEGORY");
  const classTags = tags.filter((t) => t.type === "CLASS");

  function toggleTag(id: number) {
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return setError("Başlık ve içerik zorunlu.");
    if (selectedTags.length === 0) return setError("En az bir tag seçmelisin.");
    setSaving(true);
    setError(null);
    const res = await fetch("/api/forum/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, tagIds: selectedTags }),
    });
    if (res.ok) {
      const post = await res.json();
      router.push(`/forum/${post.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Gönderi oluşturulamadı.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-bdo-text-muted hover:text-bdo-text-primary text-sm">← Geri</button>
        <h1 className="text-xl font-bold text-bdo-text-primary">Yeni Gönderi</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Başlık */}
        <div>
          <label className="block text-sm text-bdo-text-muted mb-1.5">Başlık</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Gönderinin başlığı..."
            maxLength={120}
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-4 py-2.5 text-bdo-text-primary focus:border-bdo-gold focus:outline-none text-sm"
          />
        </div>

        {/* İçerik */}
        <div>
          <label className="block text-sm text-bdo-text-muted mb-1.5">İçerik</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Gönderini buraya yaz..."
            rows={10}
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-4 py-2.5 text-bdo-text-primary focus:border-bdo-gold focus:outline-none text-sm resize-y font-mono leading-relaxed"
          />
        </div>

        {/* Tag Seçimi */}
        <div>
          <label className="block text-sm text-bdo-text-muted mb-2">
            Taglar <span className="text-bdo-text-muted/60">(birden fazla seçebilirsin)</span>
          </label>

          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 space-y-4">
            {/* Kategori tagları */}
            <div>
              <p className="text-[10px] uppercase text-bdo-text-muted font-semibold tracking-wider mb-2">Kategori</p>
              <div className="flex flex-wrap gap-2">
                {categoryTags.map((tag) => {
                  const selected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
                      style={selected
                        ? { color: tag.color, borderColor: tag.color, backgroundColor: `${tag.color}25` }
                        : { color: "#6b7280", borderColor: "#374151", backgroundColor: "transparent" }
                      }
                    >
                      {selected && "✓ "}{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Class tagları */}
            <div>
              <p className="text-[10px] uppercase text-bdo-text-muted font-semibold tracking-wider mb-2">Class</p>
              <div className="flex flex-wrap gap-1.5">
                {classTags.map((tag) => {
                  const selected = selectedTags.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className="text-xs px-2.5 py-1 rounded-full border font-medium transition-all"
                      style={selected
                        ? { color: "#a78bfa", borderColor: "#7c3aed", backgroundColor: "#7c3aed25" }
                        : { color: "#6b7280", borderColor: "#374151", backgroundColor: "transparent" }
                      }
                    >
                      {selected && "✓ "}{tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {selectedTags.length > 0 && (
            <p className="text-xs text-bdo-text-muted mt-1.5">
              {selectedTags.length} tag seçildi: {tags.filter((t) => selectedTags.includes(t.id)).map((t) => t.name).join(", ")}
            </p>
          )}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2.5 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? "Gönderiliyor..." : "Gönder"}
          </button>
          <button type="button" onClick={() => router.back()} className="text-sm text-bdo-text-muted hover:text-bdo-text-primary">
            İptal
          </button>
        </div>
      </form>
    </div>
  );
}
