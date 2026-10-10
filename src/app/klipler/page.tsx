"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Film, Upload, X, Trash2, Clock, Eye, Loader2, AlertTriangle, Tag, Swords, Pencil, Check,
} from "lucide-react";
import { TestShell, Card, Empty } from "@/components/app-shell";
import type { KlipOzet } from "@/app/api/klip/route";

/**
 * Klip arşivi.
 *
 * Videolar Bunny Stream'de duruyor; burada yalnız kapak, bilgi ve
 * oynatıcı var. Yükleme tarayıcıdan doğrudan Bunny'ye gidiyor (TUS),
 * sitenin sunucusundan geçmiyor — bu yüzden 500 MB'lık bir dosya da
 * sorun değil ve bağlantı koparsa kaldığı yerden devam ediyor.
 *
 * Kodlama birkaç dakika sürüyor. Bunny bitince webhook atıyor; o
 * gelmezse bekleyen klipler sayfa açılırken tek tek sorulup
 * tazeleniyor, yoksa klip sonsuza kadar "işleniyor" görünürdü.
 */

/** Bunny kodlama durumları */
const DURUM: Record<number, { ad: string; renk: string; bekliyor?: boolean }> = {
  0: { ad: "Yükleniyor", renk: "var(--t-faint)", bekliyor: true },
  1: { ad: "Yüklendi", renk: "var(--t-faint)", bekliyor: true },
  2: { ad: "İşleniyor", renk: "var(--t-gold)", bekliyor: true },
  3: { ad: "Kodlanıyor", renk: "var(--t-gold)", bekliyor: true },
  4: { ad: "Hazır", renk: "var(--t-good)" },
  5: { ad: "Hata", renk: "var(--t-bad)" },
  6: { ad: "Yükleme başarısız", renk: "var(--t-bad)" },
};

/** 500 MB — ham kayıt yerine kırpılmış klip gelsin diye */
const EN_BUYUK = 500 * 1024 * 1024;
/** Tarayıcıda oynayan biçimler; ham .mkv yüklenirse kimse izleyemiyor */
const BICIMLER = [".mp4", ".webm", ".mov", ".m4v"];

const sure = (s: number) =>
  s > 0 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : "—";

const boyut = (b: number) => `${(b / 1024 / 1024).toFixed(0)} MB`;

const tarih = (t: string) =>
  new Date(t).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });

type Savas = { id: number; title: string; date: string };

export default function KliplerSayfasi() {
  const { data: session, status } = useSession();
  const [klipler, setKlipler] = useState<KlipOzet[]>([]);
  const [etiketler, setEtiketler] = useState<{ ad: string; adet: number }[]>([]);
  const [savaslar, setSavaslar] = useState<Savas[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [suzgec, setSuzgec] = useState<string | null>(null);
  const [acik, setAcik] = useState<KlipOzet | null>(null);
  const [panel, setPanel] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const getir = useCallback(async () => {
    const r = await fetch("/api/klip");
    if (!r.ok) { setYukleniyor(false); return; }
    const d = await r.json();
    setKlipler(d.klipler);
    setEtiketler(d.etiketler);
    setYukleniyor(false);
    return d.klipler as KlipOzet[];
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    void getir();
    fetch("/api/wars").then((r) => (r.ok ? r.json() : [])).then((w) => {
      setSavaslar((Array.isArray(w) ? w : w?.wars ?? []).slice(0, 40));
    }).catch(() => {});
  }, [status, getir]);

  /* Kodlaması bitmemiş klipleri tazele: webhook gelmediyse burada yakalanıyor */
  useEffect(() => {
    const bekleyen = klipler.filter((k) => DURUM[k.durum]?.bekliyor);
    if (bekleyen.length === 0) return;
    const t = setTimeout(async () => {
      const taze = await Promise.all(bekleyen.map((k) =>
        fetch(`/api/klip/${k.id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)));
      const harita = new Map<number, KlipOzet>();
      for (const x of taze) if (x?.klip) harita.set(x.klip.id, x.klip);
      if (harita.size) setKlipler((v) => v.map((k) => harita.get(k.id) ?? k));
    }, 8000);
    return () => clearTimeout(t);
  }, [klipler]);

  const gorunen = useMemo(
    () => (suzgec ? klipler.filter((k) => k.etiket === suzgec) : klipler),
    [klipler, suzgec]);

  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 4000); return () => clearTimeout(t); }, [msg]);

  async function sil(k: KlipOzet) {
    if (!confirm(`"${k.baslik}" silinsin mi? Video da kalıcı olarak gidiyor.`)) return;
    const r = await fetch(`/api/klip/${k.id}`, { method: "DELETE" });
    if (!r.ok) { setMsg("Silinemedi."); return; }
    setKlipler((v) => v.filter((x) => x.id !== k.id));
    setAcik(null);
    setMsg("Klip silindi.");
  }

  if (status === "loading" || yukleniyor) {
    return <TestShell title="Klip Arşivi"><Empty>Yükleniyor…</Empty></TestShell>;
  }
  if (!session) {
    return <TestShell title="Klip Arşivi"><Empty>Bu sayfa klan içidir; Discord ile giriş yap.</Empty></TestShell>;
  }

  return (
    <TestShell
      title="Klip Arşivi"
      subtitle="Savaş anları, komik kesitler, kayda değer her şey"
      aside={
        <>
          {msg && <span className="t-chip" style={{ color: "var(--t-gold)" }}>{msg}</span>}
          <button className="t-tab" data-on={panel} onClick={() => setPanel((v) => !v)}>
            <Upload className="w-3.5 h-3.5" /> Klip yükle
          </button>
        </>
      }
    >
      {panel && (
        <YuklemePaneli
          savaslar={savaslar}
          onBitti={(k) => { setKlipler((v) => [k, ...v]); setPanel(false); setMsg("Yüklendi, kodlanıyor."); }}
          onKapat={() => setPanel(false)}
        />
      )}

      {etiketler.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          <Tag className="w-3.5 h-3.5" style={{ color: "var(--t-faint)" }} />
          <button className="t-tab" data-on={suzgec === null} onClick={() => setSuzgec(null)}>
            Hepsi ({klipler.length})
          </button>
          {etiketler.map((e) => (
            <button key={e.ad} className="t-tab" data-on={suzgec === e.ad}
                    onClick={() => setSuzgec(suzgec === e.ad ? null : e.ad)}>
              {e.ad} ({e.adet})
            </button>
          ))}
        </div>
      )}

      {gorunen.length === 0 ? (
        <Empty>Henüz klip yok. İlkini sen yükle.</Empty>
      ) : (
        <div className="grid gap-3"
             style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {gorunen.map((k) => (
            <KlipKarti key={k.id} k={k} onAc={() => setAcik(k)} />
          ))}
        </div>
      )}

      {acik && (
        <Oynatici
          k={acik}
          duzenlenebilir={acik.yukleyen.id === session.user?.id || !!session.user?.canManageWars}
          savaslar={savaslar}
          onKapat={() => setAcik(null)}
          onSil={() => void sil(acik)}
          onGuncel={(y) => { setKlipler((v) => v.map((x) => (x.id === y.id ? y : x))); setAcik(y); }}
        />
      )}
    </TestShell>
  );
}

function KlipKarti({ k, onAc }: { k: KlipOzet; onAc: () => void }) {
  const d = DURUM[k.durum] ?? DURUM[0];
  const hazir = k.durum === 4;
  return (
    <Card className="overflow-hidden">
      <button onClick={hazir ? onAc : undefined} disabled={!hazir}
              className="block w-full text-left"
              style={{ cursor: hazir ? "pointer" : "default" }}>
        <div className="relative" style={{ aspectRatio: "16/9", background: "var(--t-raised)" }}>
          {hazir ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={k.kapak} alt="" loading="lazy"
                 style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div className="w-full h-full grid place-items-center gap-2">
              {d.bekliyor
                ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: d.renk }} />
                : <AlertTriangle className="w-5 h-5" style={{ color: d.renk }} />}
              <span className="text-[11px]" style={{ color: d.renk }}>{d.ad}</span>
            </div>
          )}
          {hazir && k.saniye > 0 && (
            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10.5px] t-num"
                  style={{ background: "rgba(0,0,0,.78)", color: "#fff" }}>
              {sure(k.saniye)}
            </span>
          )}
        </div>
      </button>
      <div className="p-2.5 space-y-1">
        <p className="text-[12.5px] font-semibold truncate" title={k.baslik}>{k.baslik}</p>
        <div className="flex items-center gap-2 text-[10.5px]" style={{ color: "var(--t-faint)" }}>
          <span className="truncate">{k.yukleyen.familyName}</span>
          <span>·</span>
          <span>{tarih(k.tarih)}</span>
          {k.izlenme > 0 && (
            <span className="ml-auto flex items-center gap-1">
              <Eye className="w-3 h-3" /> {k.izlenme}
            </span>
          )}
        </div>
        {(k.etiket || k.savas) && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {k.etiket && <span className="t-chip">{k.etiket}</span>}
            {k.savas && (
              <span className="t-chip flex items-center gap-1" style={{ color: "var(--t-gold)" }}>
                <Swords className="w-3 h-3" /> {k.savas.title}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function Oynatici({ k, duzenlenebilir, savaslar, onKapat, onSil, onGuncel }: {
  k: KlipOzet;
  duzenlenebilir: boolean;
  savaslar: Savas[];
  onKapat: () => void;
  onSil: () => void;
  onGuncel: (k: KlipOzet) => void;
}) {
  const [duzenle, setDuzenle] = useState(false);
  const [baslik, setBaslik] = useState(k.baslik);
  const [aciklama, setAciklama] = useState(k.aciklama ?? "");
  const [etiket, setEtiket] = useState(k.etiket ?? "");
  const [warId, setWarId] = useState<string>(k.savas ? String(k.savas.id) : "");
  const sayildi = useRef(false);

  useEffect(() => {
    if (sayildi.current) return;
    sayildi.current = true;
    void fetch(`/api/klip/${k.id}`, { method: "POST" });
  }, [k.id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onKapat(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onKapat]);

  async function kaydet() {
    const r = await fetch(`/api/klip/${k.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baslik, aciklama, etiket, warId: warId ? Number(warId) : null }),
    });
    if (r.ok) { onGuncel((await r.json()).klip); setDuzenle(false); }
  }

  return (
    <div className="fixed inset-0 z-[900] grid place-items-center p-4"
         style={{ background: "rgba(0,0,0,.82)" }} onClick={onKapat}>
      <div className="w-full max-w-[1000px] rounded-[var(--t-r)] overflow-hidden"
           style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}
           onClick={(e) => e.stopPropagation()}>
        <div style={{ aspectRatio: "16/9", background: "#000" }}>
          <iframe src={`${k.oynatici}?autoplay=true&preload=true`}
                  loading="lazy" allowFullScreen
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                  style={{ border: 0, width: "100%", height: "100%" }} />
        </div>
        <div className="p-4 space-y-2">
          {duzenle ? (
            <div className="space-y-2">
              <input value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="Başlık"
                     className="w-full h-[34px] px-2.5 rounded-lg text-[13px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none" />
              <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={2}
                        placeholder="Açıklama (isteğe bağlı)"
                        className="w-full p-2.5 rounded-lg text-[12.5px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none" />
              <div className="flex gap-2 flex-wrap">
                <input value={etiket} onChange={(e) => setEtiket(e.target.value)} placeholder="Etiket"
                       className="h-[32px] px-2.5 w-[160px] rounded-lg text-[12.5px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none" />
                <select value={warId} onChange={(e) => setWarId(e.target.value)}
                        className="h-[32px] px-2 rounded-lg text-[12.5px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none">
                  <option value="">Savaş seçilmedi</option>
                  {savaslar.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
                <button className="t-tab" data-on onClick={() => void kaydet()}>
                  <Check className="w-3.5 h-3.5" /> Kaydet
                </button>
                <button className="t-tab" onClick={() => setDuzenle(false)}>Vazgeç</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{k.baslik}</p>
                  <p className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                    {k.yukleyen.familyName} · {tarih(k.tarih)}
                    {k.saniye > 0 && <> · <Clock className="w-3 h-3 inline -mt-0.5" /> {sure(k.saniye)}</>}
                    {k.izlenme > 0 && <> · {k.izlenme} izlenme</>}
                  </p>
                </div>
                {duzenlenebilir && (
                  <>
                    <button className="t-tab" onClick={() => setDuzenle(true)}>
                      <Pencil className="w-3.5 h-3.5" /> Düzenle
                    </button>
                    <button className="t-tab" onClick={onSil} style={{ color: "var(--t-bad)" }}>
                      <Trash2 className="w-3.5 h-3.5" /> Sil
                    </button>
                  </>
                )}
                <button className="t-tab" onClick={onKapat}><X className="w-3.5 h-3.5" /></button>
              </div>
              {k.aciklama && (
                <p className="text-[12.5px] whitespace-pre-wrap" style={{ color: "var(--t-dim)" }}>
                  {k.aciklama}
                </p>
              )}
              {(k.etiket || k.savas) && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {k.etiket && <span className="t-chip">{k.etiket}</span>}
                  {k.savas && <span className="t-chip" style={{ color: "var(--t-gold)" }}>{k.savas.title}</span>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function YuklemePaneli({ savaslar, onBitti, onKapat }: {
  savaslar: Savas[];
  onBitti: (k: KlipOzet) => void;
  onKapat: () => void;
}) {
  const [dosya, setDosya] = useState<File | null>(null);
  const [baslik, setBaslik] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [etiket, setEtiket] = useState("");
  const [warId, setWarId] = useState("");
  const [ilerleme, setIlerleme] = useState<number | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);

  function dosyaSec(f: File | null) {
    setHata(null);
    if (!f) { setDosya(null); return; }
    const uzanti = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!BICIMLER.includes(uzanti)) {
      setHata(`Bu biçim tarayıcıda oynamıyor. Kabul edilenler: ${BICIMLER.join(", ")}`);
      return;
    }
    if (f.size > EN_BUYUK) {
      setHata(`Dosya ${boyut(f.size)} — sınır ${boyut(EN_BUYUK)}. Klibi kırpıp tekrar dene.`);
      return;
    }
    setDosya(f);
    if (!baslik) setBaslik(f.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  async function yukle() {
    if (!dosya || !baslik.trim() || ilerleme !== null) return;
    setHata(null);
    setIlerleme(0);

    // 1) Sunucu Bunny'de yer açsın ve imzalı izin versin
    const r = await fetch("/api/klip", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baslik, aciklama, etiket, warId: warId ? Number(warId) : null }),
    });
    if (!r.ok) {
      setHata((await r.json().catch(() => ({}))).error ?? "Başlatılamadı.");
      setIlerleme(null);
      return;
    }
    const { klip, izin } = await r.json();

    // 2) Dosya doğrudan Bunny'ye — bizim sunucuya uğramıyor
    const { Upload } = await import("tus-js-client");
    const upload = new Upload(dosya, {
      endpoint: izin.uc,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      headers: {
        AuthorizationSignature: izin.imza,
        AuthorizationExpire: String(izin.biter),
        VideoId: izin.videoId,
        LibraryId: izin.kutuphaneId,
      },
      metadata: { filetype: dosya.type || "video/mp4", title: baslik.slice(0, 120) },
      onProgress: (gonderilen, toplam) => setIlerleme(Math.round((gonderilen / toplam) * 100)),
      onError: () => { setHata("Yükleme yarıda kesildi, tekrar dene."); setIlerleme(null); },
      onSuccess: () => { setIlerleme(null); onBitti(klip); },
    });
    upload.start();
  }

  return (
    <Card className="p-4 mb-3 space-y-3">
      <div className="flex items-center gap-2">
        <Film className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
        <p className="text-[13.5px] font-semibold flex-1">Klip yükle</p>
        <button className="t-tab" onClick={onKapat}><X className="w-3.5 h-3.5" /></button>
      </div>

      <input ref={girdi} type="file" accept="video/mp4,video/webm,video/quicktime" hidden
             onChange={(e) => dosyaSec(e.target.files?.[0] ?? null)} />

      <button onClick={() => girdi.current?.click()} disabled={ilerleme !== null}
              className="w-full p-5 rounded-[var(--t-r-sm)] text-[12.5px] text-center"
              style={{ border: "1px dashed var(--t-line-strong)", color: "var(--t-dim)" }}>
        {dosya ? `${dosya.name} · ${boyut(dosya.size)}` : "Dosya seç — MP4 / WebM / MOV, en fazla 500 MB"}
      </button>

      {hata && (
        <p className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--t-bad)" }}>
          <AlertTriangle className="w-3.5 h-3.5" /> {hata}
        </p>
      )}

      <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 160px 200px" }}>
        <input value={baslik} onChange={(e) => setBaslik(e.target.value)} placeholder="Başlık"
               disabled={ilerleme !== null}
               className="h-[34px] px-2.5 rounded-lg text-[13px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none" />
        <input value={etiket} onChange={(e) => setEtiket(e.target.value)} placeholder="Etiket"
               disabled={ilerleme !== null}
               className="h-[34px] px-2.5 rounded-lg text-[13px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none" />
        <select value={warId} onChange={(e) => setWarId(e.target.value)} disabled={ilerleme !== null}
                className="h-[34px] px-2 rounded-lg text-[12.5px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none">
          <option value="">Savaş seçilmedi</option>
          {savaslar.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
      </div>

      <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={2}
                placeholder="Açıklama (isteğe bağlı)" disabled={ilerleme !== null}
                className="w-full p-2.5 rounded-lg text-[12.5px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none" />

      {ilerleme !== null ? (
        <div className="space-y-1.5">
          <div className="h-[6px] rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
            <div style={{ width: `${ilerleme}%`, height: "100%", background: "var(--t-gold)", transition: "width .2s" }} />
          </div>
          <p className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
            %{ilerleme} — sekmeyi kapatma. Bittikten sonra kodlama birkaç dakika sürüyor.
          </p>
        </div>
      ) : (
        <button onClick={() => void yukle()} disabled={!dosya || !baslik.trim()}
                className="t-tab" data-on={!!dosya && !!baslik.trim()}>
          <Upload className="w-3.5 h-3.5" /> Yükle
        </button>
      )}
    </Card>
  );
}
