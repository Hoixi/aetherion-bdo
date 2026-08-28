"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Gem, AlertTriangle, Link2, Check } from "lucide-react";
import { TestShell, Card, Empty, loadJson } from "@/components/app-shell";
import { Slot, Picker, StatTotals, encodeSet, decodeSet, type Equippable } from "@/components/loadout";

/**
 * Kristal kurulumu.
 *
 * Oyunda kristaller ekipman parçalarındaki yuvalara takılıyor ve aynı
 * "kristal grubu"ndan sınırlı sayıda taşınabiliyor (veride `crystalGroup.max`).
 * Ekran bu kuralı denetliyor: aşan seçim kırmızı uyarıya düşüyor, çünkü
 * oyunda zaten takılamaz.
 */

const SLOTS = 10;

export default function KristallerPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [crystals, setCrystals] = useState<Equippable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const [slots, setSlots] = useState<(number | null)[]>(() =>
    decodeSet(params.get("k"), SLOTS));

  useEffect(() => {
    loadJson<{ crystals: Equippable[] }>("/api/kurulum?ne=kristal")
      .then((r) => setCrystals(r.crystals))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(
    () => new Map(crystals.map((c) => [c.itemId, c])), [crystals]);

  const chosen = useMemo(
    () => slots.map((id) => (id != null ? byId.get(id) ?? null : null)), [slots, byId]);

  const equipped = useMemo(
    () => chosen.filter((c): c is Equippable => !!c), [chosen]);

  // Adres çubuğunu seçimle eşitle; link paylaşınca kurulum da gidiyor.
  const sync = useCallback((next: (number | null)[]) => {
    setSlots(next);
    const code = encodeSet(next.map((n) => (n == null ? null : String(n))));
    router.replace(code.replace(/-+$/, "") ? `/kristaller?k=${code}` : "/kristaller",
                   { scroll: false });
  }, [router]);

  /** Grup limitini aşan seçimler — oyunda da takılamaz. */
  const overflow = useMemo(() => {
    const count = new Map<number, { name: string; max: number; n: number }>();
    for (const c of equipped) {
      if (!c.group) continue;
      const cur = count.get(c.group.key) ?? { name: c.group.name, max: c.group.max, n: 0 };
      cur.n++;
      count.set(c.group.key, cur);
    }
    return Array.from(count.values()).filter((g) => g.n > g.max);
  }, [equipped]);

  const share = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  if (loading) return <TestShell title="Kristaller"><Empty>Yükleniyor…</Empty></TestShell>;
  if (error) return <TestShell title="Kristaller"><Empty>{error}</Empty></TestShell>;

  return (
    <TestShell title="Kristal Kurulumu"
               subtitle="Kristalleri yerleştir, toplam etkiyi gör, linki foruma yapıştır">
      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <Card hi className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gem className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
            <h2 className="text-[13.5px] font-semibold">Yuvalar</h2>
            <span className="t-chip ml-auto">{equipped.length} / {SLOTS}</span>
            <button onClick={share} className="t-chip inline-flex items-center gap-1.5">
              {copied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
              {copied ? "Kopyalandı" : "Linki kopyala"}
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {chosen.map((c, i) => (
              <Slot key={i} item={c}
                    onPick={() => setPicking(i)}
                    onClear={() => sync(slots.map((v, j) => (j === i ? null : v)))} />
            ))}
          </div>

          {equipped.length > 0 && (
            <div className="flex flex-col gap-1 mt-4 pt-4" style={{ borderTop: "1px solid var(--t-line)" }}>
              {equipped.map((c, i) => (
                <div key={c.id + i} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="truncate">{c.name}</span>
                  {c.group && (
                    <span className="t-chip shrink-0">{c.group.name} · en fazla {c.group.max}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {overflow.length > 0 && (
          <Card className="p-4" >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--t-bad)" }} />
              <div className="text-[12.5px]">
                <p style={{ color: "var(--t-bad)" }}>Bu kurulum oyunda takılamaz.</p>
                {overflow.map((g) => (
                  <p key={g.name} style={{ color: "var(--t-dim)" }}>
                    {g.name}: {g.n} seçildi, en fazla {g.max} olabilir.
                  </p>
                ))}
              </div>
            </div>
          </Card>
        )}

        <Card>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <h2 className="text-[13.5px] font-semibold">Toplam etki</h2>
          </div>
          <StatTotals items={equipped} empty="Yuvalara kristal koy, toplam burada çıksın." />
        </Card>
      </div>

      {picking !== null && (
        <Picker title="Kristal seç" items={crystals}
                note={(c) => c.group ? `${c.group.name} · en fazla ${c.group.max}` : null}
                onClose={() => setPicking(null)}
                onSelect={(c) => sync(slots.map((v, j) => (j === picking ? c.itemId : v)))} />
      )}
    </TestShell>
  );
}
