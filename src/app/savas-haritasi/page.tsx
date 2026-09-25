"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Search, Swords, Upload, MapPin, Castle, Users, Skull, X, ChevronLeft, Crosshair, Flame,
  Move, RotateCcw, Check, Radio, BarChart3,
} from "lucide-react";
import { TestShell } from "@/components/app-shell";
import { olaylariCoz, olayOzeti, type SavasOlayi } from "@/lib/savas-olaylari";
import { KayitSecici } from "@/components/kayit-secici";
import { SavasAnalizi } from "@/components/savas-analizi";
import { useRakipSiniflari } from "@/lib/rakip-siniflari";
import { TIER_RENK, enYakinNode, type HaritaNode } from "@/lib/bdo-harita";
import haritaVeri from "@/data/harita/nodlar.json";

/**
 * Savaş haritası — oyunun kendi haritası, tam ekran.
 *
 * Taban karolar ve mevzi konumları oyun istemcisinden çıkarıldı, yani
 * koordinat dönüşümü uydurma değil tanım (bkz. `bdo-harita.ts`): bir
 * piksel tam 100 oyun birimi. Garmoth karolarında yaşadığımız kayma
 * meselesi burada yok.
 *
 * Sol panelde iki sekme: mevzi ara/seç ve bir savaş kaydını haritaya bas.
 * Kayıt tarayıcıda çözülüyor, sunucuya gitmiyor — biçim hâlâ kalibrasyon
 * aşamasında ve satırlar oyuncu adı taşıyor.
 */

const Harita = dynamic(() => import("@/components/dunya-haritasi"), {
  ssr: false,
  loading: () => (
    <div className="h-full grid place-items-center text-[12.5px]" style={{ color: "var(--t-faint)" }}>
      Harita yükleniyor…
    </div>
  ),
});

const NODLAR = (haritaVeri as { nodlar: HaritaNode[] }).nodlar;
const SAVAS_NODLARI = NODLAR.filter((n) => n.tur === "savas");
const AKTIF_SAYI = SAVAS_NODLARI.filter((n) => n.aktif).length;
const KALE_SAYI = SAVAS_NODLARI.filter((n) => n.kale).length;

export default function SavasHaritasiPage() {
  const { data: session } = useSession();
  const yonetici = !!session?.user?.canManageWars;
  const [sekme, setSekme] = useState<"mevzi" | "savas" | "analiz">("mevzi");
  const [ara, setAra] = useState("");
  const [seciliHam, setSecili] = useState<HaritaNode | null>(null);
  const [olaylar, setOlaylar] = useState<SavasOlayi[]>([]);
  const [seciliOlay, setSeciliOlay] = useState<number | null>(null);
  const [ham, setHam] = useState("");
  /** Yüklenen kaydın kimden geldiği — panelde kaynağı göstermek için */
  const [kaynak, setKaynak] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [suzgec, setSuzgec] = useState<"hepsi" | "kill" | "death">("hepsi");
  const [isi, setIsi] = useState(false);
  const [odak, setOdak] = useState<{ x: number; z: number; zoom: number } | null>(null);
  const [odakKey, setOdakKey] = useState("");
  const [panel, setPanel] = useState(true);
  /** Oyunda savaş açık olan mevziler — listeyi buna daraltmak için */
  const [sadeceAktif, setSadeceAktif] = useState(true);
  const [karoHata, setKaroHata] = useState(false);
  /** Kuşatma kalesi sahaları — savaş mevzilerinden bağımsız katman */
  const [kaleler, setKaleler] = useState(true);
  /** Elle düzeltilmiş kale konumları: nodeKey → [x, z] */
  const [elleKale, setElleKale] = useState<Record<number, [number, number]>>({});
  /** Konumu taşınan mevzi — haritaya tıklayınca kaydediliyor */
  const [tasinan, setTasinan] = useState<HaritaNode | null>(null);
  const dosya = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); }, [msg]);

  useEffect(() => {
    fetch("/api/harita/kaleler").then((r) => (r.ok ? r.json() : { kaleler: [] }))
      .then((d: { kaleler: Array<{ nodeKey: number; x: number; z: number }> }) => {
        const m: Record<number, [number, number]> = {};
        for (const k of d.kaleler ?? []) m[k.nodeKey] = [k.x, k.z];
        setElleKale(m);
      })
      .catch(() => {});
  }, []);

  /** Elle kayıt varsa türetilmiş konumun yerine geçer */
  const kaleKonumlu = useMemo(
    () => NODLAR.map((n) => {
      const e = elleKale[n.key];
      return e ? { ...n, kaleX: e[0], kaleZ: e[1], kaleUzak: Math.round(Math.hypot(e[0] - n.x, e[1] - n.z) / 100) } : n;
    }),
    [elleKale],
  );

  /** Panelde elle ayarlanmış konum görünsün diye güncel kayıttan okunuyor */
  const secili = seciliHam ? kaleKonumlu.find((n) => n.key === seciliHam.key) ?? seciliHam : null;

  async function kaleKaydet(n: HaritaNode, x: number, z: number) {
    setElleKale((p) => ({ ...p, [n.key]: [x, z] }));
    setTasinan(null);
    const r = await fetch("/api/harita/kaleler", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeKey: n.key, x, z }),
    });
    setMsg(r.ok ? `${n.ad} kalesi taşındı.` : "Kaydedilemedi.");
  }
  async function kaleSifirla(n: HaritaNode) {
    setElleKale((p) => { const k = { ...p }; delete k[n.key]; return k; });
    const r = await fetch(`/api/harita/kaleler?nodeKey=${n.key}`, { method: "DELETE" });
    setMsg(r.ok ? `${n.ad} kalesi varsayılana döndü.` : "Sıfırlanamadı.");
  }

  const liste = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase("tr");
    // Arama yazılınca daraltma kalkıyor: aranan mevzi aktif olmayabilir
    const taban = sadeceAktif && !q
      ? SAVAS_NODLARI.filter((n) => n.aktif || (kaleler && n.kale))
      : SAVAS_NODLARI;
    const v = q
      ? taban.filter((n) => n.ad.toLocaleLowerCase("tr").includes(q) || n.adEn.toLowerCase().includes(q))
      : taban;
    return v.slice(0, 150);
  }, [ara, sadeceAktif, kaleler]);

  /** Haritaya giden düğümler — süzgeç açıkken yalnızca savaşı açık olanlar */
  const haritaNodlari = useMemo(
    () => kaleKonumlu.filter((n) =>
      n.tur === "sehir" ? true
        : n.kale ? kaleler
          : !sadeceAktif || !!n.aktif),
    [sadeceAktif, kaleler, kaleKonumlu],
  );

  const gorunen = useMemo(
    () => olaylar.filter((o) => suzgec === "hepsi" || (suzgec === "kill") === o.bizimKill),
    [olaylar, suzgec],
  );
  const ozet = useMemo(() => olayOzeti(gorunen), [gorunen]);
  // Rakip sınıfları arka planda okunuyor; analiz kapalıyken de sürüyor
  const sinif = useRakipSiniflari(olaylar);

  /** Kavga nerede geçti — olayların ortalamasına en yakın mevzi */
  const savasYeri = useMemo(() => {
    if (olaylar.length === 0) return null;
    const x = olaylar.reduce((s, o) => s + o.dunya[0], 0) / olaylar.length;
    const z = olaylar.reduce((s, o) => s + o.dunya[2], 0) / olaylar.length;
    const en = enYakinNode(SAVAS_NODLARI, x, z);
    return en ? { node: en.node, metre: Math.round(en.d / 100) } : null;
  }, [olaylar]);

  function nodeSec(n: HaritaNode) {
    setSecili(n);
    setSekme("mevzi");
    setOdak({ x: n.x, z: n.z, zoom: 7 });
    setOdakKey(`node-${n.key}-${Date.now()}`);
  }

  function coz(metin: string, etiket?: string) {
    const { olaylar: o, atilan } = olaylariCoz(metin);
    setKaynak(etiket ?? null);
    setOlaylar(o);
    setSeciliOlay(null);
    if (o.length === 0) { setMsg("Okunabilir olay çıkmadı."); return; }
    setMsg(`${o.length} olay okundu${atilan ? `, ${atilan} satır atlandı` : ""}.`);
    const xs = o.map((e) => e.dunya[0]), zs = o.map((e) => e.dunya[2]);
    const yayilim = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 5000);
    // Yayılım ekrana sığsın: 1 piksel = 100 birim (z8), her seviye iki katı
    const zoom = Math.max(4, Math.min(8, Math.round(8 - Math.log2(yayilim / 60000))));
    setOdak({ x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2, zoom });
    setOdakKey(`olay-${Date.now()}`);
  }

  return (
    <TestShell bare tam title="Savaş Haritası">
      {/* Menü çubuğu 68px; harita geri kalan her şeyi kaplıyor */}
      <div className="relative" style={{ height: "calc(100vh - 68px)" }}>
        <Harita
          nodlar={haritaNodlari}
          olaylar={gorunen}
          seciliKey={secili?.key ?? null}
          onNode={nodeSec}
          onOlay={(at) => { setSeciliOlay(at === seciliOlay ? null : at); setSekme("savas"); }}
          seciliOlay={seciliOlay}
          isi={isi}
          odak={odak}
          odakKey={odakKey}
          onKaroHata={() => setKaroHata(true)}
          onNokta={tasinan ? (x, z) => void kaleKaydet(tasinan, x, z) : null}
          className="absolute inset-0"
        />

        {tasinan && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[600] px-3 py-2 rounded-[var(--t-r-sm)] text-[12px] flex items-center gap-2"
               style={{ background: "rgba(16,16,19,.96)", border: "1px solid rgba(232,180,81,.45)" }}>
            <Crosshair className="w-3.5 h-3.5" style={{ color: "var(--t-gold)" }} />
            <span><b>{tasinan.ad}</b> kalesinin doğru yerine tıkla</span>
            <button onClick={() => setTasinan(null)} className="t-tab">Vazgeç</button>
          </div>
        )}

        {sekme === "analiz" && olaylar.length > 0 && (
          <SavasAnalizi olaylar={gorunen} siniflar={sinif.siniflar} sinifDurum={sinif.durum}
                        okunan={sinif.okunan} toplam={sinif.toplam} kaynak={kaynak}
                        onKapat={() => setSekme("savas")} />
        )}

        {isi && olaylar.length > 0 && (
          <div className="absolute bottom-3 right-3 z-[500] px-3 py-2 rounded-[var(--t-r-sm)]"
               style={{ background: "rgba(16,16,19,.94)", border: "1px solid var(--t-line)" }}>
            <p className="text-[10px] uppercase tracking-[0.06em] mb-1" style={{ color: "var(--t-faint)" }}>
              Yoğunluk
            </p>
            <div className="h-[6px] w-[140px] rounded-full"
                 style={{ background: "linear-gradient(90deg, var(--t-good), var(--t-gold), var(--t-bad))" }} />
            <div className="flex justify-between text-[9.5px] mt-1" style={{ color: "var(--t-faint)" }}>
              <span>öldürdük</span><span>öldük</span>
            </div>
          </div>
        )}

        {karoHata && (
          <div className="absolute top-3 right-14 z-[500] px-3 py-2 rounded-[var(--t-r-sm)] text-[11.5px]"
               style={{ background: "rgba(16,16,19,.94)", border: "1px solid rgba(239,95,95,.35)", color: "#ef8080" }}>
            Harita karoları yüklenmiyor — karo sunucusu kapalı olabilir.
          </div>
        )}

        {panel ? (
          <div className="absolute top-3 left-3 bottom-3 z-[500] flex flex-col w-[320px] rounded-[var(--t-r)] overflow-hidden"
               style={{ background: "rgba(16,16,19,.94)", border: "1px solid var(--t-line)",
                        backdropFilter: "blur(6px)", boxShadow: "0 10px 40px rgba(0,0,0,.55)" }}>
            <div className="flex items-center gap-1 p-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <button className="t-tab" data-on={sekme === "mevzi"} onClick={() => setSekme("mevzi")}>
                <MapPin className="w-3.5 h-3.5" /> Mevziler
              </button>
              <button className="t-tab" data-on={sekme === "savas"} onClick={() => setSekme("savas")}>
                <Swords className="w-3.5 h-3.5" /> Savaş
              </button>
              {olaylar.length > 0 && (
                <button className="t-tab" data-on={sekme === "analiz"} onClick={() => setSekme("analiz")}>
                  <BarChart3 className="w-3.5 h-3.5" /> Analiz
                </button>
              )}
              <button className="t-tab ml-auto" onClick={() => setPanel(false)} title="Paneli gizle">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {msg && (
              <div className="px-3 py-2 text-[11.5px]"
                   style={{ color: "var(--t-gold)", borderBottom: "1px solid var(--t-line)" }}>
                {msg}
              </div>
            )}

            {sekme === "mevzi" && (
              <div className="flex flex-col min-h-0 flex-1">
                <div className="p-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
                  <div className="flex items-center gap-2 px-2 h-[34px] rounded-[var(--t-r-sm)]"
                       style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                    <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--t-faint)" }} />
                    <input value={ara} onChange={(e) => setAra(e.target.value)} placeholder="Mevzi ara…"
                           className="bg-transparent outline-none text-[12.5px] w-full"
                           style={{ color: "var(--t-text)" }} />
                    {ara && (
                      <button onClick={() => setAra("")}>
                        <X className="w-3.5 h-3.5" style={{ color: "var(--t-faint)" }} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setSadeceAktif((v) => !v)} className="t-tab" data-on={sadeceAktif}>
                      <Flame className="w-3.5 h-3.5" /> Savaş açık ({AKTIF_SAYI})
                    </button>
                    <button onClick={() => setKaleler((v) => !v)} className="t-tab" data-on={kaleler}
                            title="Kuşatma savaşının yapıldığı kale sahaları">
                      <Castle className="w-3.5 h-3.5" /> Kuşatma ({KALE_SAYI})
                    </button>
                    <span className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>
                      {liste.length}
                    </span>
                  </div>
                </div>

                {secili && (
                  <div className="p-3 space-y-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
                    <div className="flex items-start gap-2">
                      <Castle className="w-4 h-4 mt-0.5 flex-shrink-0"
                              style={{ color: TIER_RENK[secili.tier] ?? "var(--t-gold)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold truncate">{secili.ad}</p>
                        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>{secili.adEn}</p>
                      </div>
                      <button onClick={() => setSecili(null)}>
                        <X className="w-3.5 h-3.5" style={{ color: "var(--t-faint)" }} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Bilgi etiket={secili.kale ? "Savaş" : "Kademe"}
                             deger={secili.kale ? "Kuşatma" : secili.tier ? `T${secili.tier}` : "—"}
                             renk={secili.kale ? "#c86fd8" : TIER_RENK[secili.tier]} />
                      <Bilgi etiket="Bölge" deger={secili.bolge || "—"} />
                      <Bilgi etiket="Kale" deger={secili.kaleUzak != null ? `${secili.kaleUzak} m` : "—"} />
                      <Bilgi etiket="Durum" deger={secili.aktif ? "Savaş açık" : "Kapalı"}
                             renk={secili.aktif ? "var(--t-good)" : undefined} />
                    </div>
                    <p className="t-num text-[10.5px]" style={{ color: "var(--t-faint)" }}>
                      oyun konumu {secili.x}, {secili.z}
                      {elleKale[secili.key] && <span style={{ color: "var(--t-good)" }}> · kale elle ayarlı</span>}
                    </p>
                    {yonetici && secili.tur === "savas" && (
                      <div className="flex gap-1.5">
                        <button onClick={() => setTasinan(tasinan?.key === secili.key ? null : secili)}
                                className="t-tab" data-on={tasinan?.key === secili.key}>
                          {tasinan?.key === secili.key
                            ? <><Check className="w-3.5 h-3.5" /> Haritaya tıkla</>
                            : <><Move className="w-3.5 h-3.5" /> Kaleyi taşı</>}
                        </button>
                        {elleKale[secili.key] && (
                          <button onClick={() => void kaleSifirla(secili)} className="t-tab">
                            <RotateCcw className="w-3.5 h-3.5" /> Varsayılan
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-1.5">
                  {liste.map((n) => (
                    <button key={n.key} onClick={() => nodeSec(n)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left"
                            style={{ background: secili?.key === n.key ? "var(--t-raised)" : "transparent" }}>
                      <i className="w-2 h-2 rounded-full flex-shrink-0"
                         style={{ background: n.kale ? "#c86fd8" : TIER_RENK[n.tier] ?? "#888" }} />
                      <span className="text-[12.5px] truncate flex-1"
                            style={n.aktif ? { fontWeight: 600 } : undefined}>{n.ad}</span>
                      <span className="t-num text-[10.5px] flex-shrink-0"
                            style={{ color: n.kale ? "#c86fd8" : n.aktif ? "var(--t-gold)" : "var(--t-faint)" }}>
                        {n.kale ? "♜" : `T${n.tier}`}
                      </span>
                    </button>
                  ))}
                  {liste.length === 0 && (
                    <p className="text-[12px] p-3" style={{ color: "var(--t-faint)" }}>Eşleşen mevzi yok.</p>
                  )}
                </div>
              </div>
            )}

            {sekme === "savas" && (
              <div className="flex flex-col min-h-0 flex-1">
                {olaylar.length === 0 ? (
                  <>
                  <KayitSecici onYukle={(satirlar, etiket) => coz(JSON.stringify(satirlar), etiket)} />
                  <div className="p-3 space-y-2">
                    <p className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>
                      Kayıt incelemesinin çıktısını yapıştır; kill ve ölümler haritaya düşsün.
                    </p>
                    <textarea value={ham} onChange={(e) => setHam(e.target.value)}
                              placeholder="JSON çıktısı…"
                              className="w-full h-28 rounded-[var(--t-r-sm)] p-2 text-[11px] outline-none t-num"
                              style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
                    <div className="flex gap-1.5">
                      <button onClick={() => coz(ham)} disabled={!ham.trim()} className="t-tab" data-on>
                        <Swords className="w-3.5 h-3.5" /> Haritaya bas
                      </button>
                      <input ref={dosya} type="file" accept=".json,.txt,.log" className="hidden"
                             onChange={(e) => {
                               const f = e.target.files?.[0];
                               if (f) void f.text().then((t) => { setHam(t); coz(t); });
                               e.target.value = "";
                             }} />
                      <button onClick={() => dosya.current?.click()} className="t-tab">
                        <Upload className="w-3.5 h-3.5" /> Dosya
                      </button>
                    </div>
                    <p className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>
                      Elle yapıştırılan veri tarayıcıdan çıkmıyor.
                    </p>
                  </div>
                  </>
                ) : (
                  <div className="flex flex-col min-h-0 flex-1">
                    <div className="p-2 space-y-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
                      {kaynak && (
                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--t-faint)" }}>
                          <Radio className="w-3 h-3" style={{ color: "var(--t-gold)" }} />
                          <span className="truncate">{kaynak}</span>
                        </div>
                      )}
                      {savasYeri && (
                        <div className="flex items-center gap-1.5 text-[11.5px]">
                          <Crosshair className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--t-gold)" }} />
                          <span className="truncate">{savasYeri.node.ad}</span>
                          <span style={{ color: "var(--t-faint)" }}>· {savasYeri.metre} m</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 p-0.5 rounded-[var(--t-r-sm)]"
                           style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                        {([["hepsi", "Hepsi"], ["kill", "Kill"], ["death", "Ölüm"]] as const).map(([k, l]) => (
                          <button key={k} onClick={() => setSuzgec(k)}
                                  className="px-2 py-1 rounded-md text-[11px] font-semibold flex-1"
                                  style={suzgec === k
                                    ? { color: "var(--t-gold)", background: "var(--t-gold-soft)" }
                                    : { color: "var(--t-faint)" }}>
                            {l}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 text-[11.5px]">
                        <span style={{ color: "var(--t-good)" }}>{ozet.kill} kill</span>
                        <span style={{ color: "var(--t-bad)" }}>{ozet.death} ölüm</span>
                        <button onClick={() => setIsi((v) => !v)} className="t-tab ml-auto" data-on={isi}
                                title="Olay yoğunluğu — ekran ölçeğinde, alan hâkimiyeti değil">
                          <Flame className="w-3.5 h-3.5" /> Isı
                        </button>
                        <button onClick={() => { setOlaylar([]); setHam(""); setSeciliOlay(null); setIsi(false); setKaynak(null); }}
                                className="t-tab">Temizle</button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      <Baslik icon={Users} metin={`Bizimkiler · ${ozet.biz.length}`} />
                      {ozet.biz.map((p) => (
                        <div key={p.ad} className="flex items-center gap-2 px-3 py-1 text-[12px]">
                          <span className="flex-1 truncate">{p.ad}</span>
                          <span className="t-num" style={{ color: "var(--t-good)" }}>{p.kill}</span>
                          <span className="t-num" style={{ color: "var(--t-bad)" }}>{p.death}</span>
                        </div>
                      ))}
                      <Baslik icon={Skull} metin={`Karşı taraf · ${ozet.rakip.length}`} />
                      {ozet.rakip.map((p) => (
                        <div key={p.ad} className="flex items-center gap-2 px-3 py-1 text-[12px]">
                          <span className="flex-1 truncate" style={{ color: "var(--t-dim)" }}>{p.ad}</span>
                          <span className="t-num" style={{ color: "var(--t-good)" }}>{p.kill}</span>
                          <span className="t-num" style={{ color: "var(--t-bad)" }}>{p.death}</span>
                        </div>
                      ))}
                      <Baslik icon={Swords} metin={`Olaylar · ${gorunen.length}`} />
                      {gorunen.map((o) => (
                        <button key={o.at} onClick={() => setSeciliOlay(o.at === seciliOlay ? null : o.at)}
                                className="w-full flex items-center gap-1.5 px-3 py-1 text-[11.5px] text-left"
                                style={{ background: o.at === seciliOlay ? "var(--t-raised)" : "transparent" }}>
                          <span className="t-num text-[10.5px]" style={{ color: "var(--t-faint)" }}>
                            {new Date(o.at).toLocaleTimeString("tr-TR")}
                          </span>
                          <span className="truncate" style={{ color: o.bizimKill ? "var(--t-good)" : "var(--t-text)" }}>
                            {o.bizimAile}
                          </span>
                          <span style={{ color: "var(--t-faint)" }}>{o.bizimKill ? "→" : "←"}</span>
                          <span className="truncate" style={{ color: o.bizimKill ? "var(--t-text)" : "var(--t-bad)" }}>
                            {o.rakipAile}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="px-3 py-2" style={{ borderTop: "1px solid var(--t-line)" }}>
              <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                {SAVAS_NODLARI.length} mevzi · karolar ve konumlar oyun istemcisinden
              </span>
            </div>
          </div>
        ) : (
          <button onClick={() => setPanel(true)} className="t-tab absolute top-3 left-3 z-[500]"
                  style={{ background: "rgba(16,16,19,.94)" }}>
            <MapPin className="w-3.5 h-3.5" /> Panel
          </button>
        )}
      </div>
    </TestShell>
  );
}

function Bilgi({ etiket, deger, renk }: { etiket: string; deger: string; renk?: string }) {
  return (
    <div className="px-2 py-1 rounded-[var(--t-r-sm)]" style={{ background: "var(--t-raised)" }}>
      <p className="text-[9px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{etiket}</p>
      <p className="text-[12px]" style={{ color: renk ?? "var(--t-text)" }}>{deger}</p>
    </div>
  );
}

function Baslik({ icon: Icon, metin }: { icon: React.ElementType; metin: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 sticky top-0"
         style={{ background: "rgba(16,16,19,.96)", borderBottom: "1px solid var(--t-line)" }}>
      <Icon className="w-3 h-3" style={{ color: "var(--t-gold)" }} />
      <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{metin}</span>
    </div>
  );
}
