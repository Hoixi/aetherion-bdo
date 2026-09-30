import { TestShell } from "@/components/app-shell";
import type { RakipKlan } from "@/lib/rakip-dosyasi";
import { getClassIconUrl, BDO_CLASSES } from "@/lib/classes";

/** classType → ikon kimliği */
const SINIF_ID = new Map<number, string>(BDO_CLASSES.map((c) => [c.classType, c.id]));
const classIdOf = (sinif: number) => SINIF_ID.get(sinif) ?? "";
import { Shield, EyeOff, Swords, Users } from "lucide-react";

/**
 * Rakip dosyaları — menüde yok, adresi bilen ve giriş yapan görür.
 *
 * Savaş başına analiz "bu gece ne oldu" diyor; bu sayfa hafıza:
 * aynı klanla onuncu kez karşılaşırken kadrolarını ve kimin tehlikeli
 * olduğunu baştan biliyoruz.
 */

const tarih = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }) : "—";

export function RakipIcerik({ klanlar, savasSayisi, olaySayisi, sinifsiz }: {
  klanlar: RakipKlan[]; savasSayisi: number; olaySayisi: number; sinifsiz: number;
}) {
  const onemli = klanlar.filter((k) => k.kill + k.olum >= 15);
  const kalanlar = klanlar.filter((k) => k.kill + k.olum < 15);

  return (
    <TestShell
      title="Rakip dosyaları"
      subtitle={`${savasSayisi} kayıtlı savaş · ${olaySayisi} olay · ${klanlar.length} klan`}
      aside={<span className="t-chip flex items-center gap-1.5"><EyeOff className="w-3 h-3" /> menüde yok</span>}
    >
      <div className="space-y-4">
        {onemli.length === 0 && (
          <div className="p-6 text-[13px] rounded-[var(--t-r)]"
               style={{ color: "var(--t-dim)", background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
            Henüz yeterli kayıt yok. Companion&apos;da canlı savaş kaydı açıkken savaşa girildikçe burası dolar.
          </div>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", alignItems: "start" }}>
          {onemli.map((k) => <Dosya key={k.ad} k={k} />)}
        </div>

        {kalanlar.length > 0 && (
          <section className="rounded-[var(--t-r)] overflow-hidden" style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
            <header className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <Users className="w-3.5 h-3.5" style={{ color: "var(--t-gold)" }} />
              <h2 className="text-[12.5px] font-semibold">Az karşılaştıklarımız</h2>
            </header>
            <div className="p-3 flex flex-wrap gap-2">
              {kalanlar.map((k) => (
                <span key={k.ad} className="text-[11.5px] px-2 py-1 rounded-[var(--t-r-sm)]"
                      style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                  {k.ad} <b style={{ color: k.fark >= 0 ? "var(--t-good)" : "var(--t-bad)" }}>{k.fark > 0 ? "+" : ""}{k.fark}</b>
                  <span style={{ color: "var(--t-faint)" }}> · {k.kill + k.olum} olay</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
          Kaynak: Companion&apos;ın canlı savaş kaydı. Sınıflar oyunun herkese açık profil sayfasından
          {sinifsiz > 0 && ` (${sinifsiz} olayda karakterin sınıfı henüz okunmadı)`}. Resmî hasar raporunun
          yerine geçmez; yalnızca kaydı alan kişilerin gördüğü akıştır.
        </p>
      </div>
    </TestShell>
  );
}

function Dosya({ k }: { k: RakipKlan }) {
  const enKotu = Math.max(1, ...k.siniflar.map((s) => s.bizeOlum));
  const sonUc = k.gidisat.slice(-6);
  return (
    <section className="rounded-[var(--t-r)] overflow-hidden" style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
      <header className="px-4 py-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: k.fark >= 0 ? "var(--t-good)" : "var(--t-bad)" }} />
          <h2 className="text-[14px] font-semibold flex-1 truncate">{k.ad}</h2>
          <span className="t-num text-[17px] font-bold" style={{ color: k.fark >= 0 ? "var(--t-good)" : "var(--t-bad)" }}>
            {k.fark > 0 ? "+" : ""}{k.fark}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11.5px]" style={{ color: "var(--t-dim)" }}>
          <span><b style={{ color: "var(--t-good)" }}>{k.kill}</b> kill · <b style={{ color: "var(--t-bad)" }}>{k.olum}</b> ölüm</span>
          <span>{k.savas} savaş</span>
          <span>{k.kisi} kişi gördük</span>
          <span>son: {tarih(k.sonKarsilasma)}</span>
        </div>
      </header>

      {sonUc.length > 1 && (
        <div className="px-4 py-2.5 flex items-end gap-1.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
          <span className="text-[10px] uppercase tracking-[0.06em] mr-1" style={{ color: "var(--t-faint)" }}>gidişat</span>
          {sonUc.map((g) => {
            const en = Math.max(...sonUc.map((x) => Math.abs(x.fark)), 1);
            const h = Math.max(3, Math.round((Math.abs(g.fark) / en) * 22));
            return (
              <span key={g.warId} title={`${tarih(g.tarih)} · ${g.kill} kill / ${g.olum} ölüm`}
                    className="flex flex-col items-center gap-0.5" style={{ width: 22 }}>
                <i style={{ width: "100%", height: h, borderRadius: 3, background: g.fark >= 0 ? "var(--t-good)" : "var(--t-bad)" }} />
                <span className="t-num text-[9px]" style={{ color: "var(--t-faint)" }}>{g.fark > 0 ? "+" : ""}{g.fark}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="grid sm:grid-cols-2">
        <div className="p-3" style={{ borderRight: "1px solid var(--t-line)" }}>
          <p className="text-[10px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--t-faint)" }}>Kadrosu</p>
          {k.siniflar.length === 0 ? (
            <p className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>Sınıfları okunmadı.</p>
          ) : (
            <div className="space-y-1">
              {k.siniflar.slice(0, 7).map((s) => (
                <div key={s.sinif} className="flex items-center gap-2 text-[12px]">
                  {s.id && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getClassIconUrl(s.id)} alt="" className="w-4 h-4 opacity-75" />
                  )}
                  <span className="flex-1 truncate">{s.ad}</span>
                  <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>{s.kisi}×</span>
                  <span className="t-num tabular-nums w-8 text-right" style={{ color: "var(--t-bad)" }}>{s.bizeOlum}</span>
                  <span className="w-10 h-[5px] rounded-full" style={{ background: "var(--t-raised)" }}>
                    <i className="block h-full rounded-full" style={{ width: `${(s.bizeOlum / enKotu) * 100}%`, background: "var(--t-bad)" }} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-3">
          <p className="text-[10px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--t-faint)" }}>Bizi en çok öldürenler</p>
          <div className="space-y-1">
            {k.oyuncular.slice(0, 7).map((o) => (
              <div key={o.aile} className="flex items-center gap-2 text-[12px]">
                {o.sinif != null && getClassIconUrl(classIdOf(o.sinif)) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={getClassIconUrl(classIdOf(o.sinif))} alt="" title={o.sinifAd ?? ""} className="w-4 h-4 opacity-75" />
                )}
                <span className="flex-1 truncate" title={`${o.karakter} · ${o.sinifAd ?? "sınıf bilinmiyor"}`}>{o.aile}</span>
                <span className="t-num tabular-nums w-8 text-right" style={{ color: "var(--t-bad)" }}>{o.bizeOlum}</span>
                <span className="t-num tabular-nums w-8 text-right" style={{ color: "var(--t-good)" }}>{o.bizimKill}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-2 flex items-center gap-1.5 text-[11px]" style={{ borderTop: "1px solid var(--t-line)", color: "var(--t-dim)" }}>
        <Swords className="w-3 h-3" style={{ color: "var(--t-faint)" }} />
        {k.fark < -40 ? "Açık alanda kaçınılacak klan; dar geçit ve duvar."
          : k.fark < 0 ? "Başa baştan kötü: kadro ve açı önemli."
            : "Üstünlük bizde; ilk teması aramakta sakınca yok."}
      </div>
    </section>
  );
}
