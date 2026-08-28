"use client";

import { useMemo, useState } from "react";
import { Search, X, Plus } from "lucide-react";
import { gradeOf } from "@/lib/bdo-text";
import { statTr, formatTotal } from "@/lib/bdo-stats";
import { ItemIcon } from "@/components/item-visuals";

/**
 * Kurulum ekranlarının ortak parçaları (kristal, eser, beceri).
 *
 * Üçü de aynı işi yapıyor: boş slotları doldur, seçilenlerin toplam
 * etkisini gör, sonucu paylaş. Ortak tutulmalarının sebebi görünüm
 * birliği değil — slot doldurma ve stat toplama mantığının tek yerde
 * kalması.
 */

export interface StatRow { stat: string; value?: number; unit?: string; op?: string }

export interface Equippable {
  id: string;
  itemId: number;
  name: string;
  grade: number;
  icon: string | null;
  subCategory: string | null;
  stats: StatRow[];
  group?: { key: number; name: string; max: number };
}

// ── Stat toplama ────────────────────────────────────────────────────────────

export interface Totals { label: string; value: number; unit: string }

/**
 * Aynı stat farklı parçalardan gelince toplanır. Yüzde ve düz değer ayrı
 * satır kalır: "Kritik Vuruş +2" ile "+%30" toplanamaz, oyunda da toplanmıyor.
 */
export function sumStats(items: Equippable[]): Totals[] {
  const acc = new Map<string, Totals>();
  for (const it of items) {
    for (const s of it.stats ?? []) {
      const unit = s.unit === "%" ? "%" : "";
      const key = `${s.stat}|${unit}`;
      const sign = s.op === "-" ? -1 : 1;
      const prev = acc.get(key);
      const value = (prev?.value ?? 0) + sign * (s.value ?? 0);
      acc.set(key, { label: statTr(s.stat), value, unit });
    }
  }
  return Array.from(acc.values())
    .filter((t) => t.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.label.localeCompare(b.label, "tr"));
}

export function StatTotals({ items, empty }: { items: Equippable[]; empty?: string }) {
  const totals = sumStats(items);
  if (totals.length === 0) {
    return <p className="text-[12.5px] px-4 py-3" style={{ color: "var(--t-faint)" }}>{empty ?? "Henüz etki yok."}</p>;
  }
  return (
    <div className="p-4 grid gap-x-6 gap-y-1.5"
         style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
      {totals.map((t) => (
        <div key={t.label + t.unit} className="flex items-baseline justify-between gap-3 text-[12.5px]">
          <span style={{ color: "var(--t-dim)" }}>{t.label}</span>
          <span className="t-num" style={{ color: t.value < 0 ? "var(--t-bad)" : "var(--t-gold)" }}>
            {formatTotal(t.value, t.unit)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Slotlar ─────────────────────────────────────────────────────────────────

export function Slot({ item, onClear, onPick, size = 56 }: {
  item: Equippable | null;
  onClear: () => void;
  onPick: () => void;
  size?: number;
}) {
  const g = item ? gradeOf(item.grade) : null;
  if (!item) {
    return (
      <button onClick={onPick} title="Seç"
              className="flex items-center justify-center rounded-[9px] transition-colors"
              style={{ width: size, height: size, border: "1px dashed var(--t-line-strong)",
                       background: "var(--t-raised)" }}>
        <Plus className="w-4 h-4" style={{ color: "var(--t-faint)" }} />
      </button>
    );
  }
  return (
    <span className="relative inline-flex group" style={{ width: size, height: size }}>
      <button onClick={onPick} title={item.name} className="w-full h-full">
        <ItemIcon item={item} size={size} />
      </button>
      <button onClick={onClear} aria-label="Kaldır"
              className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full flex items-center justify-center"
              style={{ background: "var(--t-surface)", border: `1px solid ${g!.color}66`, color: "var(--t-dim)" }}>
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── Seçici ──────────────────────────────────────────────────────────────────

/** Slota takılacak parçayı seçtiren panel. */
export function Picker({ title, items, onSelect, onClose, note }: {
  title: string;
  items: Equippable[];
  onSelect: (item: Equippable) => void;
  onClose: () => void;
  note?: (item: Equippable) => string | null;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    const filtered = needle
      ? items.filter((i) => i.name.toLocaleLowerCase("tr").includes(needle))
      : items;
    return filtered.slice(0, 300);
  }, [items, q]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center p-4 pt-[8vh]"
         style={{ background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div className="t-card w-full max-w-[520px] max-h-[76vh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
          <h3 className="text-[13.5px] font-semibold">{title}</h3>
          <button onClick={onClose} className="ml-auto" aria-label="Kapat">
            <X className="w-4 h-4" style={{ color: "var(--t-dim)" }} />
          </button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 px-3 py-2 rounded-[9px]"
               style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: "var(--t-faint)" }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ara…"
                   className="flex-1 bg-transparent outline-none text-[13px]"
                   style={{ color: "var(--t-text)" }} />
          </div>
        </div>

        <div className="overflow-y-auto p-3 flex flex-col gap-1">
          {list.length === 0 && (
            <p className="text-[12.5px] text-center py-6" style={{ color: "var(--t-faint)" }}>
              Sonuç yok.
            </p>
          )}
          {list.map((it) => {
            const g = gradeOf(it.grade);
            const extra = note?.(it);
            return (
              <button key={it.id} onClick={() => { onSelect(it); onClose(); }}
                      className="item-chip flex items-center gap-2.5 px-2 py-1.5 rounded-[9px] text-left"
                      style={{ ["--item-grade" as string]: g.color }}>
                <ItemIcon item={it} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] leading-tight truncate" style={{ color: g.color }}>
                    {it.name}
                  </span>
                  {extra && (
                    <span className="block text-[10.5px] truncate" style={{ color: "var(--t-faint)" }}>
                      {extra}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Seçimi adres çubuğunda tutar: link paylaşınca kurulum da gider. */
export function encodeSet(ids: (string | null)[]): string {
  return ids.map((id) => (id ? String(id).split(":").pop() : "")).join("-");
}

export function decodeSet(code: string | null, size: number): (number | null)[] {
  const out: (number | null)[] = Array(size).fill(null);
  if (!code) return out;
  code.split("-").slice(0, size).forEach((part, i) => {
    const n = Number(part);
    out[i] = Number.isFinite(n) && part !== "" ? n : null;
  });
  return out;
}
