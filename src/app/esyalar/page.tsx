"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, Loader2, Sparkles, X } from "lucide-react";
import { TestShell, Card, Empty, loadJson } from "@/components/app-shell";
import { ItemIcon } from "@/components/item-visuals";
import { gradeOf } from "@/lib/bdo-text";

/**
 * Eşya veritabanı.
 *
 * Veri client'tan çıkarılıp kendi veritabanımıza yazılıyor (bkz. PAZ boru
 * hattı), bu yüzden dış siteye bağımlı değiliz ve isimler Türkçe.
 *
 * Izgara kaliteye göre renkleniyor; arama sunucuda trigram index'ten
 * karşılanıyor, o yüzden her tuşta sorgu atmak yerine kısa bir bekleme
 * yeterli.
 */

interface ItemEffect {
  statId: string;
  label: string;
  value: number;
  unit: string | null;
}

interface EffectFacet {
  statId: string;
  label: string;
  count: number;
  min: number;
  max: number;
  unit: string | null;
  featured: boolean;
}

interface ItemSummary {
  id: string;
  itemId: number;
  name: string;
  nameEn: string | null;
  grade: number;
  icon: string | null;
  slot: string | null;
  marketCategory: string | null;
  effects?: ItemEffect[];
}

interface Facets {
  marketCategories: { value: string; count: number }[];
  slots: { value: string; count: number }[];
}

interface SearchResponse {
  total: number;
  items: ItemSummary[];
  facets: Facets | null;
  effectFacets: EffectFacet[] | null;
}

const PAGE = 60;
const GRADES = [0, 1, 2, 3, 4];

export default function EsyalarPage() {
  const [q, setQ] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [kategori, setKategori] = useState<string>("");
  /** Kanonik statId — "monsterAp" gibi; bos ise etki suzgeci kapali */
  const [etki, setEtki] = useState<string>("");
  const [etkiMin, setEtkiMin] = useState<string>("");
  const [tumEtkiler, setTumEtkiler] = useState(false);

  const [items, setItems] = useState<ItemSummary[]>([]);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [etkiler, setEtkiler] = useState<EffectFacet[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Yazarken her tuşta sorgu atmamak için kısa bekleme.
  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (grade !== null) p.set("grade", String(grade));
    if (kategori) p.set("kategori", kategori);
    if (etki) {
      p.set("etki", etki);
      if (etkiMin.trim() !== "") p.set("etkiMin", etkiMin.trim());
    }
    p.set("limit", String(PAGE));
    return p;
  }, [debouncedQ, grade, kategori, etki, etkiMin]);

  // Yarışan isteklerde son sorgunun kazanması için sıra numarası.
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    loadJson<SearchResponse>(`/api/esyalar?${query}`)
      .then((r) => {
        if (mine !== seq.current) return;
        setItems(r.items);
        setTotal(r.total);
        if (r.facets) setFacets(r.facets);
        if (r.effectFacets) setEtkiler(r.effectFacets);
      })
      .catch((e) => mine === seq.current && setError(e.message))
      .finally(() => mine === seq.current && setLoading(false));
  }, [query]);

  const loadMore = useCallback(() => {
    setMore(true);
    const p = new URLSearchParams(query);
    p.set("offset", String(items.length));
    loadJson<SearchResponse>(`/api/esyalar?${p}`)
      .then((r) => setItems((prev) => [...prev, ...r.items]))
      .catch((e) => setError(e.message))
      .finally(() => setMore(false));
  }, [query, items.length]);

  const active = grade !== null || !!kategori || !!debouncedQ || !!etki;
  const secili = etkiler.find((e) => e.statId === etki) ?? null;

  return (
    <TestShell
      title="Eşya Veritabanı"
      subtitle={
        <>
          Oyun dosyalarından çıkarılmış {total > 0 ? total.toLocaleString("tr-TR") : ""} eşya
          {" "}— Türkçe ve İngilizce adlarıyla
        </>
      }
    >
      {/* ── Arama ve filtreler ── */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 px-3 py-2 rounded-[9px]"
             style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--t-faint)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Eşya ara — Kzarka, Kara Taş, Saf…"
            className="flex-1 bg-transparent outline-none text-[13.5px]"
            style={{ color: "var(--t-text)" }}
          />
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--t-faint)" }} />}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <button className="t-chip" data-on={grade === null}
                  onClick={() => setGrade(null)}
                  style={grade === null ? { borderColor: "var(--t-gold)", color: "var(--t-gold)" } : undefined}>
            Tüm kaliteler
          </button>
          {GRADES.map((g) => {
            const info = gradeOf(g);
            const on = grade === g;
            return (
              <button key={g} className="t-chip" onClick={() => setGrade(on ? null : g)}
                      style={{ borderColor: on ? info.color : undefined, color: on ? info.color : undefined }}>
                <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                      style={{ background: info.color }} />
                {info.label}
              </button>
            );
          })}

          {facets && facets.marketCategories.length > 0 && (
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="t-chip ml-auto cursor-pointer"
              style={{ background: "var(--t-raised)", color: kategori ? "var(--t-gold)" : undefined }}
            >
              <option value="">Tüm kategoriler</option>
              {facets.marketCategories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.value} ({c.count.toLocaleString("tr-TR")})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── Etkiye göre ── */}
        {etkiler.length > 0 && (
          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--t-line)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
              <span className="text-[11px] uppercase tracking-[0.08em]"
                    style={{ color: "var(--t-faint)" }}>
                Özelliğe göre
              </span>
              {etki && (
                <button className="t-chip ml-auto" onClick={() => { setEtki(""); setEtkiMin(""); }}>
                  <X className="w-3 h-3" strokeWidth={2.4} /> Temizle
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(tumEtkiler ? etkiler : etkiler.filter((e) => e.featured)).map((e) => {
                const on = etki === e.statId;
                return (
                  <button key={e.statId} className="t-chip"
                          onClick={() => { setEtki(on ? "" : e.statId); setEtkiMin(""); }}
                          style={on ? { borderColor: "var(--t-gold)", color: "var(--t-gold)" } : undefined}>
                    {e.label}
                    <span className="ml-1.5" style={{ color: "var(--t-faint)" }}>{e.count}</span>
                  </button>
                );
              })}
              <button className="t-chip" onClick={() => setTumEtkiler((v) => !v)}
                      style={{ color: "var(--t-dim)" }}>
                {tumEtkiler ? "Daha az" : `Tümü (${etkiler.length})`}
              </button>
            </div>

            {/* Esik: yalnizca bir etki secilince anlamli */}
            {secili && (
              <div className="flex items-center gap-2.5 mt-2.5">
                <span className="text-[12px]" style={{ color: "var(--t-dim)" }}>
                  En az
                </span>
                <input type="number" value={etkiMin} onChange={(e) => setEtkiMin(e.target.value)}
                       placeholder={String(secili.min)}
                       className="w-[86px] h-[30px] px-2 rounded-[var(--t-r-sm)] text-[12.5px] outline-none t-num"
                       style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                color: "var(--t-text)" }} />
                <span className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                  {secili.label} · veride {secili.min}–{secili.max}
                  {secili.unit === "%" ? " (%)" : secili.unit ? ` ${secili.unit}` : ""}
                </span>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Sonuçlar ── */}
      {error ? (
        <Empty>{error}</Empty>
      ) : loading && items.length === 0 ? (
        <Empty>Aranıyor…</Empty>
      ) : items.length === 0 ? (
        <Empty>{active ? "Bu filtrelerle eşya bulunamadı." : "Eşya yok."}</Empty>
      ) : (
        <>
          <div className="grid gap-2"
               style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
            {items.map((it) => {
              const g = gradeOf(it.grade);
              return (
                <Link key={it.id} href={`/esyalar/${it.itemId}`} className="t-card p-2.5 flex items-start gap-2.5">
                  <ItemIcon item={it} size={42} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-tight truncate" style={{ color: g.color }}>
                      {it.name}
                    </span>
                    {it.nameEn && it.nameEn !== it.name && (
                      <span className="block text-[11px] truncate" style={{ color: "var(--t-faint)" }}>
                        {it.nameEn}
                      </span>
                    )}
                    {it.marketCategory && (
                      <span className="block text-[10.5px] truncate mt-0.5" style={{ color: "var(--t-dim)" }}>
                        {it.marketCategory}
                      </span>
                    )}
                    {/* Neden eslesti: suzulen stat basta ve altin renkte */}
                    {it.effects && it.effects.length > 0 && (
                      <span className="flex flex-wrap gap-1 mt-1.5">
                        {it.effects.slice(0, 3).map((e) => {
                          const vurgu = e.statId === etki;
                          return (
                            <span key={e.statId}
                                  className="inline-block px-1.5 py-0.5 rounded text-[10px] leading-tight"
                                  style={{
                                    background: vurgu ? "rgba(232,180,81,.12)" : "var(--t-raised)",
                                    border: `1px solid ${vurgu ? "rgba(232,180,81,.38)" : "var(--t-line)"}`,
                                    color: vurgu ? "var(--t-gold)" : "var(--t-faint)",
                                  }}>
                              {e.label} {e.unit === "%" ? `+%${e.value}` : `+${e.value}`}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>

          {items.length < total && (
            <div className="flex justify-center mt-4">
              <button onClick={loadMore} disabled={more} className="t-chip px-4 py-2">
                {more ? "Yükleniyor…" : `Daha fazla (${(total - items.length).toLocaleString("tr-TR")} kaldı)`}
              </button>
            </div>
          )}
        </>
      )}
    </TestShell>
  );
}
