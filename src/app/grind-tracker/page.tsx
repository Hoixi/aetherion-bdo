"use client";

import { useState, useCallback } from "react";

const GRADE_COLORS: Record<number, string> = {
  0: "text-gray-400",
  1: "text-white",
  2: "text-green-400",
  3: "text-blue-400",
  4: "text-yellow-400",
};

const GRADE_BORDER: Record<number, string> = {
  0: "border-gray-600",
  1: "border-gray-500",
  2: "border-green-600",
  3: "border-blue-600",
  4: "border-yellow-500",
};

const GRIND_SPOTS = [
  { label: "Olun Vadisi", nodeId: "1571" },
  { label: "Dehkia Kalıntıları", nodeId: "1684" },
  { label: "Gyfin Rhasia Tapınağı", nodeId: "1546" },
  { label: "Thornwood Ormanı", nodeId: "1560" },
  { label: "Kratuga Antik Kalıntıları", nodeId: "1625" },
  { label: "Özel (elle gir)", nodeId: "custom" },
];

interface DropItem {
  id: number;
  icon: string;
  name: string;
  grade: number;
  hasMarket: boolean;
  price: number;
  priceType: "market" | "npc" | "unknown" | "loading" | "custom";
  quantity: number;
}

function formatSilver(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString("tr-TR");
}

export default function GrindTrackerPage() {
  const [selectedSpot, setSelectedSpot] = useState(GRIND_SPOTS[0].nodeId);
  const [customNodeId, setCustomNodeId] = useState("");
  const [drops, setDrops] = useState<DropItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingPrice, setEditingPrice] = useState<number | null>(null);
  const [editPriceValue, setEditPriceValue] = useState("");

  const nodeId = selectedSpot === "custom" ? customNodeId : selectedSpot;

  const loadDrops = useCallback(async () => {
    if (!nodeId) return;
    setLoading(true);
    setError("");
    setDrops([]);

    try {
      const res = await fetch(`/api/grind/drops?nodeId=${nodeId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const initial: DropItem[] = data.items.map((item: any) => ({
        ...item,
        price: 0,
        priceType: "loading" as const,
        quantity: 0,
      }));
      setDrops(initial);

      // Fiyatları paralel fetch et
      initial.forEach(async (item, idx) => {
        try {
          const pr = await fetch(`/api/grind/price?itemId=${item.id}`);
          const pd = await pr.json();
          setDrops((prev) =>
            prev.map((d, i) =>
              i === idx ? { ...d, price: pd.price, priceType: pd.type } : d
            )
          );
        } catch {
          setDrops((prev) =>
            prev.map((d, i) =>
              i === idx ? { ...d, price: 0, priceType: "unknown" } : d
            )
          );
        }
      });
    } catch (e: any) {
      setError(e.message || "Hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  const updateQuantity = (idx: number, val: string) => {
    const n = parseInt(val) || 0;
    setDrops((prev) => prev.map((d, i) => (i === idx ? { ...d, quantity: Math.max(0, n) } : d)));
  };

  const saveCustomPrice = (idx: number) => {
    const n = parseInt(editPriceValue.replace(/\D/g, "")) || 0;
    setDrops((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, price: n, priceType: "custom" } : d))
    );
    setEditingPrice(null);
    setEditPriceValue("");
  };

  const totalSilver = drops.reduce((sum, d) => sum + d.quantity * d.price, 0);
  const filledDrops = drops.filter((d) => d.quantity > 0);

  return (
    <div className="py-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-bdo-text-primary">Grind Tracker</h1>
        <p className="text-sm text-bdo-text-muted mt-1">Grind seansınızda düşen eşyaları ve toplam silver kazancınızı takip edin.</p>
      </div>

      {/* Spot Seçici */}
      <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-bdo-text-muted mb-1">Grind Spotu</label>
          <select
            value={selectedSpot}
            onChange={(e) => setSelectedSpot(e.target.value)}
            className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:outline-none focus:border-bdo-gold"
          >
            {GRIND_SPOTS.map((s) => (
              <option key={s.nodeId} value={s.nodeId}>{s.label}</option>
            ))}
          </select>
        </div>

        {selectedSpot === "custom" && (
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs text-bdo-text-muted mb-1">Node ID (bdocodex)</label>
            <input
              type="text"
              value={customNodeId}
              onChange={(e) => setCustomNodeId(e.target.value)}
              placeholder="örn. 1571"
              className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:outline-none focus:border-bdo-gold"
            />
          </div>
        )}

        <button
          onClick={loadDrops}
          disabled={loading || !nodeId}
          className="bg-bdo-gold text-bdo-bg font-semibold px-5 py-2 rounded-lg text-sm hover:bg-bdo-gold-dim transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Yükleniyor..." : "Drop Listesini Getir"}
        </button>

        {drops.length > 0 && (
          <button
            onClick={() => setDrops((prev) => prev.map((d) => ({ ...d, quantity: 0 })))}
            className="px-4 py-2 rounded-lg text-sm border border-bdo-border text-bdo-text-muted hover:text-red-400 hover:border-red-400/50 transition-colors"
          >
            Sıfırla
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Özet */}
      {drops.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <div className="text-xs text-bdo-text-muted mb-1">Toplam Silver</div>
            <div className="text-xl font-bold text-bdo-gold">{formatSilver(totalSilver)}</div>
          </div>
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <div className="text-xs text-bdo-text-muted mb-1">Farklı Eşya</div>
            <div className="text-xl font-bold text-bdo-text-primary">{filledDrops.length}</div>
          </div>
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <div className="text-xs text-bdo-text-muted mb-1">Toplam Drop</div>
            <div className="text-xl font-bold text-bdo-text-primary">{drops.reduce((s, d) => s + d.quantity, 0)}</div>
          </div>
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <div className="text-xs text-bdo-text-muted mb-1">Drop Listesi</div>
            <div className="text-xl font-bold text-bdo-text-primary">{drops.length} eşya</div>
          </div>
        </div>
      )}

      {/* Drop Tablosu */}
      {drops.length > 0 && (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-[48px_1fr_120px_160px_120px_120px] text-xs text-bdo-text-muted px-4 py-2 border-b border-bdo-border bg-bdo-bg/50 font-medium">
            <div></div>
            <div>Eşya</div>
            <div className="text-center">Adet</div>
            <div className="text-right">Birim Fiyat</div>
            <div className="text-right">Kaynak</div>
            <div className="text-right">Toplam</div>
          </div>

          {drops.map((item, idx) => (
            <div
              key={item.id}
              className={`grid grid-cols-[48px_1fr_120px_160px_120px_120px] items-center px-4 py-2.5 border-b border-bdo-border/50 last:border-0 hover:bg-bdo-bg/30 transition-colors ${item.quantity > 0 ? "bg-bdo-gold/3" : ""}`}
            >
              {/* İkon */}
              <div className={`w-9 h-9 rounded border ${GRADE_BORDER[item.grade]} overflow-hidden bg-bdo-bg flex-shrink-0`}>
                {item.icon && (
                  <img src={item.icon} alt={item.name} className="w-full h-full object-cover" />
                )}
              </div>

              {/* İsim */}
              <div className={`text-sm font-medium px-3 ${GRADE_COLORS[item.grade]}`}>
                {item.name}
              </div>

              {/* Adet Input */}
              <div className="flex justify-center">
                <input
                  type="number"
                  min={0}
                  value={item.quantity || ""}
                  onChange={(e) => updateQuantity(idx, e.target.value)}
                  placeholder="0"
                  className="w-20 bg-bdo-bg border border-bdo-border rounded-lg px-2 py-1 text-sm text-center text-bdo-text-primary focus:outline-none focus:border-bdo-gold"
                />
              </div>

              {/* Fiyat */}
              <div className="flex items-center justify-end gap-1.5">
                {editingPrice === idx ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editPriceValue}
                      onChange={(e) => setEditPriceValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveCustomPrice(idx)}
                      placeholder="Silver"
                      autoFocus
                      className="w-28 bg-bdo-bg border border-bdo-gold rounded px-2 py-1 text-xs text-right text-bdo-text-primary focus:outline-none"
                    />
                    <button onClick={() => saveCustomPrice(idx)} className="text-bdo-gold text-xs hover:text-bdo-gold-dim">✓</button>
                    <button onClick={() => setEditingPrice(null)} className="text-bdo-text-muted text-xs hover:text-red-400">✕</button>
                  </div>
                ) : (
                  <>
                    <span className={`text-sm font-mono ${item.priceType === "loading" ? "text-bdo-text-muted animate-pulse" : "text-bdo-text-primary"}`}>
                      {item.priceType === "loading" ? "..." : formatSilver(item.price)}
                    </span>
                    <button
                      onClick={() => { setEditingPrice(idx); setEditPriceValue(String(item.price)); }}
                      className="text-bdo-text-muted hover:text-bdo-gold transition-colors"
                      title="Fiyatı düzenle"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {/* Kaynak */}
              <div className="text-right">
                {item.priceType === "loading" && <span className="text-xs text-bdo-text-muted">yükleniyor</span>}
                {item.priceType === "market" && <span className="text-xs text-green-400">Pazar</span>}
                {item.priceType === "npc" && <span className="text-xs text-blue-400">NPC</span>}
                {item.priceType === "custom" && <span className="text-xs text-bdo-gold">Özel</span>}
                {item.priceType === "unknown" && <span className="text-xs text-bdo-text-muted">Bilinmiyor</span>}
              </div>

              {/* Toplam */}
              <div className={`text-right text-sm font-mono font-semibold ${item.quantity > 0 ? "text-bdo-gold" : "text-bdo-text-muted"}`}>
                {item.quantity > 0 ? formatSilver(item.quantity * item.price) : "-"}
              </div>
            </div>
          ))}

          {/* Footer toplam */}
          <div className="grid grid-cols-[48px_1fr_120px_160px_120px_120px] items-center px-4 py-3 bg-bdo-gold/8 border-t border-bdo-gold/20">
            <div></div>
            <div className="text-sm font-semibold text-bdo-text-primary">Toplam</div>
            <div></div>
            <div></div>
            <div></div>
            <div className="text-right text-base font-bold text-bdo-gold font-mono">{formatSilver(totalSilver)}</div>
          </div>
        </div>
      )}

      {!loading && drops.length === 0 && !error && (
        <div className="text-center py-16 text-bdo-text-muted">
          <div className="text-4xl mb-3">⚔</div>
          <div className="text-sm">Spot seçin ve drop listesini getirin</div>
        </div>
      )}
    </div>
  );
}
