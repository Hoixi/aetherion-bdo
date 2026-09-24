"use client";

import { Slot, type Equippable } from "@/components/loadout";

/**
 * Kristal tahtası — oyundaki (ve garmoth'taki) halka düzeni.
 *
 * Yerleşim 5×5'lik bir ızgaranın elmas deseni: köşeler ve orta kenarlar dış
 * halka, içeride üç sıra, tam ortada tek yuva. Altı köşe/orta yuva büyük
 * (oyunda çerçeveli duranlar), ortadaki ayrı vurgulu. Arkadaki daireler ve
 * bağlantı çizgileri süs — oyundaki pano hissini veriyor, tıklanabilir
 * değiller.
 *
 * Yuva sırası kodda sabit: kayıtlı kurulumlar bu sıraya göre çözülüyor,
 * görsel değişse de kimlik bozulmasın diye (bkz. YERLER).
 */

/** [sütun, satır] — 5×5 ızgarada 1'den başlar; tur: büyük / orta / normal */
export const YERLER: Array<{ c: number; r: number; tur: "buyuk" | "merkez" | "normal" }> = [
  { c: 1, r: 1, tur: "buyuk" }, { c: 3, r: 1, tur: "buyuk" }, { c: 5, r: 1, tur: "buyuk" },
  { c: 2, r: 2, tur: "normal" }, { c: 3, r: 2, tur: "normal" }, { c: 4, r: 2, tur: "normal" },
  { c: 1, r: 3, tur: "normal" }, { c: 2, r: 3, tur: "normal" }, { c: 3, r: 3, tur: "merkez" },
  { c: 4, r: 3, tur: "normal" }, { c: 5, r: 3, tur: "normal" },
  { c: 2, r: 4, tur: "normal" }, { c: 3, r: 4, tur: "normal" }, { c: 4, r: 4, tur: "normal" },
  { c: 1, r: 5, tur: "buyuk" }, { c: 3, r: 5, tur: "buyuk" }, { c: 5, r: 5, tur: "buyuk" },
];
export const HALKA_YUVA = YERLER.length; // 17
export const SAFAK_YUVA = 6;

/** Süs: dış çerçeve çizgileri + iç daireler. Izgarayla aynı yüzdelerde durur. */
function Zemin() {
  const p = (n: number) => `${n * 20 - 10}%`;
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      <g stroke="rgba(255,255,255,.10)" fill="none" strokeWidth="1">
        {/* köşeleri birleştiren dış çerçeve */}
        <line x1={p(1)} y1={p(1)} x2={p(5)} y2={p(1)} />
        <line x1={p(1)} y1={p(5)} x2={p(5)} y2={p(5)} />
        <line x1={p(1)} y1={p(1)} x2={p(1)} y2={p(5)} />
        <line x1={p(5)} y1={p(1)} x2={p(5)} y2={p(5)} />
        {/* iç daireler */}
        <circle cx="50%" cy="50%" r="19%" />
        <circle cx="50%" cy="50%" r="27%" strokeDasharray="3 6" />
        <circle cx="50%" cy="50%" r="34%" />
        <circle cx="50%" cy="50%" r="9%" strokeDasharray="2 5" />
      </g>
    </svg>
  );
}

export function KristalTahtasi({ halka, safak, onSec, onSil, safakCesit }: {
  /** 17 yuva, sırası YERLER ile aynı */
  halka: (Equippable | null)[];
  /** 6 şafak kristali */
  safak: (Equippable | null)[];
  onSec: (tur: "halka" | "safak", i: number) => void;
  onSil: (tur: "halka" | "safak", i: number) => void;
  safakCesit?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="relative mx-auto" style={{ maxWidth: 560, aspectRatio: "1 / 1" }}>
        <Zemin />
        <div className="relative grid h-full w-full"
             style={{ gridTemplateColumns: "repeat(5, 1fr)", gridTemplateRows: "repeat(5, 1fr)" }}>
          {YERLER.map((y, i) => (
            <div key={i} className="flex items-center justify-center"
                 style={{ gridColumn: y.c, gridRow: y.r }}>
              <span className={`kristal-yuva ${y.tur}`}>
                <Slot item={halka[i] ?? null} size={y.tur === "normal" ? 46 : 54}
                      onPick={() => onSec("halka", i)} onClear={() => onSil("halka", i)} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl p-2.5" style={{ background: "var(--t-raised)", border: "1px solid rgba(239,95,95,.28)" }}>
        <div className="text-[10.5px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--t-faint)" }}>
          Şafak Kristalleri{safakCesit ? ` · ${safakCesit} çeşit` : ""}
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {safak.map((c, i) => (
            <Slot key={i} item={c ?? null} size={48}
                  onPick={() => onSec("safak", i)} onClear={() => onSil("safak", i)} />
          ))}
        </div>
      </div>
    </div>
  );
}
