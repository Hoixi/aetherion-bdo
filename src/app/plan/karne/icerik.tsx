import { TestShell } from "@/components/app-shell";
import type { KarneSatiri } from "@/lib/karne";
import { getClassIconUrl } from "@/lib/classes";
import { EyeOff, Skull, Swords, TrendingUp } from "lucide-react";

/**
 * Kişisel savaş karnesi — menüde yok.
 *
 * Hasar raporu kim ne yaptı diyor; bu tablo nedenini söylüyor: kim
 * kimin elinden ölüyor, hangi sınıf kime denk geliyor. Parti kurarken
 * ve "şuna dikkat et" derken bakılacak yer.
 */

export function KarneIcerik({ satirlar, savasSayisi, olaySayisi }: {
  satirlar: KarneSatiri[]; savasSayisi: number; olaySayisi: number;
}) {
  const yeterli = satirlar.filter((s) => s.kill + s.olum >= 10);
  const enIyi = yeterli.slice(0, 3);
  const enCokOlen = [...yeterli].sort((a, b) => b.savasBasiOlum - a.savasBasiOlum).slice(0, 3);

  return (
    <TestShell
      title="Savaş karnesi"
      subtitle={`${savasSayisi} kayıtlı savaş · ${olaySayisi} olay · ${satirlar.length} kişi`}
      aside={<span className="t-chip flex items-center gap-1.5"><EyeOff className="w-3 h-3" /> menüde yok</span>}
    >
      <div className="space-y-4">
        {satirlar.length === 0 ? (
          <div className="p-6 text-[13px] rounded-[var(--t-r)]"
               style={{ color: "var(--t-dim)", background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
            Henüz kill akışı kaydı yok.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Ozet ikon={TrendingUp} baslik="En iyi kill/ölüm" renk="var(--t-good)"
                    satirlar={enIyi.map((s) => [s.aile, s.kd.toFixed(2)])} />
              <Ozet ikon={Skull} baslik="Savaş başına en çok ölen" renk="var(--t-bad)"
                    satirlar={enCokOlen.map((s) => [s.aile, s.savasBasiOlum.toFixed(1)])} />
            </div>

            <section className="rounded-[var(--t-r)] overflow-hidden"
                     style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
              <header className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
                <Swords className="w-3.5 h-3.5" style={{ color: "var(--t-gold)" }} />
                <h2 className="text-[12.5px] font-semibold">Herkes</h2>
                <span className="text-[11px] ml-auto" style={{ color: "var(--t-faint)" }}>kill/ölüm sırasına göre</span>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--t-faint)" }}>
                      {["Aile", "Sınıf", "K", "Ö", "K/D", "Savaş", "Savaş başı ölüm", "En çok öldüğü sınıf", "En zorlandığı klan", "En çok avladığı"].map((b, i) => (
                        <th key={b} className="text-[10px] uppercase tracking-[0.06em] font-normal px-3 py-2"
                            style={{ textAlign: i <= 1 || i >= 7 ? "left" : "right", borderBottom: "1px solid var(--t-line)" }}>{b}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {satirlar.map((s) => (
                      <tr key={s.aile} style={{ borderBottom: "1px solid var(--t-line)" }}>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {s.aile}
                          {s.klan && <span className="ml-1.5 text-[10px]" style={{ color: "var(--t-faint)" }}>{s.klan}</span>}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {s.sinifId ? (
                            <span className="inline-flex items-center gap-1.5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={getClassIconUrl(s.sinifId)} alt="" className="w-4 h-4 opacity-75" />
                              <span style={{ color: "var(--t-dim)" }}>{s.sinifAd}</span>
                            </span>
                          ) : <span style={{ color: "var(--t-faint)" }}>—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right t-num tabular-nums" style={{ color: "var(--t-good)" }}>{s.kill}</td>
                        <td className="px-3 py-1.5 text-right t-num tabular-nums" style={{ color: "var(--t-bad)" }}>{s.olum}</td>
                        <td className="px-3 py-1.5 text-right t-num tabular-nums font-semibold"
                            style={{ color: s.kd >= 1 ? "var(--t-good)" : s.kd >= 0.6 ? "var(--t-text)" : "var(--t-bad)" }}>
                          {s.kd.toFixed(2)}
                        </td>
                        <td className="px-3 py-1.5 text-right t-num tabular-nums" style={{ color: "var(--t-faint)" }}>{s.savas}</td>
                        <td className="px-3 py-1.5 text-right t-num tabular-nums">{s.savasBasiOlum.toFixed(1)}</td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {s.zorlandigi ? (
                            <span className="inline-flex items-center gap-1.5">
                              {s.zorlandigi.id && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={getClassIconUrl(s.zorlandigi.id)} alt="" className="w-4 h-4 opacity-70" />
                              )}
                              <span style={{ color: "var(--t-dim)" }}>{s.zorlandigi.ad}</span>
                              <span className="t-num text-[10.5px]" style={{ color: "var(--t-bad)" }}>{s.zorlandigi.olum}</span>
                            </span>
                          ) : <span style={{ color: "var(--t-faint)" }}>—</span>}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--t-dim)" }}>
                          {s.zorKlan ? <>{s.zorKlan.ad} <span className="t-num text-[10.5px]" style={{ color: "var(--t-bad)" }}>{s.zorKlan.olum}</span></> : "—"}
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap" style={{ color: "var(--t-dim)" }}>
                          {s.avi ? <>{s.avi.aile} <span className="t-num text-[10.5px]" style={{ color: "var(--t-good)" }}>{s.avi.kill}</span></> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
              Kaynak: Companion&apos;ın canlı savaş kaydı — yalnız kaydı alan kişilerin gördüğü akış.
              Tek istemci bütün ittifakı görmediği için buradaki sayılar resmî hasar raporundan düşük olabilir;
              kıyas için kullanılır, karne notu için değil.
            </p>
          </>
        )}
      </div>
    </TestShell>
  );
}

function Ozet({ ikon: Ikon, baslik, renk, satirlar }: {
  ikon: React.ElementType; baslik: string; renk: string; satirlar: Array<[string, string]>;
}) {
  return (
    <section className="rounded-[var(--t-r)] overflow-hidden" style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
      <header className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <Ikon className="w-3.5 h-3.5" style={{ color: renk }} />
        <h2 className="text-[12.5px] font-semibold">{baslik}</h2>
      </header>
      <div className="p-3 space-y-1">
        {satirlar.length === 0 && <p className="text-[12px]" style={{ color: "var(--t-dim)" }}>Yeterli kayıt yok.</p>}
        {satirlar.map(([ad, deger], i) => (
          <div key={ad} className="flex items-center gap-2 text-[12.5px]">
            <span className="t-num text-[11px] w-4" style={{ color: "var(--t-faint)" }}>{i + 1}</span>
            <span className="flex-1 truncate">{ad}</span>
            <span className="t-num font-semibold" style={{ color: renk }}>{deger}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
