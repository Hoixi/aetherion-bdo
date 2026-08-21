"use client";

import { useCallback, useState } from "react";
import { Coins, Pencil, RotateCcw, Search, Swords, Package, Check, X } from "lucide-react";
import { TestShell, Card, Head } from "@/components/app-shell";

/**
 * Grind takibi.
 *
 * Drop listesi bdocodex node'undan, fiyatlar pazardan geliyor. Fiyatı
 * çekilemeyen eşyalar için elle giriş var — pazarda listelenmeyen
 * eşyaların NPC değeri her zaman doğru olmuyor.
 */

type PriceType = "market" | "npc" | "unknown" | "loading" | "custom";

type DropItem = {
  id: number;
  icon: string;
  name: string;
  grade: number;
  hasMarket: boolean;
  price: number;
  priceType: PriceType;
  quantity: number;
};

/** Oyun içi kalite renkleri */
const GRADE_COLOR: Record<number, string> = {
  0: "#8a8a92", 1: "#f4f4f5", 2: "#5fd39a", 3: "#6b93ff", 4: "#e8b451",
};

const PRICE_META: Record<PriceType, { label: string; color: string }> = {
  loading: { label: "yükleniyor", color: "var(--t-faint)" },
  market: { label: "Pazar", color: "#5fd39a" },
  npc: { label: "NPC", color: "#6b93ff" },
  custom: { label: "Özel", color: "var(--t-gold)" },
  unknown: { label: "Bilinmiyor", color: "var(--t-faint)" },
};

const SPOTS = [
  { label: "Orbita Kalesi", nodeId: "1571", refNodeId: "2003" },
  { label: "Özel (elle gir)", nodeId: "custom", refNodeId: "" },
];

/** BDO gümüşü milyar mertebesine çıkıyor; tabloda hizayı bozmasın */
function silver(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("tr-TR");
}

const GRID = "grid-cols-[44px_1fr_96px_150px_100px_110px]";

export default function GrindTrackerPage() {
  const [spot, setSpot] = useState(SPOTS[0].nodeId);
  const [customNode, setCustomNode] = useState("");
  const [drops, setDrops] = useState<DropItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const current = SPOTS.find((s) => s.nodeId === spot);
  const nodeId = spot === "custom" ? customNode : spot;
  const refNodeId = spot === "custom" ? customNode : (current?.refNodeId ?? spot);

  const load = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    setErr("");
    setDrops([]);

    try {
      const res = await fetch(`/api/grind/drops?nodeId=${nodeId}&refNodeId=${refNodeId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const initial: DropItem[] = (data.items as Omit<DropItem, "price" | "priceType" | "quantity">[])
        .map((item) => ({ ...item, price: 0, priceType: "loading" as const, quantity: 0 }));
      setDrops(initial);

      // Fiyatlar tek tek geliyor; hepsini bekleyip listeyi geciktirmek yerine
      // geldikçe yerine yazılıyor
      initial.forEach(async (item, idx) => {
        try {
          const pd = await (await fetch(`/api/grind/price?itemId=${item.id}`)).json();
          setDrops((prev) => prev.map((d, i) => (i === idx ? { ...d, price: pd.price, priceType: pd.type } : d)));
        } catch {
          setDrops((prev) => prev.map((d, i) => (i === idx ? { ...d, price: 0, priceType: "unknown" } : d)));
        }
      });
    } catch (e) {
      setErr((e as Error).message || "Drop listesi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [nodeId, refNodeId]);

  function setQty(idx: number, val: string) {
    const n = parseInt(val) || 0;
    setDrops((prev) => prev.map((d, i) => (i === idx ? { ...d, quantity: Math.max(0, n) } : d)));
  }

  function saveCustomPrice(idx: number) {
    const n = parseInt(editValue.replace(/\D/g, "")) || 0;
    setDrops((prev) => prev.map((d, i) => (i === idx ? { ...d, price: n, priceType: "custom" } : d)));
    setEditing(null);
    setEditValue("");
  }

  const total = drops.reduce((s, d) => s + d.quantity * d.price, 0);
  const filled = drops.filter((d) => d.quantity > 0);
  const totalDrops = drops.reduce((s, d) => s + d.quantity, 0);

  return (
    <TestShell
      title="Grind Tracker"
      subtitle="Grind seansında düşen eşyaları gir, toplam gümüş kazancını gör."
      aside={drops.length > 0 ? (
        <span className="t-chip hidden sm:inline" style={{ color: "var(--t-gold)" }}>
          {silver(total)}
        </span>
      ) : null}
    >
      {/* ── Spot seçimi ────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Label>Grind spotu</Label>
            <select value={spot} onChange={(e) => setSpot(e.target.value)}
                    className="w-full h-[34px] px-3 rounded-[var(--t-r-sm)] text-[13px] outline-none"
                    style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }}>
              {SPOTS.map((s) => <option key={s.nodeId} value={s.nodeId}>{s.label}</option>)}
            </select>
          </div>

          {spot === "custom" && (
            <div className="flex-1 min-w-[160px]">
              <Label>Node ID (bdocodex)</Label>
              <input value={customNode} onChange={(e) => setCustomNode(e.target.value)}
                     placeholder="örn. 1571"
                     className="w-full h-[34px] px-3 rounded-[var(--t-r-sm)] text-[13px] outline-none"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
            </div>
          )}

          <button onClick={load} disabled={loading || !nodeId}
                  className="text-[12px] font-semibold px-3.5 h-[34px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-45"
                  style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                           border: "1px solid rgba(232,180,81,.3)" }}>
            <Search className="w-3.5 h-3.5" strokeWidth={2} />
            {loading ? "Yükleniyor…" : "Drop listesini getir"}
          </button>

          {drops.length > 0 && (
            <button onClick={() => setDrops((prev) => prev.map((d) => ({ ...d, quantity: 0 })))}
                    className="text-[12px] font-semibold px-3 h-[34px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5"
                    style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} /> Sıfırla
            </button>
          )}
        </div>
      </Card>

      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}

      {/* ── Özet ───────────────────────────────────────────────────── */}
      {drops.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Toplam Gümüş" value={silver(total)} color="var(--t-gold)" />
          <Stat label="Farklı Eşya" value={String(filled.length)} />
          <Stat label="Toplam Drop" value={String(totalDrops)} />
          <Stat label="Drop Listesi" value={`${drops.length} eşya`} />
        </div>
      )}

      {/* ── Tablo ──────────────────────────────────────────────────── */}
      {drops.length > 0 && (
        <Card className="overflow-hidden">
          <Head icon={Package} title="Drop Listesi" meta={`${drops.length} EŞYA`} />

          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className={`grid ${GRID} text-[10px] uppercase tracking-[0.06em] px-4 py-2`}
                   style={{ color: "var(--t-faint)", borderBottom: "1px solid var(--t-line)" }}>
                <div />
                <div>Eşya</div>
                <div className="text-center">Adet</div>
                <div className="text-right">Birim Fiyat</div>
                <div className="text-right">Kaynak</div>
                <div className="text-right">Toplam</div>
              </div>

              {drops.map((item, idx) => {
                const meta = PRICE_META[item.priceType];
                return (
                  <div key={item.id} className={`grid ${GRID} items-center px-4 py-2 t-row`}
                       style={item.quantity > 0 ? { background: "rgba(232,180,81,.04)" } : undefined}>
                    <div className="w-9 h-9 rounded-[var(--t-r-sm)] overflow-hidden flex-shrink-0"
                         style={{ background: "var(--t-canvas)", border: `1px solid ${GRADE_COLOR[item.grade] ?? "var(--t-line)"}55` }}>
                      {item.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.icon} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>

                    <div className="text-[13px] font-medium px-3 truncate"
                         style={{ color: GRADE_COLOR[item.grade] ?? "var(--t-text)" }}>
                      {item.name}
                    </div>

                    <div className="flex justify-center">
                      <input type="number" min={0} value={item.quantity || ""} placeholder="0"
                             onChange={(e) => setQty(idx, e.target.value)}
                             className="w-[68px] h-[28px] px-2 rounded-[var(--t-r-sm)] text-[13px] text-center outline-none"
                             style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
                    </div>

                    <div className="flex items-center justify-end gap-1.5">
                      {editing === idx ? (
                        <>
                          <input autoFocus value={editValue}
                                 onChange={(e) => setEditValue(e.target.value)}
                                 onKeyDown={(e) => e.key === "Enter" && saveCustomPrice(idx)}
                                 placeholder="Gümüş"
                                 className="w-[104px] h-[26px] px-2 rounded text-[12px] text-right outline-none"
                                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-gold)", color: "var(--t-text)" }} />
                          <button onClick={() => saveCustomPrice(idx)} aria-label="Kaydet"
                                  style={{ color: "var(--t-gold)" }}>
                            <Check className="w-3.5 h-3.5" strokeWidth={2.4} />
                          </button>
                          <button onClick={() => setEditing(null)} aria-label="İptal"
                                  style={{ color: "var(--t-faint)" }}>
                            <X className="w-3.5 h-3.5" strokeWidth={2.4} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`t-num text-[13px] ${item.priceType === "loading" ? "animate-pulse" : ""}`}
                                style={{ color: item.priceType === "loading" ? "var(--t-faint)" : "var(--t-text)" }}>
                            {item.priceType === "loading" ? "…" : silver(item.price)}
                          </span>
                          <button onClick={() => { setEditing(idx); setEditValue(String(item.price)); }}
                                  title="Fiyatı elle gir" aria-label="Fiyatı elle gir"
                                  style={{ color: "var(--t-faint)" }}>
                            <Pencil className="w-3 h-3" strokeWidth={2} />
                          </button>
                        </>
                      )}
                    </div>

                    <div className="text-right text-[11px]" style={{ color: meta.color }}>{meta.label}</div>

                    <div className="text-right t-num text-[13px] font-semibold"
                         style={{ color: item.quantity > 0 ? "var(--t-gold)" : "var(--t-faint)" }}>
                      {item.quantity > 0 ? silver(item.quantity * item.price) : "—"}
                    </div>
                  </div>
                );
              })}

              <div className={`grid ${GRID} items-center px-4 py-3`}
                   style={{ background: "var(--t-gold-soft)", borderTop: "1px solid rgba(232,180,81,.2)" }}>
                <div />
                <div className="text-[13px] font-semibold px-3">Toplam</div>
                <div /><div /><div />
                <div className="text-right t-num text-[15px] font-bold" style={{ color: "var(--t-gold)" }}>
                  {silver(total)}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {!loading && drops.length === 0 && !err && (
        <Card className="p-12 flex flex-col items-center gap-3">
          <Swords className="w-7 h-7" strokeWidth={1.4} style={{ color: "var(--t-faint)" }} />
          <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>
            Spot seç ve drop listesini getir.
          </span>
        </Card>
      )}

      <div className="pb-6" />
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

function Stat({ label, value, color = "var(--t-text)" }: {
  label: string; value: string; color?: string;
}) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Coins className="w-3 h-3" strokeWidth={2} style={{ color: "var(--t-faint)" }} />
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
          {label}
        </span>
      </div>
      <div className="t-num text-[20px] font-bold leading-none" style={{ color }}>{value}</div>
    </Card>
  );
}
