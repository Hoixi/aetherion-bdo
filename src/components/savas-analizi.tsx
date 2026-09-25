"use client";

import { useMemo } from "react";
import {
  Shield, Users, Skull, Swords, Clock, Crosshair, Flame, Sparkles, X,
} from "lucide-react";
import { savasAnalizi, olayYayilimi } from "@/lib/savas-analiz";
import type { SavasOlayi } from "@/lib/savas-olaylari";
import { BDO_CLASSES, getClassIconUrl } from "@/lib/classes";
import type { SinifDurumu } from "@/lib/rakip-siniflari";

/**
 * Kaydın okunmuş hâli: kime öldük, kimi öldürdük, ne zaman dağıldık.
 *
 * Haritanın üstünde tam ekran duruyor — yan paneldeki 320 piksele sığmıyor,
 * hele 70-80 kişilik bir savaşta hiç sığmıyor. Bölümler genişliğe göre
 * sütunlara diziliyor.
 *
 * Sınıf bilgisi dışarıdan geliyor (arka planda okunuyor, bkz.
 * `useRakipSiniflari`); burada sadece gösteriliyor.
 *
 * Bütün sayılar tek kaydın gördüğü olaylardan: o istemciye gelen akış
 * savaşın tamamı olmak zorunda değil, resmî rapor yerine geçmez.
 */

/** class_<id> → bizim sınıf kaydımız */
const SINIF = new Map<number, (typeof BDO_CLASSES)[number]>(
  BDO_CLASSES.map((c) => [c.classType, c]),
);

export function SavasAnalizi({ olaylar, siniflar, sinifDurum, okunan, toplam, kaynak, onKapat }: {
  olaylar: SavasOlayi[];
  /** karakter adı (küçük harf) → sınıf numarası */
  siniflar: Record<string, number>;
  sinifDurum: SinifDurumu;
  okunan: number;
  toplam: number;
  kaynak?: string | null;
  onKapat: () => void;
}) {
  const a = useMemo(() => savasAnalizi(olaylar), [olaylar]);
  const yayilim = useMemo(() => olayYayilimi(olaylar), [olaylar]);

  /** Öldüğümüz/öldürdüğümüz olaylarda rakibin sınıfı */
  const sinifSayim = useMemo(() => {
    const m = new Map<number, { olum: number; kill: number }>();
    let bilinmeyen = 0;
    for (const o of olaylar) {
      const s = siniflar[o.rakipKarakter.toLocaleLowerCase("tr")];
      if (s == null) { bilinmeyen++; continue; }
      const v = m.get(s) ?? { olum: 0, kill: 0 };
      if (o.bizimKill) v.kill++; else v.olum++;
      m.set(s, v);
    }
    return {
      bilinmeyen,
      satirlar: Array.from(m.entries())
        .map(([sinif, v]) => ({ sinif, ...v, toplam: v.olum + v.kill }))
        .sort((x, y) => y.olum - x.olum || y.toplam - x.toplam),
    };
  }, [olaylar, siniflar]);

  /** Aile → o kayıtta görülen karakterin sınıfı */
  const aileSinifi = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of olaylar) {
      const s = siniflar[o.rakipKarakter.toLocaleLowerCase("tr")];
      if (s != null && !m.has(o.rakipAile)) m.set(o.rakipAile, s);
    }
    return m;
  }, [olaylar, siniflar]);

  if (olaylar.length === 0) return null;

  const enCok = a.klanlar[0];
  const sure = a.sureSn >= 60 ? `${Math.floor(a.sureSn / 60)} dk ${a.sureSn % 60} sn` : `${a.sureSn} sn`;

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
          {sinifDurum === "calisiyor" ? `sınıflar okunuyor · ${okunan}/${toplam}`
            : sinifDurum === "hata" ? "sınıflar okunamadı"
              : sinifSayim.bilinmeyen > 0 ? `${sinifSayim.bilinmeyen} olayda sınıf bilinmiyor` : "sınıflar tamam"}
        </span>
        <button onClick={onKapat} className="t-tab" aria-label="Kapat"><X className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", alignItems: "start" }}>

          <Kart icon={Flame} baslik="Özet">
            <div className="grid grid-cols-2 gap-1.5 p-2.5">
              <Kutu etiket="Öldürdük" deger={String(a.kill)} renk="var(--t-good)" />
              <Kutu etiket="Öldük" deger={String(a.death)} renk="var(--t-bad)" />
              <Kutu etiket="Kayıt süresi" deger={sure} />
              <Kutu etiket="Üst üste ölüm" deger={String(a.olumSerisi)}
                    renk={a.olumSerisi >= 5 ? "var(--t-bad)" : undefined} />
            </div>
            {enCok && enCok.olum > 0 && (
              <div className="mx-2.5 mb-2.5 rounded-[var(--t-r-sm)] px-2.5 py-2"
                   style={{ background: "rgba(239,95,95,.08)", border: "1px solid rgba(239,95,95,.25)" }}>
                <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>En çok öldüğümüz klan</p>
                <p className="text-[13.5px] font-semibold">{enCok.ad}</p>
                <p className="text-[11px]" style={{ color: "var(--t-dim)" }}>
                  {enCok.olum} ölüm · {enCok.kill} kill karşılığında
                </p>
              </div>
            )}
          </Kart>

          <Kart icon={Shield} baslik={`Karşı klanlar · ${a.klanlar.length}`}>
            <div className="p-2.5 space-y-1.5">
              {a.klanlar.map((k) => (
                <Cubuk key={k.ad} ad={k.ad} kill={k.kill} olum={k.olum}
                       en={Math.max(1, ...a.klanlar.map((x) => x.toplam))} />
              ))}
            </div>
          </Kart>

          <Kart icon={Sparkles} baslik="Karşı tarafın sınıfları">
            <div className="p-2.5 space-y-1.5">
              {sinifSayim.satirlar.length === 0 ? (
                <p className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>
                  {sinifDurum === "calisiyor" ? "Profiller okunuyor…" : "Sınıf bilgisi gelmedi."}
                </p>
              ) : sinifSayim.satirlar.map((r) => {
                const c = SINIF.get(r.sinif);
                return (
                  <Cubuk key={r.sinif} ad={c?.name ?? `class ${r.sinif}`} kill={r.kill} olum={r.olum}
                         en={Math.max(1, ...sinifSayim.satirlar.map((x) => x.toplam))}
                         ikon={c ? getClassIconUrl(c.id) : undefined} />
                );
              })}
            </div>
          </Kart>

          <Kart icon={Users} baslik={`Bizimkiler · ${a.biz.length}`}>
            <div className="p-1.5 max-h-[420px] overflow-y-auto">
              {a.biz.map((p) => (
                <div key={p.ad} className="px-1.5 py-1">
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="flex-1 truncate">{p.ad}</span>
                    <span className="t-num" style={{ color: "var(--t-good)" }}>{p.kill}</span>
                    <span className="t-num" style={{ color: "var(--t-bad)" }}>{p.death}</span>
                  </div>
                  {p.ek.length > 0 && (
                    <p className="text-[10px] truncate" style={{ color: "var(--t-faint)" }}>{p.ek.join(", ")}</p>
                  )}
                </div>
              ))}
            </div>
          </Kart>

          <Kart icon={Skull} baslik={`Bizi en çok öldürenler · ${a.rakip.length}`}>
            <div className="p-1.5 max-h-[420px] overflow-y-auto">
              {a.rakip.map((p) => {
                const s = aileSinifi.get(p.ad);
                const c = s != null ? SINIF.get(s) : undefined;
                return (
                  <div key={p.ad} className="flex items-center gap-2 px-1.5 py-1 text-[12.5px]">
                    {c ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getClassIconUrl(c.id)} alt={c.name} title={c.name} className="w-4 h-4 opacity-75 flex-shrink-0" />
                    ) : <span className="w-4 flex-shrink-0" />}
                    <span className="flex-1 truncate" style={{ color: "var(--t-dim)" }}>{p.ad}</span>
                    <span className="text-[10px] truncate max-w-[110px]" style={{ color: "var(--t-faint)" }}>
                      {p.ek.join(", ")}
                    </span>
                    <span className="t-num" style={{ color: "var(--t-bad)" }}>{p.kill}</span>
                    <span className="t-num" style={{ color: "var(--t-good)" }}>{p.death}</span>
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
                    <span className="t-num" style={{ color: "var(--t-good)" }}>{i.bizimKill}</span>
                    <span className="t-num" style={{ color: "var(--t-bad)" }}>{i.bizeOlum}</span>
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
              <Satir ikon={Swords} etiket="En uzun kill serisi" deger={String(a.killSerisi)} />
              {yayilim && (
                <Satir ikon={Crosshair} etiket="Kavga yayılımı"
                       deger={`ortalama ${yayilim.ortalamaMetre} m · en uzak ${yayilim.enUzakMetre} m`} />
              )}
            </div>
          </Kart>
        </div>

        <p className="mt-3 text-[10.5px]" style={{ color: "var(--t-faint)" }}>
          Sayılar bu kaydın gördüğü olaylardan; tek istemci bütün ittifakın akışını görmeyebilir.
          Resmî hasar raporunun yerine geçmez. Sınıflar oyunun herkese açık profil sayfasından.
        </p>
      </div>
    </div>
  );
}

function Kart({ icon: Icon, baslik, children }: {
  icon: React.ElementType; baslik: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--t-r-sm)] overflow-hidden"
         style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
      <div className="flex items-center gap-1.5 px-3 py-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <Icon className="w-3 h-3" style={{ color: "var(--t-gold)" }} />
        <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{baslik}</span>
      </div>
      {children}
    </div>
  );
}

function Cubuk({ ad, kill, olum, en, ikon }: {
  ad: string; kill: number; olum: number; en: number; ikon?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[12.5px]">
        {ikon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ikon} alt="" className="w-4 h-4 opacity-80 flex-shrink-0" />
        )}
        <span className="flex-1 truncate">{ad}</span>
        <span className="t-num" style={{ color: "var(--t-good)" }}>{kill}</span>
        <span className="t-num" style={{ color: "var(--t-bad)" }}>{olum}</span>
      </div>
      <div className="flex h-[5px] mt-0.5 rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
        <i style={{ width: `${(kill / en) * 100}%`, background: "var(--t-good)" }} />
        <i style={{ width: `${(olum / en) * 100}%`, background: "var(--t-bad)" }} />
      </div>
    </div>
  );
}

function Kutu({ etiket, deger, renk }: { etiket: string; deger: string; renk?: string }) {
  return (
    <div className="px-2 py-1.5 rounded-[var(--t-r-sm)]" style={{ background: "var(--t-raised)" }}>
      <p className="text-[9px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{etiket}</p>
      <p className="t-num text-[15px] font-bold" style={{ color: renk ?? "var(--t-text)" }}>{deger}</p>
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
