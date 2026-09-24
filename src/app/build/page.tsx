"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Gem, Sparkles, FlaskConical, UtensilsCrossed, Eraser } from "lucide-react";
import { TestShell, Empty, loadJson } from "@/components/app-shell";
import { Slot, Picker, type Equippable, type StatRow } from "@/components/loadout";
import { StatPaneli } from "@/components/stat-paneli";
import { BuildKaydet, type KayitliBuild } from "@/components/build-kaydet";
import { statTr } from "@/lib/bdo-stats";

/**
 * Build — ekipmansız kurulum.
 *
 * Silah/zırh yok; bir karakterin "neyi nereye taktığı ve ne kullandığı":
 * kristaller, eser + ışık taşları, iksirler ve yemekler. Hepsi tek ekranda,
 * ada verilip kaydediliyor; herkese açık yapılırsa klandaki herkes görüyor.
 * Sağdaki panel toplam etkiyi oyundaki başlıklara ayırıyor.
 *
 * Kayıt kodu tek dize: `k:<kristaller>|s:<şafak>|e:<eserler>|t:<taşlar>|i:<iksirler>|y:<yemekler>`
 */

const BOLUM = { kristal: 14, safak: 6, eser: 2, tas: 4, iksir: 3, yemek: 2 } as const;
type Bolum = keyof typeof BOLUM;
const ONEK: Record<Bolum, string> = { kristal: "k", safak: "s", eser: "e", tas: "t", iksir: "i", yemek: "y" };

type Secim = Record<Bolum, (number | null)[]>;
const bos = (): Secim => ({
  kristal: Array(BOLUM.kristal).fill(null), safak: Array(BOLUM.safak).fill(null),
  eser: Array(BOLUM.eser).fill(null), tas: Array(BOLUM.tas).fill(null),
  iksir: Array(BOLUM.iksir).fill(null), yemek: Array(BOLUM.yemek).fill(null),
});

function kodla(s: Secim): string {
  const parca = (b: Bolum) => {
    const v = s[b].map((x) => (x == null ? "" : String(x))).join("-").replace(/-+$/, "");
    return v ? `${ONEK[b]}:${v}` : "";
  };
  return (Object.keys(BOLUM) as Bolum[]).map(parca).filter(Boolean).join("|");
}
function coz(code: string | null): Secim {
  const out = bos();
  if (!code) return out;
  for (const p of code.split("|")) {
    const [on, ham = ""] = p.split(":");
    const b = (Object.keys(ONEK) as Bolum[]).find((k) => ONEK[k] === on);
    if (!b) continue;
    ham.split("-").slice(0, BOLUM[b]).forEach((x, i) => { const v = Number(x); out[b][i] = x !== "" && Number.isFinite(v) ? v : null; });
  }
  return out;
}

const safakMi = (c: Equippable) => /şafak/i.test(c.name);
interface Combo { id: string; name: string; required: string[]; stats: StatRow[] }

export default function BuildPage() {
  return <Suspense fallback={<TestShell title="Build"><Empty>Yükleniyor…</Empty></TestShell>}><Icerik /></Suspense>;
}

function Icerik() {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session } = useSession();

  const [crystals, setCrystals] = useState<Equippable[]>([]);
  const [artifacts, setArtifacts] = useState<Equippable[]>([]);
  const [lightstones, setLightstones] = useState<Equippable[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [iksirler, setIksirler] = useState<Equippable[]>([]);
  const [yemekler, setYemekler] = useState<Equippable[]>([]);
  const [hata, setHata] = useState<string | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ad, setAd] = useState("");
  const [picking, setPicking] = useState<{ b: Bolum; i: number } | null>(null);
  const [secim, setSecim] = useState<Secim>(() => coz(params.get("b")));

  useEffect(() => {
    Promise.all([
      loadJson<{ crystals: Equippable[] }>("/api/kurulum?ne=kristal"),
      loadJson<{ artifacts: Equippable[]; lightstones: Equippable[]; combos: Combo[] }>("/api/kurulum?ne=eser"),
      loadJson<{ iksirler: Equippable[]; yemekler: Equippable[] }>("/api/kurulum?ne=tuketilen"),
    ]).then(([k, e, t]) => {
      setCrystals(k.crystals); setArtifacts(e.artifacts); setLightstones(e.lightstones); setCombos(e.combos);
      setIksirler(t.iksirler); setYemekler(t.yemekler);
    }).catch((err) => setHata((err as Error).message)).finally(() => setYukleniyor(false));
  }, []);

  const havuz = useMemo(() => new Map<Bolum, Equippable[]>([
    ["kristal", crystals.filter((c) => !safakMi(c))],
    ["safak", crystals.filter(safakMi)],
    ["eser", artifacts],
    ["tas", lightstones],
    ["iksir", iksirler],
    ["yemek", yemekler],
  ]), [crystals, artifacts, lightstones, iksirler, yemekler]);

  const byId = useMemo(() => {
    const m = new Map<number, Equippable>();
    for (const liste of Array.from(havuz.values())) for (const it of liste) m.set(it.itemId, it);
    return m;
  }, [havuz]);

  const secili = useCallback((b: Bolum) => secim[b].map((id) => (id != null ? byId.get(id) ?? null : null)), [secim, byId]);
  const takili = useMemo(
    () => (Object.keys(BOLUM) as Bolum[]).flatMap((b) => secili(b)).filter((x): x is Equippable => !!x),
    [secili],
  );

  const kod = useMemo(() => kodla(secim), [secim]);
  const yaz = useCallback((s: Secim) => {
    setSecim(s);
    const code = kodla(s);
    router.replace(code ? `/build?b=${encodeURIComponent(code)}` : "/build", { scroll: false });
  }, [router]);
  const koy = (b: Bolum, i: number, id: number | null) =>
    yaz({ ...secim, [b]: secim[b].map((v, j) => (j === i ? id : v)) });

  /** Açılan ışık taşı kombinasyonu — eserler gibi, taş adlarına bakarak */
  const acilanKombo = useMemo(() => {
    const adlar = secili("tas").filter((s): s is Equippable => !!s).map((s) => s.name);
    if (adlar.length < 3) return null;
    return combos.find((c) => c.required.every((r) => adlar.some((n) => n.includes(r.replace(/<[^>]*>/g, "").trim())))) ?? null;
  }, [secili, combos]);
  const komboStat = useMemo(
    () => (acilanKombo?.stats ?? []).map((s) => ({ label: statTr(s.stat), value: (s.op === "-" ? -1 : 1) * (s.value ?? 0), unit: s.unit === "%" ? "%" : "" })),
    [acilanKombo],
  );

  function yukleKayit(b: KayitliBuild) { setAd(b.name); yaz(coz(b.code)); }

  if (yukleniyor) return <TestShell title="Build"><Empty>Yükleniyor…</Empty></TestShell>;
  if (hata) return <TestShell title="Build"><Empty>{hata}</Empty></TestShell>;

  const bolum = (b: Bolum, baslik: string, Ikon: typeof Gem, boyut = 52) => (
    <div className="rounded-xl p-3" style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
      <div className="flex items-center gap-2 mb-2.5">
        <Ikon className="w-3.5 h-3.5" style={{ color: "var(--t-gold)" }} />
        <h3 className="text-[12.5px] font-semibold">{baslik}</h3>
        <span className="t-num text-[11px] ml-auto" style={{ color: "var(--t-faint)" }}>
          {secim[b].filter(Boolean).length}/{BOLUM[b]}
        </span>
      </div>
      <div className="flex gap-2 flex-wrap">
        {secili(b).map((it, i) => (
          <Slot key={i} item={it} size={boyut}
                onPick={() => setPicking({ b, i })}
                onClear={() => koy(b, i, null)} />
        ))}
      </div>
      {secim[b].some(Boolean) && (
        <div className="mt-2 pt-2 grid gap-y-0.5" style={{ borderTop: "1px solid var(--t-line)" }}>
          {secili(b).filter((x): x is Equippable => !!x).map((it, i) => (
            <span key={it.id + i} className="text-[11px] truncate" style={{ color: "var(--t-dim)" }}>{it.name}</span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <TestShell title="Build"
               subtitle="Kristaller, eser & ışık taşları, iksirler ve yemekler — tek ekranda, adıyla kayıtlı">
      <div className="space-y-3">
        <BuildKaydet kind="build" code={kod} ad={ad} onAd={setAd} onYukle={yukleKayit} benId={session?.user?.id} />

        <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) 320px", alignItems: "start" }}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                {takili.length} parça seçili
              </span>
              <button onClick={() => { setAd(""); yaz(bos()); }} className="t-tab ml-auto">
                <Eraser className="w-3.5 h-3.5" /> Temizle
              </button>
            </div>

            {bolum("kristal", "Kristaller", Gem)}
            {bolum("safak", "Şafak Kristalleri", Gem)}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {bolum("eser", "Eserler", Sparkles, 58)}
              {bolum("tas", "Işık Taşları", Sparkles, 58)}
            </div>
            {acilanKombo && (
              <div className="rounded-xl px-3 py-2 text-[12px]"
                   style={{ background: "var(--t-gold-soft)", border: "1px solid rgba(232,180,81,.35)" }}>
                <span style={{ color: "var(--t-gold)" }}>Açılan kombinasyon:</span>{" "}
                {acilanKombo.name.replace(/<[^>]*>/g, "")}
              </div>
            )}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              {bolum("iksir", "İksirler", FlaskConical, 48)}
              {bolum("yemek", "Yemekler", UtensilsCrossed, 48)}
            </div>
          </div>

          <div style={{ height: "calc(100vh - 230px)", minHeight: 420, position: "sticky", top: 16 }}>
            <StatPaneli items={takili} ekstra={komboStat} />
          </div>
        </div>
      </div>

      {picking && (
        <Picker title={`${picking.b === "safak" ? "Şafak kristali" : picking.b === "kristal" ? "Kristal" : picking.b === "eser" ? "Eser" : picking.b === "tas" ? "Işık taşı" : picking.b === "iksir" ? "İksir" : "Yemek"} seç`}
                items={havuz.get(picking.b) ?? []}
                note={(c) => c.subCategory}
                onClose={() => setPicking(null)}
                onSelect={(c) => koy(picking.b, picking.i, c.itemId)} />
      )}
    </TestShell>
  );
}
