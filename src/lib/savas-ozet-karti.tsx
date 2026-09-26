import { ImageResponse } from "next/og";
import { BDO_CLASSES, getClassIconUrl } from "@/lib/classes";
import type { SavasOzeti } from "@/lib/savas-ozeti";

/**
 * Savaş özeti kartının çizimi — Discord'a giden 900×660 PNG.
 *
 * Veri toplama `savas-ozeti.ts`te, ısı kesiti `harita-karti.ts`te; burası
 * yalnız yerleşim. Satori ile çiziliyor, yani sadece flex düzeni ve basit
 * kutular: ızgara, gölge, filtre yok.
 */

const SITE_URL = process.env.NEXTAUTH_URL || "https://aetheri.online";
const SINIF = new Map<number, (typeof BDO_CLASSES)[number]>(
  BDO_CLASSES.map((c) => [c.classType, c]),
);

const ALTIN = "#e0b040";
const YESIL = "#2bca6e";
const KIRMIZI = "#e05252";
const YAZI = "#dce4f2";
const SONUK = "#7a8ba3";
const COK_SONUK = "#4d5c73";
const CIZGI = "#1a2030";

/**
 * Yazı tipi karta gömülüyor.
 *
 * Satori'nin varsayılanı latin alt kümesi: "ş", "ğ", "İ" gibi harfler
 * eksik kalıyor ve Türkçe başlıklar delik deşik çıkıyor. Inter'in
 * latin-ext sürümü indirilip süreç ömrü boyunca bellekte tutuluyor —
 * kart başına indirme yok.
 */
const FONTLAR: Record<number, string> = {
  400: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf",
  700: "https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf",
};
let fontBellek: Array<{ name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }> | null = null;

async function fontlar() {
  if (fontBellek) return fontBellek;
  try {
    const yuklu = await Promise.all(
      (Object.entries(FONTLAR) as Array<[string, string]>).map(async ([agirlik, url]) => {
        const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!r.ok) throw new Error(`font ${r.status}`);
        return {
          name: "Inter", data: await r.arrayBuffer(),
          weight: Number(agirlik) as 400 | 700, style: "normal" as const,
        };
      }),
    );
    fontBellek = yuklu;
    return yuklu;
  } catch {
    // İnmediyse Satori kendi varsayılanına düşsün; Türkçe harfler eksik
    // çıkabilir ama kart hiç üretilememektense yarım üretilsin.
    return null;
  }
}

const saat = (t: number) =>
  new Date(t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

function sure(sn: number) {
  const dk = Math.floor(sn / 60);
  return dk >= 60 ? `${Math.floor(dk / 60)}s ${dk % 60}dk` : `${dk} dk`;
}

export async function ozetKarti({ baslik, tarih, o, isiUrl }: {
  baslik: string;
  tarih: Date;
  o: SavasOzeti;
  /** Isı kesitinin data URI'si; üretilemediyse null */
  isiUrl: string | null;
}) {
  const fark = o.kill - o.death;
  const kd = o.death > 0 ? (o.kill / o.death).toFixed(2) : "—";
  const enBuyukDilim = Math.max(1, ...o.dilimler.map((d) => Math.max(d.kill, d.death)));
  const klanlar = o.klanlar.slice(0, 5);
  const enKlan = Math.max(1, ...klanlar.map((k) => k.kill + k.olum));
  const siniflar = o.siniflar.slice(0, 5);
  const enSinif = Math.max(1, ...siniflar.map((s) => s.olum));
  const dateStr = tarih.toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul",
  });
  return new ImageResponse(
    (
      <div style={{
        width: "900px", height: "660px", display: "flex", flexDirection: "column",
        background: "linear-gradient(160deg, #1a2233 0%, #131820 42%, #0c0f15 100%)",
        fontFamily: "Inter, sans-serif",
      }}>
        <div style={{ display: "flex", height: "3px", width: "100%",
                      background: `linear-gradient(90deg, ${ALTIN}, #c29328 40%, transparent)` }} />

        {/* Başlık */}
        <div style={{ display: "flex", alignItems: "flex-end", padding: "18px 30px 0", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: "12px", letterSpacing: "2px", color: ALTIN }}>
              SAVAŞ ÖZETİ
            </div>
            <div style={{ display: "flex", fontSize: "28px", fontWeight: 800, color: YAZI }}>
              {baslik}
            </div>
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div style={{ display: "flex", fontSize: "13px", color: SONUK }}>{dateStr}</div>
            <div style={{ display: "flex", fontSize: "13px", color: COK_SONUK }}>
              {saat(o.ilk)} – {saat(o.son)} · {sure(o.sureSn)}
            </div>
          </div>
        </div>

        {/* Sayılar */}
        <div style={{ display: "flex", alignItems: "center", gap: "26px", padding: "14px 30px 12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "7px" }}>
            <div style={{ display: "flex", fontSize: "44px", fontWeight: 800,
                          color: fark >= 0 ? YESIL : KIRMIZI }}>
              {fark > 0 ? "+" : ""}{fark}
            </div>
            <div style={{ display: "flex", fontSize: "12px", color: COK_SONUK }}>fark</div>
          </div>
          {[
            { e: "ÖLDÜRDÜK", d: String(o.kill), c: YESIL },
            { e: "ÖLDÜK", d: String(o.death), c: KIRMIZI },
            { e: "K/D", d: kd, c: YAZI },
            { e: "OLAY", d: String(o.olaySayisi), c: YAZI },
            { e: "KARŞI KLAN", d: String(o.klanlar.length), c: YAZI },
            { e: "KARŞI AİLE", d: String(o.rakipler.length), c: YAZI },
          ].map((k) => (
            <div key={k.e} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: "10px", letterSpacing: "1px", color: COK_SONUK }}>{k.e}</div>
              <div style={{ display: "flex", fontSize: "21px", fontWeight: 700, color: k.c }}>{k.d}</div>
            </div>
          ))}
        </div>

        {/* Orta: harita + listeler */}
        <div style={{ display: "flex", padding: "0 30px", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", width: "520px" }}>
            {isiUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={isiUrl} width={520} height={320} alt=""
                   style={{ borderRadius: "8px", border: `1px solid ${CIZGI}` }} />
            ) : (
              <div style={{ display: "flex", width: "520px", height: "320px", borderRadius: "8px",
                            border: `1px solid ${CIZGI}`, alignItems: "center", justifyContent: "center",
                            color: COK_SONUK, fontSize: "13px" }}>
                Harita kesiti üretilemedi
              </div>
            )}
            <div style={{ display: "flex", gap: "14px", marginTop: "6px", fontSize: "11px", color: COK_SONUK }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ display: "flex", width: "8px", height: "8px", borderRadius: "4px", background: KIRMIZI }} />
                öldüğümüz yerler
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ display: "flex", width: "8px", height: "8px", borderRadius: "4px", background: YESIL }} />
                aldığımız kill
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "10px" }}>
            <Bolum baslik="KARŞI KLANLAR">
              {klanlar.map((k) => (
                <div key={k.ad} style={{ display: "flex", flexDirection: "column", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", fontSize: "13px", color: YAZI }}>
                    <div style={{ display: "flex", flex: 1 }}>{k.ad}</div>
                    <div style={{ display: "flex", color: YESIL, width: "34px", justifyContent: "flex-end" }}>{k.kill}</div>
                    <div style={{ display: "flex", color: KIRMIZI, width: "34px", justifyContent: "flex-end" }}>{k.olum}</div>
                  </div>
                  <div style={{ display: "flex", height: "5px", marginTop: "3px", gap: "2px" }}>
                    <div style={{ display: "flex", width: `${(k.kill / enKlan) * 100}%`, background: YESIL, borderRadius: "3px" }} />
                    <div style={{ display: "flex", width: `${(k.olum / enKlan) * 100}%`, background: KIRMIZI, borderRadius: "3px" }} />
                  </div>
                </div>
              ))}
            </Bolum>

            <Bolum baslik={siniflar.length ? "BİZİ EN ÇOK ÖLDÜREN SINIFLAR" : "SINIFLAR"}>
              {siniflar.length === 0 ? (
                <div style={{ display: "flex", fontSize: "12px", color: COK_SONUK }}>
                  Karakter profilleri henüz okunmadı.
                </div>
              ) : siniflar.map((s) => {
                const c = SINIF.get(s.sinif);
                const ikon = c ? `${SITE_URL}${getClassIconUrl(c.id)}` : null;
                return (
                  <div key={s.sinif} style={{ display: "flex", alignItems: "center", marginBottom: "6px", gap: "8px" }}>
                    {ikon
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={ikon} width={18} height={18} alt="" style={{ opacity: 0.8 }} />
                      : <div style={{ display: "flex", width: "18px" }} />}
                    <div style={{ display: "flex", fontSize: "13px", color: YAZI, width: "86px" }}>
                      {c?.name ?? s.sinif}
                    </div>
                    <div style={{ display: "flex", flex: 1, height: "7px", background: "#16202e", borderRadius: "4px" }}>
                      <div style={{ display: "flex", width: `${(s.olum / enSinif) * 100}%`,
                                    background: KIRMIZI, borderRadius: "4px" }} />
                    </div>
                    <div style={{ display: "flex", fontSize: "13px", color: KIRMIZI, width: "26px",
                                  justifyContent: "flex-end" }}>{s.olum}</div>
                    <div style={{ display: "flex", fontSize: "11px", color: COK_SONUK, width: "44px",
                                  justifyContent: "flex-end" }}>{s.kisi} kişi</div>
                  </div>
                );
              })}
            </Bolum>
          </div>
        </div>

        {/* Zaman çizgisi */}
        <div style={{ display: "flex", flexDirection: "column", padding: "14px 30px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <div style={{ display: "flex", fontSize: "10px", letterSpacing: "1px", color: COK_SONUK }}>
              SAVAŞIN AKIŞI · {o.dilimSn < 60 ? `${o.dilimSn} SN` : `${o.dilimSn / 60} DK`}LIK DİLİMLER
            </div>
            <div style={{ display: "flex", flex: 1 }} />
            <div style={{ display: "flex", fontSize: "10px", color: YESIL }}>üst: öldürdük</div>
            <div style={{ display: "flex", fontSize: "10px", color: KIRMIZI }}>alt: öldük</div>
          </div>
          {/*
            Çubuk yüksekliği ayrı bir sarmalayıcıda: Satori'de yüksekliği
            verilmiş boş bir kutu, esnek kapsayıcının içinde gerilip bütün
            alanı kaplıyordu. Sütun yönünde justifyContent ile hizalanınca
            verilen yükseklik korunuyor.
          */}
          <div style={{ display: "flex", alignItems: "center", height: "84px", gap: "3px" }}>
            {o.dilimler.map((d) => {
              const y = Math.round((d.kill / enBuyukDilim) * 38);
              const k = Math.round((d.death / enBuyukDilim) * 38);
              return (
                <div key={d.t} style={{ display: "flex", flexDirection: "column", flex: 1, height: "84px" }}>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end",
                                height: "40px", width: "100%" }}>
                    <div style={{ display: "flex", width: "100%", height: `${y}px`, flexShrink: 0,
                                  background: YESIL, borderRadius: "3px 3px 0 0" }} />
                  </div>
                  <div style={{ display: "flex", width: "100%", height: "2px", flexShrink: 0,
                                background: "#26324a" }} />
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start",
                                height: "40px", width: "100%" }}>
                    <div style={{ display: "flex", width: "100%", height: `${k}px`, flexShrink: 0,
                                  background: KIRMIZI, borderRadius: "0 0 3px 3px" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: COK_SONUK }}>
            <div style={{ display: "flex" }}>{saat(o.ilk)}</div>
            <div style={{ display: "flex" }}>{saat(o.son)}</div>
          </div>
        </div>

        <div style={{ display: "flex", flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", padding: "0 30px 14px", fontSize: "10.5px",
                      color: COK_SONUK, gap: "6px" }}>
          <div style={{ display: "flex" }}>
            {o.kayitci} kayıttan{o.kayitciAdlari.length ? ` (${o.kayitciAdlari.slice(0, 3).join(", ")})` : ""}
            {o.tekrar > 0 ? ` · ${o.tekrar} tekrar eden paket ayıklandı` : ""}
            {o.sinifsiz > 0 ? ` · ${o.sinifsiz} olayda sınıf bilinmiyor` : ""}
          </div>
          <div style={{ display: "flex", flex: 1 }} />
          <div style={{ display: "flex" }}>aetheri.online · resmî hasar raporu değildir</div>
        </div>
      </div>
    ),
    { width: 900, height: 660, fonts: (await fontlar()) ?? undefined },
  );
}

function Bolum({ baslik, children }: { baslik: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", background: "#11161f",
                  border: `1px solid ${CIZGI}`, borderRadius: "8px", padding: "9px 11px" }}>
      <div style={{ display: "flex", fontSize: "10px", letterSpacing: "1px", color: COK_SONUK,
                    marginBottom: "7px" }}>{baslik}</div>
      {children}
    </div>
  );
}
