"use client";

import { useCallback, useEffect, useState } from "react";
import type { AnonsMod, GurultuMod } from "@/lib/ses-web";

/**
 * Tarayıcı sesli sohbetinin ayarları — localStorage. Masaüstü uygulamasındaki
 * Ayarlar'ın ses kısmının karşılığı; tuşlar sanal tuş kodu yerine
 * KeyboardEvent.code tutar ("KeyV", "Mouse4").
 */
export interface SesAyarlar {
  mikrofon: string; hoparlor: string;
  gurultuMod: GurultuMod;
  /** mikrofon kazancı 0.2–3 */
  kazanc: number;
  /** ses kapısı eşiği dBFS (−100 = kapalı) */
  esikDb: number;
  /** kulaklık ana sesi % */
  cikis: number;
  pttKod: string; pttAd: string;
  anonsMod: AnonsMod; anonsKod: string; anonsAd: string;
}

export const VARSAYILAN: SesAyarlar = {
  mikrofon: "", hoparlor: "", gurultuMod: "rnnoise", kazanc: 1, esikDb: -100, cikis: 100,
  pttKod: "", pttAd: "", anonsMod: "kapali", anonsKod: "", anonsAd: "",
};
const ANAHTAR = "aetherion.ses";

function oku(): SesAyarlar {
  try { const v = JSON.parse(localStorage.getItem(ANAHTAR) ?? "null"); return v ? { ...VARSAYILAN, ...v } : VARSAYILAN; }
  catch { return VARSAYILAN; }
}

export function useSesAyarlari(): [SesAyarlar, <K extends keyof SesAyarlar>(k: K, v: SesAyarlar[K]) => void, boolean] {
  const [a, setA] = useState<SesAyarlar>(VARSAYILAN);
  const [hazir, setHazir] = useState(false);
  useEffect(() => { setA(oku()); setHazir(true); }, []);
  const onAyar = useCallback(<K extends keyof SesAyarlar>(k: K, v: SesAyarlar[K]) => {
    setA((eski) => { const yeni = { ...eski, [k]: v }; try { localStorage.setItem(ANAHTAR, JSON.stringify(yeni)); } catch { /* özel pencere */ } return yeni; });
  }, []);
  return [a, onAyar, hazir];
}
