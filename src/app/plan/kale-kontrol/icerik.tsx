"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Castle, ChevronLeft, MapPin, RotateCcw, Check } from "lucide-react";
import { TestShell } from "@/components/app-shell";
import type { HaritaNode } from "@/lib/bdo-harita";
import type { Isaret } from "@/components/dunya-haritasi";
import haritaVeri from "@/data/harita/nodlar.json";
import oyunKale from "@/data/harita/oyun-kale.json";

/**
 * Kale konumu kontrol ekranı.
 *
 * Üç kaynak aynı anda çiziliyor:
 *   altın  — oyun istemcisinden gelen fetih bölgesi çapası
 *   yeşil  — haritadan elle işaretlenmiş konum (veritabanı)
 *   sönük  — garmoth haritalarından türetilmiş eski tahmin
 *   mor    — hiçbir savaş mevzisine bağlanmayan çapalar
 *
 * Elle düzeltme sitede oyun çapasını eziyor; burada ikisi yan yana
 * duruyor ki hangisinin doğru olduğuna oyuna bakarak karar verilsin.
 * Liste varsayılan olarak "iki kaynak birbirinden en çok ayrılan"
 * sırada: kontrol etmeye değer olanlar en üstte.
 */

const Harita = dynamic(() => import("@/components/dunya-haritasi"), {
  ssr: false,
  loading: () => (
    <div className="h-full grid place-items-center text-[12.5px]" style={{ color: "var(--t-faint)" }}>
      Harita yükleniyor…
    </div>
  ),
});

const RENK = {
  oyun: "#e8b451",
  elle: "#38d07f",
  turetme: "#808089",
  eslesmeyen: "#c86fd8",
} as const;

type Kaynak = keyof typeof RENK;

const HAM = (haritaVeri as { nodlar: HaritaNode[] }).nodlar;
const SAVAS = HAM.filter((n) => n.tur === "savas");

type Capa = { nodeKey: number; nodeAd: string; x: number; z: number; mevziyeMetre: number; payKat?: number };
const CAPA = new Map<number, Capa>(
  (oyunKale as { nokta: Capa[] }).nokta.map((p) => [p.nodeKey, p]),
);
const ARTAN = (oyunKale as { eslesmeyen?: Array<{ x: number; z: number; enYakinAd: string | null; enYakinMetre: number }> })
  .eslesmeyen ?? [];

const metre = (ax: number, az: number, bx: number, bz: number) => Math.round(Math.hypot(ax - bx, az - bz) / 100);

export function KaleKontrol() {
  const [elle, setElle] = useState<Record<number, [number, number]>>({});
  const [yuklendi, setYuklendi] = useState(false);
  const [acik, setAcik] = useState<Record<Kaynak, boolean>>({
    oyun: true, elle: true, turetme: false, eslesmeyen: true,
  });
  const [bolgeler, setBolgeler] = useState<Set<string> | null>(null);   // null = hepsi
  const [sadeceAktif, setSadeceAktif] = useState(true);
  const [secili, setSecili] = useState<number | null>(null);
  const [odak, setOdak] = useState<{ x: number; z: number; zoom: number } | null>(null);
  const [odakKey, setOdakKey] = useState("");
  const [panel, setPanel] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/harita/kaleler").then((r) => (r.ok ? r.json() : { kaleler: [] }))
      .then((d: { kaleler: Array<{ nodeKey: number; x: number; z: number }> }) => {
        const m: Record<number, [number, number]> = {};
        for (const k of d.kaleler ?? []) m[k.nodeKey] = [k.x, k.z];
        setElle(m);
      })
      .catch(() => {})
      .finally(() => setYuklendi(true));
  }, []);

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); }, [msg]);

  /** Her mevzi için üç kaynağın durumu ve aralarındaki fark */
  const satirlar = useMemo(() => SAVAS.map((n) => {
    const c = CAPA.get(n.key);
    const e = elle[n.key];
    return {
      n,
      capa: c ? { x: c.x, z: c.z, mevziye: c.mevziyeMetre, pay: c.payKat ?? 9 } : null,
      elle: e ? { x: e[0], z: e[1] } : null,
      // nodlar.json'daki kaleX hâlâ eski garmoth türetmesi
      turetme: n.kaleX != null && n.kaleZ != null ? { x: n.kaleX, z: n.kaleZ } : null,
      fark: c && e ? metre(c.x, c.z, e[0], e[1]) : null,
    };
  }), [elle]);

  const bolgeSayilari = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of satirlar) {
      if (!s.capa && !s.elle) continue;
      m.set(s.n.bolge, (m.get(s.n.bolge) ?? 0) + 1);
    }
    return Array.from(m).sort((a, b) => b[1] - a[1]);
  }, [satirlar]);

  const bolgeAcik = useCallback((b: string) => bolgeler == null || bolgeler.has(b), [bolgeler]);

  const gorunen = useMemo(() => satirlar
    .filter((s) => (s.capa || s.elle || s.turetme) && bolgeAcik(s.n.bolge) && (!sadeceAktif || s.n.aktif))
    // İki kaynak en çok ayrışanlar üstte: kontrol sırası bu
    .sort((a, b) => (b.fark ?? -1) - (a.fark ?? -1) || a.n.ad.localeCompare(b.n.ad, "tr")),
  [satirlar, bolgeAcik, sadeceAktif]);

  /** Haritaya giden işaretler — her kaynak kendi rengiyle */
  const isaretler = useMemo<Isaret[]>(() => {
    const out: Isaret[] = [];
    for (const s of gorunen) {
      if (acik.turetme && s.turetme) {
        out.push({ id: `t${s.n.key}`, x: s.turetme.x, z: s.turetme.z, renk: RENK.turetme,
                   etiket: `${s.n.ad} · garmoth türetmesi`, bicim: "daire", onTik: () => setSecili(s.n.key) });
      }
      if (acik.oyun && s.capa) {
        out.push({ id: `o${s.n.key}`, x: s.capa.x, z: s.capa.z, renk: RENK.oyun,
                   etiket: `${s.n.ad} · oyun çapası · mevziye ${s.capa.mevziye} m`
                     + (s.capa.pay <= 1.3 ? " · eşleme şüpheli" : ""),
                   bicim: "kale", onTik: () => setSecili(s.n.key) });
      }
      if (acik.elle && s.elle) {
        out.push({ id: `e${s.n.key}`, x: s.elle.x, z: s.elle.z, renk: RENK.elle,
                   etiket: `${s.n.ad} · elle işaretlendi`
                     + (s.fark != null ? ` · çapadan ${s.fark} m` : ""),
                   bicim: "daire", onTik: () => setSecili(s.n.key) });
      }
    }
    if (acik.eslesmeyen) {
      for (const [i, a] of Array.from(ARTAN.entries())) {
        out.push({ id: `a${i}`, x: a.x, z: a.z, renk: RENK.eslesmeyen,
                   etiket: `eşleşmemiş çapa · en yakın ${a.enYakinAd ?? "—"} ${a.enYakinMetre} m`,
                   bicim: "kale" });
      }
    }
    return out;
  }, [gorunen, acik]);

  /* Kale ikonlarını biz çiziyoruz; harita kendi kalesini çizmesin diye
     düğümlerden kale konumu çıkarılıyor. */
  const haritaNodlari = useMemo(
    () => HAM.filter((n) => n.tur === "sehir" || (bolgeAcik(n.bolge) && (!sadeceAktif || n.aktif)))
      .map((n) => ({ ...n, kaleX: undefined, kaleZ: undefined })),
    [bolgeAcik, sadeceAktif],
  );

  function git(s: (typeof satirlar)[number]) {
    setSecili(s.n.key);
    const p = s.capa ?? s.elle ?? s.turetme ?? { x: s.n.x, z: s.n.z };
    setOdak({ x: p.x, z: p.z, zoom: 8 });
    setOdakKey(`kale-${s.n.key}-${Date.now()}`);
  }

  async function elleSil(key: number, ad: string) {
    const r = await fetch(`/api/harita/kaleler?nodeKey=${key}`, { method: "DELETE" });
    if (!r.ok) { setMsg("Silinemedi."); return; }
    setElle((p) => { const k = { ...p }; delete k[key]; return k; });
    setMsg(`${ad}: elle düzeltme kaldırıldı, oyun çapası geçerli.`);
  }

  const ayrilan = satirlar.filter((s) => (s.fark ?? 0) >= 50).length;
  const sec = gorunen.find((s) => s.n.key === secili) ?? null;

  return (
    <TestShell bare tam title="Kale kontrol">
      <div className="relative" style={{ height: "calc(100vh - 68px)" }}>
        <Harita
          nodlar={haritaNodlari}
          isaretler={isaretler}
          seciliKey={secili}
          onNode={(n) => {
            const s = satirlar.find((x) => x.n.key === n.key);
            if (s) git(s);
          }}
          odak={odak}
          odakKey={odakKey}
          className="absolute inset-0"
        />

        {msg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] px-3 py-2 rounded-[var(--t-r-sm)] text-[12px]"
               style={{ background: "rgba(16,16,19,.96)", border: "1px solid var(--t-line)" }}>
            {msg}
          </div>
        )}

        {panel ? (
          <div className="absolute top-3 left-3 bottom-3 z-[500] flex flex-col w-[330px] rounded-[var(--t-r)] overflow-hidden"
               style={{ background: "rgba(16,16,19,.94)", border: "1px solid var(--t-line)",
                        backdropFilter: "blur(6px)", boxShadow: "0 10px 40px rgba(0,0,0,.55)" }}>
            <div className="flex items-center gap-2 p-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <Castle className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold">Kale kontrol</p>
                <p className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>
                  {yuklendi ? `${ayrilan} mevzide kaynaklar 50 m'den fazla ayrışıyor` : "elle düzeltmeler yükleniyor…"}
                </p>
              </div>
              <button className="t-tab" onClick={() => setPanel(false)} title="Paneli gizle">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Katmanlar */}
            <div className="p-3 space-y-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                 style={{ color: "var(--t-faint)" }}>Katmanlar</p>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["oyun", "Oyun çapası"], ["elle", "Elle"], ["turetme", "Garmoth"], ["eslesmeyen", `Boşta (${ARTAN.length})`],
                ] as Array<[Kaynak, string]>).map(([k, ad]) => (
                  <button key={k} className="t-tab" data-on={acik[k]}
                          style={{ padding: "0.35rem 0.6rem" }}
                          onClick={() => setAcik((v) => ({ ...v, [k]: !v[k] }))}>
                    <i className="w-2 h-2 rounded-full" style={{ background: RENK[k] }} /> {ad}
                  </button>
                ))}
              </div>
              <button className="t-tab" data-on={sadeceAktif} style={{ padding: "0.35rem 0.6rem" }}
                      onClick={() => setSadeceAktif((v) => !v)}>
                Yalnız savaş açık mevziler
              </button>
            </div>

            {/* Bölgeler */}
            <div className="p-3 space-y-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] flex-1"
                   style={{ color: "var(--t-faint)" }}>Bölge</p>
                <button className="t-tab" style={{ padding: "0.25rem 0.5rem" }}
                        onClick={() => setBolgeler(null)}>Hepsi</button>
                <button className="t-tab" style={{ padding: "0.25rem 0.5rem" }}
                        onClick={() => setBolgeler(new Set())}>Hiçbiri</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bolgeSayilari.map(([b, n]) => (
                  <button key={b} className="t-tab" data-on={bolgeAcik(b)}
                          style={{ padding: "0.35rem 0.6rem" }}
                          onClick={() => setBolgeler((v) => {
                            const s = new Set(v ?? bolgeSayilari.map(([x]) => x));
                            if (s.has(b)) s.delete(b); else s.add(b);
                            return s;
                          })}>
                    {b} ({n})
                  </button>
                ))}
              </div>
            </div>

            {/* Seçili mevzinin ayrıntısı */}
            {sec && (
              <div className="p-3 space-y-1.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
                <p className="text-[13px] font-semibold">{sec.n.ad}</p>
                <div className="space-y-1 t-num text-[11px]">
                  {sec.capa && (
                    <p style={{ color: RENK.oyun }}>
                      oyun çapası {Math.round(sec.capa.x)}, {Math.round(sec.capa.z)}
                      <span style={{ color: "var(--t-faint)" }}> · mevziye {sec.capa.mevziye} m
                        {sec.capa.pay <= 1.3 && " · eşleme şüpheli"}</span>
                    </p>
                  )}
                  {sec.elle && (
                    <p style={{ color: RENK.elle }}>
                      elle {Math.round(sec.elle.x)}, {Math.round(sec.elle.z)}
                      {sec.fark != null && <span style={{ color: "var(--t-faint)" }}> · çapadan {sec.fark} m</span>}
                    </p>
                  )}
                  {sec.turetme && (
                    <p style={{ color: RENK.turetme }}>
                      garmoth {Math.round(sec.turetme.x)}, {Math.round(sec.turetme.z)}
                    </p>
                  )}
                </div>
                {sec.elle && (
                  <button className="t-tab" onClick={() => void elleSil(sec.n.key, sec.n.ad)}>
                    <RotateCcw className="w-3.5 h-3.5" /> Elle düzeltmeyi kaldır
                  </button>
                )}
                {!sec.elle && sec.capa && (
                  <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--t-faint)" }}>
                    <Check className="w-3.5 h-3.5" style={{ color: RENK.oyun }} /> oyun çapası geçerli
                  </p>
                )}
              </div>
            )}

            {/* Liste */}
            <div className="flex-1 overflow-y-auto p-1.5">
              {gorunen.map((s) => (
                <button key={s.n.key} onClick={() => git(s)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left"
                        style={{ background: secili === s.n.key ? "var(--t-raised)" : "transparent" }}>
                  <span className="flex gap-[3px] flex-shrink-0">
                    <i className="w-2 h-2 rounded-full"
                       style={{ background: s.capa ? RENK.oyun : "transparent",
                                border: s.capa ? "none" : "1px solid var(--t-line-strong)" }} />
                    <i className="w-2 h-2 rounded-full"
                       style={{ background: s.elle ? RENK.elle : "transparent",
                                border: s.elle ? "none" : "1px solid var(--t-line-strong)" }} />
                  </span>
                  <span className="text-[12.5px] truncate flex-1"
                        style={s.n.aktif ? { fontWeight: 600 } : undefined}>{s.n.ad}</span>
                  <span className="t-num text-[10.5px] flex-shrink-0"
                        style={{ color: s.fark == null ? "var(--t-faint)"
                          : s.fark >= 100 ? "var(--t-bad)" : s.fark >= 50 ? "var(--t-gold)" : "var(--t-faint)" }}>
                    {s.fark != null ? `${s.fark} m` : "—"}
                  </span>
                </button>
              ))}
              {gorunen.length === 0 && (
                <p className="text-[12px] p-3" style={{ color: "var(--t-faint)" }}>
                  Seçili bölgelerde kale konumu yok.
                </p>
              )}
            </div>

            <p className="px-3 py-2 text-[10px]" style={{ color: "var(--t-faint)", borderTop: "1px solid var(--t-line)" }}>
              sağdaki sayı: oyun çapası ile elle işaret arası mesafe
            </p>
          </div>
        ) : (
          <button onClick={() => setPanel(true)}
                  className="absolute top-3 left-3 z-[500] t-tab"
                  style={{ background: "rgba(16,16,19,.94)" }}>
            <MapPin className="w-3.5 h-3.5" /> Panel
          </button>
        )}
      </div>
    </TestShell>
  );
}
