import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Download, ShieldCheck, KeyRound, HelpCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { TestShell } from "@/components/app-shell";

export const metadata = {
  title: "Companion kurulum rehberi",
  description: "Aetherion Companion'ı sıfırdan kurma: Npcap, kurulum, hesap bağlama, overlay ve yayın.",
};

/**
 * Companion kurulum rehberi — resimli, adım adım.
 *
 * Neden ayrı sayfa: /uygulama eşleştirme kodunu veriyor, ama "ne kurayım,
 * Npcap da ne, overlay nasıl açılır" soruları her yeni üyede baştan
 * soruluyordu. Buradaki görseller uygulamanın kendi ekranları.
 */

const Adim = ({ no, baslik, ozet, children }: {
  no: number; baslik: string; ozet: string; children: ReactNode;
}) => (
  <section className="scroll-mt-20" id={`adim-${no}`}>
    <div className="flex items-start gap-4">
      <div className="shrink-0 w-9 h-9 rounded-full grid place-items-center text-[15px] font-extrabold"
           style={{ background: "var(--t-gold)", color: "#1c1406" }}>{no}</div>
      <div className="min-w-0 flex-1">
        <h2 className="text-[22px] font-semibold leading-tight">{baslik}</h2>
        <p className="text-[14px] mt-1.5" style={{ color: "var(--t-dim)" }}>{ozet}</p>
        <div className="mt-5 space-y-4">{children}</div>
      </div>
    </div>
  </section>
);

const Gorsel = ({ src, alt, altyazi }: { src: string; alt: string; altyazi: string }) => (
  <figure className="rounded-[12px] overflow-hidden border" style={{ borderColor: "var(--t-line)" }}>
    <Image src={src} alt={alt} width={800} height={525} className="w-full h-auto block" unoptimized />
    <figcaption className="px-4 py-2.5 text-[12.5px]"
                style={{ color: "var(--t-dim)", background: "var(--t-surface)", borderTop: "1px solid var(--t-line)" }}>
      {altyazi}
    </figcaption>
  </figure>
);

const Not = ({ tur = "bilgi", children }: { tur?: "bilgi" | "uyari" | "iyi"; children: ReactNode }) => {
  const renk = tur === "uyari" ? "#f07a6a" : tur === "iyi" ? "#6fd39a" : "var(--t-gold)";
  const Ikon = tur === "uyari" ? AlertTriangle : tur === "iyi" ? CheckCircle2 : Info;
  return (
    <div className="flex gap-3 rounded-[10px] px-4 py-3 text-[13.5px] leading-relaxed"
         style={{ background: `color-mix(in srgb, ${renk} 9%, transparent)`, border: `1px solid color-mix(in srgb, ${renk} 35%, transparent)` }}>
      <Ikon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: renk }} strokeWidth={2} />
      <div className="min-w-0">{children}</div>
    </div>
  );
};

/** Npcap kurulum penceresinin şeması — üçüncü parti ekran görüntüsü yerine çizim. */
function NpcapCizim() {
  const kutu = (y: number, isaretli: boolean, metin: string, vurgu?: boolean) => (
    <g key={y}>
      <rect x="34" y={y} width="13" height="13" rx="2.5"
            fill={isaretli ? "#e6b450" : "none"} stroke={vurgu ? "#f07a6a" : "#6b6358"} strokeWidth={vurgu ? 2 : 1.2} />
      {isaretli && <path d={`M37 ${y + 6.5} l3 3.2 l6 -6.6`} fill="none" stroke="#1c1406" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      <text x="56" y={y + 10.5} fill={vurgu ? "#f07a6a" : "#cfc7b8"} fontSize="11.5" fontFamily="inherit">{metin}</text>
    </g>
  );
  return (
    <figure className="rounded-[12px] overflow-hidden border" style={{ borderColor: "var(--t-line)" }}>
      <svg viewBox="0 0 560 250" className="w-full h-auto block" style={{ background: "#181612" }} role="img"
           aria-label="Npcap kurulum penceresindeki seçenekler ve hangisinin işaretlenmemesi gerektiği">
        <rect x="18" y="16" width="524" height="218" rx="10" fill="#211e19" stroke="#3b362d" />
        <text x="34" y="42" fill="#f1ece2" fontSize="13.5" fontWeight="700" fontFamily="inherit">Installation Options</text>
        <line x1="34" y1="52" x2="526" y2="52" stroke="#2e2a23" />
{kutu(66, false, "Legacy loopback support for Nmap 7.80 and older")}
        {kutu(96, false, "Restrict Npcap driver's access to Administrators only", true)}
        {kutu(126, false, "Support raw 802.11 traffic (and monitor mode)")}
        {kutu(156, true, "Install Npcap in WinPcap API-compatible Mode")}
        <text x="56" y="200" fill="#f07a6a" fontSize="11.5" fontFamily="inherit">↑ Yalnız bu kutuya dikkat: işaretli KALMASIN</text>
        <rect x="392" y="188" width="62" height="24" rx="5" fill="#2e2a23" stroke="#3b362d" />
        <text x="412" y="204" fill="#a89f8f" fontSize="11" fontFamily="inherit">Cancel</text>
        <rect x="462" y="188" width="64" height="24" rx="5" fill="#e6b450" />
        <text x="483" y="204" fill="#1c1406" fontSize="11" fontWeight="700" fontFamily="inherit">Install</text>
      </svg>
      <figcaption className="px-4 py-2.5 text-[12.5px]"
                  style={{ color: "var(--t-dim)", background: "var(--t-surface)", borderTop: "1px solid var(--t-line)" }}>
        Npcap kurulum penceresi, varsayılan hâliyle. Hiçbirine dokunma — yalnız kırmızı kutunun işaretli olmadığından emin ol.
      </figcaption>
    </figure>
  );
}

export default function RehberPage() {
  return (
    <TestShell title="Companion kurulum rehberi"
               subtitle="Sıfırdan kurulum: Npcap, uygulama, hesap bağlama, overlay ve yayın. On dakika sürer.">
      <div className="max-w-[860px] space-y-10">

        <div className="rounded-[14px] overflow-hidden border" style={{ borderColor: "var(--t-line)" }}>
          <Image src="/rehber/overlay-oyunda.jpg" alt="Oyunun üstünde çalışan Aetherion overlay'i"
                 width={800} height={525} className="w-full h-auto block" unoptimized priority />
        </div>
        <p className="text-[14.5px] leading-relaxed -mt-6" style={{ color: "var(--t-dim)" }}>
          Companion oyunun üstünde saydam bir katman çiziyor: savaş geri sayımı, kale buffı,
          kill/ölüm skoru, kill akışı, grind sayacı. Ayrıca savaş raporunu oyundan birebir
          okuyup siteye taşıyor. Aşağıdaki adımları sırayla yaparsan on dakikada kurulur.
        </p>

        <Adim no={1} baslik="Npcap'i kur" ozet="Skor ve kill akışı widget'ları bunsuz çalışmaz. Önce bunu kur, sonra uygulamayı.">
          <p className="text-[14px] leading-relaxed">
            Companion, oyunun sunucudan aldığı savaş raporu ve kill akışı paketlerini okuyor.
            Windows bunu üçüncü parti bir sürücü olmadan yapmaya izin vermiyor; Npcap de o sürücü.
            Wireshark&apos;ın kullandığı, açık kaynaklı ve yaygın bir araç.
          </p>
          <p className="text-[14px]">
            <a href="https://npcap.com/#download" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 font-semibold px-4 py-2 rounded-[9px] text-[13.5px]"
               style={{ background: "var(--t-gold)", color: "#1c1406" }}>
              <Download className="w-4 h-4" /> npcap.com → Npcap Installer
            </a>
          </p>
          <NpcapCizim />
          <Not tur="uyari">
            <b>&quot;Restrict Npcap driver&apos;s access to Administrators only&quot; işaretli kalmasın.</b>{" "}
            İşaretlersen Companion&apos;ı her açışta yönetici olarak çalıştırman gerekir; işaretli
            değilse normal kullanıcı olarak çalışır. Diğer kutulara dokunma, varsayılanlar doğru.
          </Not>
          <Not>
            Kurulumdan sonra <b>bilgisayarı yeniden başlat</b>. Sürücü yeniden başlatmadan önce
            bazen yüklenmiyor; &quot;Npcap yüklenemedi&quot; hatasının en sık sebebi bu.
          </Not>
        </Adim>

        <Adim no={2} baslik="Companion'ı indir ve kur" ozet="Tek dosya, kurulum sihirbazı yok denecek kadar kısa.">
          <p className="text-[14px]">
            <Link href="/api/companion/download"
                  className="inline-flex items-center gap-2 font-semibold px-4 py-2 rounded-[9px] text-[13.5px]"
                  style={{ background: "var(--t-gold)", color: "#1c1406" }}>
              <Download className="w-4 h-4" /> Aetherion Companion&apos;ı indir
            </Link>
          </p>
          <Not tur="uyari">
            Windows <b>SmartScreen</b> &quot;bilinmeyen yayımcı&quot; diye uyarır — uygulama henüz kod
            imzası taşımıyor. <b>Daha fazla bilgi → Yine de çalıştır</b> de. Smart App Control açıksa
            Windows dosyayı tamamen engelleyebilir; o durumda Ayarlar → Gizlilik ve güvenlik →
            Windows Güvenliği → Uygulama ve tarayıcı denetimi&apos;nden kapatman gerekiyor.
          </Not>
        </Adim>

        <Adim no={3} baslik="Hesabına bağla" ozet="Altı haneli kodla eşleştiriliyor; şifre girmiyorsun.">
          <Gorsel src="/rehber/eslesme.jpg" alt="Companion eşleştirme ekranı"
                  altyazi="Uygulama ilk açılışta bu ekranla geliyor." />
          <ol className="text-[14px] leading-relaxed space-y-2 list-decimal pl-5" style={{ color: "var(--t-dim)" }}>
            <li>Sitede <Link href="/uygulama" className="font-semibold" style={{ color: "var(--t-gold)" }}>Masaüstü Uygulaması</Link> sayfasını aç.</li>
            <li><b style={{ color: "var(--t-text)" }}>Eşleştirme kodu al</b>&apos;a bas — altı haneli bir kod çıkar.</li>
            <li>Kodu uygulamadaki kutuya yaz, <b style={{ color: "var(--t-text)" }}>Bağlan</b>&apos;a bas.</li>
          </ol>
          <Not>Kod beş dakika geçerli ve tek kullanımlık. Her bilgisayar için yeni kod alınır;
            bağlı cihazları aynı sayfadan görebilir, istediğini çıkarabilirsin.</Not>
        </Adim>

        <Adim no={4} baslik="Overlay'i ayarla" ozet="Hangi widget ekranın neresinde duracak — sürükleyerek seçiyorsun.">
          <p className="text-[14px] leading-relaxed">
            Uygulamada <b>Overlay</b> sekmesine gel. Sağdaki listeden istediğin widget&apos;ı aç,
            soldaki küçük ekranda kutusunu sürükleyip yerine koy. Konum yüzde olarak saklanıyor,
            yani oyun çözünürlüğünü değiştirsen de yerleşim kaymıyor.
          </p>
          <Gorsel src="/rehber/overlay-duzen.jpg" alt="Overlay düzen ekranı"
                  altyazi="Sol: ekranın minyatürü, kutular sürükleniyor. Sağ: widget listesi." />
          <div className="grid sm:grid-cols-2 gap-3 text-[13.5px]">
            {[
              ["Savaş skoru", "Senin ve klanın kill/ölümü, K/D"],
              ["Kill akışı", "Son altı kill/ölüm, kim kimi aldı"],
              ["İlk üç", "Savaşta en çok kill alan üç kişi"],
              ["Savaş geri sayımı", "Son 10 dakikada büyür, kırmızıya döner"],
              ["Kale buffı", "Aktif Edana buffı ve kalan süre"],
              ["Grind sayacı", "Süre, düşüş ve en çok düşen eşyalar"],
              ["Parti", "Savaş partindeki oyuncular"],
              ["Ses", "Mikrofon durumu ve o an konuşanlar"],
              ["Bildirim", "Savaş başlıyor / yeni buff uyarıları"],
            ].map(([ad, ne]) => (
              <div key={ad} className="rounded-[9px] px-3.5 py-2.5"
                   style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
                <b>{ad}</b>
                <div style={{ color: "var(--t-dim)" }}>{ne}</div>
              </div>
            ))}
          </div>
          <Not tur="iyi">
            <b>Skor, kill akışı ve ilk üç widget&apos;ları savaş sırasında kill akışını dinler — ama
            bu dinleme yalnız senin bilgisayarında kalır, siteye hiçbir kayıt göndermez.</b>{" "}
            Savaşın resmî kaydını yalnız Yönetim → Canlı kayıt&apos;ı başlatan kişi yüklüyor, o yüzden
            herkes overlay açsa bile sitedeki sayılar karışmıyor.
          </Not>
          <Not tur="uyari">
            Overlay yalnız oyun <b>kenarlıksız pencere</b> (borderless) modundayken görünür.
            Tam ekran (exclusive) modda Windows hiçbir pencereyi oyunun üstüne çıkarmıyor.
          </Not>
        </Adim>

        <Adim no={5} baslik="Yayın yapıyorsan: OBS" ozet="Aynı skor, yayın için saydam bir tarayıcı kaynağı olarak.">
          <Gorsel src="/rehber/yayin.jpg" alt="Yayın kaplaması ekranı"
                  altyazi="Adresi kopyala, OBS'te Tarayıcı kaynağı olarak yapıştır." />
          <ol className="text-[14px] leading-relaxed space-y-2 list-decimal pl-5" style={{ color: "var(--t-dim)" }}>
            <li>Uygulamada <b style={{ color: "var(--t-text)" }}>Yayın</b> sekmesi → sağ üstteki anahtarla kaplamayı aç.</li>
            <li>Çıkan adresi kopyala.</li>
            <li>OBS → Kaynaklar → <b style={{ color: "var(--t-text)" }}>+</b> → <b style={{ color: "var(--t-text)" }}>Tarayıcı</b> → URL alanına yapıştır.</li>
            <li>Genişlik 520, yükseklik 330 iyi bir başlangıç. Zemin saydam gelir.</li>
          </ol>
          <Not>Kaplama yalnız kendi bilgisayarında çalışıyor (127.0.0.1), dışarıdan kimse erişemiyor.
            Büyütmek istersen uygulamadaki <b>Ölçek</b> kaydırağını kullan — OBS içinde büyütmek
            yazıyı bulanıklaştırıyor.</Not>
        </Adim>

        <Adim no={6} baslik="Savaşta ne yapman gerekiyor" ozet="Çoğu kişi için hiçbir şey. Raporu bir kişi yüklüyor.">
          <p className="text-[14px] leading-relaxed">
            Overlay açıksa skor kendiliğinden akar, elini sürmene gerek yok. Savaş raporunu siteye
            taşımak ise yöneticinin işi: savaş biter bitmez oyundaki raporu açıp uygulamadan
            yüklüyor. Sonuç herkese burada görünüyor.
          </p>
          <Gorsel src="/rehber/rapor.jpg" alt="Companion savaş raporları ekranı"
                  altyazi="Yüklenen rapor hem uygulamada hem sitede açılıyor." />
          <Not>
            Sitedeki ayrıntılı tabloya <Link href="/hasar-raporu" className="font-semibold"
              style={{ color: "var(--t-gold)" }}>Hasar raporu</Link> sayfasından,
            kill akışının haritasına <Link href="/savas-haritasi" className="font-semibold"
              style={{ color: "var(--t-gold)" }}>Savaş haritası</Link> sayfasından ulaşıyorsun.
          </Not>
        </Adim>

        <section className="scroll-mt-20" id="sorun">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-9 h-9 rounded-full grid place-items-center"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line-strong)" }}>
              <HelpCircle className="w-4.5 h-4.5" style={{ color: "var(--t-gold)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-[22px] font-semibold leading-tight">Takılırsan</h2>
              <div className="mt-5 space-y-3">
                {[
                  ["Skor hep 0 görünüyor", "Npcap kurulu değil ya da kurulumdan sonra bilgisayar yeniden başlatılmadı. Npcap'i kurup yeniden başlat. Bir de kill akışı yalnız savaş sırasında dolar — savaş yokken boş olması normal."],
                  ["Overlay hiç görünmüyor", "Oyun tam ekran (exclusive) modda. Grafik ayarlarından kenarlıksız pencereye al. Ayrıca Overlay sekmesindeki anahtarın açık olduğundan emin ol."],
                  ["Widget kutusu ekranda yanlış yerde", "Overlay sekmesindeki minyatür ekranda kutuyu sürükle. Dilersen 'Varsayılan' ya da 'Yayın düzeni' düğmeleriyle hazır yerleşime dönebilirsin."],
                  ["Windows dosyayı engelliyor", "SmartScreen'de 'Daha fazla bilgi → Yine de çalıştır'. Smart App Control açıksa Windows Güvenliği'nden kapatman gerekiyor; uygulama henüz kod imzası taşımıyor."],
                  ["Uygulama 'Anahtar geçersiz' diyor", "Cihazın bağlantısı kesilmiş. /uygulama sayfasından yeni kod al ve tekrar bağlan."],
                  ["Grind sayacı eşya saymıyor", "Oyun kenarlıksız pencere modunda olmalı ve Grind sekmesinden 'Bölge seç' ile ganimet balonunun yeri bir kez gösterilmeli."],
                ].map(([s, c]) => (
                  <details key={s} className="rounded-[10px] px-4 py-3"
                           style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
                    <summary className="cursor-pointer text-[14px] font-semibold">{s}</summary>
                    <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: "var(--t-dim)" }}>{c}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-[12px] px-5 py-4 flex items-center gap-4 flex-wrap"
             style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
          <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: "var(--t-good)" }} />
          <p className="text-[13.5px] leading-relaxed flex-1 min-w-[260px]" style={{ color: "var(--t-dim)" }}>
            Companion oyunun dosyalarına dokunmuyor, hafızasını okumuyor ve oyuna hiçbir şey
            göndermiyor. Yalnızca sunucudan gelen savaş raporu ve kill akışı paketlerini okuyor;
            siteye giden tek şey yöneticinin yüklediği savaş raporu.
          </p>
          <Link href="/uygulama"
                className="inline-flex items-center gap-2 font-semibold px-4 py-2 rounded-[9px] text-[13.5px]"
                style={{ background: "var(--t-gold)", color: "#1c1406" }}>
            <KeyRound className="w-4 h-4" /> Eşleştirme kodu al
          </Link>
        </div>
      </div>
    </TestShell>
  );
}
