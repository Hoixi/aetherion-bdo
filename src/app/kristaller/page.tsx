"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertTriangle, Eraser } from "lucide-react";
import { TestShell, Empty, loadJson } from "@/components/app-shell";
import { Slot, Picker, type Equippable } from "@/components/loadout";
import { StatPaneli } from "@/components/stat-paneli";
import { BuildKaydet, type KayitliBuild } from "@/components/build-kaydet";

/**
 * Kristal kurulumu.
 *
 * Düzen oyundaki kristal penceresini izliyor: her ekipman parçasının iki
 * yuvası var (ana silah, uyanış, alt silah, kask, zırh, eldiven, ayakkabı =
 * 14), altta ayrı bir sırada altı Şafak kristali. Sağ sütun toplam etkiyi
 * oyundaki gibi başlıklara ayırıp gösteriyor.
 *
 * Kurulumun kendisi adres çubuğundaki kod; ada verilip kaydedilebiliyor,
 * herkese açık yapılırsa klandaki herkes listeden açabiliyor.
 */

const PARCALAR = [
  { ad: "Ana Silah", kisa: "AS" },
  { ad: "Uyanış Silahı", kisa: "UY" },
  { ad: "Alt Silah", kisa: "ALT" },
  { ad: "Kask", kisa: "KSK" },
  { ad: "Zırh", kisa: "ZRH" },
  { ad: "Eldiven", kisa: "ELD" },
  { ad: "Ayakkabı", kisa: "AYK" },
] as const;
const SLOTS = PARCALAR.length * 2; // 14
const SAFAK = 6;

const safakMi = (c: Equippable) => /şafak/i.test(c.name);

/** Kod: 14 kristal "-" ile, sonra "~" ve 6 şafak. Eski (tek parçalı) kodlar da okunur. */
function coz(code: string | null): { ana: (number | null)[]; safak: (number | null)[] } {
  const bos = (n: number) => Array<number | null>(n).fill(null);
  if (!code) return { ana: bos(SLOTS), safak: bos(SAFAK) };
  const [a = "", s = ""] = code.split("~");
  const say = (raw: string, n: number) => {
    const out = bos(n);
    raw.split("-").slice(0, n).forEach((p, i) => { const v = Number(p); out[i] = p !== "" && Number.isFinite(v) ? v : null; });
    return out;
  };
  return { ana: say(a, SLOTS), safak: say(s, SAFAK) };
}
const kodla = (ana: (number | null)[], safak: (number | null)[]) => {
  const p = (x: (number | null)[]) => x.map((v) => (v == null ? "" : String(v))).join("-").replace(/-+$/, "");
  const s = p(safak);
  return s ? `${p(ana)}~${s}` : p(ana);
};

export default function KristallerPage() {
  return <Suspense fallback={<TestShell title="Kristal Kurulumu"><Empty>Yükleniyor…</Empty></TestShell>}><Icerik /></Suspense>;
}

function Icerik() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session } = useSession();

  const [crystals, setCrystals] = useState<Equippable[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<{ tur: "ana" | "safak"; i: number } | null>(null);
  const [ad, setAd] = useState("");

  const ilk = coz(params.get("k"));
  const [slots, setSlots] = useState<(number | null)[]>(ilk.ana);
  const [safak, setSafak] = useState<(number | null)[]>(ilk.safak);

  useEffect(() => {
    loadJson<{ crystals: Equippable[] }>("/api/kurulum?ne=kristal")
      .then((r) => setCrystals(r.crystals))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const byId = useMemo(() => new Map(crystals.map((c) => [c.itemId, c])), [crystals]);
  const secili = useMemo(() => slots.map((id) => (id != null ? byId.get(id) ?? null : null)), [slots, byId]);
  const seciliSafak = useMemo(() => safak.map((id) => (id != null ? byId.get(id) ?? null : null)), [safak, byId]);
  const takili = useMemo(() => [...secili, ...seciliSafak].filter((c): c is Equippable => !!c), [secili, seciliSafak]);
  const kod = useMemo(() => kodla(slots, safak), [slots, safak]);

  const normalKristaller = useMemo(() => crystals.filter((c) => !safakMi(c)), [crystals]);
  const safakKristalleri = useMemo(() => crystals.filter(safakMi), [crystals]);

  /** Adres çubuğu kurulumla eşit kalsın — link paylaşınca kurulum da gider */
  const yaz = useCallback((ana: (number | null)[], saf: (number | null)[]) => {
    setSlots(ana); setSafak(saf);
    const code = kodla(ana, saf);
    router.replace(code.replace(/[-~]/g, "") ? `/kristaller?k=${code}` : "/kristaller", { scroll: false });
  }, [router]);

  /** Grup limitini aşan seçimler — oyunda da takılamaz */
  const asim = useMemo(() => {
    const say = new Map<number, { name: string; max: number; n: number }>();
    for (const c of takili) {
      if (!c.group) continue;
      const cur = say.get(c.group.key) ?? { name: c.group.name, max: c.group.max, n: 0 };
      cur.n++; say.set(c.group.key, cur);
    }
    return Array.from(say.values()).filter((g) => g.n > g.max);
  }, [takili]);

  function yukle(b: KayitliBuild) {
    const c = coz(b.code);
    setAd(b.name);
    yaz(c.ana, c.safak);
  }

  if (loading) return <TestShell title="Kristal Kurulumu"><Empty>Yükleniyor…</Empty></TestShell>;
  if (error) return <TestShell title="Kristal Kurulumu"><Empty>{error}</Empty></TestShell>;

  return (
    <TestShell title="Kristal Kurulumu"
               subtitle="Her parçanın iki yuvası, altta Şafak kristalleri · kaydet, istersen klanla paylaş">
      <div className="space-y-3">
        <BuildKaydet kind="kristal" code={kod} ad={ad} onAd={setAd} onYukle={yukle} benId={session?.user?.id} />

        <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) 320px", alignItems: "start" }}>
          {/* Sol: yuvalar */}
          <div className="rounded-xl p-4" style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-[13px] font-semibold">Yuvalar</h2>
              <span className="t-chip">{takili.length} / {SLOTS + SAFAK}</span>
              <button onClick={() => { setAd(""); yaz(Array(SLOTS).fill(null), Array(SAFAK).fill(null)); }}
                      className="t-tab ml-auto" title="Hepsini boşalt">
                <Eraser className="w-3.5 h-3.5" /> Temizle
              </button>
            </div>

            <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))" }}>
              {PARCALAR.map((p, gi) => (
                <div key={p.ad} className="rounded-lg p-2.5"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                  <div className="text-[10.5px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--t-faint)" }}>{p.ad}</div>
                  <div className="flex gap-2">
                    {[0, 1].map((k) => {
                      const i = gi * 2 + k;
                      return (
                        <Slot key={i} item={secili[i]} size={52}
                              onPick={() => setPicking({ tur: "ana", i })}
                              onClear={() => yaz(slots.map((v, j) => (j === i ? null : v)), safak)} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Şafak kristalleri */}
            <div className="mt-3 rounded-lg p-2.5" style={{ background: "var(--t-raised)", border: "1px solid rgba(239,95,95,.28)" }}>
              <div className="text-[10.5px] uppercase tracking-[0.08em] mb-2" style={{ color: "var(--t-faint)" }}>
                Şafak Kristalleri <span style={{ color: "var(--t-faint)" }}>· {safakKristalleri.length} çeşit</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {seciliSafak.map((c, i) => (
                  <Slot key={i} item={c} size={52}
                        onPick={() => setPicking({ tur: "safak", i })}
                        onClear={() => yaz(slots, safak.map((v, j) => (j === i ? null : v)))} />
                ))}
              </div>
            </div>

            {asim.length > 0 && (
              <div className="flex items-start gap-2.5 mt-3 px-3 py-2 rounded-lg"
                   style={{ background: "rgba(239,95,95,.10)", border: "1px solid rgba(239,95,95,.35)" }}>
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--t-bad)" }} />
                <div className="text-[12px]">
                  <p style={{ color: "var(--t-bad)" }}>Bu kurulum oyunda takılamaz.</p>
                  {asim.map((g) => (
                    <p key={g.name} style={{ color: "var(--t-dim)" }}>{g.name}: {g.n} seçildi, en fazla {g.max}.</p>
                  ))}
                </div>
              </div>
            )}

            {takili.length > 0 && (
              <div className="mt-3 pt-3 grid gap-x-6 gap-y-1" style={{ borderTop: "1px solid var(--t-line)", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
                {takili.map((c, i) => (
                  <div key={c.id + i} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate" style={{ color: "var(--t-dim)" }}>{c.name}</span>
                    {c.group && <span className="shrink-0" style={{ color: "var(--t-faint)" }}>≤{c.group.max}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sağ: istatistikler */}
          <div style={{ height: "calc(100vh - 230px)", minHeight: 420, position: "sticky", top: 16 }}>
            <StatPaneli items={takili} />
          </div>
        </div>
      </div>

      {picking && (
        <Picker title={picking.tur === "safak" ? "Şafak kristali seç" : "Kristal seç"}
                items={picking.tur === "safak" ? safakKristalleri : normalKristaller}
                note={(c) => (c.group ? `${c.group.name} · en fazla ${c.group.max}` : null)}
                onClose={() => setPicking(null)}
                onSelect={(c) => {
                  if (picking.tur === "safak") yaz(slots, safak.map((v, j) => (j === picking.i ? c.itemId : v)));
                  else yaz(slots.map((v, j) => (j === picking.i ? c.itemId : v)), safak);
                }} />
      )}
    </TestShell>
  );
}
