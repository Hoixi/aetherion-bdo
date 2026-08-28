"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Gem, Sparkles, X, Link2 } from "lucide-react";
import { ItemIcon } from "@/components/item-visuals";
import { sumStats, type Equippable, type StatRow } from "@/components/loadout";

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

function LoadoutCard({ kind, code, label }: LoadoutAttrs) {
  const [crystals, setCrystals] = useState<Equippable[] | null>(null);
  const [eser, setEser] = useState<Awaited<ReturnType<typeof getEser>> | null>(null);

  useEffect(() => {
    if (kind === "kristal") getKristal().then(setCrystals).catch(() => setCrystals([]));
    else getEser().then(setEser).catch(() => setEser(null));
  }, [kind]);

  const href = kind === "kristal" ? `/kristaller?k=${code}` : `/eserler?${code}`;

  const { items, combos } = useMemo(() => {
    if (kind === "kristal") {
      if (!crystals) return { items: [], combos: [] as Combo[] };
      const by = new Map(crystals.map((c) => [c.itemId, c]));
      return { items: idsFrom(code).map((id) => by.get(id)).filter(Boolean) as Equippable[], combos: [] };
    }
    if (!eser) return { items: [], combos: [] as Combo[] };
    // eser kodu: "e=..&t=.." biçiminde geliyor
    const qs = new URLSearchParams(code);
    const by = new Map([...eser.artifacts, ...eser.lightstones].map((i) => [i.itemId, i]));
    const chosen = [...idsFrom(qs.get("e") ?? ""), ...idsFrom(qs.get("t") ?? "")]
      .map((id) => by.get(id)).filter(Boolean) as Equippable[];
    // Guclendirilmis tas temel tasin yerine sayiliyor - kurulum ekraniyla
    // ayni cozumleme, yoksa kart ile ekran farkli sonuc gosterir.
    const have = new Set(chosen.map((c) => eser.aliases[c.id] ?? c.id));
    return {
      items: chosen,
      combos: eser.combos.filter((c) => c.required.every((u) => have.has(u))),
    };
  }, [kind, code, crystals, eser]);

  const totals = useMemo(
    () => (kind === "eser"
      // Taslarin cogunun kombinasyondan bagimsiz kendi stat'i da var.
      ? sumStats([
          ...combos.map((c) => ({
            id: c.id, itemId: 0, name: c.name, grade: 0,
            icon: null, subCategory: null, stats: c.stats })),
          ...items,
        ])
      : sumStats(items)),
    [kind, items, combos]);

  const Icon = kind === "kristal" ? Gem : Sparkles;
  const loading = kind === "kristal" ? crystals === null : eser === null;

  return (
    <div className="loadout-card">
      <div className="loadout-card-head">
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--t-gold)" }} />
        <span className="text-[12.5px] font-semibold">
          {label || (kind === "kristal" ? "Kristal kurulumu" : "Eser kurulumu")}
        </span>
        <a href={href} className="ml-auto text-[11px] inline-flex items-center gap-1"
           style={{ color: "var(--t-dim)" }}>
          <Link2 className="w-3 h-3" /> Aç
        </a>
      </div>

      {loading ? (
        <p className="text-[12px] px-3 py-2.5" style={{ color: "var(--t-faint)" }}>Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="text-[12px] px-3 py-2.5" style={{ color: "var(--t-faint)" }}>
          Bu kurulumda parça yok.
        </p>
      ) : (
        <>
          <div className="loadout-card-items">
            {items.map((it, i) => (
              <span key={it.id + i} title={it.name}>
                <ItemIcon item={it} size={34} />
              </span>
            ))}
          </div>

          {combos.length > 0 && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5">
              {combos.map((c) => (
                <span key={c.id} className="t-chip" style={{ color: "var(--t-gold)" }}>{c.name}</span>
              ))}
            </div>
          )}

          {totals.length > 0 && (
            <div className="loadout-card-stats">
              {totals.slice(0, 8).map((t) => (
                <span key={t.label + t.unit} className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>
                  {t.label}{" "}
                  <span className="t-num" style={{ color: t.value < 0 ? "var(--t-bad)" : "var(--t-gold)" }}>
                    {t.value > 0 ? "+" : ""}{t.unit === "%" ? `%${t.value}` : t.value}
                  </span>
                </span>
              ))}
              {totals.length > 8 && (
                <span className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                  +{totals.length - 8} etki daha
                </span>
              )}
            </div>
          )}
        </>
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
