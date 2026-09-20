"use client";

import { useEffect, useState } from "react";

/** Sayfa içi toast ve onay kutusu — uygulamadaki dialog.ts'in aynısı. */

export interface Toast { id: number; metin: string; tur: "bilgi" | "iyi" | "kotu"; at: number }
interface Onay { metin: string; evet: string; hayir: string; coz: (v: boolean) => void }

type Dinleyici = () => void;
let toastlar: Toast[] = [];
let onay: Onay | null = null;
const dinleyiciler = new Set<Dinleyici>();
const yay = () => dinleyiciler.forEach((f) => f());
let sayac = 0;

export function toast(metin: string, tur: Toast["tur"] = "bilgi", sureMs = 4000) {
  const id = ++sayac;
  toastlar = [...toastlar, { id, metin, tur, at: Date.now() }];
  yay();
  setTimeout(() => { toastlar = toastlar.filter((t) => t.id !== id); yay(); }, sureMs);
}

export function onayla(metin: string, evet = "Evet", hayir = "Vazgeç"): Promise<boolean> {
  return new Promise((coz) => { onay = { metin, evet, hayir, coz: (v) => { onay = null; yay(); coz(v); } }; yay(); });
}

export function useDialoglar() {
  const [, tik] = useState(0);
  useEffect(() => { const f = () => tik((x) => x + 1); dinleyiciler.add(f); return () => { dinleyiciler.delete(f); }; }, []);
  return { toastlar, onay };
}
