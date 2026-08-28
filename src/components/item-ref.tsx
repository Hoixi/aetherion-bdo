"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, Package } from "lucide-react";
import { gradeOf, parseBdoText } from "@/lib/bdo-text";
import { ItemIcon } from "@/components/item-visuals";

/**
 * Forum yazılarına eşya gömme.
 *
 * Yazı `forum_posts.content` içinde HTML olarak duruyor, o yüzden eşya da
 * kendi kendine yeten bir `<span data-item=…>` olarak saklanıyor: ad,
 * kalite ve ikon etikete yazılı, böylece gönderi listesi tek bir istek
 * atmadan çiziliyor. Ayrıntı (açıklama, ağırlık, fiyat) yalnızca fare
 * üstüne gelince çekiliyor.
 */

const idOf = (urn: string) => urn.split(":").pop() ?? urn;

// ── Depolanan biçim ────────────────────────────────────────────────────

export type ItemRefAttrs = {
  urn: string;
  name: string;
  grade: number;
  icon: string | null;
};

/** TipTap düğümü — satır içi ve bölünmez */
export const ItemRefNode = Node.create({
  name: "itemRef",
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    // `renderHTML: () => null` olmazsa TipTap her özniteliği ayrıca
    // etikete basıyor ve yanına `urn="…" grade="3"` gibi başıboş
    // nitelikler düşüyor. Yazma işi aşağıdaki renderHTML'e bırakıldı.
    const sessiz = { renderHTML: () => null };
    return {
      urn: { default: "", ...sessiz },
      name: { default: "", ...sessiz },
      grade: { default: 0, ...sessiz },
      icon: { default: null, ...sessiz },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-item]",
        getAttrs: (el) => {
          const e = el as HTMLElement;
          return {
            urn: e.getAttribute("data-item") ?? "",
            name: e.getAttribute("data-name") ?? e.textContent ?? "",
            grade: Number(e.getAttribute("data-grade") ?? 0),
            icon: e.getAttribute("data-icon"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    const { urn, name, grade, icon } = node.attrs as ItemRefAttrs;
    const g = gradeOf(grade);
    const children: unknown[] = [];
    if (icon) children.push(["img", { src: icon, alt: "", class: "item-ref-ic" }]);
    children.push(["span", {}, name]);

    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-item": urn,
        "data-name": name,
        "data-grade": String(grade),
        ...(icon ? { "data-icon": icon } : {}),
        class: "item-ref",
        style: `color:${g.color};border-color:${g.color}55`,
      }),
      ...(children as never[]),
    ];
  },
});

// ── Ayrıntı getirme ────────────────────────────────────────────────────

type Detay = {
  name: string;
  grade: number;
  icon: string | null;
  description: string | null;
  data: Record<string, unknown>;
  marketCategory: string | null;
};

type Fiyat = { price: number; region?: string } | null;

/** Aynı eşyanın üstüne ikinci kez gelince ağa çıkılmasın */
const detayBellek = new Map<string, Detay | null>();
const fiyatBellek = new Map<string, Fiyat>();

async function detayGetir(urn: string): Promise<Detay | null> {
  if (detayBellek.has(urn)) return detayBellek.get(urn) ?? null;
  try {
    const res = await fetch(`/api/esyalar/${idOf(urn)}`);
    const d = res.ok ? ((await res.json()) as Detay) : null;
    detayBellek.set(urn, d);
    return d;
  } catch {
    detayBellek.set(urn, null);
    return null;
  }
}

/**
 * Pazar fiyatı ayrı çekiliyor: bu istek bdocodex'e çıkıyor ve ilk seferde
 * yarım saniye sürüyor. Balonu onun için bekletmiyoruz, fiyat gelince
 * satır kendi kendine beliriyor.
 */
async function fiyatGetir(urn: string): Promise<Fiyat> {
  if (fiyatBellek.has(urn)) return fiyatBellek.get(urn) ?? null;
  try {
    const p = await (await fetch(`/api/grind/price?itemId=${idOf(urn)}`)).json();
    const f: Fiyat = p?.type === "market" ? { price: p.price, region: p.region } : null;
    fiyatBellek.set(urn, f);
    return f;
  } catch {
    fiyatBellek.set(urn, null);
    return null;
  }
}

const gumus = (n: number) => n.toLocaleString("tr-TR");

// ── İpucu balonu ───────────────────────────────────────────────────────

type Konum = { x: number; y: number; urn: string; attrs: ItemRefAttrs };

/**
 * Bir kapsayıcının içindeki eşyalara ipucu takar.
 *
 * Gönderi gövdesi `dangerouslySetInnerHTML` ile basıldığı için tek tek
 * bileşen bağlanamıyor; olay yakalama kapsayıcıda yapılıyor. Kanca
 * olarak duruyor ki çağıran fazladan bir sarmalayıcı `div` koymak
 * zorunda kalmasın — dönen `ref` doğrudan mevcut gövdeye takılıyor.
 */
export function useItemTooltip<T extends HTMLElement = HTMLDivElement>() {
  const kap = useRef<T>(null);
  const [konum, setKonum] = useState<Konum | null>(null);
  const [detay, setDetay] = useState<Detay | null>(null);
  const [fiyat, setFiyat] = useState<Fiyat>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  /** Fare hızlı gezerken geç dönen isteğin yeni balonu ezmemesi için */
  const bilet = useRef(0);

  const ac = useCallback(async (el: HTMLElement) => {
    const urn = el.getAttribute("data-item");
    if (!urn) return;
    const benim = ++bilet.current;

    const r = el.getBoundingClientRect();
    setKonum({
      x: r.left,
      y: r.top,
      urn,
      attrs: {
        urn,
        name: el.getAttribute("data-name") ?? el.textContent ?? "",
        grade: Number(el.getAttribute("data-grade") ?? 0),
        icon: el.getAttribute("data-icon"),
      },
    });

    // Bellekteki varsa anında; yoksa boş başlayıp bekleme yazısı göster
    setDetay(detayBellek.get(urn) ?? null);
    setFiyat(fiyatBellek.get(urn) ?? null);
    setYukleniyor(!detayBellek.has(urn));

    const d = await detayGetir(urn);
    if (bilet.current !== benim) return;
    setYukleniyor(false);
    setDetay(d);
    if (!d) return;

    const f = await fiyatGetir(urn);
    if (bilet.current !== benim) return;
    setFiyat(f);
  }, []);

  useEffect(() => {
    const el = kap.current;
    if (!el) return;

    const kapat = () => {
      bilet.current++;
      setKonum(null);
      setYukleniyor(false);
    };

    const gir = (e: Event) => {
      const t = (e.target as HTMLElement | null)?.closest?.("[data-item]");
      if (t) ac(t as HTMLElement);
    };

    const cik = (e: Event) => {
      const from = (e.target as HTMLElement | null)?.closest?.("[data-item]");
      if (!from) return;
      // Rozetin içinde gezinmek (ikondan yazıya geçmek) çıkış değil:
      // mouseout çocuk elemana geçerken de tetikleniyor ve balon titriyordu.
      const to = (e as MouseEvent).relatedTarget as HTMLElement | null;
      if (to && from.contains(to)) return;
      kapat();
    };

    el.addEventListener("mouseover", gir);
    el.addEventListener("mouseout", cik);
    // Rozetler arası boşluğa geçip kapsayıcıdan çıkınca da kapansın.
    el.addEventListener("pointerleave", kapat);
    // Konum açılışta ölçülüp `fixed` sabitleniyor: sayfa kayınca rozet gidiyor,
    // balon yerinde kalıyordu ve fare kımıldamadığı için mouseout hiç gelmiyordu.
    window.addEventListener("scroll", kapat, true);
    window.addEventListener("blur", kapat);

    return () => {
      el.removeEventListener("mouseover", gir);
      el.removeEventListener("mouseout", cik);
      el.removeEventListener("pointerleave", kapat);
      window.removeEventListener("scroll", kapat, true);
      window.removeEventListener("blur", kapat);
    };
  }, [ac]);

  const tooltip = konum ? (
    <ItemTooltip attrs={konum.attrs} detay={detay} fiyat={fiyat}
                 yukleniyor={yukleniyor} x={konum.x} y={konum.y} />
  ) : null;

  return { ref: kap, tooltip };
}

function ItemTooltip({ attrs, detay, fiyat, yukleniyor, x, y }: {
  attrs: ItemRefAttrs; detay: Detay | null; fiyat: Fiyat;
  yukleniyor: boolean; x: number; y: number;
}) {
  const kalite = detay?.grade ?? attrs.grade;
  const g = gradeOf(kalite);
  const d = detay?.data ?? {};
  const agirlik = typeof d.weight === "number" ? d.weight : null;
  const npc = typeof d.sellPrice === "number" && d.sellPrice > 0 ? d.sellPrice : null;
  const aile = d.familyInventory === true;
  const altKategori = typeof d.marketSubCategory === "string" ? d.marketSubCategory : null;

  // Balon üstte açılıyor; tepeye yakınsa alta düşüyor
  const ust = y > 340;

  return (
    <div className="fixed z-[9999] pointer-events-none w-[300px] rounded-[10px] p-3"
         style={{
           left: Math.min(x, (typeof window !== "undefined" ? window.innerWidth : 1200) - 320),
           top: ust ? y - 8 : y + 26,
           transform: ust ? "translateY(-100%)" : undefined,
           background: "var(--t-surface)",
           border: `1px solid ${g.color}44`,
           boxShadow: "0 18px 44px rgba(0,0,0,.65)",
         }}>
      <div className="flex items-start gap-2.5">
        <ItemIcon size={40}
                  item={{ id: attrs.urn, name: attrs.name, grade: kalite,
                          icon: detay?.icon ?? attrs.icon }} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-tight" style={{ color: g.color }}>
            {detay?.name ?? attrs.name}
          </div>
          {(detay?.marketCategory || altKategori) && (
            <div className="text-[10.5px] mt-0.5" style={{ color: "var(--t-faint)" }}>
              {[detay?.marketCategory, altKategori].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>

      {yukleniyor && (
        <p className="text-[11px] mt-2.5 animate-pulse" style={{ color: "var(--t-faint)" }}>
          Yükleniyor…
        </p>
      )}

      {detay && (
        <>
          <div className="mt-2.5 pt-2.5 space-y-1 text-[11.5px]"
               style={{ borderTop: "1px solid var(--t-line)" }}>
            {agirlik !== null && (
              <Satir etiket="Ağırlık" deger={`${agirlik.toFixed(2)} LT`} />
            )}
            {fiyat && (
              <Satir etiket={`Merkez pazar${fiyat.region ? ` (${fiyat.region})` : ""}`}
                     deger={`${gumus(fiyat.price)} gümüş`} vurgu />
            )}
            {npc !== null && <Satir etiket="NPC satış" deger={`${gumus(npc)} gümüş`} />}
            {aile && (
              <p className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>
                Aile envanterine koyulabilir
              </p>
            )}
          </div>

          {detay.description && (
            <div className="mt-2.5 pt-2.5 text-[11.5px] leading-relaxed"
                 style={{ borderTop: "1px solid var(--t-line)", color: "var(--t-dim)" }}>
              {parseBdoText(detay.description).map((p, i) => (
                <span key={i} style={p.color ? { color: p.color } : undefined}>{p.text}</span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Satir({ etiket, deger, vurgu }: { etiket: string; deger: string; vurgu?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span style={{ color: "var(--t-faint)" }}>{etiket}</span>
      <span className="t-num" style={{ color: vurgu ? "var(--t-gold)" : "var(--t-dim)" }}>{deger}</span>
    </div>
  );
}

// ── Eşya seçici ────────────────────────────────────────────────────────

type Bulunan = { id: string; name: string; grade: number; icon: string | null; marketCategory: string | null };

/** Editörde "eşya ekle" düğmesinin açtığı arama penceresi */
export function ItemPicker({ onPick, onClose }: {
  onPick: (a: ItemRefAttrs) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [liste, setListe] = useState<Bulunan[]>([]);
  const [ariyor, setAriyor] = useState(false);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setListe([]); return; }
    // Her tuşta istek atmamak için kısa bekleme
    const t = setTimeout(async () => {
      setAriyor(true);
      try {
        const r = await (await fetch(`/api/esyalar?q=${encodeURIComponent(s)}&limit=25`)).json();
        setListe(r.items ?? []);
      } catch {
        setListe([]);
      } finally {
        setAriyor(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[12vh] px-4"
         style={{ background: "rgba(0,0,0,.7)", backdropFilter: "blur(3px)" }}
         onClick={onClose}>
      <div className="w-full max-w-md rounded-[var(--t-r)] overflow-hidden"
           style={{ background: "var(--t-surface)", border: "1px solid var(--t-line-strong)" }}
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3"
             style={{ borderBottom: "1px solid var(--t-line)" }}>
          <Package className="w-4 h-4 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
          <span className="text-[13.5px] font-semibold">Eşya ekle</span>
          <button onClick={onClose} aria-label="Kapat" className="ml-auto p-1"
                  style={{ color: "var(--t-faint)" }}>
            <X className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
                   placeholder="Eşya adı ara — en az 2 harf"
                   className="w-full h-[36px] pl-9 pr-3 rounded-[var(--t-r-sm)] text-[13px] outline-none"
                   style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                            color: "var(--t-text)" }} />
          </div>
        </div>

        <div className="max-h-[46vh] overflow-y-auto">
          {ariyor && (
            <p className="px-4 py-3 text-[12px] animate-pulse" style={{ color: "var(--t-faint)" }}>
              Aranıyor…
            </p>
          )}
          {!ariyor && q.trim().length >= 2 && liste.length === 0 && (
            <p className="px-4 py-6 text-center text-[12.5px]" style={{ color: "var(--t-faint)" }}>
              Eşleşen eşya yok.
            </p>
          )}
          {liste.map((it) => {
            const g = gradeOf(it.grade);
            return (
              <button key={it.id}
                      onClick={() => onPick({ urn: it.id, name: it.name, grade: it.grade, icon: it.icon })}
                      className="t-row w-full px-4 py-2 flex items-center gap-2.5 text-left">
                <ItemIcon item={it} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] truncate" style={{ color: g.color }}>{it.name}</span>
                  {it.marketCategory && (
                    <span className="block text-[10.5px] truncate" style={{ color: "var(--t-faint)" }}>
                      {it.marketCategory}
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
