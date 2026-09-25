"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * olay listesi değişince baştan kuruluyor.
 */

const TUR_ARASI_MS = 1200;
/** Sonsuz döngüye karşı: kalan azalmıyorsa bırak */
const ILERLEME_YOK_SINIRI = 3;

export type SinifDurumu = "bos" | "calisiyor" | "bitti" | "hata";

export function useRakipSiniflari(olaylar: SavasOlayi[], acik = true) {
  /** karakter adı (küçük harf) → sınıf numarası */
  const [siniflar, setSiniflar] = useState<Record<string, number>>({});
  const [durum, setDurum] = useState<SinifDurumu>("bos");
  const [kalan, setKalan] = useState(0);
  const [toplam, setToplam] = useState(0);
  const calisiyor = useRef(false);
  const durdurulan = useRef(false);

  const durdur = useCallback(() => { durdurulan.current = true; setDurum("bitti"); }, []);

  useEffect(() => {
    if (!acik || olaylar.length === 0) return;
    const aileler = Array.from(new Set(olaylar.map((o) => o.rakipAile).filter(Boolean)));
    if (aileler.length === 0) return;
    if (calisiyor.current) return;

    calisiyor.current = true;
    durdurulan.current = false;
    setToplam(aileler.length);
    setDurum("calisiyor");
    let iptal = false;

    (async () => {
      let oncekiKalan = Infinity, duran = 0;
      for (;;) {
        if (iptal || durdurulan.current) break;
        let d: { aileler?: Record<string, { karakterler: Array<{ ad: string; sinif: number }> }>; kalan?: number };
        try {
          const r = await fetch("/api/bdo-profil", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aileler }),
          });
          d = await r.json();
          if (!r.ok) throw new Error(d as unknown as string);
        } catch {
          if (!iptal) setDurum("hata");
          break;
        }
        if (iptal) break;

        setSiniflar((onceki) => {
          const harita = { ...onceki };
          for (const kayit of Object.values(d.aileler ?? {})) {
            for (const k of kayit.karakterler) harita[k.ad.toLocaleLowerCase("tr")] = k.sinif;
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
      calisiyor.current = false;
    })();

    return () => { iptal = true; calisiyor.current = false; };
  }, [olaylar, acik]);

  return { siniflar, durum, kalan, toplam, okunan: Math.max(0, toplam - kalan), durdur };
}
