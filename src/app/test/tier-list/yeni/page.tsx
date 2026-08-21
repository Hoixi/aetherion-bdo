"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Check, Plus, X, ListOrdered } from "lucide-react";
import { TestShell, Card, Empty } from "@/components/test-shell";

/**
 * Yeni tier list.
 *
 * Tier adları ve renkleri serbest — herkes S/A/B kullanmıyor, bazı
 * listeler "Meta / Oynanır / Uzak dur" gibi ayrılıyor.
 */

const TAGS = [
  { key: "PVE", label: "PvE", color: "#2bca6e" },
  { key: "NODE_WAR", label: "Node War", color: "#f0994c" },
  { key: "ONE_V_ONE", label: "1v1", color: "#ef5f5f" },
  { key: "ONE_V_X", label: "1vX", color: "#a855f7" },
  { key: "AOS", label: "AoS", color: "#6b93ff" },
];

const DEFAULT_TIERS = [
  { name: "S", color: "#ef4444" },
  { name: "A", color: "#f97316" },
  { name: "B", color: "#eab308" },
  { name: "C", color: "#22c55e" },
  { name: "D", color: "#3b82f6" },
];

const MAX_TIERS = 8;

export default function YeniTierListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isVoting, setIsVoting] = useState(false);
  const [tiers, setTiers] = useState(DEFAULT_TIERS.map((t, i) => ({ ...t, order: i })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !!session?.user?.isAdmin;

  function toggleTag(key: string) {
    setTags((prev) => (prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]));
  }

  function updateTier(i: number, field: "name" | "color", value: string) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: value } : t)));
  }

  function removeTier(i: number) {
    // Sıra numaraları veritabanına gidiyor; silmede yeniden numaralanmalı
    setTiers((prev) => prev.filter((_, idx) => idx !== i).map((t, idx) => ({ ...t, order: idx })));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Başlık zorunlu.");
    if (tiers.length < 2) return setError("En az 2 tier gerekli.");

    setSaving(true);
    setError(null);
    const res = await fetch("/api/tier-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, tags, isVoting, customTiers: tiers }),
    });

    if (res.ok) {
      const data = await res.json();
      router.push(`/test/tier-list/${data.id}`);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "Oluşturulamadı.");
    setSaving(false);
  }

  if (status === "unauthenticated") {
    return (
      <TestShell title="Yeni Tier List" subtitle="Giriş gerekiyor">
        <Empty>Tier list açmak için giriş yapman gerekiyor.</Empty>
      </TestShell>
    );
  }

  return (
    <TestShell bare title="Yeni Tier List">
      <div className="max-w-2xl mx-auto space-y-5 pb-8">
        <Link href="/test/tier-list"
              className="inline-flex items-center gap-1 text-[12px] transition-colors hover:opacity-80"
              style={{ color: "var(--t-dim)" }}>
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.2} /> Tier listelere dön
        </Link>

        <h1 className="text-[26px] font-bold tracking-tight leading-none">Yeni Tier List</h1>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <Label>Başlık</Label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
                   placeholder="örn. Node War Class Tier List"
                   className="w-full h-[42px] px-4 rounded-[var(--t-r-sm)] text-[14px] outline-none"
                   style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)",
                            color: "var(--t-text)" }} />
          </div>

          <div>
            <Label>Açıklama <span className="normal-case opacity-60">(isteğe bağlı)</span></Label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                      placeholder="Bu tier list hakkında kısa bir açıklama…"
                      className="w-full px-4 py-2.5 rounded-[var(--t-r-sm)] text-[13.5px] outline-none resize-none"
                      style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)",
                               color: "var(--t-text)" }} />
          </div>

          <div>
            <Label>Taglar</Label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((tag) => {
                const on = tags.includes(tag.key);
                return (
                  <button key={tag.key} type="button" onClick={() => toggleTag(tag.key)}
                          className="inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full font-medium transition-colors"
                          style={on
                            ? { color: tag.color, background: tag.color + "22", border: `1px solid ${tag.color}` }
                            : { color: "var(--t-faint)", border: "1px solid var(--t-line-strong)" }}>
                    {on && <Check className="w-3 h-3" strokeWidth={2.6} />}
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Tierler</Label>
            <Card className="p-3 space-y-2">
              {tiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="color" value={tier.color} aria-label="Tier rengi"
                         onChange={(e) => updateTier(i, "color", e.target.value)}
                         className="w-8 h-8 rounded cursor-pointer bg-transparent"
                         style={{ border: "1px solid var(--t-line)" }} />
                  <input value={tier.name} maxLength={8}
                         onChange={(e) => updateTier(i, "name", e.target.value)}
                         className="flex-1 h-[34px] px-3 rounded-[var(--t-r-sm)] text-[13px] font-bold outline-none"
                         style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                  color: tier.color }} />
                  {tiers.length > 2 && (
                    <button type="button" onClick={() => removeTier(i)} aria-label="Tier'i sil"
                            className="px-2" style={{ color: "var(--t-faint)" }}>
                      <X className="w-3.5 h-3.5" strokeWidth={2.4} />
                    </button>
                  )}
                </div>
              ))}

              {tiers.length < MAX_TIERS && (
                <button type="button"
                        onClick={() => setTiers((prev) => [...prev, { name: "?", color: "#7a8ba3", order: prev.length }])}
                        className="text-[12px] inline-flex items-center gap-1.5 transition-colors hover:opacity-80"
                        style={{ color: "var(--t-gold)" }}>
                  <Plus className="w-3.5 h-3.5" strokeWidth={2.2} /> Tier ekle
                </button>
              )}
            </Card>
          </div>

          {isAdmin && (
            <Card className="p-3.5">
              <button type="button" onClick={() => setIsVoting((v) => !v)}
                      className="flex items-center gap-3 text-left w-full">
                <span className="relative w-10 h-6 rounded-full flex-shrink-0 transition-colors"
                      style={{ background: isVoting ? "var(--t-gold)" : "var(--t-line-strong)" }}>
                  <span className="absolute top-1 w-4 h-4 rounded-full transition-transform"
                        style={{ background: "#fff", transform: `translateX(${isVoting ? 20 : 4}px)` }} />
                </span>
                <span>
                  <span className="block text-[13px] font-medium">Oylamalı tier list</span>
                  <span className="block text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                    Her üye kendi sıralamasını yapar, sonuç ortalamadan çıkar.
                  </span>
                </span>
              </button>
            </Card>
          )}

          {error && <p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={saving}
                    className="inline-flex items-center gap-2 font-semibold px-5 h-[38px] rounded-[var(--t-r-sm)] text-[13px] disabled:opacity-50"
                    style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
              <ListOrdered className="w-3.5 h-3.5" strokeWidth={2} />
              {saving ? "Oluşturuluyor…" : "Oluştur"}
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

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[11px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--t-faint)" }}>
      {children}
    </label>
  );
}
