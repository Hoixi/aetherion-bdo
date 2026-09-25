"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SavasOlayi } from "@/lib/savas-olaylari";

/**
 * Rakip karakterlerin sınıfı — arka planda, kendi hızında.
 *
 * Sınıf bilgisi oyunun resmî profil sayfasından geliyor ve uç, istek başına
 * yalnızca birkaç yeni aile okuyor. 70-80 kişilik bir savaşta bunu elle
 * "devam" diyerek toplamak mümkün değil; burada kuyruk kendi kendine
 * dönüyor: her turda bir istek, turlar arasında bekleme. Önbellekte olan
 * aileler ilk turda geldiği için ikinci savaşta iş neredeyse anında bitiyor.
 *
 * Kuyruk sayfa açık kaldığı sürece çalışıyor, sekme değiştirince durmuyor;
 * olay listesi değişince baştan kuruluyor. Durduktan sonra `baslat` ile
 * elle tekrar sürülebiliyor: profili o an okunamayan aileler kalmış
 * olabiliyor, bir tur daha atmak bedava (okunanlar önbellekten geliyor).
 */

const TUR_ARASI_MS = 1200;
/**
 * Tek istekte sorulan aile sayısı. Uç uzun listeyi reddediyordu ve 78
 * aileli bir savaşta istek daha başlamadan 400 dönüyordu; liste artık
 * kümelere bölünüyor, kaç kişilik savaş olursa olsun çalışsın.
 */
const KUME = 50;
/** Sonsuz döngüye karşı: kalan azalmıyorsa bırak */
const ILERLEME_YOK_SINIRI = 3;

export type SinifDurumu = "bos" | "calisiyor" | "bitti" | "hata";

/** Son turun ham sonucu — "neden bulamadı" sorusunun cevabı arayüzde dursun */
export interface SinifTanisi {
  /** Bu oturumda sayfaya gidilen aile sayısı */
  denenen: number;
  /** Karakteri çıkan aile */
  bulunan: number;
  /** Sayfası açıldı ama karakter yok (gizli profil, ad değişikliği) */
  bos: number;
  /** Sayfaya hiç ulaşılamadı — engel, zaman aşımı */
  ulasilamayan: number;
  /** İlk birkaç hatanın mesajı */
  mesajlar: string[];
}

export function useRakipSiniflari(olaylar: SavasOlayi[], acik = true) {
  /** karakter adı (küçük harf) → sınıf numarası */
  const [siniflar, setSiniflar] = useState<Record<string, number>>({});
  /** aile adı (küçük harf) → profildeki bütün karakterleri */
  const [kadro, setKadro] = useState<Record<string, Array<{ ad: string; sinif: number }>>>({});
  const [durum, setDurum] = useState<SinifDurumu>("bos");
  const [kalan, setKalan] = useState(0);
  const [toplam, setToplam] = useState(0);
  const [tani, setTani] = useState<SinifTanisi>({ denenen: 0, bulunan: 0, bos: 0, ulasilamayan: 0, mesajlar: [] });
  const calisiyor = useRef(false);
  const durdurulan = useRef(false);
  /** Yürüyen turun kimliği — liste değişince eskisi kendini bırakıyor */
  const nesil = useRef(0);

  const aileler = useMemo(
    () => Array.from(new Set(olaylar.map((o) => o.rakipAile).filter(Boolean))),
    [olaylar],
  );

  const durdur = useCallback(() => { durdurulan.current = true; setDurum("bitti"); }, []);

  /** `zorla`: boş kayıtlı aileler de yeniden okunuyor (elle "bul" düğmesi) */
  const baslat = useCallback(async (zorla = false) => {
    if (calisiyor.current || aileler.length === 0) return;
    const benim = ++nesil.current;
    calisiyor.current = true;
    durdurulan.current = false;
    setToplam(aileler.length);
    setDurum("calisiyor");

    const kumeler: string[][] = [];
    for (let i = 0; i < aileler.length; i += KUME) kumeler.push(aileler.slice(i, i + KUME));

    for (let k = 0; k < kumeler.length; k++) {
      const kume = kumeler[k];
      if (durdurulan.current || nesil.current !== benim) break;
      /** Sonraki kümelerdeki aileler de "kalan" sayılıyor */
      const sonrakiler = aileler.length - (k + 1) * KUME;
      let oncekiKalan = Infinity, duran = 0;

      for (;;) {
        if (durdurulan.current || nesil.current !== benim) break;
        let d: {
          aileler?: Record<string, { karakterler: Array<{ ad: string; sinif: number }> }>;
          kalan?: number; denenen?: number; bulunan?: number; bos?: number; hataSayisi?: number;
          hatalar?: Array<{ aile: string; mesaj: string }>;
        };
        try {
          const r = await fetch("/api/bdo-profil", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aileler: kume, zorla }),
          });
          d = await r.json();
          if (!r.ok) throw new Error((d as unknown as { error?: string })?.error ?? `HTTP ${r.status}`);
        } catch (e) {
          if (nesil.current === benim) {
            setDurum("hata");
            setTani((o) => ({ ...o, mesajlar: [(e as Error)?.message ?? "istek başarısız", ...o.mesajlar].slice(0, 3) }));
          }
          if (nesil.current === benim) calisiyor.current = false;
          return;
        }
        if (nesil.current !== benim) return;   // bayrak yeni turun, dokunma

        setSiniflar((onceki) => {
          const harita = { ...onceki };
          for (const kayit of Object.values(d.aileler ?? {})) {
            for (const kr of kayit.karakterler) harita[kr.ad.toLocaleLowerCase("tr")] = kr.sinif;
          }
          return harita;
        });
        setKadro((onceki) => {
          const harita = { ...onceki };
          for (const [aile, kayit] of Object.entries(d.aileler ?? {})) {
            harita[aile.toLocaleLowerCase("tr")] = kayit.karakterler;
          }
          return harita;
        });

        setTani((o) => ({
          denenen: o.denenen + (d.denenen ?? 0),
          bulunan: o.bulunan + (d.bulunan ?? 0),
          bos: o.bos + (d.bos ?? 0),
          ulasilamayan: o.ulasilamayan + Math.max(0, d.hataSayisi ?? 0),
          mesajlar: Array.from(new Set([...(d.hatalar ?? []).map((h) => `${h.aile}: ${h.mesaj}`), ...o.mesajlar])).slice(0, 3),
        }));

        const yeniKalan = d.kalan ?? 0;
        setKalan(Math.max(0, sonrakiler) + yeniKalan);
        if (yeniKalan === 0) break;
        // Kalan azalmıyorsa (hep aynı aileler okunamıyorsa) ısrar etme
        duran = yeniKalan >= oncekiKalan ? duran + 1 : 0;
        oncekiKalan = yeniKalan;
        if (duran >= ILERLEME_YOK_SINIRI) break;

        await new Promise((r) => setTimeout(r, TUR_ARASI_MS));
      }
    }
    if (nesil.current === benim && !durdurulan.current) { setKalan(0); setDurum("bitti"); }
    if (nesil.current === benim) calisiyor.current = false;
  }, [aileler]);

  useEffect(() => {
    // Liste değişti: yürüyen tur eski aileleri okuyor, bırak ve yeniden kur
    nesil.current++;
    calisiyor.current = false;
    if (!acik || aileler.length === 0) return;
    void baslat();
    // Temizlikte sayacı kasten artırıyoruz: yürüyen tur kendini bıraksın
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => { nesil.current++; calisiyor.current = false; };
  }, [acik, aileler, baslat]);

  return {
    siniflar, kadro, durum, kalan, toplam, tani,
    okunan: Math.max(0, toplam - kalan),
    durdur, baslat,
  };
}
