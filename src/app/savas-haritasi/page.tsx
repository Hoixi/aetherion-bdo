"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Swords, Upload, Users, MapPin, Skull, Eraser } from "lucide-react";
import { TestShell, Card, Head, Empty } from "@/components/app-shell";
import { olaylariCoz, olayOzeti, olayKutusu, type SavasOlayi } from "@/lib/savas-olaylari";

/**
 * Savaş haritası — kim nerede öldürdü, kim nerede öldü.
 *
 * Girdi, kayıt incelemesinin bastığı satırlar: yapıştır ya da dosyayı
 * seç, gerisi tarayıcıda çözülüyor. Hiçbir şey sunucuya gitmiyor;
 * kalibrasyon aşamasında olduğumuz için kayıt da tutulmuyor.
 *
 * Noktalar kale planlarıyla aynı haritada duruyor: oyun koordinatı
 * garmoth uzayına çevriliyor (bkz. `savas-olaylari.ts`).
 */

const Harita = dynamic(() => import("@/components/olay-haritasi"), {
  ssr: false,
  loading: () => <div className="h-full grid place-items-center text-[12.5px]" style={{ color: "var(--t-faint)" }}>Harita yükleniyor…</div>,
});

type Suzgec = "hepsi" | "kill" | "death";

export default function SavasHaritasiPage() {
  const [ham, setHam] = useState("");
  const [olaylar, setOlaylar] = useState<SavasOlayi[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [suzgec, setSuzgec] = useState<Suzgec>("hepsi");
  const [oyuncu, setOyuncu] = useState("");
  const [secili, setSecili] = useState<number | null>(null);
  const dosya = useRef<HTMLInputElement>(null);

  function coz(metin: string) {
    const { olaylar: o, atilan } = olaylariCoz(metin);
    setOlaylar(o);
    setSecili(null);
    setMsg(o.length === 0
      ? "Okunabilir olay çıkmadı — inceleme çıktısının tamamını yapıştır."
      : `${o.length} olay okundu${atilan ? `, ${atilan} satır atlandı` : ""}.`);
  }

  const suzulmus = useMemo(() => {
    const q = oyuncu.trim().toLocaleLowerCase("tr");
    return olaylar.filter((o) =>
      (suzgec === "hepsi" || (suzgec === "kill") === o.bizimKill) &&
      (!q || o.bizimAile.toLocaleLowerCase("tr").includes(q) || o.rakipAile.toLocaleLowerCase("tr").includes(q) ||
        o.bizimKarakter.toLocaleLowerCase("tr").includes(q) || o.rakipKarakter.toLocaleLowerCase("tr").includes(q)));
  }, [olaylar, suzgec, oyuncu]);

  const ozet = useMemo(() => olayOzeti(suzulmus), [suzulmus]);
  const kutu = useMemo(() => olayKutusu(suzulmus), [suzulmus]);
  const fitKey = useMemo(
    () => `${suzulmus.length}:${suzulmus[0]?.at ?? 0}:${suzulmus[suzulmus.length - 1]?.at ?? 0}`,
    [suzulmus],
  );
  const sure = olaylar.length
    ? Math.round((olaylar[olaylar.length - 1].at - olaylar[0].at) / 1000)
    : 0;

  return (
    <TestShell title="Savaş Haritası"
               subtitle="Kill ve ölümler oyundaki yerleriyle — kale planlarıyla aynı harita"
               aside={msg ? <span className="t-chip" style={{ color: "var(--t-gold)" }}>{msg}</span> : null}>
      {olaylar.length === 0 && (
        <Card className="mb-4">
          <Head icon={Upload} title="Kayıt incelemesi çıktısı" />
          <div className="p-4 space-y-3">
            <textarea value={ham} onChange={(e) => setHam(e.target.value)}
                      placeholder="İnceleme çıktısını buraya yapıştır…"
                      className="w-full h-40 rounded-[var(--t-r-sm)] p-3 text-[12px] outline-none t-num"
                      style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => coz(ham)} disabled={!ham.trim()} className="t-tab" data-on>
                <Swords className="w-3.5 h-3.5" /> Haritaya bas
              </button>
              <input ref={dosya} type="file" accept=".json,.txt,.log" className="hidden"
                     onChange={(e) => {
                       const f = e.target.files?.[0];
                       if (f) void f.text().then((t) => { setHam(t); coz(t); });
                       e.target.value = "";
                     }} />
              <button onClick={() => dosya.current?.click()} className="t-tab">
                <Upload className="w-3.5 h-3.5" /> Dosyadan al
              </button>
              <p className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                Satır satır ya da tek JSON dizisi — ikisi de olur. Veri tarayıcıdan çıkmıyor.
              </p>
            </div>
          </div>
        </Card>
      )}

      {olaylar.length === 0 && <Empty>Henüz olay yok.</Empty>}

      {olaylar.length > 0 && (
        <div className="space-y-4">
          <Card className="p-3.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-0.5 p-0.5 rounded-[var(--t-r-sm)]"
                   style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                {([["hepsi", "Hepsi"], ["kill", "Bizim kill"], ["death", "Bizim ölüm"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setSuzgec(k)}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap"
                          style={suzgec === k
                            ? { color: "var(--t-gold)", background: "var(--t-gold-soft)" }
                            : { color: "var(--t-faint)" }}>
                    {l}
                  </button>
                ))}
              </div>
              <input value={oyuncu} onChange={(e) => setOyuncu(e.target.value)} placeholder="Oyuncu ara…"
                     className="h-[34px] px-3 rounded-[var(--t-r-sm)] text-[12.5px] outline-none"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
              <span className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                {suzulmus.length} olay · {sure} sn kayıt
              </span>
              <button onClick={() => { setOlaylar([]); setHam(""); setMsg(null); setOyuncu(""); setSuzgec("hepsi"); }}
                      className="t-tab ml-auto">
                <Eraser className="w-3.5 h-3.5" /> Temizle
              </button>
            </div>
          </Card>

          <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 340px", alignItems: "start" }}>
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <Head icon={MapPin} title="Olay yerleri"
                      meta={`${ozet.kill} kill · ${ozet.death} ölüm`} />
                <Harita olaylar={suzulmus} seciliAt={secili} onSec={setSecili}
                        fitKey={fitKey} kutu={kutu} className="h-[520px]" />
                <div className="flex items-center gap-4 px-4 py-2.5 text-[11px]"
                     style={{ borderTop: "1px solid var(--t-line)", color: "var(--t-faint)" }}>
                  <span className="flex items-center gap-1.5">
                    <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--t-good)" }} /> bizim kill
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: "var(--t-bad)" }} /> bizim ölüm
                  </span>
                  <span className="ml-auto">Nokta, paketteki olay yeri — öldürene mi ölene mi ait olduğu doğrulanmadı.</span>
                </div>
              </Card>

              <Card>
                <Head icon={Swords} title="Olaylar" meta={`${suzulmus.length}`} />
                <div className="max-h-[360px] overflow-y-auto">
                  {suzulmus.map((o) => (
                    <button key={o.at} onClick={() => setSecili(o.at === secili ? null : o.at)}
                            className="w-full flex items-center gap-2 px-4 py-1.5 text-[12px] text-left"
                            style={{ borderBottom: "1px solid var(--t-line)",
                                     background: o.at === secili ? "var(--t-raised)" : "transparent" }}>
                      <span className="t-num" style={{ color: "var(--t-faint)" }}>
                        {new Date(o.at).toLocaleTimeString("tr-TR")}
                      </span>
                      <span style={{ color: o.bizimKill ? "var(--t-good)" : "var(--t-text)" }}>{o.bizimAile}</span>
                      <span style={{ color: "var(--t-faint)" }}>{o.bizimKill ? "→" : "←"}</span>
                      <span style={{ color: o.bizimKill ? "var(--t-text)" : "var(--t-bad)" }}>{o.rakipAile}</span>
                      <span className="ml-auto text-[10.5px] truncate" style={{ color: "var(--t-faint)" }}>
                        {o.rakipKlan}
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <Head icon={Users} title="Bizimkiler" meta={`${ozet.biz.length} kişi`} />
                <div className="p-3 grid gap-1">
                  {ozet.biz.map((p) => (
                    <div key={p.ad} className="flex items-center gap-3 px-2 py-1.5 rounded-lg"
                         style={{ background: "var(--t-raised)" }}>
                      <span className="text-[12.5px] flex-1 truncate">{p.ad}</span>
                      <span className="t-num text-[12.5px]" style={{ color: "var(--t-good)" }}>{p.kill}</span>
                      <span className="t-num text-[12.5px]" style={{ color: "var(--t-bad)" }}>{p.death}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <Head icon={Skull} title="Karşı taraf" meta={`${ozet.rakip.length} kişi`} />
                <div className="p-3 grid gap-1 max-h-[320px] overflow-y-auto">
                  {ozet.rakip.map((p) => (
                    <div key={p.ad} className="flex items-center gap-3 px-2 py-1 text-[12px]">
                      <span className="flex-1 truncate" style={{ color: "var(--t-dim)" }}>{p.ad}</span>
                      <span className="t-num" style={{ color: "var(--t-good)" }}>{p.kill}</span>
                      <span className="t-num" style={{ color: "var(--t-bad)" }}>{p.death}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {ozet.klanlar.length > 0 && (
                <Card className="p-3.5">
                  <p className="text-[10px] uppercase tracking-[0.06em] mb-2" style={{ color: "var(--t-faint)" }}>
                    Karşı klanlar
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ozet.klanlar.map((k) => (
                      <span key={k.ad} className="t-chip">{k.ad} · {k.n}</span>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="pb-6" />
    </TestShell>
  );
}
