"use client";

import { useEffect, useState } from "react";
import { ses, useSes, sesCihazlari } from "@/lib/ses-web";
import type { SesAyarlar } from "@/lib/ses-ayarlar";
import { toast } from "./dialog";

/**
 * Ses ayarları — cihazlar, bas-konuş, gürültü engelleme, anons (yönetici),
 * mikrofon izni, kulaklık/mikrofon seviyesi, eşik (canlı ölçerle).
 * Tuşlar KeyboardEvent.code olarak tutulur; yalnızca bu sekme odaktayken çalışır.
 */

const dbYuzde = (db: number) => Math.round(Math.max(0, Math.min(100, (db + 60) / 60 * 100)));

/** e.code → kısa etiket */
function tusAdi(e: KeyboardEvent): string {
  const c = e.code;
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  if (c.startsWith("Shift")) return "Shift"; if (c.startsWith("Control")) return "Ctrl"; if (c.startsWith("Alt")) return "Alt";
  return ({ Space: "Boşluk", CapsLock: "Caps", Backquote: "`" } as Record<string, string>)[c] ?? c.replace(/^Numpad/, "Num ");
}

export function SesAyarlariPaneli({ ayarlar, onAyar, yonetici = false }: {
  ayarlar: SesAyarlar;
  onAyar: <K extends keyof SesAyarlar>(k: K, v: SesAyarlar[K]) => void;
  yonetici?: boolean;
}) {
  const d = useSes();
  const [cihazlar, setCihazlar] = useState<{ mikrofonlar: Array<{ id: string; ad: string }>; hoparlorler: Array<{ id: string; ad: string }> }>({ mikrofonlar: [], hoparlorler: [] });
  const [tusDinle, setTusDinle] = useState<null | "ptt" | "anons">(null);
  const [izin, setIzin] = useState<PermissionState | null>(null);
  const izinTazele = () => { void ses.izinDurumu().then(setIzin); };
  useEffect(() => { void sesCihazlari().then(setCihazlar); }, []);
  useEffect(() => { ses.olcerBaslat().catch(() => {}).finally(izinTazele); return () => { void ses.olcerDurdur(); }; }, []);
  async function izinIste() {
    try { await ses.olcerBaslat(); toast("Mikrofon açıldı.", "iyi"); sesCihazlari().then(setCihazlar).catch(() => {}); }
    catch (e) { toast(ses.durum.hata ?? String(e), "kotu", 8000); }
    izinTazele();
  }
  const izinMetni = izin === "granted" ? "verildi" : izin === "denied" ? "reddedildi" : izin === "prompt" ? "henüz sorulmadı" : "bilinmiyor";
  const izinRenk = izin === "granted" ? "var(--t-good)" : izin === "denied" ? "var(--t-bad)" : "var(--t-dim)";

  // Tuş yakalama: klavye ya da fare yan tuşu
  useEffect(() => {
    if (!tusDinle) return;
    const hedef = tusDinle;
    const ata = (kod: string, ad: string) => {
      if (hedef === "anons") { onAyar("anonsKod", kod); onAyar("anonsAd", ad); } else { onAyar("pttKod", kod); onAyar("pttAd", ad); }
      setTusDinle(null);
    };
    const k = (e: KeyboardEvent) => { e.preventDefault(); if (e.key === "Escape") { setTusDinle(null); return; } ata(e.code, tusAdi(e)); };
    const m = (e: MouseEvent) => { if (e.button === 3 || e.button === 4) { e.preventDefault(); ata(`Mouse${e.button + 1}`, `Fare ${e.button + 1}`); } };
    window.addEventListener("keydown", k, true); window.addEventListener("mousedown", m, true);
    return () => { window.removeEventListener("keydown", k, true); window.removeEventListener("mousedown", m, true); };
  }, [tusDinle, onAyar]);

  const olcerYuzde = dbYuzde(d.olcer), esikYuzde = ayarlar.esikDb <= -99 ? 0 : dbYuzde(ayarlar.esikDb);

  return (
    <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", alignItems: "start" }}>
      <div className="card">
        <div className="head">Cihazlar</div>
        <div className="row">
          <div style={{ flex: 1 }}>Mikrofon</div>
          <select className="input" style={{ width: 220 }} value={ayarlar.mikrofon} onChange={(e) => onAyar("mikrofon", e.target.value)}>
            <option value="">Varsayılan</option>
            {cihazlar.mikrofonlar.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
          </select>
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>Hoparlör / kulaklık</div>
          <select className="input" style={{ width: 220 }} value={ayarlar.hoparlor} onChange={(e) => onAyar("hoparlor", e.target.value)}>
            <option value="">Varsayılan</option>
            {cihazlar.hoparlorler.map((m) => <option key={m.id} value={m.id}>{m.ad}</option>)}
          </select>
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>Bas-konuş tuşu<div className="faint small">Boşsa mikrofon hep açık (eşikle). Tarayıcıda yalnızca bu sekme öndeyken çalışır; oyun içinde tuş için masaüstü uygulaması gerekir.</div></div>
          <button className={`btn ${tusDinle === "ptt" ? "btn-gold" : "btn-ghost"}`} style={{ height: 30 }} onClick={() => setTusDinle((v) => v === "ptt" ? null : "ptt")}>
            {tusDinle === "ptt" ? "Bir tuşa bas… (Esc)" : ayarlar.pttKod ? ayarlar.pttAd : "Tuş ata"}
          </button>
          {ayarlar.pttKod && <button className="btn btn-ghost" style={{ height: 30 }} onClick={() => { onAyar("pttKod", ""); onAyar("pttAd", ""); }}>Kaldır</button>}
        </div>
        <div className="row" style={{ alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>Gürültü engelleme<div className="faint small">
            {ayarlar.gurultuMod === "gtcrn" ? "GTCRN: en güçlü sinir ağı; klavye, fan, sokak sesi. Biraz daha CPU."
             : ayarlar.gurultuMod === "rnnoise" ? "RNNoise: hafif sinir ağı; çoğu durum için yeterli. (önerilen)"
             : ayarlar.gurultuMod === "tarayici" ? "Tarayıcı motorunun kendi filtresi; zayıf." : "Kapalı: mikrofon olduğu gibi gider."}
          </div></div>
          <select className="input" style={{ width: 150 }} value={ayarlar.gurultuMod} onChange={(e) => onAyar("gurultuMod", e.target.value as SesAyarlar["gurultuMod"])}>
            <option value="gtcrn">Güçlü (GTCRN)</option>
            <option value="rnnoise">Normal (RNNoise)</option>
            <option value="tarayici">Hafif (tarayıcı)</option>
            <option value="kapali">Kapalı</option>
          </select>
        </div>
        {yonetici && (
          <>
            <div className="head" style={{ borderTop: "1px solid var(--t-line)" }}>📢 Anons <span className="faint small" style={{ fontWeight: 400 }}>· tüm odalara konuş (yönetici)</span></div>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>Mod<div className="faint small">
                {ayarlar.anonsMod === "tus" ? "Tuşa basılı tutunca sesin bütün odalara gider; kendi odana da (bas-konuş kapalıysa bile)."
                 : ayarlar.anonsMod === "otomatik" ? "Mikrofonun açıkken ne söylersen bütün odalar duyar." : "Sadece bulunduğun oda duyar."}
              </div></div>
              <select className="input" style={{ width: 150 }} value={ayarlar.anonsMod} onChange={(e) => onAyar("anonsMod", e.target.value as SesAyarlar["anonsMod"])}>
                <option value="kapali">Kapalı</option>
                <option value="tus">Tuşla</option>
                <option value="otomatik">Otomatik (hep)</option>
              </select>
            </div>
            {ayarlar.anonsMod === "tus" && (
              <div className="row">
                <div style={{ flex: 1 }}>Anons tuşu<div className="faint small">Bas-konuş tuşundan farklı olsun.</div></div>
                <button className={`btn ${tusDinle === "anons" ? "btn-gold" : "btn-ghost"}`} style={{ height: 30 }} onClick={() => setTusDinle((v) => v === "anons" ? null : "anons")}>
                  {tusDinle === "anons" ? "Bir tuşa bas… (Esc)" : ayarlar.anonsKod ? ayarlar.anonsAd : "Tuş ata"}
                </button>
                {ayarlar.anonsKod && <button className="btn btn-ghost" style={{ height: 30 }} onClick={() => { onAyar("anonsKod", ""); onAyar("anonsAd", ""); }}>Kaldır</button>}
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <div className="head">Mikrofon</div>
        <div style={{ padding: 14, display: "grid", gap: 14 }}>
          <div>
            <div className="small dim" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Mikrofon izni</span><span style={{ color: izinRenk, fontWeight: 600 }}>{izinMetni}</span>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" style={{ height: 28 }} onClick={() => void izinIste()}>{izin === "granted" ? "Yeniden dene" : "İzin iste"}</button>
            </div>
            {izin === "denied" && <div className="faint small" style={{ marginTop: 6 }}>Tarayıcı mikrofonu engellemiş: adres çubuğundaki kilit/simgeden bu site için mikrofona izin ver, sonra &quot;Yeniden dene&quot;.</div>}
          </div>
          <div>
            <div className="small dim" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Kulaklık sesi <span className="faint">(herkes)</span></span><span className="t-num">{ayarlar.cikis}%</span>
            </div>
            <input type="range" min={0} max={200} value={ayarlar.cikis} style={{ width: "100%" }} onChange={(e) => onAyar("cikis", Number(e.target.value))} />
          </div>
          <div>
            <div className="small dim" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Mikrofon seviyesi</span><span className="t-num">{Math.round(ayarlar.kazanc * 100)}%</span>
            </div>
            <input type="range" min={20} max={300} value={Math.round(ayarlar.kazanc * 100)} style={{ width: "100%" }} onChange={(e) => onAyar("kazanc", Number(e.target.value) / 100)} />
          </div>
          <div>
            <div className="small dim" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Ses eşiği <span className="faint">(altı gönderilmez)</span></span>
              <span className="t-num">{ayarlar.esikDb <= -99 ? "kapalı" : `${ayarlar.esikDb} dB`}</span>
            </div>
            <div className="olcer" title="Canlı mikrofon seviyesi; çizgi eşik">
              <i style={{ width: `${olcerYuzde}%`, background: d.kapiAcik ? "var(--t-good)" : "var(--t-faint)" }} />
              {esikYuzde > 0 && <b style={{ left: `${esikYuzde}%` }} />}
            </div>
            <input type="range" min={-100} max={-10} value={ayarlar.esikDb} style={{ width: "100%" }} onChange={(e) => onAyar("esikDb", Number(e.target.value))} />
            <div className="faint small">Konuşmadan bekle; çubuk nereye kadar geliyorsa eşiği onun biraz üstüne koy. En sola çekince kapalı.</div>
          </div>
          <div className="faint small">Ölçer: {d.olcer} dB · {d.kapiAcik ? "gönderiliyor" : "eşik altı"}</div>
        </div>
      </div>
    </div>
  );
}
