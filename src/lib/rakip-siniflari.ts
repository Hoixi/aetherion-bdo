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
/** Sonsuz döngüye karşı: kalan azalmıyorsa bırak */
const ILERLEME_YOK_SINIRI = 3;

export type SinifDurumu = "bos" | "calisiyor" | "bitti" | "hata";

export function useRakipSiniflari(olaylar: SavasOlayi[], acik = true) {
  /** karakter adı (küçük harf) → sınıf numarası */
  const [siniflar, setSiniflar] = useState<Record<string, number>>({});
  /** aile adı (küçük harf) → profildeki bütün karakterleri */
  const [kadro, setKadro] = useState<Record<string, Array<{ ad: string; sinif: number }>>>({});
  const [durum, setDurum] = useState<SinifDurumu>("bos");
  const [kalan, setKalan] = useState(0);
  const [toplam, setToplam] = useState(0);
  const calisiyor = useRef(false);
  const durdurulan = useRef(false);
  /** Yürüyen turun kimliği — liste değişince eskisi kendini bırakıyor */
  const nesil = useRef(0);

  const aileler = useMemo(
    () => Array.from(new Set(olaylar.map((o) => o.rakipAile).filter(Boolean))),
    [olaylar],
  );

  const durdur = useCallback(() => { durdurulan.current = true; setDurum("bitti"); }, []);

  const baslat = useCallback(async () => {
    if (calisiyor.current || aileler.length === 0) return;
    const benim = ++nesil.current;
    calisiyor.current = true;
    durdurulan.current = false;
    setToplam(aileler.length);
    setDurum("calisiyor");

    let oncekiKalan = Infinity, duran = 0;
    for (;;) {
      if (durdurulan.current || nesil.current !== benim) break;
      let d: { aileler?: Record<string, { karakterler: Array<{ ad: string; sinif: number }> }>; kalan?: number };
      try {
        const r = await fetch("/api/bdo-profil", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aileler }),
        });
        d = await r.json();
        if (!r.ok) throw new Error(d as unknown as string);
      } catch {
        if (nesil.current === benim) setDurum("hata");
        break;
      }
      if (nesil.current !== benim) break;

      setSiniflar((onceki) => {
        const harita = { ...onceki };
        for (const kayit of Object.values(d.aileler ?? {})) {
          for (const k of kayit.karakterler) harita[k.ad.toLocaleLowerCase("tr")] = k.sinif;
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

      const yeniKalan = d.kalan ?? 0;
      setKalan(yeniKalan);
      if (yeniKalan === 0) { setDurum("bitti"); break; }
      // Kalan azalmıyorsa (hep aynı aileler okunamıyorsa) ısrar etme
      duran = yeniKalan >= oncekiKalan ? duran + 1 : 0;
      oncekiKalan = yeniKalan;
      if (duran >= ILERLEME_YOK_SINIRI) { setDurum("bitti"); break; }

      await new Promise((r) => setTimeout(r, TUR_ARASI_MS));
    }
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
    siniflar, kadro, durum, kalan, toplam,
    okunan: Math.max(0, toplam - kalan),
    durdur, baslat,
  };
}
