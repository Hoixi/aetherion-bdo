"use client";

import { useMemo, useState } from "react";
import { Shield, Users, Skull, Swords, Clock, Crosshair, Flame, Sparkles } from "lucide-react";
import { savasAnalizi, olayYayilimi } from "@/lib/savas-analiz";
import type { SavasOlayi } from "@/lib/savas-olaylari";
import { BDO_CLASSES, getClassIconUrl } from "@/lib/classes";

/**
 * Kaydın okunmuş hâli: kime öldük, kimi öldürdük, ne zaman dağıldık.
 *
 * Hepsi tek kaydın içinden; o istemciye gelen akış savaşın tamamı olmak
 * zorunda değil. Bu yüzden başlıkta "bu kayıtta" deniyor, resmî rapor
 * yerine geçmiyor.
 */

/** class_<id> → bizim sınıf kaydımız */
const SINIF = new Map<number, (typeof BDO_CLASSES)[number]>(
  BDO_CLASSES.map((c) => [c.classType, c]),
);

export function SavasAnalizi({ olaylar }: { olaylar: SavasOlayi[] }) {
  const a = useMemo(() => savasAnalizi(olaylar), [olaylar]);
  const yayilim = useMemo(() => olayYayilimi(olaylar), [olaylar]);
  /** karakter adı (küçük harf) → sınıf numarası */
  const [siniflar, setSiniflar] = useState<Record<string, number>>({});
  const [sinifDurum, setSinifDurum] = useState<"bos" | "yukleniyor" | "bitti" | "hata">("bos");
  const [kalan, setKalan] = useState(0);

  /**
   * Rakiplerin sınıfı oyunun resmî profil sayfasından geliyor; istek başına
   * birkaç yeni aile okunduğu için düğme "kalan" sayısını gösterip tekrar
   * çalıştırılabiliyor.
   */
  async function siniflariGetir() {
    setSinifDurum("yukleniyor");
    try {
      const aileler = Array.from(new Set(olaylar.map((o) => o.rakipAile).filter(Boolean)));
      const r = await fetch("/api/bdo-profil", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aileler }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Profiller alınamadı.");
      const harita: Record<string, number> = { ...siniflar };
      for (const kayit of Object.values(d.aileler ?? {}) as Array<{ karakterler: Array<{ ad: string; sinif: number }> }>) {
        for (const k of kayit.karakterler) harita[k.ad.toLocaleLowerCase("tr")] = k.sinif;
      }
      setSiniflar(harita);
      setKalan(d.kalan ?? 0);
      setSinifDurum("bitti");
    } catch { setSinifDurum("hata"); }
  }

  /** Öldüğümüz olaylarda rakibin sınıfı — bilinenlerden sayım */
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
  if (olaylar.length === 0) {
    return <p className="p-3 text-[12px]" style={{ color: "var(--t-faint)" }}>Önce bir kayıt yükle.</p>;
  }

  const enCok = a.klanlar[0];
  const sure = a.sureSn >= 60 ? `${Math.floor(a.sureSn / 60)} dk ${a.sureSn % 60} sn` : `${a.sureSn} sn`;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-3 grid grid-cols-2 gap-1.5">
        <Kutu etiket="Öldürdük" deger={String(a.kill)} renk="var(--t-good)" />
        <Kutu etiket="Öldük" deger={String(a.death)} renk="var(--t-bad)" />
        <Kutu etiket="Kayıt süresi" deger={sure} />
        <Kutu etiket="Üst üste ölüm" deger={String(a.olumSerisi)}
              renk={a.olumSerisi >= 5 ? "var(--t-bad)" : undefined} />
      </div>

      {enCok && enCok.olum > 0 && (
        <div className="px-3 pb-3">
          <div className="rounded-[var(--t-r-sm)] px-2.5 py-2"
               style={{ background: "rgba(239,95,95,.08)", border: "1px solid rgba(239,95,95,.25)" }}>
            <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>En çok öldüğümüz klan</p>
            <p className="text-[13.5px] font-semibold">{enCok.ad}</p>
            <p className="text-[11px]" style={{ color: "var(--t-dim)" }}>
              {enCok.olum} ölüm · {enCok.kill} kill karşılığında
            </p>
          </div>
        </div>
      )}

      <Baslik icon={Shield} metin={`Karşı klanlar · ${a.klanlar.length}`} />
      <div className="p-2 space-y-1.5">
        {a.klanlar.map((k) => {
          const en = Math.max(1, ...a.klanlar.map((x) => x.toplam));
          return (
            <div key={k.ad}>
              <div className="flex items-center gap-2 text-[12px]">
                <span className="flex-1 truncate">{k.ad}</span>
                <span className="t-num" style={{ color: "var(--t-good)" }}>{k.kill}</span>
                <span className="t-num" style={{ color: "var(--t-bad)" }}>{k.olum}</span>
              </div>
              <div className="flex h-[5px] mt-0.5 rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
                <i style={{ width: `${(k.kill / en) * 100}%`, background: "var(--t-good)" }} />
                <i style={{ width: `${(k.olum / en) * 100}%`, background: "var(--t-bad)" }} />
              </div>
            </div>
          );
        })}
      </div>

      <Baslik icon={Users} metin={`Bizimkiler · ${a.biz.length}`} />
      <div className="p-1.5">
        {a.biz.map((p) => (
          <div key={p.ad} className="px-1.5 py-1">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="flex-1 truncate">{p.ad}</span>
              <span className="t-num" style={{ color: "var(--t-good)" }}>{p.kill}</span>
              <span className="t-num" style={{ color: "var(--t-bad)" }}>{p.death}</span>
            </div>
            {p.ek.length > 0 && (
              <p className="text-[10px] truncate" style={{ color: "var(--t-faint)" }}>
                {p.ek.join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>

      <Baslik icon={Sparkles} metin="Karşı tarafın sınıfları" />
      <div className="p-2 space-y-1.5">
        {sinifSayim.satirlar.length === 0 ? (
          <p className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>
            Rakiplerin sınıfı oyunun resmî profil sayfasından okunuyor.
          </p>
        ) : (
          sinifSayim.satirlar.map((r) => {
            const c = SINIF.get(r.sinif);
            const en = Math.max(1, ...sinifSayim.satirlar.map((x) => x.toplam));
            return (
              <div key={r.sinif}>
                <div className="flex items-center gap-2 text-[12px]">
                  {c && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getClassIconUrl(c.id)} alt="" className="w-4 h-4 opacity-80" />
                  )}
                  <span className="flex-1 truncate">{c?.name ?? `class ${r.sinif}`}</span>
                  <span className="t-num" style={{ color: "var(--t-good)" }}>{r.kill}</span>
                  <span className="t-num" style={{ color: "var(--t-bad)" }}>{r.olum}</span>
                </div>
                <div className="flex h-[5px] mt-0.5 rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
                  <i style={{ width: `${(r.kill / en) * 100}%`, background: "var(--t-good)" }} />
                  <i style={{ width: `${(r.olum / en) * 100}%`, background: "var(--t-bad)" }} />
                </div>
              </div>
            );
          })
        )}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => void siniflariGetir()} className="t-tab"
                  disabled={sinifDurum === "yukleniyor"}>
            <Sparkles className="w-3.5 h-3.5" />
            {sinifDurum === "yukleniyor" ? "Okunuyor…" : kalan > 0 ? `Devam et (${kalan})` : "Sınıfları getir"}
          </button>
          {sinifDurum === "hata" && <span className="text-[11px]" style={{ color: "var(--t-bad)" }}>Okunamadı.</span>}
          {sinifSayim.bilinmeyen > 0 && sinifDurum !== "bos" && (
            <span className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>
              {sinifSayim.bilinmeyen} olayda sınıf bilinmiyor
            </span>
          )}
        </div>
      </div>

      <Baslik icon={Skull} metin={`Bizi en çok öldürenler · ${a.rakip.length}`} />
      <div className="p-1.5">
        {a.rakip.slice(0, 20).map((p) => (
          <div key={p.ad} className="flex items-center gap-2 px-1.5 py-1 text-[12px]">
            <span className="flex-1 truncate" style={{ color: "var(--t-dim)" }}>{p.ad}</span>
            {(() => {
              // Bu ailenin bu kayıtta görülen karakteri → sınıf ikonu
              const olay = olaylar.find((o) => o.rakipAile === p.ad);
              const s = olay ? siniflar[olay.rakipKarakter.toLocaleLowerCase("tr")] : undefined;
              const c = s != null ? SINIF.get(s) : undefined;
              return c ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={getClassIconUrl(c.id)} alt={c.name} title={c.name} className="w-4 h-4 opacity-75" />
              ) : null;
            })()}
            <span className="text-[10px] truncate max-w-[90px]" style={{ color: "var(--t-faint)" }}>
              {p.ek.join(", ")}
            </span>
            <span className="t-num" style={{ color: "var(--t-bad)" }}>{p.kill}</span>
            <span className="t-num" style={{ color: "var(--t-good)" }}>{p.death}</span>
          </div>
        ))}
      </div>

      {a.ikililer.length > 0 && (
        <>
          <Baslik icon={Swords} metin="Tekrarlayan eşleşmeler" />
          <div className="p-1.5">
            {a.ikililer.slice(0, 15).map((i) => (
              <div key={`${i.bizim}-${i.rakip}`} className="flex items-center gap-1.5 px-1.5 py-1 text-[11.5px]">
                <span className="truncate flex-1">{i.bizim}</span>
                <span style={{ color: "var(--t-faint)" }}>↔</span>
                <span className="truncate flex-1" style={{ color: "var(--t-dim)" }}>{i.rakip}</span>
                <span className="t-num" style={{ color: "var(--t-good)" }}>{i.bizimKill}</span>
                <span className="t-num" style={{ color: "var(--t-bad)" }}>{i.bizeOlum}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <Baslik icon={Clock} metin="Zaman ve yer" />
      <div className="p-3 space-y-1.5 text-[11.5px]">
        {a.enYogunDakika && (
          <Satir ikon={Flame} etiket="En yoğun dakika"
                 deger={`${new Date(a.enYogunDakika.dakika + ":00Z").toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} · ${a.enYogunDakika.sayi} olay`} />
        )}
        {a.ilk && a.son && (
          <Satir ikon={Clock} etiket="İlk / son olay"
                 deger={`${new Date(a.ilk.at).toLocaleTimeString("tr-TR")} → ${new Date(a.son.at).toLocaleTimeString("tr-TR")}`} />
        )}
        <Satir ikon={Swords} etiket="En uzun kill serisi" deger={`${a.killSerisi}`} />
        {yayilim && (
          <Satir ikon={Crosshair} etiket="Kavga yayılımı"
                 deger={`ortalama ${yayilim.ortalamaMetre} m · en uzak ${yayilim.enUzakMetre} m`} />
        )}
      </div>

      <p className="px-3 pb-3 text-[10px]" style={{ color: "var(--t-faint)" }}>
        Sayılar bu kaydın gördüğü olaylardan; tek istemci bütün ittifakın akışını
        görmeyebilir. Resmî hasar raporunun yerine geçmez.
      </p>
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

function Baslik({ icon: Icon, metin }: { icon: React.ElementType; metin: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 sticky top-0"
         style={{ background: "rgba(16,16,19,.96)", borderTop: "1px solid var(--t-line)",
                  borderBottom: "1px solid var(--t-line)" }}>
      <Icon className="w-3 h-3" style={{ color: "var(--t-gold)" }} />
      <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{metin}</span>
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
