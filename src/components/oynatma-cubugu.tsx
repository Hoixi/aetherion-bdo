"use client";

import { Play, Pause, SkipBack, Rewind, FastForward } from "lucide-react";

/**
 * Savaşı zaman çizgisinde oynatma.
 *
 * Kayıt saatlerce sürebiliyor; gerçek zamanlı izlemenin anlamı yok, o yüzden
 * hız çarpanı var. Çubuğu sürükleyerek herhangi bir ana atlanıyor, boşluk
 * tuşu duraklatıyor.
 *
 * Zaman "kayıt saati": olayların üstündeki damga, oyunun sunucu saati değil
 * kaydı alan bilgisayarın saati.
 */

export const HIZLAR = [2, 5, 10, 20] as const;

export function OynatmaCubugu({ ilk, son, an, calisiyor, hiz, onAn, onOynat, onHiz, onBasaAl }: {
  ilk: number;
  son: number;
  /** Şu anki an (ms); null ise oynatma kapalı, hepsi görünüyor */
  an: number | null;
  calisiyor: boolean;
  hiz: number;
  onAn: (t: number) => void;
  onOynat: () => void;
  onHiz: (h: number) => void;
  onBasaAl: () => void;
}) {
  const suan = an ?? son;
  const gecen = Math.max(0, Math.round((suan - ilk) / 1000));
  const toplam = Math.max(1, Math.round((son - ilk) / 1000));
  const sure = (sn: number) => `${Math.floor(sn / 60)}:${String(sn % 60).padStart(2, "0")}`;

  return (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[600] flex items-center gap-2.5 px-3 py-2 rounded-[var(--t-r)]"
         style={{ background: "rgba(16,16,19,.94)", border: "1px solid var(--t-line)",
                  backdropFilter: "blur(6px)", boxShadow: "0 10px 34px rgba(0,0,0,.5)", width: "min(660px, calc(100vw - 380px))" }}>
      <button onClick={onBasaAl} className="t-tab" title="Başa al">
        <SkipBack className="w-3.5 h-3.5" />
      </button>
      <button onClick={onOynat} className="t-tab" data-on={calisiyor}
              title={calisiyor ? "Duraklat (boşluk)" : "Oynat (boşluk)"}>
        {calisiyor ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>

      <span className="t-num text-[11.5px] tabular-nums flex-shrink-0" style={{ color: "var(--t-dim)" }}>
        {sure(gecen)} / {sure(toplam)}
      </span>

      <input type="range" min={ilk} max={son} step={250} value={suan}
             onChange={(e) => onAn(Number(e.target.value))}
             aria-label="Savaş zamanı"
             aria-valuetext={`${sure(gecen)} / ${sure(toplam)}`}
             style={{ ["--ilerleme" as string]: `${((suan - ilk) / Math.max(1, son - ilk)) * 100}%` }}
             className="flex-1 oynatma-cizgi" />

      <span className="t-num text-[11px] flex-shrink-0" style={{ color: "var(--t-faint)" }}>
        {new Date(suan).toLocaleTimeString("tr-TR")}
      </span>

      <div className="flex items-center gap-0.5 p-0.5 rounded-[var(--t-r-sm)] flex-shrink-0"
           style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
        <Rewind className="w-3 h-3 ml-1" style={{ color: "var(--t-faint)" }} />
        {HIZLAR.map((h) => (
          <button key={h} onClick={() => onHiz(h)}
                  className="px-1.5 py-1 rounded-md text-[11px] font-semibold"
                  style={hiz === h
                    ? { color: "var(--t-gold)", background: "var(--t-gold-soft)" }
                    : { color: "var(--t-faint)" }}>
            {h}x
          </button>
        ))}
        <FastForward className="w-3 h-3 mr-1" style={{ color: "var(--t-faint)" }} />
      </div>
    </div>
  );
}
