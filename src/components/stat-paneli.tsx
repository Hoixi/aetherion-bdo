"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { sumStats, type Equippable } from "@/components/loadout";
import { formatTotal } from "@/lib/bdo-stats";
import { statGrubu, STAT_GRUPLARI } from "@/lib/stat-gruplari";

/**
 * Toplam etki paneli — oyundaki karakter ekranı gibi başlıklara ayrılmış,
 * arama kutulu. Kurulum ekranlarının sağ sütununda duruyor.
 */
export function StatPaneli({ items, ekstra, baslik = "İstatistikler" }: {
  items: Equippable[];
  /** Dışarıdan gelen ek satırlar (ör. ışık taşı kombinasyonları) */
  ekstra?: Array<{ label: string; value: number; unit: string }>;
  baslik?: string;
}) {
  const [q, setQ] = useState("");

  const gruplar = useMemo(() => {
    const hepsi = [...sumStats(items), ...(ekstra ?? [])];
    const needle = q.trim().toLocaleLowerCase("tr");
    const suzulmus = needle ? hepsi.filter((t) => t.label.toLocaleLowerCase("tr").includes(needle)) : hepsi;
    const map = new Map<string, Array<{ label: string; value: number; unit: string; sira: number }>>();
    for (const t of suzulmus) {
      const g = statGrubu(t.label);
      const liste = map.get(g.ad) ?? [];
      liste.push({ ...t, sira: g.sira });
      map.set(g.ad, liste);
    }
    const sira = [...STAT_GRUPLARI.map((g) => g.ad), "Diğer"];
    return sira
      .filter((ad) => map.has(ad))
      .map((ad) => ({ ad, satirlar: map.get(ad)!.sort((a, b) => a.sira - b.sira || a.label.localeCompare(b.label, "tr")) }));
  }, [items, ekstra, q]);

  return (
    <div className="flex flex-col min-h-0 h-full rounded-xl overflow-hidden"
         style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
      <div className="px-3 py-2.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
             style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
          <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--t-faint)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${baslik} ara`}
                 className="flex-1 bg-transparent outline-none text-[12.5px]" style={{ color: "var(--t-text)" }} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {gruplar.length === 0 && (
          <p className="text-[12.5px] px-4 py-6 text-center" style={{ color: "var(--t-faint)" }}>
            {q ? "Aramaya uyan istatistik yok." : "Yuvalara parça koy, etkiler burada toplansın."}
          </p>
        )}
        {gruplar.map((g) => (
          <div key={g.ad}>
            <div className="px-3 py-1.5 text-[11px] font-semibold sticky top-0"
                 style={{ background: "var(--t-raised)", color: "var(--t-dim)", borderBottom: "1px solid var(--t-line)" }}>
              {g.ad}
            </div>
            {g.satirlar.map((t) => (
              <div key={t.label + t.unit} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-[12.5px]"
                   style={{ borderBottom: "1px solid var(--t-line)" }}>
                <span style={{ color: "var(--t-dim)" }}>{t.label}</span>
                <span className="t-num font-semibold" style={{ color: t.value < 0 ? "var(--t-bad)" : "var(--t-text)" }}>
                  {formatTotal(t.value, t.unit)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
