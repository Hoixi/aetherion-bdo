"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ZamanKovasi, SinifSatiri } from "@/lib/savas-analiz";
import { BDO_CLASSES, getClassIconUrl } from "@/lib/classes";

/**
 * Analiz grafikleri — el yazması SVG, sitenin kendi çizim diliyle
 * (bkz. `app/dps/parcalar.tsx`): ince çizgi, saç teli ızgara, renk yalnızca
 * durum bildirir.
 *
 * Renk düzeni her yerde aynı: yeşil bizim kill, kırmızı bizim ölüm. İkisi
 * konumla da ayrışıyor (sıfır çizgisinin üstü/altı) ve doğrudan
 * etiketleniyor, yani renk tek başına anlam taşımıyor — renk körlüğünde de
 * okunuyor. Altın nötr vurgu: büyüklük skalası ve seçili sütun.
 */

const YESIL = "#38d07f";
const KIRMIZI = "#ef5f5f";
const IZGARA = "rgba(255,255,255,.06)";
const YAZI = "#808089";

/** class_<id> → sınıf kaydı */
const SINIF = new Map<number, (typeof BDO_CLASSES)[number]>(
  BDO_CLASSES.map((c) => [c.classType, c]),
);
export const sinifAdi = (s: number) => SINIF.get(s)?.name ?? `class ${s}`;
export const sinifIkonu = (s: number) => {
  const c = SINIF.get(s);
  return c ? getClassIconUrl(c.id) : null;
};

/** Kutunun gerçek piksel genişliği — viewBox esnetince yazılar eziliyor */
function useGenislik(taban = 520) {
  const kutu = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(taban);
  useEffect(() => {
    if (!kutu.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, Math.round(e.contentRect.width))));
    ro.observe(kutu.current);
    return () => ro.disconnect();
  }, []);
  return { kutu, W };
}

const saat = (t: number) =>
  new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

function Ipucu({ x, W, children }: { x: number; W: number; children: React.ReactNode }) {
  return (
    <div className="absolute top-1 pointer-events-none rounded-[10px] px-2.5 py-1.5 text-[11.5px] min-w-[136px] z-10"
         style={{
           left: `${(x / W) * 100}%`,
           transform: x > W / 2 ? "translateX(calc(-100% - 10px))" : "translateX(10px)",
           background: "rgba(11,11,12,.96)", border: "1px solid var(--t-line-strong)",
           backdropFilter: "blur(8px)",
         }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Savaşın akışı: sıfır çizgisinin üstünde kill, altında ölüm
 * ------------------------------------------------------------------ */

export function AkisGrafigi({ kovalar, kovaSn, yukseklik = 132 }: {
  kovalar: ZamanKovasi[]; kovaSn: number; yukseklik?: number;
}) {
  const { kutu, W } = useGenislik();
  const [uzeri, setUzeri] = useState<number | null>(null);
  if (kovalar.length === 0) return null;

  const H = yukseklik, ustBosluk = 12, altBosluk = 26, solBosluk = 30;
  const alan = H - ustBosluk - altBosluk;
  const enBuyuk = Math.max(1, ...kovalar.map((k) => Math.max(k.kill, k.death)));
  const orta = ustBosluk + alan / 2;
  const birim = (alan / 2) / enBuyuk;
  const bant = (W - solBosluk - 6) / kovalar.length;
  // Çubuk en fazla 24 piksel; kalanı hava, bitişik çubuklar 2 piksel boşlukla ayrılıyor
  const kalinlik = Math.max(2, Math.min(24, bant - 2));
  const x = (i: number) => solBosluk + i * bant + (bant - kalinlik) / 2;

  const zirve = kovalar.reduce((en, k, i) => (k.death > kovalar[en].death ? i : en), 0);
  const secili = uzeri ?? null;

  return (
    <div className="relative" ref={kutu}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block"
           onMouseLeave={() => setUzeri(null)}
           onMouseMove={(e) => {
             const r = e.currentTarget.getBoundingClientRect();
             const px = ((e.clientX - r.left) / r.width) * W;
             const i = Math.floor((px - solBosluk) / bant);
             setUzeri(i >= 0 && i < kovalar.length ? i : null);
           }}>
        {/* Ölçek: en büyük değer ve sıfır */}
        <text x={solBosluk - 6} y={orta - alan / 2 + 9} textAnchor="end" fontSize="9.5" fill={YAZI}>{enBuyuk}</text>
        <text x={solBosluk - 6} y={orta + 3} textAnchor="end" fontSize="9.5" fill={YAZI}>0</text>
        <text x={solBosluk - 6} y={orta + alan / 2 + 3} textAnchor="end" fontSize="9.5" fill={YAZI}>{enBuyuk}</text>
        <line x1={solBosluk} x2={W - 6} y1={orta} y2={orta} stroke="rgba(255,255,255,.14)" />
        <line x1={solBosluk} x2={W - 6} y1={orta - alan / 2} y2={orta - alan / 2} stroke={IZGARA} />
        <line x1={solBosluk} x2={W - 6} y1={orta + alan / 2} y2={orta + alan / 2} stroke={IZGARA} />

        {kovalar.map((k, i) => (
          <g key={k.t} opacity={secili == null || secili === i ? 1 : 0.45}>
            {k.kill > 0 && (
              <rect x={x(i)} y={orta - k.kill * birim} width={kalinlik} height={k.kill * birim}
                    rx={Math.min(4, kalinlik / 2)} fill={YESIL} />
            )}
            {k.kill > 0 && <rect x={x(i)} y={orta - 2} width={kalinlik} height={2} fill={YESIL} />}
            {k.death > 0 && (
              <rect x={x(i)} y={orta} width={kalinlik} height={k.death * birim}
                    rx={Math.min(4, kalinlik / 2)} fill={KIRMIZI} />
            )}
            {k.death > 0 && <rect x={x(i)} y={orta} width={kalinlik} height={2} fill={KIRMIZI} />}
          </g>
        ))}

        {/*
          En çok öldüğümüz dilim doğrudan etiketli, gerisi ipucunda. Etiket
          çubuğun içinde duruyor: aşağı büyüyen çubuğun ucunda zaman ekseni
          var, dışarı yazınca saatin üstüne biniyordu. Kırmızı dolgunun
          üstünde koyu mürekkep okunuyor.
        */}
        {kovalar[zirve].death * birim >= 15 && kalinlik >= 14 && (
          <text x={x(zirve) + kalinlik / 2} y={orta + kovalar[zirve].death * birim - 4}
                textAnchor="middle" fontSize="10" fontWeight="600" fill="#2a0d0d">
            {kovalar[zirve].death}
          </text>
        )}

        {/* Zaman ekseni: sığdığı kadar etiket, sonuncusu bir öncekine binmiyorsa */}
        {kovalar.map((k, i) => {
          const her = Math.max(1, Math.ceil(kovalar.length / Math.max(2, Math.floor(W / 64))));
          const son = kovalar.length - 1;
          const oncekiEtiket = Math.floor(son / her) * her;
          if (i % her !== 0 && i !== son) return null;
          if (i !== son && i === oncekiEtiket && son - oncekiEtiket < her / 2) return null;
          return (
            <text key={k.t} x={x(i) + kalinlik / 2} y={H - 7} fontSize="9.5" fill={YAZI}
                  textAnchor={i === son ? "end" : i === 0 ? "start" : "middle"}>
              {saat(k.t)}
            </text>
          );
        })}
      </svg>

      {secili != null && (
        <Ipucu x={x(secili) + kalinlik / 2} W={W}>
          <div className="font-semibold mb-0.5" style={{ color: "var(--t-gold)" }}>
            {saat(kovalar[secili].t)} · {kovaSn < 60 ? `${kovaSn} sn` : `${kovaSn / 60} dk`}
          </div>
          <Satir renk={YESIL} etiket="Öldürdük" deger={kovalar[secili].kill} />
          <Satir renk={KIRMIZI} etiket="Öldük" deger={kovalar[secili].death} />
          <Satir etiket="O ana kadar fark" deger={kovalar[secili].fark} isaretli />
        </Ipucu>
      )}
    </div>
  );
}

function Satir({ renk, etiket, deger, isaretli }: {
  renk?: string; etiket: string; deger: number; isaretli?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {renk ? <i className="w-2.5 h-[2px] rounded-full" style={{ background: renk }} /> : <i className="w-2.5" />}
      <span className="flex-1" style={{ color: "var(--t-dim)" }}>{etiket}</span>
      <span className="t-num font-semibold tabular-nums">
        {isaretli && deger > 0 ? "+" : ""}{deger}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Kümülatif fark: savaş boyunca önde miydik, arkada mı
 * ------------------------------------------------------------------ */

export function FarkCizgisi({ kovalar, yukseklik = 78 }: { kovalar: ZamanKovasi[]; yukseklik?: number }) {
  const { kutu, W } = useGenislik();
  if (kovalar.length < 2) return null;

  const H = yukseklik, ust = 12, alt = 12, sol = 26;
  const degerler = kovalar.map((k) => k.fark);
  const enB = Math.max(1, ...degerler.map(Math.abs));
  const orta = ust + (H - ust - alt) / 2;
  const y = (v: number) => orta - (v / enB) * ((H - ust - alt) / 2);
  const x = (i: number) => sol + (i / (kovalar.length - 1)) * (W - sol - 30);
  const d = degerler.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const sonuc = degerler[degerler.length - 1];
  const renk = sonuc >= 0 ? YESIL : KIRMIZI;

  return (
    <div className="relative" ref={kutu}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block">
        <defs>
          {/* Kullanıcı uzayında: geçiş sıfır çizgisine denk gelsin, yolun kutusuna değil */}
          <linearGradient id="fark-dolgu" gradientUnits="userSpaceOnUse" x1="0" y1={ust} x2="0" y2={H - alt}>
            <stop offset="0" stopColor={YESIL} stopOpacity="0.18" />
            <stop offset={((orta - ust) / (H - alt - ust)).toFixed(3)} stopColor={YESIL} stopOpacity="0.02" />
            <stop offset={((orta - ust) / (H - alt - ust)).toFixed(3)} stopColor={KIRMIZI} stopOpacity="0.02" />
            <stop offset="1" stopColor={KIRMIZI} stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path d={`${d} L${x(kovalar.length - 1)},${orta} L${x(0)},${orta} Z`} fill="url(#fark-dolgu)" />
        <line x1={sol} x2={W - 30} y1={orta} y2={orta} stroke="rgba(255,255,255,.14)" />
        <text x={sol - 6} y={orta + 3} textAnchor="end" fontSize="9.5" fill={YAZI}>0</text>
        <path d={d} fill="none" stroke={renk} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(kovalar.length - 1)} cy={y(sonuc)} r="4" fill={renk} stroke="#0b0b0c" strokeWidth="2" />
        <text x={x(kovalar.length - 1) + 8} y={y(sonuc) + 4} fontSize="11" fill="#f4f4f5" className="tabular-nums">
          {sonuc > 0 ? "+" : ""}{sonuc}
        </text>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Sınıf dağılımı
 * ------------------------------------------------------------------ */

export function SinifDagilimGrafigi({ satirlar, enFazla = 12 }: { satirlar: SinifSatiri[]; enFazla?: number }) {
  const gosterilen = satirlar.slice(0, enFazla);
  const kalanlar = satirlar.slice(enFazla);
  const kalan = kalanlar.reduce(
    (t, r) => ({ kill: t.kill + r.kill, olum: t.olum + r.olum, toplam: t.toplam + r.toplam, kisi: t.kisi + r.kisi }),
    { kill: 0, olum: 0, toplam: 0, kisi: 0 },
  );
  const en = Math.max(1, ...satirlar.map((r) => r.toplam));

  return (
    <div className="space-y-1.5">
      {gosterilen.map((r) => (
        <SinifSatir key={r.sinif} ad={sinifAdi(r.sinif)} ikon={sinifIkonu(r.sinif)}
                    kill={r.kill} olum={r.olum} kisi={r.kisi} en={en} />
      ))}
      {kalanlar.length > 0 && (
        <SinifSatir ad={`Diğer ${kalanlar.length} sınıf`} ikon={null}
                    kill={kalan.kill} olum={kalan.olum} kisi={kalan.kisi} en={en} />
      )}
    </div>
  );
}

function SinifSatir({ ad, ikon, kill, olum, kisi, en }: {
  ad: string; ikon: string | null; kill: number; olum: number; kisi: number; en: number;
}) {
  return (
    <div title={`${ad} · ${kisi} kişi · ${olum} ölümümüz, ${kill} kill`}>
      <div className="flex items-center gap-2 text-[12.5px]">
        {ikon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ikon} alt="" className="w-4 h-4 opacity-80 flex-shrink-0" />
        ) : <span className="w-4 flex-shrink-0" />}
        <span className="flex-1 truncate">{ad}</span>
        <span className="text-[10px] tabular-nums" style={{ color: "var(--t-faint)" }}>{kisi} kişi</span>
        <span className="t-num tabular-nums w-6 text-right" style={{ color: "var(--t-good)" }}>{kill}</span>
        <span className="t-num tabular-nums w-6 text-right" style={{ color: "var(--t-bad)" }}>{olum}</span>
      </div>
      <div className="flex h-[5px] mt-0.5 gap-[2px]">
        <i style={{ width: `${(kill / en) * 100}%`, background: "var(--t-good)", borderRadius: 3 }} />
        <i style={{ width: `${(olum / en) * 100}%`, background: "var(--t-bad)", borderRadius: 3 }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Isı matrisi — klan × sınıf ve sınıf × sınıf aynı tabloyu kullanıyor
 * ------------------------------------------------------------------ */

export interface MatrisSatiri {
  anahtar: string;
  etiket: string;
  /** Satır başındaki küçük ikon (sınıf) */
  ikon?: string | null;
  /** Etiketin yanındaki sayı (kişi, toplam) */
  ek?: number;
  hucre: Map<number, number>;
}

/**
 * Sayı büyüdükçe koyulaşan tek renkli tablo. Değer hücrenin içinde de
 * yazıyor: renk tek başına okuma zorunluluğu değil, tablo kendisi zaten
 * okunabilir hâli.
 */
export function IsiMatrisi({ satirlar, sutunlar, enBuyuk, renk = "altin", baslik, altYazi, birim = "kişi" }: {
  satirlar: MatrisSatiri[];
  sutunlar: number[];
  enBuyuk: number;
  renk?: "altin" | "kirmizi";
  /** Sol üst köşedeki sütun başlığı */
  baslik: string;
  altYazi: string;
  birim?: string;
}) {
  const [uzeri, setUzeri] = useState<{ satir: string; sinif: number; n: number } | null>(null);
  // Sütun sayısı yüksekse kırpıyoruz: 16 sınıftan sonra hücre okunmuyor
  const sut = useMemo(() => sutunlar.slice(0, 16), [sutunlar]);
  if (satirlar.length === 0 || sut.length === 0) return null;
  const taban = renk === "kirmizi" ? "239,95,95" : "232,180,81";
  const koyuYazi = renk === "kirmizi" ? "#2a0d0d" : "#151208";

  return (
    <div className="p-2.5">
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: "2px" }}>
          <thead>
            <tr>
              <th className="text-left text-[9.5px] uppercase tracking-[0.06em] font-normal pr-2"
                  style={{ color: "var(--t-faint)" }}>{baslik}</th>
              {sut.map((s) => {
                const ikon = sinifIkonu(s);
                return (
                  <th key={s} className="w-[22px]" title={sinifAdi(s)}>
                    {ikon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ikon} alt={sinifAdi(s)} className="w-[18px] h-[18px] opacity-70 mx-auto" />
                    ) : <span className="text-[9px]" style={{ color: "var(--t-faint)" }}>{s}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {satirlar.map((r) => (
              <tr key={r.anahtar}>
                <td className="pr-2 text-[11.5px] whitespace-nowrap max-w-[150px] truncate">
                  <span className="inline-flex items-center gap-1.5">
                    {r.ikon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.ikon} alt="" className="w-[14px] h-[14px] opacity-75" />
                    )}
                    <span className="truncate">{r.etiket}</span>
                    {r.ek != null && (
                      <span className="text-[10px] tabular-nums" style={{ color: "var(--t-faint)" }}>{r.ek}</span>
                    )}
                  </span>
                </td>
                {sut.map((s) => {
                  const n = r.hucre.get(s) ?? 0;
                  const secili = uzeri?.satir === r.anahtar && uzeri?.sinif === s;
                  return (
                    <td key={s}
                        onMouseEnter={() => setUzeri({ satir: r.anahtar, sinif: s, n })}
                        onMouseLeave={() => setUzeri(null)}
                        tabIndex={n ? 0 : -1}
                        onFocus={() => setUzeri({ satir: r.anahtar, sinif: s, n })}
                        onBlur={() => setUzeri(null)}
                        title={n ? `${r.etiket} · ${sinifAdi(s)} · ${n} ${birim}` : undefined}
                        className="w-[22px] h-[22px] text-center text-[10.5px] tabular-nums rounded-[4px]"
                        style={{
                          background: n ? `rgba(${taban},${(0.14 + 0.72 * (n / enBuyuk)).toFixed(3)})` : "var(--t-raised)",
                          color: n ? (n / enBuyuk > 0.55 ? koyuYazi : "#f4f4f5") : "transparent",
                          outline: secili ? `1px solid rgba(${taban},.9)` : "none",
                        }}>
                      {n || "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-2 text-[10px]" style={{ color: "var(--t-faint)" }}>
        <span>{birim} sayısı</span>
        <span className="flex items-center gap-[2px]">
          {[0.15, 0.4, 0.65, 0.9].map((a) => (
            <i key={a} className="w-3 h-[7px] rounded-[2px]" style={{ background: `rgba(${taban},${a})` }} />
          ))}
        </span>
        <span>1 → {enBuyuk}</span>
        <span className="ml-auto truncate">
          {uzeri && uzeri.n > 0
            ? `${satirlar.find((x) => x.anahtar === uzeri.satir)?.etiket} · ${sinifAdi(uzeri.sinif)} · ${uzeri.n} ${birim}`
            : altYazi}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 *  Bizi en çok öldüren sınıflar — klanın geneli, tek seri
 * ------------------------------------------------------------------ */

/**
 * Tek soru, tek seri: hangi sınıfa kaç ölüm verdik. Çubuk yalnız ölümü
 * çiziyor; kendi kill'imiz ve kişi sayısı satırın sağında yazı olarak
 * duruyor, çünkü iki çubuk aynı satırda büyüklük karşılaştırmasını
 * bozuyor.
 */
export function OlumSiralamasi({ satirlar, toplamOlum, enFazla = 14 }: {
  satirlar: SinifSatiri[];
  /** Kayıttaki bütün ölümler — pay hesabı için (sınıfı bilinmeyenler dahil) */
  toplamOlum: number;
  enFazla?: number;
}) {
  const sirali = satirlar.slice().sort((a, b) => b.olum - a.olum || b.toplam - a.toplam);
  const gosterilen = sirali.slice(0, enFazla);
  const kuyruk = sirali.slice(enFazla);
  const en = Math.max(1, ...sirali.map((r) => r.olum));
  const pay = (n: number) => (toplamOlum > 0 ? Math.round((n / toplamOlum) * 100) : 0);

  return (
    <div className="p-2.5 space-y-[7px]">
      {gosterilen.map((r, i) => {
        const ikon = sinifIkonu(r.sinif);
        return (
          <div key={r.sinif} className="flex items-center gap-2"
               title={`${sinifAdi(r.sinif)} · ${r.olum} ölüm · ${r.kisi} kişi · biz ${r.kill} kill aldık`}>
            <span className="w-[14px] text-[10px] tabular-nums text-right flex-shrink-0"
                  style={{ color: "var(--t-faint)" }}>{i + 1}</span>
            {ikon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ikon} alt="" className="w-[18px] h-[18px] opacity-85 flex-shrink-0" />
            ) : <span className="w-[18px] flex-shrink-0" />}
            <span className="w-[86px] text-[12px] truncate flex-shrink-0">{sinifAdi(r.sinif)}</span>

            <span className="flex-1 min-w-[60px] h-[10px] rounded-[3px] relative"
                  style={{ background: "var(--t-raised)" }}>
              <i className="absolute left-0 top-0 h-full"
                 style={{ width: `${Math.max(2, (r.olum / en) * 100)}%`, background: KIRMIZI,
                          borderRadius: "3px 4px 4px 3px" }} />
            </span>

            <span className="t-num text-[12.5px] tabular-nums w-7 text-right font-semibold"
                  style={{ color: "var(--t-bad)" }}>{r.olum}</span>
            <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: "var(--t-dim)" }}>
              %{pay(r.olum)}
            </span>
            <span className="text-[10px] tabular-nums w-14 text-right hidden sm:block"
                  style={{ color: "var(--t-faint)" }}>{r.kisi} kişi</span>
            <span className="text-[10px] tabular-nums w-16 text-right hidden md:block"
                  style={{ color: "var(--t-faint)" }}>
              kişi başı {(r.olum / Math.max(1, r.kisi)).toFixed(1)}
            </span>
            <span className="t-num text-[11px] tabular-nums w-8 text-right hidden md:block"
                  style={{ color: "var(--t-good)" }}>{r.kill}</span>
          </div>
        );
      })}
      {kuyruk.length > 0 && (
        <p className="text-[10.5px] pt-1" style={{ color: "var(--t-faint)" }}>
          + {kuyruk.length} sınıf daha, toplam {kuyruk.reduce((t, r) => t + r.olum, 0)} ölüm
        </p>
      )}
      <p className="text-[10px] pt-1" style={{ color: "var(--t-faint)" }}>
        Çubuk ölümü gösteriyor · yüzde kayıttaki bütün ölümlere oran ·
        sağdaki yeşil sayı o sınıfa karşı aldığımız kill
      </p>
    </div>
  );
}
