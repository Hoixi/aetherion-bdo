"use client";

import { useEffect, useRef, useState } from "react";
import { ses, type SesDurum } from "@/lib/ses-web";

/**
 * Odadaki ekran yayınları — sohbetin üstünde kutucuklar. Kutuya tıkla →
 * büyük (tam ekran); Esc ile geri. Kendi yayınım da görünür (sessiz, ne
 * gösterdiğimi görmek için).
 */
function YayinKutusu({ y, buyuk, onTik }: { y: SesDurum["yayinlar"][number]; buyuk: boolean; onTik: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current; const t = ses.ekranParcasi(y.id);
    if (!el || !t) return;
    t.attach(el);
    return () => { t.detach(el); };
  }, [y.id]);
  return (
    <div className="yayin-kutu" onClick={onTik} title={buyuk ? "Küçült (Esc)" : "Büyüt"}>
      <video ref={ref} autoPlay playsInline muted={y.ben} />
      <span className="yayin-etiket">📺 {y.ad}{y.ben ? " (sen)" : ""}</span>
    </div>
  );
}

export function YayinPaneli({ yayinlar }: { yayinlar: SesDurum["yayinlar"] }) {
  const [buyuk, setBuyuk] = useState<string | null>(null);
  useEffect(() => {
    if (!buyuk) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setBuyuk(null); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [buyuk]);
  useEffect(() => { if (buyuk && !yayinlar.some((y) => y.id === buyuk)) setBuyuk(null); }, [yayinlar, buyuk]);
  if (yayinlar.length === 0) return null;
  const b = buyuk ? yayinlar.find((y) => y.id === buyuk) : null;
  return (
    <>
      <div className="yayin-serit">
        {yayinlar.map((y) => <YayinKutusu key={y.id} y={y} buyuk={false} onTik={() => setBuyuk(y.id)} />)}
      </div>
      {b && (
        <div className="yayin-perde" onClick={() => setBuyuk(null)}>
          <div style={{ width: "min(96vw, 1600px)", height: "min(92vh, 900px)" }} onClick={(e) => e.stopPropagation()}>
            <YayinKutusu y={b} buyuk onTik={() => setBuyuk(null)} />
          </div>
        </div>
      )}
    </>
  );
}
