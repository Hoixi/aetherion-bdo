"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Oyun modu — Document Picture-in-Picture penceresi.
 *
 * Oyunun içine hiçbir şey çizilmez; bu sadece işletim sisteminin her zaman
 * üstte tuttuğu sıradan bir pencere. Oyun kenarlıksız pencere modundaysa
 * üstünde durur, tam ekran exclusive modda duramaz (Windows kuralı).
 */

// Tarayıcı tip tanımlarında henüz yok
type PipApi = { requestWindow(o?: { width?: number; height?: number }): Promise<Window> };
declare global {
  interface Window { documentPictureInPicture?: PipApi }
}

export function pipSupported(): boolean {
  return typeof window !== "undefined" && !!window.documentPictureInPicture;
}

/** Ana belgedeki stilleri PiP penceresine kopyalar */
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map((r) => r.cssText).join("");
      const el = target.document.createElement("style");
      el.textContent = css;
      target.document.head.appendChild(el);
    } catch {
      // Farklı kaynaktan gelen sayfalar okunamaz — bağlantıyı olduğu gibi taşı
      const link = target.document.createElement("link");
      link.rel = "stylesheet";
      if (sheet.href) {
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  width?: number;
  height?: number;
  children: React.ReactNode;
};

export function PipGuide({ open, onClose, width = 340, height = 460, children }: Props) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const api = window.documentPictureInPicture;
    if (!api) return;

    let win: Window | null = null;
    let cancelled = false;

    api.requestWindow({ width, height }).then((w) => {
      if (cancelled) { w.close(); return; }
      win = w;
      copyStyles(w);
      w.document.body.style.margin = "0";
      w.document.body.style.background = "#0c0f15";
      // Kullanıcı pencereyi kapatırsa durumu geri bildir
      w.addEventListener("pagehide", () => closeRef.current());
      setPipWindow(w);
    }).catch(() => closeRef.current());

    return () => {
      cancelled = true;
      setPipWindow(null);
      win?.close();
    };
  }, [open, width, height]);

  if (!pipWindow) return null;
  return createPortal(children, pipWindow.document.body);
}
