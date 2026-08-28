"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Gem, Sparkles, X, Link2 } from "lucide-react";
import { ItemIcon } from "@/components/item-visuals";
import { sumStats, type Equippable, type StatRow } from "@/components/loadout";
import { formatTotal } from "@/lib/bdo-stats";

/**
 * Kristal / eser kurulumunu foruma gömme.
 *
 * Kurulum ekranları seçimi adres çubuğunda tutuyor, yani bir kurulum zaten
 * tek bir linkle ifade ediliyor. Buradaki düğüm o linki saklıyor; gönderi
 * basıldığında kart olarak canlandırılıyor. Kurulumun kendisi kopyalanmıyor —
 * link neyse kart odur, ikisi ayrışamaz.
 */

export type LoadoutKind = "kristal" | "eser";

export interface LoadoutAttrs {
  kind: LoadoutKind;
  code: string;   // kristal: "1-2-3", eser: "e1,e2|t1,t2,t3"
  label: string;
}

// ── TipTap düğümü ───────────────────────────────────────────────────────────

export const LoadoutRefNode = Node.create({
  name: "loadoutRef",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    // itemRef'teki ile aynı sebep: yazma işi tamamen renderHTML'e ait,
    // yoksa TipTap öznitelikleri bir de kendisi basıyor.
    const sessiz = { renderHTML: () => null };
    return {
      kind: { default: "kristal", ...sessiz },
      code: { default: "", ...sessiz },
      label: { default: "", ...sessiz },
    };
  },

  parseHTML() {
    return [{
      tag: "div[data-loadout]",
      getAttrs: (el) => {
        const e = el as HTMLElement;
        return {
          kind: (e.getAttribute("data-loadout") ?? "kristal") as LoadoutKind,
          code: e.getAttribute("data-code") ?? "",
          label: e.getAttribute("data-label") ?? "",
        };
      },
    }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { kind, code, label } = node.attrs as LoadoutAttrs;
    // JavaScript çalışmazsa (ya da kart yüklenmeden önce) gönderi yine de
    // okunur kalsın diye içeriye linkin kendisi yazılıyor.
    const href = kind === "kristal" ? `/kristaller?k=${code}` : `/eserler?${code}`;
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-loadout": kind,
        "data-code": code,
        ...(label ? { "data-label": label } : {}),
        class: "loadout-ref",
      }),
      ["a", { href }, label || (kind === "kristal" ? "Kristal kurulumu" : "Eser kurulumu")],
    ];
  },
});

// ── Kart ────────────────────────────────────────────────────────────────────

interface Combo { id: string; name: string; required: string[]; stats: StatRow[] }

/** Bir kez çekilip tüm kartlarca paylaşılan veri. */
let kristalCache: Promise<Equippable[]> | null = null;
let eserCache: Promise<EserPayload> | null = null;

const getKristal = () => (kristalCache ??= fetch("/api/kurulum?ne=kristal")
  .then((r) => (r.ok ? r.json() : { crystals: [] })).then((d) => d.crystals ?? []));

interface EserPayload {
  artifacts: Equippable[]; lightstones: Equippable[];
  combos: Combo[]; aliases: Record<string, string>;
}

const getEser = () => (eserCache ??= fetch("/api/kurulum?ne=eser")
  .then((r) => (r.ok ? r.json() : {}) as Promise<Partial<EserPayload>>)
  .then((d): EserPayload => ({
    artifacts: d.artifacts ?? [],
    lightstones: d.lightstones ?? [],
    combos: d.combos ?? [],
    aliases: d.aliases ?? {},
  })));

const idsFrom = (code: string) =>
  code.split("-").map(Number).filter((n) => Number.isFinite(n) && n > 0);

const SLOT_COUNTS = { kristal: 16, eser: { artifact: 2, stone: 4 } } as const;

/** Tooltip'in yakalayabilmesi için parça oyun içi rozet nitelikleriyle sarılıyor. */
function CardSlot({ item, size = 34 }: { item: Equippable | null; size?: number }) {
  if (!item) {
    return <span className="loadout-slot loadout-slot-empty" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="loadout-slot"
      style={{ width: size, height: size }}
      // Forumdaki eşya tooltip'i bu nitelikleri arıyor; karttaki parçalar da
      // aynı kutuyu açsın diye burada da veriliyor.
      data-item={item.id}
      data-name={item.name}
      data-grade={String(item.grade)}
      {...(item.icon ? { "data-icon": item.icon } : {})}
    >
      <ItemIcon item={item} size={size} />
    </span>
  );
}

/** Boş yuvaları da çizecek şekilde sabit uzunluğa getirir. */
const pad = <T,>(arr: T[], n: number): (T | null)[] =>
  Array.from({ length: n }, (_, i) => arr[i] ?? null);

function LoadoutCard({ kind, code, label }: LoadoutAttrs) {
  const [crystals, setCrystals] = useState<Equippable[] | null>(null);
  const [eser, setEser] = useState<EserPayload | null>(null);

  useEffect(() => {
    if (kind === "kristal") getKristal().then(setCrystals).catch(() => setCrystals([]));
    else getEser().then(setEser).catch(() => setEser(null));
  }, [kind]);

  const href = kind === "kristal" ? `/kristaller?k=${code}` : `/eserler?${code}`;

  const { crystalSlots, artifactSlots, stoneSlots, combos, items } = useMemo(() => {
    const bos = {
      crystalSlots: [] as (Equippable | null)[],
      artifactSlots: [] as (Equippable | null)[],
      stoneSlots: [] as (Equippable | null)[],
      combos: [] as Combo[],
      items: [] as Equippable[],
    };

    if (kind === "kristal") {
      if (!crystals) return bos;
      const by = new Map(crystals.map((c) => [c.itemId, c]));
      const chosen = idsFrom(code).map((id) => by.get(id)).filter(Boolean) as Equippable[];
      return { ...bos, crystalSlots: pad(chosen, SLOT_COUNTS.kristal), items: chosen };
    }

    if (!eser) return bos;
    const qs = new URLSearchParams(code);
    const by = new Map([...eser.artifacts, ...eser.lightstones].map((i) => [i.itemId, i]));
    const arts = idsFrom(qs.get("e") ?? "").map((id) => by.get(id)).filter(Boolean) as Equippable[];
    const stones = idsFrom(qs.get("t") ?? "").map((id) => by.get(id)).filter(Boolean) as Equippable[];
    // Güçlendirilmiş taş temel taşın yerine sayılıyor — kurulum ekranıyla aynı
    // çözümleme, yoksa kart ile ekran farklı sonuç gösterir.
    const have = new Set(stones.map((s) => eser.aliases[s.id] ?? s.id));
    return {
      ...bos,
      artifactSlots: pad(arts, SLOT_COUNTS.eser.artifact),
      stoneSlots: pad(stones, SLOT_COUNTS.eser.stone),
      combos: eser.combos.filter((c) => c.required.every((u) => have.has(u))),
      items: [...arts, ...stones],
    };
  }, [kind, code, crystals, eser]);

  const totals = useMemo(
    () => (kind === "eser"
      // Taşların çoğunun kombinasyondan bağımsız kendi stat'ı da var.
      ? sumStats([
          ...combos.map((c) => ({
            id: c.id, itemId: 0, name: c.name, grade: 0,
            icon: null, subCategory: null, stats: c.stats })),
          ...items,
        ])
      : sumStats(items)),
    [kind, items, combos]);

  const loading = kind === "kristal" ? crystals === null : eser === null;

  return (
    <LoadoutCardView
      kind={kind} label={label} href={href} loading={loading}
      crystalSlots={crystalSlots} artifactSlots={artifactSlots}
      stoneSlots={stoneSlots} combos={combos} totals={totals} filled={items.length}
    />
  );
}

/**
 * Kartın görünümü — veri çekmeden, verilen parçalarla çiziyor.
 * Ayrı durmasının sebebi: kart bir tasarım işi ve veritabanı olmadan da
 * gözden geçirilebilmesi gerekiyor.
 */
export function LoadoutCardView({
  kind, label, href, loading, crystalSlots, artifactSlots, stoneSlots, combos, totals, filled,
}: {
  kind: LoadoutKind;
  label: string;
  href: string;
  loading: boolean;
  crystalSlots: (Equippable | null)[];
  artifactSlots: (Equippable | null)[];
  stoneSlots: (Equippable | null)[];
  combos: Combo[];
  totals: ReturnType<typeof sumStats>;
  filled: number;
}) {
  const Icon = kind === "kristal" ? Gem : Sparkles;
  const dolu = filled;
  const toplam = kind === "kristal"
    ? SLOT_COUNTS.kristal
    : SLOT_COUNTS.eser.artifact + SLOT_COUNTS.eser.stone;

  return (
    <div className="loadout-card">
      <div className="loadout-card-head">
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--t-gold)" }} />
        <span className="loadout-card-title">
          {label || (kind === "kristal" ? "Kristal kurulumu" : "Eser kurulumu")}
        </span>
        <span className="loadout-count">{dolu}/{toplam}</span>
        <a href={href} className="loadout-open">
          <Link2 className="w-3 h-3" /> Aç
        </a>
      </div>

      {loading ? (
        <div className="loadout-card-body">
          <span className="loadout-hint">Yükleniyor…</span>
        </div>
      ) : dolu === 0 ? (
        <div className="loadout-card-body">
          <span className="loadout-hint">Bu kurulumda parça yok.</span>
        </div>
      ) : (
        <div className="loadout-card-body">
          {kind === "kristal" ? (
            <div className="loadout-grid">
              {crystalSlots.map((c, i) => <CardSlot key={i} item={c} />)}
            </div>
          ) : (
            <div className="loadout-rows">
              <div className="loadout-row">
                <span className="loadout-row-label">Eser</span>
                <div className="loadout-row-slots">
                  {artifactSlots.map((a, i) => <CardSlot key={i} item={a} size={40} />)}
                </div>
              </div>
              <div className="loadout-row">
                <span className="loadout-row-label">Işık Taşı</span>
                <div className="loadout-row-slots">
                  {stoneSlots.map((s, i) => <CardSlot key={i} item={s} size={40} />)}
                </div>
              </div>
            </div>
          )}

          {combos.length > 0 && (
            <div className="loadout-combos">
              {combos.map((c) => (
                <span key={c.id} className="loadout-combo">{c.name}</span>
              ))}
            </div>
          )}

          {totals.length > 0 && (
            <div className="loadout-stats">
              {totals.slice(0, 10).map((t) => (
                <span key={t.label + t.unit} className="loadout-stat">
                  <span className="loadout-stat-label">{t.label}</span>
                  <span className="loadout-stat-value"
                        style={t.value < 0 ? { color: "var(--t-bad)" } : undefined}>
                    {formatTotal(t.value, t.unit)}
                  </span>
                </span>
              ))}
              {totals.length > 10 && (
                <span className="loadout-stat loadout-stat-more">
                  +{totals.length - 10} etki daha
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Gönderi gövdesindeki kurulum yer tutucularını karta çevirir.
 * Gövde `dangerouslySetInnerHTML` ile basıldığı için bileşen doğrudan
 * bağlanamıyor; her yer tutucuya portal açılıyor.
 */
export function useLoadoutEmbeds<T extends HTMLElement = HTMLDivElement>(html: string) {
  const kap = useRef<T>(null);
  const [nodes, setNodes] = useState<Array<{ el: HTMLElement; attrs: LoadoutAttrs }>>([]);

  useEffect(() => {
    const root = kap.current;
    if (!root) return;
    const found = Array.from(root.querySelectorAll<HTMLElement>("[data-loadout]")).map((el) => {
      el.innerHTML = "";     // yedek link yerini karta bırakıyor
      return {
        el,
        attrs: {
          kind: (el.getAttribute("data-loadout") ?? "kristal") as LoadoutKind,
          code: el.getAttribute("data-code") ?? "",
          label: el.getAttribute("data-label") ?? "",
        },
      };
    });
    setNodes(found);
  }, [html]);

  const portals = nodes.map(({ el, attrs }, i) =>
    createPortal(<LoadoutCard {...attrs} />, el, `loadout-${i}`));

  return { ref: kap, portals };
}

// ── Ekleme penceresi ────────────────────────────────────────────────────────

/** Kurulum ekranından kopyalanan linki düğüme çevirir. */
export function parseLoadoutUrl(input: string): LoadoutAttrs | null {
  let path: string, query: string;
  try {
    const u = new URL(input, window.location.origin);
    path = u.pathname;
    query = u.search.replace(/^\?/, "");
  } catch {
    return null;
  }
  if (path.endsWith("/kristaller")) {
    const code = new URLSearchParams(query).get("k") ?? "";
    return code ? { kind: "kristal", code, label: "" } : null;
  }
  if (path.endsWith("/eserler")) {
    const qs = new URLSearchParams(query);
    if (!qs.get("e") && !qs.get("t")) return null;
    return { kind: "eser", code: qs.toString(), label: "" };
  }
  return null;
}

export function LoadoutPicker({ onClose, onPick }: {
  onClose: () => void;
  onPick: (attrs: LoadoutAttrs) => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const parsed = useMemo(() => (url.trim() ? parseLoadoutUrl(url.trim()) : null), [url]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center p-4 pt-[12vh]"
         style={{ background: "rgba(0,0,0,.6)" }} onClick={onClose}>
      <div className="t-card w-full max-w-[460px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
          <h3 className="text-[13.5px] font-semibold">Kurulum ekle</h3>
          <button onClick={onClose} className="ml-auto" aria-label="Kapat">
            <X className="w-4 h-4" style={{ color: "var(--t-dim)" }} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          <p className="text-[12px]" style={{ color: "var(--t-faint)" }}>
            Kristal ya da Eser ekranında kurulumu hazırla, <b>Linki kopyala</b> de,
            sonra buraya yapıştır.
          </p>

          <input value={url} onChange={(e) => setUrl(e.target.value)} autoFocus
                 placeholder="https://…/kristaller?k=…"
                 className="px-3 py-2 rounded-[9px] bg-transparent outline-none text-[13px]"
                 style={{ border: "1px solid var(--t-line)", color: "var(--t-text)" }} />

          <input value={label} onChange={(e) => setLabel(e.target.value)}
                 placeholder="Başlık (isteğe bağlı) — örn. Node War kristalleri"
                 className="px-3 py-2 rounded-[9px] bg-transparent outline-none text-[13px]"
                 style={{ border: "1px solid var(--t-line)", color: "var(--t-text)" }} />

          {url.trim() && !parsed && (
            <p className="text-[12px]" style={{ color: "var(--t-bad)" }}>
              Bu link tanınmadı. /kristaller ya da /eserler linki olmalı.
            </p>
          )}

          <button disabled={!parsed}
                  onClick={() => parsed && onPick({ ...parsed, label: label.trim() })}
                  className="t-chip px-4 py-2 self-end"
                  style={parsed ? { borderColor: "var(--t-gold)", color: "var(--t-gold)" } : { opacity: 0.5 }}>
            Ekle
          </button>
        </div>
      </div>
    </div>
  );
}
