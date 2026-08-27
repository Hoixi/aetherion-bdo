"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Hammer, Boxes, Package, Repeat, Copy, Layers } from "lucide-react";
import { TestShell, Card, Empty, loadJson } from "@/components/app-shell";
import { ItemIcon, ItemChip, BdoText, type ItemLinkLike } from "@/components/item-visuals";
import { gradeOf } from "@/lib/bdo-text";

/**
 * Eşya detayı.
 *
 * Asıl değer ilişkilerde: bir eşya neyden yapılır ve nerede kullanılır.
 * İkinci soru oyun içinde hiç cevaplanmıyor; burada ters tarif aramasıyla
 * (jsonb containment) geliyor.
 */

interface ItemGroup {
  key: string;
  title: string;
  hint?: string;
  items: ItemLinkLike[];
}

interface ItemDetail {
  id: string;
  itemId: number;
  name: string;
  nameEn: string | null;
  grade: number;
  icon: string | null;
  slot: string | null;
  marketCategory: string | null;
  description: string | null;
  descriptionEn: string | null;
  data: Record<string, unknown>;
  groups: ItemGroup[];
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  made: Hammer,
  used: Boxes,
  reform: Repeat,
  variants: Copy,
  canonical: Layers,
};

const groupIcon = (key: string) => GROUP_ICONS[key.split(":")[0]] ?? Package;

/** Gövdeden okunabilir künye satırları çıkarır; olmayan alan gösterilmez. */
function statsOf(d: Record<string, unknown>): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const push = (label: string, v: unknown, fmt?: (x: never) => string) => {
    if (v === undefined || v === null || v === "") return;
    out.push([label, fmt ? fmt(v as never) : String(v)]);
  };
  const tl = (n: number) => n.toLocaleString("tr-TR");

  push("Yuva", d.category);
  push("Ağırlık", d.weight, (n: number) => `${n} LT`);
  push("Max güçlendirme", d.maxEnhance);
  push("Dayanıklılık", d.maxDurability, tl);
  push("Satış", d.sellPrice, (n: number) => `${tl(n)} G`);
  push("Alış", d.buyPrice, (n: number) => `${tl(n)} G`);
  push("Onarım", d.repairPrice, tl);
  push("Pazarda", d.marketable, (b: boolean) => (b ? "Satılabilir" : "Satılamaz"));
  push("Pazar kategorisi", d.marketSubCategory);
  push("Gerekli seviye", d.requiredLevel);
  push("Yığın", d.maxStack, tl);
  return out;
}

export default function EsyaDetayPage({ params }: { params: { id: string } }) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loadJson<ItemDetail>(`/api/esyalar/${params.id}`)
      .then(setItem)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <TestShell title="Eşya"><Empty>Yükleniyor…</Empty></TestShell>;
  if (error || !item) {
    return (
      <TestShell title="Eşya">
        <Empty>{error ?? "Eşya bulunamadı."}</Empty>
      </TestShell>
    );
  }

  const g = gradeOf(item.grade);
  const stats = statsOf(item.data);
  const classes = Array.isArray(item.data.classes) ? (item.data.classes as string[]) : [];

  return (
    <TestShell title={item.name} bare>
      <Link href="/esyalar" className="inline-flex items-center gap-1.5 mb-3 text-[12.5px]"
            style={{ color: "var(--t-dim)" }}>
        <ArrowLeft className="w-3.5 h-3.5" /> Eşya veritabanı
      </Link>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        {/* ── Künye ── */}
        <Card hi className="p-5">
          <div className="flex items-start gap-4">
            <ItemIcon item={item} size={72} />
            <div className="min-w-0 flex-1">
              <h1 className="text-[19px] font-semibold leading-tight" style={{ color: g.color }}>
                {item.name}
              </h1>
              {item.nameEn && item.nameEn !== item.name && (
                <p className="text-[13px] mt-0.5" style={{ color: "var(--t-faint)" }}>{item.nameEn}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="t-chip" style={{ borderColor: `${g.color}66`, color: g.color }}>
                  {g.label}
                </span>
                {item.marketCategory && <span className="t-chip">{item.marketCategory}</span>}
                <span className="t-chip font-mono" style={{ color: "var(--t-faint)" }}>#{item.itemId}</span>
              </div>
            </div>
          </div>

          {item.description && (
            <div className="mt-4 pt-4 text-[13px]" style={{ borderTop: "1px solid var(--t-line)", color: "var(--t-dim)" }}>
              <BdoText text={item.description} />
            </div>
          )}

          {stats.length > 0 && (
            <div className="grid gap-x-6 gap-y-1.5 mt-4 pt-4"
                 style={{ borderTop: "1px solid var(--t-line)",
                          gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
              {stats.map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span style={{ color: "var(--t-faint)" }}>{label}</span>
                  <span className="t-num" style={{ color: "var(--t-text)" }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {classes.length > 0 && (
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--t-line)" }}>
              <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--t-faint)" }}>
                Sınıflar
              </span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {classes.map((c) => <span key={c} className="t-chip">{c}</span>)}
              </div>
            </div>
          )}
        </Card>

        {/* ── Bağlantılı eşyalar ── */}
        {item.groups.length === 0 ? (
          <Empty>Bu eşyanın bağlantılı olduğu başka eşya bulunamadı.</Empty>
        ) : (
          item.groups.map((group) => {
            const Icon = groupIcon(group.key);
            return (
              <Card key={group.key}>
                <div className="flex items-center gap-2 px-5 py-3.5"
                     style={{ borderBottom: "1px solid var(--t-line)" }}>
                  <Icon className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                  <h2 className="text-[13.5px] font-semibold">{group.title}</h2>
                  {group.hint && <span className="t-chip ml-auto">{group.hint}</span>}
                </div>
                <div className="p-3 grid gap-1.5"
                     style={{ gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))" }}>
                  {group.items.map((li) => <ItemChip key={group.key + li.id} item={li} />)}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </TestShell>
  );
}
