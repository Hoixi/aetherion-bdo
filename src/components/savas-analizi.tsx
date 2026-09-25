"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Shield, Users, Skull, Swords, Clock, Crosshair, Flame, Sparkles, X,
  Search, Loader2, Activity, Grid3x3, UserSearch,
} from "lucide-react";
import {
  savasAnalizi, olayYayilimi, zamanKovalari, sinifDagilimi, klanSinifMatrisi,
  karakterDagilimi, aileKadrosu, type SinifSatiri,
} from "@/lib/savas-analiz";
import type { SavasOlayi } from "@/lib/savas-olaylari";
import { BDO_CLASSES } from "@/lib/classes";
import type { SinifDurumu } from "@/lib/rakip-siniflari";
import {
  AkisGrafigi, FarkCizgisi, SinifDagilimGrafigi, KlanSinifMatrisi, sinifAdi, sinifIkonu,
} from "@/components/analiz-grafikler";

/**
 * Kaydın okunmuş hâli: kime öldük, kimi öldürdük, ne zaman dağıldık.
 *
 * Haritanın üstünde tam ekran duruyor — yan paneldeki 320 piksele sığmıyor,
 * hele 70-80 kişilik bir savaşta hiç sığmıyor. Bölümler genişliğe göre
 * sütunlara diziliyor, grafikler satırın tamamını kaplıyor.
 *
 * Rakip sınıfları dışarıdan geliyor (arka planda okunuyor, bkz.
 * `useRakipSiniflari`); başlıktaki düğme kuyruğu elle bir tur daha sürüyor.
 * Bizim sınıflarımız üye kaydından: aile adı → sitedeki class alanı.
 *
 * Bütün sayılar tek kaydın gördüğü olaylardan: o istemciye gelen akış
 * savaşın tamamı olmak zorunda değil, resmî rapor yerine geçmez.
 */

/** sitedeki class alanı ("cadi") → oyunun sınıf numarası */
const KIMLIK_TIP = new Map<string, number>(BDO_CLASSES.map((c) => [c.id, c.classType]));

/** Üye listesinden aile → sınıf numarası; savaşta bizim taraf için */
function useBizimSiniflar() {
  const [harita, setHarita] = useState<Record<string, number>>({});
  useEffect(() => {
    let iptal = false;
    fetch("/api/members")
      .then((r) => (r.ok ? r.json() : []))
      .then((uyeler: Array<{ familyName?: string; class?: string }>) => {
        if (iptal || !Array.isArray(uyeler)) return;
        const m: Record<string, number> = {};
        for (const u of uyeler) {
          const t = u.class ? KIMLIK_TIP.get(u.class) : undefined;
          if (u.familyName && t != null) m[u.familyName.toLocaleLowerCase("tr")] = t;
        }
        setHarita(m);
      })
      .catch(() => {});
    return () => { iptal = true; };
  }, []);
  return harita;
}

export function SavasAnalizi({
  olaylar, siniflar, kadro, sinifDurum, okunan, toplam, kalan, kaynak, onKapat, onSinifAra,
}: {
  olaylar: SavasOlayi[];
  /** karakter adı (küçük harf) → sınıf numarası */
  siniflar: Record<string, number>;
  /** aile adı (küçük harf) → profildeki bütün karakterleri */
  kadro?: Record<string, Array<{ ad: string; sinif: number }>>;
  sinifDurum: SinifDurumu;
  okunan: number;
  toplam: number;
  kalan?: number;
  kaynak?: string | null;
  onKapat: () => void;
  /** Sınıf kuyruğunu elle bir tur daha sür */
  onSinifAra?: () => void;
}) {
  const a = useMemo(() => savasAnalizi(olaylar), [olaylar]);
  const yayilim = useMemo(() => olayYayilimi(olaylar), [olaylar]);
  const { kovalar, kovaSn } = useMemo(() => zamanKovalari(olaylar), [olaylar]);
  const rakipSinif = useMemo(() => sinifDagilimi(olaylar, siniflar), [olaylar, siniflar]);
  const matris = useMemo(() => klanSinifMatrisi(olaylar, siniflar), [olaylar, siniflar]);
  const karakterler = useMemo(() => karakterDagilimi(olaylar, siniflar), [olaylar, siniflar]);
  const aileler = useMemo(() => aileKadrosu(olaylar, kadro ?? {}), [olaylar, kadro]);

  const bizimSinifHaritasi = useBizimSiniflar();
  /** Bizim taraf sınıf dağılımı — aile adı üye kaydıyla eşleşenler */
  const bizimSinif = useMemo(() => {
    const m = new Map<number, { kill: number; olum: number; aile: Set<string> }>();
    let bilinmeyen = 0;
    for (const o of olaylar) {
      const s = bizimSinifHaritasi[o.bizimAile.toLocaleLowerCase("tr")];
      if (s == null) { bilinmeyen++; continue; }
      const v = m.get(s) ?? { kill: 0, olum: 0, aile: new Set<string>() };
      if (o.bizimKill) v.kill++; else v.olum++;
      v.aile.add(o.bizimAile);
      m.set(s, v);
    }
    const satirlar: SinifSatiri[] = Array.from(m.entries())
      .map(([sinif, v]) => ({ sinif, kill: v.kill, olum: v.olum, toplam: v.kill + v.olum, kisi: v.aile.size }))
      .sort((x, y) => y.toplam - x.toplam);
    return { satirlar, bilinmeyen };
  }, [olaylar, bizimSinifHaritasi]);

  if (olaylar.length === 0) return null;

  const enCok = a.klanlar[0];
  const sure = a.sureSn >= 60 ? `${Math.floor(a.sureSn / 60)} dk ${a.sureSn % 60} sn` : `${a.sureSn} sn`;
  const fark = a.kill - a.death;
  const oran = a.death > 0 ? (a.kill / a.death).toFixed(2) : "—";
  const calisiyor = sinifDurum === "calisiyor";
  /** Profili hiç okunmamış aileler — düğme bunlar için var */
  const eksikAile = aileler.filter((r) => r.karakterler.length === 0).length;
  const tam = { gridColumn: "1 / -1" } as const;

  return (
    <div className="absolute inset-3 z-[700] flex flex-col rounded-[var(--t-r)] overflow-hidden"
         style={{ background: "rgba(12,12,14,.97)", border: "1px solid var(--t-line)",
                  backdropFilter: "blur(8px)", boxShadow: "0 24px 80px rgba(0,0,0,.7)" }}>
      <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <Swords className="w-4 h-4 flex-shrink-0" style={{ color: "var(--t-gold)" }} />
        <span className="text-[14px] font-semibold">Savaş analizi</span>
        <span className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
          {olaylar.length} olay{kaynak ? ` · ${kaynak}` : ""}
        </span>

        <span className="ml-auto flex items-center gap-1.5 text-[11px]"
              style={{ color: sinifDurum === "hata" ? "var(--t-bad)" : "var(--t-faint)" }}>
          <Sparkles className="w-3 h-3" />
          {calisiyor ? `karakterler okunuyor · ${okunan}/${toplam}${kalan ? ` · ${kalan} kaldı` : ""}`
            : sinifDurum === "hata" ? "profiller okunamadı"
              : eksikAile > 0 ? `${eksikAile} ailenin karakteri bilinmiyor`
                : toplam > 0 ? `${toplam} ailenin karakterleri okundu` : "karakter okunmadı"}
        </span>

        {onSinifAra && (
          <button onClick={onSinifAra} disabled={calisiyor} className="t-tab flex items-center gap-1.5 text-[11.5px]"
                  style={{ opacity: calisiyor ? 0.55 : 1, color: !calisiyor && eksikAile > 0 ? "var(--t-gold)" : undefined }}
                  title="Aile adlarından karakterleri ve sınıflarını oyunun profil sayfasından oku">
            {calisiyor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            Karakterleri bul
          </button>
        )}
        <button onClick={onKapat} className="t-tab" aria-label="Kapat"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", alignItems: "start" }}>

          {/* Başlık şeridi: tek bir büyük sayı, gerisi küçük kutular */}
          <div style={{ ...tam, background: "var(--t-surface)", border: "1px solid var(--t-line)" }}
               className="rounded-[var(--t-r-sm)] flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[46px] leading-none font-bold"
                    style={{ color: fark >= 0 ? "var(--t-good)" : "var(--t-bad)",
                             fontVariantNumeric: "proportional-nums" }}>
                {fark > 0 ? "+" : ""}{fark}
              </span>
              <span className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>fark</span>
            </div>
            <Kutu etiket="Öldürdük" deger={String(a.kill)} renk="var(--t-good)" />
            <Kutu etiket="Öldük" deger={String(a.death)} renk="var(--t-bad)" />
            <Kutu etiket="K/D" deger={oran} />
            <Kutu etiket="Kayıt süresi" deger={sure} />
            <Kutu etiket="Üst üste ölüm" deger={String(a.olumSerisi)}
                  renk={a.olumSerisi >= 5 ? "var(--t-bad)" : undefined} />
            <Kutu etiket="Üst üste kill" deger={String(a.killSerisi)} />
            <Kutu etiket="Karşı klan" deger={String(a.klanlar.length)} />
            <Kutu etiket="Karşı aile" deger={String(a.rakip.length)} />
            <Kutu etiket="Karşı karakter" deger={String(karakterler.length)} />
            {enCok && enCok.olum > 0 && (
              <div className="ml-auto rounded-[var(--t-r-sm)] px-2.5 py-1.5"
                   style={{ background: "rgba(239,95,95,.08)", border: "1px solid rgba(239,95,95,.25)" }}>
                <p className="text-[10px]" style={{ color: "var(--t-faint)" }}>En çok öldüğümüz klan</p>
                <p className="text-[13px] font-semibold">{enCok.ad}
                  <span className="ml-1.5 text-[11px]" style={{ color: "var(--t-dim)" }}>
                    {enCok.olum} ölüm / {enCok.kill} kill
                  </span>
                </p>
              </div>
            )}
          </div>

          <div style={tam}>
            <Kart icon={Activity}
                  baslik={`Savaşın akışı · ${kovaSn < 60 ? `${kovaSn} sn` : `${kovaSn / 60} dk`}lık dilimler`}
                  sag={<Efsane />}>
              <div className="px-3 pt-2 pb-1">
                <AkisGrafigi kovalar={kovalar} kovaSn={kovaSn} />
              </div>
              <div className="px-3 pb-2">
                <p className="text-[10px] uppercase tracking-[0.06em] mb-0.5" style={{ color: "var(--t-faint)" }}>
                  Kümülatif fark
                </p>
                <FarkCizgisi kovalar={kovalar} />
              </div>
            </Kart>
          </div>

          {matris.satirlar.length > 0 && (
            <div style={tam}>
              <Kart icon={Grid3x3} baslik="Karşı klanların sınıf kadrosu">
                <KlanSinifMatrisi satirlar={matris.satirlar} sutunlar={matris.sutunlar} enBuyuk={matris.enBuyuk} />
              </Kart>
            </div>
          )}

          <Kart icon={Sparkles} baslik={`Karşı tarafın sınıfları · ${rakipSinif.satirlar.length}`}>
            <div className="p-2.5">
              {rakipSinif.satirlar.length === 0 ? (
                <p className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>
                  {calisiyor ? "Profiller okunuyor…" : "Sınıf bilgisi yok — «Karakterleri bul»."}
                </p>
              ) : <SinifDagilimGrafigi satirlar={rakipSinif.satirlar} />}
              {rakipSinif.bilinmeyen > 0 && rakipSinif.satirlar.length > 0 && (
                <p className="mt-2 text-[10px]" style={{ color: "var(--t-faint)" }}>
                  {rakipSinif.bilinmeyen} olayda karakterin sınıfı bilinmiyor.
                </p>
              )}
            </div>
          </Kart>

          <Kart icon={Users} baslik={`Bizim sınıflar · ${bizimSinif.satirlar.length}`}>
            <div className="p-2.5">
              {bizimSinif.satirlar.length === 0 ? (
                <p className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>
                  Aile adları üye kaydıyla eşleşmedi.
                </p>
              ) : <SinifDagilimGrafigi satirlar={bizimSinif.satirlar} />}
              {bizimSinif.bilinmeyen > 0 && (
                <p className="mt-2 text-[10px]" style={{ color: "var(--t-faint)" }}>
                  {bizimSinif.bilinmeyen} olayda bizim tarafın sınıfı kayıtlı değil (müttefik olabilir).
                </p>
              )}
            </div>
          </Kart>

          <Kart icon={Shield} baslik={`Karşı klanlar · ${a.klanlar.length}`}>
            <div className="p-2.5 space-y-1.5 max-h-[420px] overflow-y-auto">
              {a.klanlar.map((k) => (
                <Cubuk key={k.ad} ad={k.ad} kill={k.kill} olum={k.olum}
                       en={Math.max(1, ...a.klanlar.map((x) => x.toplam))} />
              ))}
            </div>
          </Kart>

          <Kart icon={Skull} baslik={`Karşı karakterler · ${karakterler.length}`}>
            <div className="p-1.5 max-h-[420px] overflow-y-auto">
              {karakterler.map((k) => (
                <div key={k.ad} className="flex items-center gap-2 px-1.5 py-1 text-[12.5px]">
                  <SinifIkonu sinif={k.sinif} />
                  <span className="flex-1 truncate">{k.ad}</span>
                  <span className="text-[10px] truncate max-w-[120px]" style={{ color: "var(--t-faint)" }}>
                    {k.aile}{k.klan ? ` · ${k.klan}` : ""}
                  </span>
                  <span className="t-num tabular-nums w-6 text-right" style={{ color: "var(--t-bad)" }}>{k.bizeOlum}</span>
                  <span className="t-num tabular-nums w-6 text-right" style={{ color: "var(--t-good)" }}>{k.bizimKill}</span>
                </div>
              ))}
            </div>
          </Kart>

          <Kart icon={UserSearch} baslik={`Ailelerin karakterleri · ${aileler.length}`}>
            <div className="p-1.5 max-h-[420px] overflow-y-auto">
              {aileler.map((r) => (
                <div key={r.aile} className="px-1.5 py-1">
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="flex-1 truncate">{r.aile}</span>
                    <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                      {r.karakterler.length || "—"} karakter
                    </span>
                    <span className="t-num tabular-nums w-6 text-right" style={{ color: "var(--t-bad)" }}>{r.bizeOlum}</span>
                    <span className="t-num tabular-nums w-6 text-right" style={{ color: "var(--t-good)" }}>{r.bizimKill}</span>
                  </div>
                  {r.karakterler.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                      {r.karakterler.map((k) => {
                        const bu = r.gorulen.some((g) => g.ad === k.ad);
                        return (
                          <span key={k.ad} title={`${k.ad} · ${sinifAdi(k.sinif)}${bu ? " · savaşta gördük" : ""}`}
                                className="flex items-center gap-1 px-1 py-0.5 rounded-[5px] text-[10px]"
                                style={{ background: bu ? "var(--t-gold-soft)" : "var(--t-raised)",
                                         color: bu ? "var(--t-text)" : "var(--t-faint)" }}>
                            <SinifIkonu sinif={k.sinif} boyut={12} />
                            <span className="max-w-[92px] truncate">{k.ad}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Kart>

          <Kart icon={Users} baslik={`Bizimkiler · ${a.biz.length}`}>
            <div className="p-1.5 max-h-[420px] overflow-y-auto">
              {a.biz.map((p) => {
                const s = bizimSinifHaritasi[p.ad.toLocaleLowerCase("tr")];
                return (
                  <div key={p.ad} className="px-1.5 py-1">
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <SinifIkonu sinif={s ?? null} />
                      <span className="flex-1 truncate">{p.ad}</span>
                      <span className="t-num tabular-nums w-6 text-right" style={{ color: "var(--t-good)" }}>{p.kill}</span>
                      <span className="t-num tabular-nums w-6 text-right" style={{ color: "var(--t-bad)" }}>{p.death}</span>
                    </div>
                    {p.ek.length > 0 && (
                      <p className="text-[10px] truncate pl-6" style={{ color: "var(--t-faint)" }}>{p.ek.join(", ")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Kart>

          {a.ikililer.length > 0 && (
            <Kart icon={Swords} baslik="Tekrarlayan eşleşmeler">
              <div className="p-1.5 max-h-[420px] overflow-y-auto">
                {a.ikililer.map((i) => (
                  <div key={`${i.bizim}-${i.rakip}`} className="flex items-center gap-1.5 px-1.5 py-1 text-[12px]">
                    <span className="truncate flex-1">{i.bizim}</span>
                    <span style={{ color: "var(--t-faint)" }}>↔</span>
                    <span className="truncate flex-1" style={{ color: "var(--t-dim)" }}>{i.rakip}</span>
                    <span className="t-num tabular-nums" style={{ color: "var(--t-good)" }}>{i.bizimKill}</span>
                    <span className="t-num tabular-nums" style={{ color: "var(--t-bad)" }}>{i.bizeOlum}</span>
                  </div>
                ))}
              </div>
            </Kart>
          )}

          <Kart icon={Clock} baslik="Zaman ve yer">
            <div className="p-3 space-y-1.5 text-[11.5px]">
              {a.enYogunDakika && (
                <Satir ikon={Flame} etiket="En yoğun dakika"
                       deger={`${new Date(a.enYogunDakika.dakika + ":00Z").toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} · ${a.enYogunDakika.sayi} olay`} />
              )}
              {a.ilk && a.son && (
                <Satir ikon={Clock} etiket="İlk / son olay"
                       deger={`${new Date(a.ilk.at).toLocaleTimeString("tr-TR")} → ${new Date(a.son.at).toLocaleTimeString("tr-TR")}`} />
              )}
              {yayilim && (
                <Satir ikon={Crosshair} etiket="Kavga yayılımı"
                       deger={`ortalama ${yayilim.ortalamaMetre} m · en uzak ${yayilim.enUzakMetre} m`} />
              )}
            </div>
          </Kart>
        </div>

        <p className="mt-3 text-[10.5px]" style={{ color: "var(--t-faint)" }}>
          Sayılar bu kaydın gördüğü olaylardan; tek istemci bütün ittifakın akışını görmeyebilir.
          Resmî hasar raporunun yerine geçmez. Rakip karakterleri ve sınıfları oyunun herkese açık
          profil sayfasından, bizimkiler üye kaydından.
        </p>
      </div>
    </div>
  );
}

/** Sınıf ikonu ya da aynı boyutta boşluk — satırlar hizada kalsın */
function SinifIkonu({ sinif, boyut = 16 }: { sinif: number | null; boyut?: number }) {
  const ikon = sinif != null ? sinifIkonu(sinif) : null;
  if (!ikon) return <span className="flex-shrink-0" style={{ width: boyut, height: boyut }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={ikon} alt="" title={sinif != null ? sinifAdi(sinif) : undefined}
         className="opacity-80 flex-shrink-0" style={{ width: boyut, height: boyut }} />
  );
}

/** Grafiklerin ortak anahtarı — renk tek başına anlam taşımasın diye her yerde aynı */
function Efsane() {
  return (
    <span className="flex items-center gap-3 text-[10.5px]" style={{ color: "var(--t-dim)" }}>
      <span className="flex items-center gap-1.5">
        <i className="w-3 h-[3px] rounded-full" style={{ background: "var(--t-good)" }} /> öldürdük (üst)
      </span>
      <span className="flex items-center gap-1.5">
        <i className="w-3 h-[3px] rounded-full" style={{ background: "var(--t-bad)" }} /> öldük (alt)
      </span>
    </span>
  );
}

function Kart({ icon: Icon, baslik, sag, children }: {
  icon: React.ElementType; baslik: string; sag?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--t-r-sm)] overflow-hidden"
         style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <Icon className="w-3 h-3 flex-shrink-0" style={{ color: "var(--t-gold)" }} />
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{baslik}</span>
        {sag && <span className="ml-auto">{sag}</span>}
      </div>
      {children}
    </div>
  );
}

function Cubuk({ ad, kill, olum, en }: { ad: string; kill: number; olum: number; en: number }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="flex-1 truncate">{ad}</span>
        <span className="t-num tabular-nums" style={{ color: "var(--t-good)" }}>{kill}</span>
        <span className="t-num tabular-nums" style={{ color: "var(--t-bad)" }}>{olum}</span>
      </div>
      <div className="flex h-[5px] mt-0.5 gap-[2px]">
        <i style={{ width: `${(kill / en) * 100}%`, background: "var(--t-good)", borderRadius: 3 }} />
        <i style={{ width: `${(olum / en) * 100}%`, background: "var(--t-bad)", borderRadius: 3 }} />
      </div>
    </div>
  );
}

function Kutu({ etiket, deger, renk }: { etiket: string; deger: string; renk?: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{etiket}</p>
      <p className="t-num text-[17px] font-bold tabular-nums" style={{ color: renk ?? "var(--t-text)" }}>{deger}</p>
    </div>
  );
}

function Satir({ ikon: Ikon, etiket, deger }: { ikon: React.ElementType; etiket: string; deger: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Ikon className="w-3 h-3 flex-shrink-0" style={{ color: "var(--t-faint)" }} />
      <span style={{ color: "var(--t-faint)" }}>{etiket}</span>
      <span className="ml-auto text-right">{deger}</span>
    </div>
  );
}
