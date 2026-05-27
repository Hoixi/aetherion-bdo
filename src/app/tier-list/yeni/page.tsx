"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const TAGS = [
  { key: "PVE", label: "PvE", color: "#22c55e" },
  { key: "NODE_WAR", label: "Node War", color: "#f97316" },
  { key: "ONE_V_ONE", label: "1v1", color: "#ef4444" },
  { key: "ONE_V_X", label: "1vX", color: "#a855f7" },
  { key: "AOS", label: "AoS", color: "#3b82f6" },
];

const DEFAULT_TIERS = [
  { name: "S", color: "#ef4444" },
  { name: "A", color: "#f97316" },
  { name: "B", color: "#eab308" },
  { name: "C", color: "#22c55e" },
  { name: "D", color: "#3b82f6" },
];

export default function NewTierListPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [tiers, setTiers] = useState(DEFAULT_TIERS.map((t, i) => ({ ...t, order: i })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  if (!session) return (
    <div className="text-center py-16 text-bdo-text-muted text-sm">Giriş yapman gerekiyor.</div>
  );

  function toggleTag(key: string) {
    setSelectedTags((prev) => prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]);
  }

  function updateTier(i: number, field: "name" | "color", value: string) {
    setTiers((prev) => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  }

  function addTier() {
    setTiers((prev) => [...prev, { name: "?", color: "#6b7280", order: prev.length }]);
  }

  function removeTier(i: number) {
    setTiers((prev) => prev.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, order: idx })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Başlık zorunlu.");
    if (tiers.length < 2) return setError("En az 2 tier gerekli.");
    setSaving(true);
    setError(null);

    const res = await fetch("/api/tier-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        tags: selectedTags,
        isVoting,
        customTiers: tiers,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/tier-list/${data.id}`);
    } else {
      const data = await res.json();
      setError(data.error ?? "Oluşturulamadı.");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-bdo-text-muted hover:text-bdo-text-primary text-sm">← Geri</button>
        <h1 className="text-xl font-bold text-bdo-text-primary">Yeni Tier List</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Başlık */}
        <div>
          <label className="block text-sm text-bdo-text-muted mb-1.5">Başlık</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="örn: Node War Class Tier List"
            maxLength={100}
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-4 py-2.5 text-bdo-text-primary focus:border-bdo-gold focus:outline-none text-sm"
          />
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-sm text-bdo-text-muted mb-1.5">Açıklama <span className="text-bdo-text-muted/50">(isteğe bağlı)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Bu tier list hakkında kısa bir açıklama..."
            rows={2}
            className="w-full bg-bdo-surface border border-bdo-border rounded-lg px-4 py-2.5 text-bdo-text-primary focus:border-bdo-gold focus:outline-none text-sm resize-none"
          />
        </div>

        {/* Taglar */}
        <div>
          <label className="block text-sm text-bdo-text-muted mb-2">Taglar</label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => {
              const sel = selectedTags.includes(tag.key);
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => toggleTag(tag.key)}
                  className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all"
                  style={sel
                    ? { color: tag.color, borderColor: tag.color, backgroundColor: `${tag.color}25` }
                    : { color: "#6b7280", borderColor: "#374151" }
                  }
                >
                  {sel && "✓ "}{tag.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier Düzeni */}
        <div>
          <label className="block text-sm text-bdo-text-muted mb-2">Tierler</label>
          <div className="space-y-2">
            {tiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="color"
                  value={tier.color}
                  onChange={(e) => updateTier(i, "color", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-bdo-border bg-transparent"
                />
                <input
                  type="text"
                  value={tier.name}
                  onChange={(e) => updateTier(i, "name", e.target.value)}
                  maxLength={8}
                  className="flex-1 bg-bdo-surface border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none text-sm font-bold"
                  style={{ color: tier.color }}
                />
                {tiers.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeTier(i)}
                    className="text-bdo-text-muted hover:text-red-400 text-sm px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          {tiers.length < 8 && (
            <button
              type="button"
              onClick={addTier}
              className="mt-2 text-sm text-bdo-text-muted hover:text-bdo-gold transition-colors"
            >
              + Tier ekle
            </button>
          )}
        </div>

        {/* Oylamalı mı? */}
        {isAdmin && (
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setIsVoting((v) => !v)}
                className={`relative w-10 h-6 rounded-full transition-colors ${isVoting ? "bg-bdo-sapphire" : "bg-bdo-border"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${isVoting ? "translate-x-5" : "translate-x-1"}`} />
              </div>
              <div>
                <p className="text-sm text-bdo-text-primary">Oylamalı Tier List</p>
                <p className="text-xs text-bdo-text-muted">Her üye kendi tier sıralamasını yapabilir</p>
              </div>
            </label>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2.5 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? "Oluşturuluyor..." : "Oluştur"}
          </button>
          <button type="button" onClick={() => router.back()} className="text-sm text-bdo-text-muted hover:text-bdo-text-primary">
            İptal
          </button>
        </div>
      </form>
    </div>
  );
}
