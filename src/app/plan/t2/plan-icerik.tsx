import { TestShell } from "@/components/app-shell";
import type { T2Plan, PlanBizimSinif } from "@/lib/t2-plan";
import { getClassIconUrl } from "@/lib/classes";
import { Swords, Shield, Crosshair, Clock, Users, TriangleAlert, Target, EyeOff } from "lucide-react";

/**
 * T2 savaş planı — menüde yok, adresi bilen görür (giriş şart).
 *
 * Plan metni burada duruyor, sayılar veritabanından geliyor: her savaştan
 * sonra sayfa kendini günceller. Yani "şu klana şu kadar ölüyoruz" cümlesi
 * yazıldığı günün değil, bugünün sayısı.
 *
 * Kadro önerisi de canlı: savaşa katıl diyenlerin sınıflarına göre üç
 * müfreze kuruluyor. Öneri, karar değil — parti ekranında elle değişir.
 */

/** Sınıfın müfrezedeki doğal yeri; sıra = öncelik */
const ROL_TERCIHI: Record<string, "kale" | "ana" | "kanat"> = {
  okcu: "kale", archer: "kale", nova: "kale", sage: "kale", corsair: "kale",
  sahire: "ana", guardian: "ana", valkyrie: "ana", vahsi: "ana", drakania: "ana",
  dosa: "ana", woosa: "ana", cadi: "ana", buyucu: "ana", shai: "ana", seraph: "ana",
  striker: "kanat", kara_sovalye: "kanat", maegu: "kanat", kunoichi: "kanat",
  ninja: "kanat", musa: "kanat", maehwa: "kanat", lahn: "kanat", hashashin: "kanat",
  avci: "kanat", deadeye: "kanat", mistik: "kanat", savasci: "kanat", wukong: "kanat",
};

const MUFREZE = {
  kale: {
    ad: "Kale müfrezesi",
    isi: "Kale hasarı ve uzaktan baskı. Kavgaya girmez, kapı/duvar açısında durur, kendi menzilinde ateş eder.",
    hedef: 6,
  },
  ana: {
    ad: "Ana müfreze",
    isi: "Mevzi tutma ve toplu kavga. CC önce, giriş sonra; geri çekilme çağrısı lidere ait.",
    hedef: 12,
  },
  kanat: {
    ad: "Kanat müfrezesi",
    isi: "Karşının uzak menzillisini avlar. Ana müfreze bağlandıktan sonra yandan girer, hedef bitince çıkar.",
    hedef: 5,
  },
} as const;

type RolAnahtar = keyof typeof MUFREZE;

function kadroyuBol(kadro: Array<{ id: number; ad: string; sinif: string; sinifAd: string; gs: number; klan: string | null }>) {
  const kutular: Record<RolAnahtar, typeof kadro> = { kale: [], ana: [], kanat: [] };
  for (const k of kadro) {
    const rol = ROL_TERCIHI[k.sinif] ?? "ana";
    if (kutular[rol].length < MUFREZE[rol].hedef) kutular[rol].push(k);
    else kutular.ana.push(k);
  }

  /*
    Dengeleme.

    Doğal dağılımda ana müfreze şişiyor: kadronun çoğu orta menzil. Tek
    başına on beş kişilik bir ana müfreze tek CC'de eriyor, üç kişilik
    kanat da hiçbir şeye yetmiyor. Eksik kalan müfrezeler, ana müfrezedeki
    en uygun sınıflardan tamamlanıyor — kanada girebilecekler (yakın
    dövüş, hareketli), kaleye gidebilecekler (menzilli).
  */
  const KANADA_UYGUN = ["vahsi", "dosa", "drakania", "valkyrie", "guardian", "woosa"];
  const KALEYE_UYGUN = ["cadi", "buyucu", "sahire", "seraph", "woosa"];
  const tasi = (hedefRol: RolAnahtar, uygun: string[]) => {
    while (kutular[hedefRol].length < MUFREZE[hedefRol].hedef && kutular.ana.length > MUFREZE.ana.hedef) {
      const i = kutular.ana.findIndex((k) => uygun.includes(k.sinif));
      if (i < 0) break;
      kutular[hedefRol].push(kutular.ana.splice(i, 1)[0]);
    }
  };
  tasi("kanat", KANADA_UYGUN);
  tasi("kale", KALEYE_UYGUN);

  for (const rol of Object.keys(kutular) as RolAnahtar[]) kutular[rol].sort((a, b) => b.gs - a.gs);
  return kutular;
}

const bin = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}K`);

export function PlanIcerik({ v }: { v: T2Plan }) {
  const kutular = kadroyuBol(v.kadro);
  const enSertler = v.klanlar.filter((k) => k.fark < 0).slice(0, 3);
  const kolaylar = v.klanlar.filter((k) => k.fark > 0).sort((a, b) => b.fark - a.fark).slice(0, 3);
  const tehdit = v.karsiSiniflar.slice(0, 6);
  const enIyiBizim = v.bizimSiniflar.slice(0, 5);
  const enZayifBizim = [...v.bizimSiniflar].sort((a, b) => a.kd - b.kd).slice(0, 4);
  const tarih = v.yaklasan
    ? new Date(v.yaklasan.date).toLocaleString("tr-TR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <TestShell
      title="T2 Savaş Planı"
      subtitle={v.yaklasan ? `${v.yaklasan.title} · ${tarih}` : "Yaklaşan T2 savaşı yok — plan son verilere göre duruyor."}
      aside={<span className="t-chip flex items-center gap-1.5"><EyeOff className="w-3 h-3" /> menüde yok</span>}
    >
      <div className="space-y-4">

        <Kart ikon={TriangleAlert} baslik="Neden T2 için ayrı bir plan">
          <div className="grid gap-3 sm:grid-cols-2">
            <Kutu baslik="T1 gecelerinde" satirlar={v.t1 ? [
              [`${v.t1.kd.toFixed(2)}`, "kill / ölüm"],
              [`${v.t1.kisiBasiOlum.toFixed(1)}`, "kişi başı ölüm"],
              [`${v.t1.kisi}`, "ortalama kadro"],
            ] : [["—", "veri yok"]]} />
            <Kutu vurgu baslik="T2 gecelerinde" satirlar={v.t2 ? [
              [`${v.t2.kd.toFixed(2)}`, "kill / ölüm"],
              [`${v.t2.kisiBasiOlum.toFixed(1)}`, "kişi başı ölüm"],
              [`${v.t2.kisi}`, "ortalama kadro"],
            ] : [["—", "veri yok"]]} />
          </div>
          <p className="text-[12.5px] leading-relaxed mt-3" style={{ color: "var(--t-dim)" }}>
            Fark kadro kalitesinde değil, kavganın biçiminde: T2&apos;de karşı taraf daha derli toplu ve
            uzaktan çok daha fazla hasar basıyor. Aşağıdaki plan tek bir şeye odaklanıyor —
            <b style={{ color: "var(--t-text)" }}> ölüm sayısını düşürmek</b>. Aynı kadroyla kill sayısı
            zaten geliyor; geceyi kaybettiren, ölüp respawn&apos;da geçirdiğimiz dakikalar.
          </p>
        </Kart>

        <Kart ikon={Shield} baslik={`Kime karşı oynuyoruz · son ${v.kayitSavaslari.length} savaşın kill akışı (${v.olaySayisi} olay)`}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--t-bad)" }}>Bize üstün gelenler</p>
              {enSertler.length === 0 ? <p className="text-[12px]" style={{ color: "var(--t-dim)" }}>Kayıtta üstün gelen klan yok.</p> : (
                <div className="space-y-1.5">
                  {enSertler.map((k) => <KlanSatir key={k.ad} {...k} />)}
                </div>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--t-good)" }}>Rahat geçtiklerimiz</p>
              <div className="space-y-1.5">
                {kolaylar.map((k) => <KlanSatir key={k.ad} {...k} />)}
              </div>
            </div>
          </div>
          <p className="text-[12.5px] leading-relaxed mt-3" style={{ color: "var(--t-dim)" }}>
            Gecenin kaderi bir-iki klanla olan kavgada belirleniyor. Sahada
            {enSertler[0] ? <b style={{ color: "var(--t-text)" }}> {enSertler[0].ad}</b> : " sert klan"} bayrağı
            görünce kural değişir: açık alanda birebir kavga yok, dar geçit ve kale duvarı kullanılır.
          </p>
        </Kart>

        <Kart ikon={Crosshair} baslik="Bizi ne öldürüyor">
          <div className="space-y-1.5">
            {tehdit.map((s) => {
              const en = Math.max(...tehdit.map((x) => x.olum));
              return (
                <div key={s.ad}>
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span className="flex-1 truncate">{s.ad}</span>
                    <span className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>{s.kisi} kişi</span>
                    <span className="t-num tabular-nums w-9 text-right" style={{ color: "var(--t-bad)" }}>{s.olum}</span>
                    <span className="t-num tabular-nums w-9 text-right" style={{ color: "var(--t-good)" }}>{s.kill}</span>
                  </div>
                  <div className="h-[5px] mt-0.5 rounded-full" style={{ background: "var(--t-raised)" }}>
                    <i className="block h-full rounded-full" style={{ width: `${(s.olum / en) * 100}%`, background: "var(--t-bad)" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[12.5px] leading-relaxed mt-3" style={{ color: "var(--t-dim)" }}>
            Kırmızı bize verdikleri ölüm, yeşil onlardan aldığımız kill. Tablo tek bir şey söylüyor:
            <b style={{ color: "var(--t-text)" }}> uzak menzilli sınıflar bizi ikiye katlıyor</b>.
            Bunların ikisi de menzil dışında zararsız; sorun onlara yürürken açık alanda geçirdiğimiz saniyeler.
            {v.sinifsiz > 0 && <span style={{ color: "var(--t-faint)" }}> ({v.sinifsiz} olayda karşı karakterin sınıfı henüz okunmadı.)</span>}
          </p>
        </Kart>

        <Kart ikon={Users} baslik={`Kadro · ${v.kadro.length} kişi${v.yaklasan ? ` (${v.yaklasan.title})` : ""}`}>
          {v.kadro.length === 0 ? (
            <p className="text-[12.5px]" style={{ color: "var(--t-dim)" }}>Bu savaşa henüz katıl diyen yok.</p>
          ) : (
            <>
              <div className="grid gap-3 lg:grid-cols-3">
                {(Object.keys(MUFREZE) as RolAnahtar[]).map((rol) => (
                  <div key={rol} className="rounded-[var(--t-r-sm)] overflow-hidden"
                       style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
                    <div className="px-3 py-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-semibold">{MUFREZE[rol].ad}</span>
                        <span className="t-num text-[11px] ml-auto" style={{ color: "var(--t-faint)" }}>
                          {kutular[rol].length} kişi
                        </span>
                      </div>
                      <p className="text-[11px] mt-1 leading-snug" style={{ color: "var(--t-dim)" }}>{MUFREZE[rol].isi}</p>
                    </div>
                    <div className="p-1.5">
                      {kutular[rol].map((k, i) => (
                        <div key={k.id} className="flex items-center gap-2 px-1.5 py-1 text-[12px]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={getClassIconUrl(k.sinif)} alt="" className="w-4 h-4 opacity-75" />
                          <span className="flex-1 truncate">{k.ad}</span>
                          {i === 0 && <span title="Önerilen lider: müfrezenin en yüksek GS'i">👑</span>}
                          <span className="t-num text-[10.5px]" style={{ color: "var(--t-faint)" }}>{k.gs}</span>
                        </div>
                      ))}
                      {kutular[rol].length === 0 && <p className="px-1.5 py-2 text-[11.5px]" style={{ color: "var(--t-faint)" }}>Boş</p>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] mt-2" style={{ color: "var(--t-faint)" }}>
                Dağılım sınıfın doğal işine göre otomatik; taç yalnızca öneri (müfrezenin en yüksek GS&apos;i).
                Gerçek lideri parti ekranından seç — sesli odada tacı orada görünüyor.
              </p>
            </>
          )}
        </Kart>

        <Kart ikon={Target} baslik="Sahada kurallar">
          <ol className="space-y-2.5 text-[12.5px] leading-relaxed" style={{ color: "var(--t-dim)" }}>
            <Kural n={1} baslik="CC olmadan giriş yok">
              Ana müfreze, şahire/guardian CC&apos;si düşmeden ilerlemez. Sayılar açık:
              CC&apos;yi en çok basan sınıflarımız aynı zamanda en iyi kill/ölüm oranına sahip olanlar.
            </Kural>
            <Kural n={2} baslik="Açık alanda durma">
              Bizi en çok öldüren şey uzak menzilli hasar. Duvar, kapı, tepe arkası — hareket
              ederken bile bir şeyin arkasında ol.
            </Kural>
            <Kural n={3} baslik="Kanat müfrezesi yalnız girmez">
              Kanat, ana müfreze bağlandıktan sonra girer. Erken giren kanat, karşının bütün
              hasarını tek başına yer; geçen T2&apos;de en çok ölen isimler bu rolden çıktı.
            </Kural>
            <Kural n={4} baslik="Kale müfrezesi kavgaya girmez">
              Kale hasarını uzaktan vuranlar yapıyor. Onları kavgaya çeken her dakika,
              gecenin sonundaki kale hasarından düşüyor.
            </Kural>
            <Kural n={5} baslik="Ölüm bütçesi">
              Kişi başı hedef: <b style={{ color: "var(--t-text)" }}>
                {v.t2 ? Math.max(8, Math.round(v.t2.kisiBasiOlum * 0.6)) : 12} ölümün altı
              </b>
              {v.t2 && <> (son T2 ortalaması {v.t2.kisiBasiOlum.toFixed(1)})</>}. Üç kez üst üste
              aynı yerde ölen, o noktayı bırakır.
            </Kural>
            <Kural n={6} baslik="Respawn birlikte">
              Tek tek dönmek, tek tek ölmek demek. Ölen kişi müfreze toplanana kadar kapıda bekler.
            </Kural>
          </ol>
        </Kart>

        <Kart ikon={Clock} baslik="Zaman çizelgesi">
          <div className="space-y-2 text-[12.5px]">
            {[
              ["−30 dk", "Kadro kesinleşir, parti ekranında liderler seçilir, herkes kendi sesli odasına girer."],
              ["−15 dk", "Kale buff kontrolü, elixir/yemek, ayarlar: mikrofon seviyesi ve otomatik seviye açık mı."],
              ["−5 dk", "Müfrezeler toplanma noktasında. Kale müfrezesi menzil açısını seçer."],
              ["0", "Fort kurulur. Ana müfreze fortun önünde, kanat yanda, kale müfrezesi arkada."],
              ["İlk 10 dk", "Temas kurulur ama tam kavga aranmaz: karşının kaç kişi ve hangi klan olduğu anlaşılır."],
              ["10-30 dk", "Ana müfreze mevzi tutar, kanat karşının uzak menzillisini avlar, kale hasarı başlar."],
              ["Son 15 dk", "Kale hasarı önceliklidir. Ölüm pahasına vurmak yerine, fortu ayakta tutmak."],
            ].map(([t, m]) => (
              <div key={t} className="flex gap-3">
                <span className="t-num text-[11.5px] w-16 flex-shrink-0 pt-0.5" style={{ color: "var(--t-gold)" }}>{t}</span>
                <span style={{ color: "var(--t-dim)" }}>{m}</span>
              </div>
            ))}
          </div>
        </Kart>

        <Kart ikon={Swords} baslik="Sınıf sınıf: kim ne yapıyor (son savaşların ortalaması)">
          <div className="grid gap-3 sm:grid-cols-2">
            <SinifListesi baslik="Taşıyanlar" renk="var(--t-good)" satirlar={enIyiBizim} />
            <SinifListesi baslik="Zorlananlar" renk="var(--t-bad)" satirlar={enZayifBizim} />
          </div>
          <p className="text-[12px] leading-relaxed mt-3" style={{ color: "var(--t-dim)" }}>
            &quot;Zorlananlar&quot; kötü oynadıkları için değil, işleri gereği öndeler diye orada. Plan bunu
            kabul ediyor: onlardan beklenen kill değil, karşıyı tutmak. Ölçüyü de ona göre yapacağız.
          </p>
        </Kart>

        <Kart ikon={Clock} baslik="Savaştan sonra ne ölçeceğiz">
          <ul className="space-y-1.5 text-[12.5px]" style={{ color: "var(--t-dim)" }}>
            <li>· Kişi başı ölüm {v.t2 ? v.t2.kisiBasiOlum.toFixed(1) : "?"} → hedefin altına indi mi.</li>
            <li>· Sert klanla farkımız (şu an {enSertler[0] ? `${enSertler[0].ad} ${enSertler[0].fark}` : "—"}) kapandı mı.</li>
            <li>· Uzak menzilli sınıflara verdiğimiz ölüm düştü mü — savaş özeti kartındaki &quot;bizi en çok öldüren sınıflar&quot;.</li>
            <li>· Kale hasarı: kale müfrezesi kavgadan uzak durunca ne kadar arttı.</li>
          </ul>
          <p className="text-[11.5px] mt-3" style={{ color: "var(--t-faint)" }}>
            Hepsi savaş bitince Hasar Raporu → &quot;Savaş özeti&quot; kartında ve Savaş Haritası → Analiz
            ekranında kendiliğinden çıkıyor; ayrıca sayı toplamaya gerek yok.
          </p>
        </Kart>

        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
          Bu sayfa menüde yok, adresi bilen ve giriş yapan görür. Sayılar her savaştan sonra
          kendini günceller; plan metni sabit. Son {v.ozetler.length} savaş okundu.
        </p>
      </div>
    </TestShell>
  );
}

function Kart({ ikon: Ikon, baslik, children }: { ikon: React.ElementType; baslik: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--t-r)] overflow-hidden" style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
      <header className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <Ikon className="w-3.5 h-3.5" style={{ color: "var(--t-gold)" }} />
        <h2 className="text-[12.5px] font-semibold">{baslik}</h2>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Kutu({ baslik, satirlar, vurgu }: { baslik: string; satirlar: Array<[string, string]>; vurgu?: boolean }) {
  return (
    <div className="rounded-[var(--t-r-sm)] px-3.5 py-3"
         style={{ background: vurgu ? "rgba(239,95,95,.07)" : "var(--t-raised)", border: `1px solid ${vurgu ? "rgba(239,95,95,.25)" : "var(--t-line)"}` }}>
      <p className="text-[10px] uppercase tracking-[0.06em] mb-2" style={{ color: "var(--t-faint)" }}>{baslik}</p>
      <div className="flex gap-5">
        {satirlar.map(([d, e]) => (
          <div key={e}>
            <p className="t-num text-[19px] font-bold">{d}</p>
            <p className="text-[10.5px]" style={{ color: "var(--t-dim)" }}>{e}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function KlanSatir({ ad, kill, olum, fark }: { ad: string; kill: number; olum: number; fark: number }) {
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span className="flex-1 truncate">{ad}</span>
      <span className="t-num tabular-nums w-9 text-right" style={{ color: "var(--t-good)" }}>{kill}</span>
      <span className="t-num tabular-nums w-9 text-right" style={{ color: "var(--t-bad)" }}>{olum}</span>
      <span className="t-num tabular-nums w-11 text-right font-semibold"
            style={{ color: fark >= 0 ? "var(--t-good)" : "var(--t-bad)" }}>{fark > 0 ? "+" : ""}{fark}</span>
    </div>
  );
}

function SinifListesi({ baslik, renk, satirlar }: { baslik: string; renk: string; satirlar: PlanBizimSinif[] }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.06em] mb-1.5" style={{ color: renk }}>{baslik}</p>
      <div className="space-y-1">
        {satirlar.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-[12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getClassIconUrl(s.id)} alt="" className="w-4 h-4 opacity-75" />
            <span className="flex-1 truncate">{s.ad}</span>
            <span className="t-num tabular-nums w-10 text-right" title="kill / ölüm">{s.kd.toFixed(2)}</span>
            <span className="t-num tabular-nums w-12 text-right text-[11px]" style={{ color: "var(--t-faint)" }} title="ortalama hasar">{bin(s.hasar)}</span>
            <span className="t-num tabular-nums w-11 text-right text-[11px]" style={{ color: "var(--t-faint)" }} title="ortalama kale hasarı">{bin(s.kale)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Kural({ n, baslik, children }: { n: number; baslik: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="t-num text-[12px] w-5 h-5 rounded-full grid place-items-center flex-shrink-0 mt-0.5"
            style={{ background: "var(--t-gold-soft)", color: "var(--t-gold)" }}>{n}</span>
      <span>
        <b style={{ color: "var(--t-text)" }}>{baslik}.</b> {children}
      </span>
    </li>
  );
}
