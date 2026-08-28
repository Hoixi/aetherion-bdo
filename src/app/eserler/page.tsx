"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Link2, Check, CircleDot } from "lucide-react";
import { TestShell, Card, Empty, loadJson } from "@/components/app-shell";
import { Slot, Picker, StatTotals, sumStats, encodeSet, decodeSet, type Equippable, type StatRow }
  from "@/components/loadout";
import { gradeOf } from "@/lib/bdo-text";
import { statTr, formatTotal } from "@/lib/bdo-stats";

/**
 * Eser ve ışık taşı kurulumu.
 *
 * Eserlerin kendi etkisi YOK — veride hiçbirinde `effects` alanı yok.
 * Etki ışık taşı kombinasyonundan geliyor: doğru 3 ya da 4 taş takılınca
 * kombinasyon açılıyor. Ekranın işi bu eşleşmeyi göstermek.
 */

const ARTIFACT_SLOTS = 2;
const STONE_SLOTS = 4;

interface Combo { id: string; name: string; required: string[]; stats: StatRow[] }

export default function EserlerPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [artifacts, setArtifacts] = useState<Equippable[]>([]);
  const [lightstones, setLightstones] = useState<Equippable[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<{ kind: "eser" | "tas"; index: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const [eser, setEser] = useState<(number | null)[]>(() => decodeSet(params.get("e"), ARTIFACT_SLOTS));
  const [tas, setTas] = useState<(number | null)[]>(() => decodeSet(params.get("t"), STONE_SLOTS));

  useEffect(() => {
    loadJson<{ artifacts: Equippable[]; lightstones: Equippable[]; combos: Combo[];
               aliases: Record<string, string> }>("/api/kurulum?ne=eser")
      .then((r) => {
        setArtifacts(r.artifacts); setLightstones(r.lightstones);
        setCombos(r.combos); setAliases(r.aliases ?? {});
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const artById = useMemo(() => new Map(artifacts.map((a) => [a.itemId, a])), [artifacts]);
  const stoneById = useMemo(() => new Map(lightstones.map((s) => [s.itemId, s])), [lightstones]);
  const stoneByUrn = useMemo(() => new Map(lightstones.map((s) => [s.id, s])), [lightstones]);

  const chosenArt = useMemo(() => eser.map((id) => (id != null ? artById.get(id) ?? null : null)), [eser, artById]);
  const chosenStone = useMemo(() => tas.map((id) => (id != null ? stoneById.get(id) ?? null : null)), [tas, stoneById]);

  const equippedStones = useMemo(
    () => chosenStone.filter((s): s is Equippable => !!s), [chosenStone]);

  const sync = useCallback((nextEser: (number | null)[], nextTas: (number | null)[]) => {
    setEser(nextEser); setTas(nextTas);
    const e = encodeSet(nextEser.map((n) => (n == null ? null : String(n))));
    const t = encodeSet(nextTas.map((n) => (n == null ? null : String(n))));
    const qs = new URLSearchParams();
    if (e.replace(/-+/g, "")) qs.set("e", e);
    if (t.replace(/-+/g, "")) qs.set("t", t);
    router.replace(qs.toString() ? `/eserler?${qs}` : "/eserler", { scroll: false });
  }, [router]);

  /**
   * Takılı taşlarla açılan kombinasyonlar. Bir kombinasyon, gerektirdiği
   * taşların HEPSİ takılıysa açılıyor; kısmi eşleşme "yakın" sayılıp ayrıca
   * gösteriliyor ki bir taş eksikse görülebilsin.
   */
  const { active, close } = useMemo(() => {
    // Guclendirilmis tas temel tasin yerine sayiliyor; kombinasyonlar temel
    // urn istedigi icin once alias'tan gecirilmezse guclendirilmis tas takan
    // hicbir kombinasyon acamaz.
    const have = new Set(equippedStones.map((s) => aliases[s.id] ?? s.id));
    const act: Combo[] = [];
    const near: Array<{ combo: Combo; missing: string[] }> = [];
    for (const c of combos) {
      const missing = c.required.filter((u) => !have.has(u));
      if (missing.length === 0) act.push(c);
      else if (have.size > 0 && missing.length === 1) near.push({ combo: c, missing });
    }
    return { active: act, close: near.slice(0, 6) };
  }, [combos, equippedStones, aliases]);

  // Taslarin 83'unun kendi etkisi de var; toplam = kombinasyon + taslar.
  const allSources = useMemo(() => [
    ...active.map((c) => ({
      id: c.id, itemId: 0, name: c.name, grade: 0,
      icon: null, subCategory: null, stats: c.stats,
    })),
    ...equippedStones,
  ], [active, equippedStones]);

  const comboStats = useMemo(() => sumStats(allSources), [allSources]);

  const share = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  /**
   * Taşın kendi etkisi seçicide görünsün — 93 taşın 83'ünün kombinasyondan
   * bağımsız kendi stat'ı var ve hangisini takacağına ona bakarak karar
   * veriliyor. Güçlendirilmiş sürüm ayrıca işaretleniyor: kombinasyonda
   * temel taşın yerine geçtiği için ikisi listede karışabiliyor.
   */
  const stoneNote = (s: Equippable) => {
    const own = (s.stats ?? [])
      .map((x) => `${statTr(x.stat)} ${x.op === "-" ? "-" : "+"}${x.unit === "%" ? "%" : ""}${x.value}`)
      .join(" · ");
    const guclu = aliases[s.id] && aliases[s.id] !== s.id ? "Güçlendirilmiş" : null;
    return [guclu, own || s.subCategory].filter(Boolean).join(" — ") || null;
  };

  const cleanName = (s: string) => s.replace(/<[^>]*>/g, "").trim();

  if (loading) return <TestShell title="Eserler"><Empty>Yükleniyor…</Empty></TestShell>;
  if (error) return <TestShell title="Eserler"><Empty>{error}</Empty></TestShell>;

  return (
    <TestShell title="Eser & Işık Taşı"
               subtitle="Işık taşlarını yerleştir, açılan kombinasyonu ve etkilerini gör">
      <div className="grid gap-4">
        <Card hi className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
            <h2 className="text-[13.5px] font-semibold">Kurulum</h2>
            <button onClick={share} className="t-chip ml-auto inline-flex items-center gap-1.5">
              {copied ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
              {copied ? "Kopyalandı" : "Linki kopyala"}
            </button>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--t-faint)" }}>
                Eser
              </p>
              <div className="flex gap-2.5">
                {chosenArt.map((a, i) => (
                  <Slot key={i} item={a} size={62}
                        onPick={() => setPicking({ kind: "eser", index: i })}
                        onClear={() => sync(eser.map((v, j) => (j === i ? null : v)), tas)} />
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--t-faint)" }}>
                Işık Taşı
              </p>
              <div className="flex flex-wrap gap-2.5">
                {chosenStone.map((s, i) => (
                  <Slot key={i} item={s} size={62}
                        onPick={() => setPicking({ kind: "tas", index: i })}
                        onClear={() => sync(eser, tas.map((v, j) => (j === i ? null : v)))} />
                ))}
              </div>
            </div>
          </div>

          {equippedStones.length > 0 && (
            <div className="flex flex-col gap-1 mt-4 pt-4" style={{ borderTop: "1px solid var(--t-line)" }}>
              {equippedStones.map((s, i) => (
                <div key={s.id + i} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="truncate">{s.name}</span>
                  <span className="shrink-0 text-[11.5px]" style={{ color: "var(--t-dim)" }}>
                    {stoneNote(s) ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Açılan kombinasyonlar ── */}
        <Card>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <CircleDot className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
            <h2 className="text-[13.5px] font-semibold">Açılan kombinasyonlar</h2>
            <span className="t-chip ml-auto">{active.length}</span>
          </div>

          {active.length === 0 ? (
            <p className="text-[12.5px] px-5 py-4" style={{ color: "var(--t-faint)" }}>
              Henüz kombinasyon açılmadı — bir kombinasyon, gerektirdiği 3 ya da 4 taşın
              hepsi takılıyken açılır.
            </p>
          ) : (
            <div className="p-4 flex flex-col gap-3">
              {active.map((c) => (
                <div key={c.id} className="rounded-[10px] p-3"
                     style={{ border: "1px solid var(--t-line)", background: "var(--t-raised)" }}>
                  <p className="text-[13px] font-medium" style={{ color: "var(--t-gold)" }}>
                    {cleanName(c.name)}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2">
                    {c.stats.map((s, i) => (
                      <span key={i} className="text-[12.5px]" style={{ color: "var(--t-dim)" }}>
                        {statTr(s.stat)}{" "}
                        <span className="t-num" style={{ color: "var(--t-text)" }}>
                          {formatTotal((s.op === "-" ? -1 : 1) * (s.value ?? 0), s.unit ?? "")}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Bir taş kalanlar ── */}
        {close.length > 0 && (
          <Card>
            <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <h2 className="text-[13.5px] font-semibold">Bir taş kaldı</h2>
              <span className="t-chip ml-auto">{close.length}</span>
            </div>
            <div className="p-4 flex flex-col gap-2">
              {close.map(({ combo, missing }) => {
                const stone = stoneByUrn.get(missing[0]);
                const g = gradeOf(stone?.grade ?? 0);
                return (
                  <div key={combo.id} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="truncate" style={{ color: "var(--t-dim)" }}>{cleanName(combo.name)}</span>
                    <span className="shrink-0 t-chip" style={{ color: g.color, borderColor: `${g.color}55` }}>
                      {stone?.name ?? "bilinmeyen taş"}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Toplam ── */}
        <Card>
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <h2 className="text-[13.5px] font-semibold">Toplam etki</h2>
          </div>
          {comboStats.length === 0 ? (
            <p className="text-[12.5px] px-4 py-3" style={{ color: "var(--t-faint)" }}>
              Taş tak ya da kombinasyon aç, toplam burada çıksın.
            </p>
          ) : (
            <StatTotals items={allSources} />
          )}
        </Card>
      </div>

      {picking?.kind === "eser" && (
        <Picker title="Eser seç" items={artifacts} onClose={() => setPicking(null)}
                onSelect={(a) => sync(eser.map((v, j) => (j === picking.index ? a.itemId : v)), tas)} />
      )}
      {picking?.kind === "tas" && (
        <Picker title="Işık taşı seç" items={lightstones} onClose={() => setPicking(null)}
                note={stoneNote}
                onSelect={(s) => sync(eser, tas.map((v, j) => (j === picking.index ? s.itemId : v)))} />
      )}
    </TestShell>
  );
}
