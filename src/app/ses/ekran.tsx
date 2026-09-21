"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sesApi, type Savas, type OdaListesi, type OnlineUye } from "@/lib/ses-api";
import type { SesAyarlar } from "@/lib/ses-ayarlar";
import { ses, useSes } from "@/lib/ses-web";
import { MikIkon, KulaklikIkon, HoparlorIkon } from "./ikon";
import { SesAyarlariPaneli } from "./ayarlar";
import { Sohbet } from "./sohbet";
import { onayla, toast } from "./dialog";
import { getClassByID } from "@/lib/classes";

const sinifAdi = (id: string) => getClassByID(id)?.name ?? id;

/**
 * Ses — Discord düzeni (tarayıcı sürümü; masaüstü uygulamasındaki Ses ekranının aynısı).
 *  Sol: kategoriler ve odalar; odanın altında içindekiler. Odanın adına
 *  tıkla → gir (düğme yok). Odadaki bir kişiye tıkla → ses/sustur kutusu.
 *  En altta kendi kontrollerim (⚙ → ses ayarları kartı ortada açılır).
 *  Orta: #genel sohbet. Sağ: uygulaması açık üyeler.
 *
 *  Savaş kategorisi otomatik: yaklaşan savaş için "Genel" + her parti.
 *  Kalıcı kategoriler/odalar yönetici işi. Herkes istediği odaya girer.
 *  Liste dakikada bir tazelenir (uygulama geneli kural).
 */

interface Oda { anahtar: string; ad: string; kisiler: string[]; kilit?: boolean; gir: () => void; sil?: () => void }
interface Kategori { ad: string; odalar: Oda[]; savas?: boolean }

export function SesEkrani({ benId, benAd, yonetici, ayarlar, onAyar, savaslar, online }: {
  benId: number; benAd: string; yonetici?: boolean;
  ayarlar: SesAyarlar;
  onAyar: <K extends keyof SesAyarlar>(k: K, v: SesAyarlar[K]) => void;
  savaslar: Savas[];
  online: OnlineUye[];
}) {
  const api = sesApi;
  const d = useSes();
  const [odalar, setOdalar] = useState<OdaListesi | null>(null);
  const [sag, setSag] = useState<"oda" | "ayar">("oda");
  const [secili, setSecili] = useState<string | null>(null); // popover: katılımcı kimliği
  const [yeni, setYeni] = useState<{ kategori: string; ad: string; kilit: boolean } | null>(null);
  const [yeniKategori, setYeniKategori] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const simdi = Date.now();

  const savas = useMemo(() => savaslar.filter((w) => Date.parse(w.date) > simdi - 6 * 3600_000)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0] ?? null, [savaslar, simdi]);
  const partim = savas?.parties.find((p) => p.members.some((m) => m.id === benId)) ?? null;

  const yukle = useCallback(() => { api.voiceRooms().then(setOdalar).catch(() => {}); }, [api]);
  // Odadakiler 10 sn'de bir; sekmeye dönünce hemen (odaya girmeden kimin nerede olduğu görünsün)
  useEffect(() => {
    yukle();
    const t = setInterval(yukle, 10_000);
    const gor = () => { if (document.visibilityState === "visible") yukle(); };
    document.addEventListener("visibilitychange", gor);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", gor); };
  }, [yukle]);
  // Bağlanınca/ayrılınca listeyi hemen tazele (dakika beklemesin)
  useEffect(() => { const t = setTimeout(yukle, 1500); return () => clearTimeout(t); }, [d.bagli, d.oda, yukle]);

  const kisiler = (anahtar: string, savasOda = false) => {
    const liste = savasOda ? odalar?.warRooms.find((r) => r.room === anahtar)?.members : odalar?.rooms.find((r) => `oda-${r.slug}` === anahtar)?.members;
    // Bağlı olduğum odada canlı listeyi kullan (isim + konuşma)
    if (d.bagli && d.oda === anahtar) return d.katilimcilar.map((k) => k.ad);
    return liste ?? [];
  };

  const kategoriler: Kategori[] = [];
  if (savas) {
    const odalarS: Oda[] = [
      { anahtar: `savas-${savas.id}-genel`, ad: "Genel", kisiler: kisiler(`savas-${savas.id}-genel`, true), gir: () => ses.baglan(api, savas.id, "genel") },
      ...savas.parties.map((p) => ({
        anahtar: `savas-${savas.id}-parti-${p.id}`, ad: p.name + (p.id === partim?.id ? " · partin" : ""),
        kisiler: kisiler(`savas-${savas.id}-parti-${p.id}`, true), gir: () => ses.baglan(api, savas.id, "parti", p.id),
      })),
    ];
    kategoriler.push({ ad: savas.title, odalar: odalarS, savas: true });
  }
  const gruplar = new Map<string, Oda[]>();
  for (const o of odalar?.rooms ?? []) {
    const oda: Oda = {
      anahtar: `oda-${o.slug}`, ad: o.name, kilit: o.adminOnly, kisiler: kisiler(`oda-${o.slug}`),
      gir: () => { if (o.canJoin) void ses.odayaBaglan(api, o.id); else toast("Bu oda yöneticiye özel.", "kotu"); },
      sil: odalar?.canManage ? async () => { if (await onayla(`"${o.name}" odası silinsin mi?`, "Sil")) api.voiceRoomDelete(o.id).then(yukle); } : undefined,
    };
    gruplar.set(o.category, [...(gruplar.get(o.category) ?? []), oda]);
  }
  for (const [ad, ods] of Array.from(gruplar)) kategoriler.push({ ad, odalar: ods });

  async function odaAc() {
    if (!yeni?.ad.trim()) return;
    try { await api.voiceRoomCreate(yeni.ad.trim(), yeni.kilit, yeni.kategori); setYeni(null); yukle(); }
    catch (e) { toast((e as Error).message, "kotu"); }
  }
  useEffect(() => { if (hata) { toast(hata, "kotu"); setHata(null); } }, [hata]);
  useEffect(() => { if (d.hata) toast(d.hata, "kotu"); }, [d.hata]);

  const konusanlar = new Set(d.katilimcilar.filter((k) => k.konusuyor).map((k) => k.ad));
  const sessizler = new Set(d.katilimcilar.filter((k) => k.sessiz).map((k) => k.ad));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 200px", gap: 10, height: "100%", minHeight: 0 }} onClick={() => secili && setSecili(null)}>
      {/* Sol: kanal listesi */}
      <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "auto", padding: "6px 0" }}>
          {kategoriler.length === 0 && <div className="faint small" style={{ padding: 12 }}>Henüz oda yok.</div>}
          {kategoriler.map((k) => (
            <div key={k.ad} style={{ marginBottom: 6 }}>
              <div className="kanal-kategori">
                <span style={{ flex: 1 }}>{k.savas ? "⚔ " : ""}{k.ad}</span>
                {odalar?.canManage && !k.savas && (
                  <button className="kanal-arti" title="Bu kategoriye oda aç" onClick={() => setYeni({ kategori: k.ad, ad: "", kilit: false })}>+</button>
                )}
              </div>
              {k.odalar.map((o) => {
                const buradayim = d.bagli && d.oda === o.anahtar;
                return (
                  <div key={o.anahtar}>
                    <div className={`kanal ${buradayim ? "on" : ""}`} onClick={() => !buradayim && o.gir()} title={buradayim ? "Buradasın" : "Girmek için tıkla"}>
                      <span className="kanal-ikon">{o.kilit ? "🔒" : "🔊"}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.ad}</span>
                      {o.kisiler.length > 0 && <span className="faint small">{o.kisiler.length}</span>}
                      {o.sil && <button className="kanal-sil" title="Odayı sil" onClick={(e) => { e.stopPropagation(); o.sil!(); }}>×</button>}
                    </div>
                    {o.kisiler.map((ad) => {
                      const k = buradayim ? d.katilimcilar.find((x) => x.ad === ad) : undefined;
                      const tik = k && !k.ben;
                      return (
                        <div key={ad} style={{ position: "relative" }}>
                          <div className={`kanal-kisi ${konusanlar.has(ad) ? "konusuyor" : ""} ${tik ? "tiklanir" : ""}`}
                               onClick={() => tik && setSecili(secili === k.id ? null : k.id)}>
                            <i />
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ad}{ad === benAd ? " (sen)" : ""}</span>
                            {k?.susturuldu && <HoparlorIkon acik={false} size={11} />}
                            {sessizler.has(ad) && <MikIkon acik={false} size={11} />}
                          </div>
                          {k && secili === k.id && (
                            <div className="popover" onClick={(e) => e.stopPropagation()}>
                              <div style={{ fontWeight: 600, marginBottom: 6 }}>{k.ad}</div>
                              <div className="small dim" style={{ display: "flex", justifyContent: "space-between" }}><span>Ses</span><span className="t-num">{k.susturuldu ? "—" : `%${k.seviye}`}</span></div>
                              <input type="range" min={0} max={200} value={k.susturuldu ? 0 : k.seviye} disabled={k.susturuldu} style={{ width: "100%" }}
                                     onChange={(e) => ses.hacim(k.id, Number(e.target.value))} />
                              <button className={`btn ${k.susturuldu ? "" : "btn-ghost"}`} style={{ width: "100%", height: 28, marginTop: 6, color: k.susturuldu ? "var(--t-bad)" : undefined }}
                                      onClick={() => ses.sustur(k.id, !k.susturuldu)}>{k.susturuldu ? "Sesini aç" : "Sustur"}</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {yeni?.kategori === k.ad && (
                <div style={{ padding: "4px 10px", display: "grid", gap: 4 }}>
                  <input className="input" style={{ height: 28 }} autoFocus placeholder="Oda adı" value={yeni.ad} maxLength={40}
                         onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") odaAc(); if (e.key === "Escape") setYeni(null); }} />
                  <label className="faint small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={yeni.kilit} onChange={(e) => setYeni({ ...yeni, kilit: e.target.checked })} /> yöneticiye özel
                  </label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button className="btn btn-gold" style={{ height: 26, flex: 1 }} onClick={odaAc}>Aç</button>
                    <button className="btn btn-ghost" style={{ height: 26 }} onClick={() => setYeni(null)}>İptal</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {odalar?.canManage && (
            <div style={{ padding: "8px 10px", display: "flex", gap: 4 }}>
              <input className="input" style={{ height: 28 }} placeholder="Yeni kategori…" value={yeniKategori} maxLength={40}
                     onChange={(e) => setYeniKategori(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter" && yeniKategori.trim()) { setYeni({ kategori: yeniKategori.trim(), ad: "", kilit: false }); setYeniKategori(""); } }} />
              <button className="btn btn-ghost" style={{ height: 28, padding: "0 8px" }} disabled={!yeniKategori.trim()}
                      onClick={() => { setYeni({ kategori: yeniKategori.trim(), ad: "", kilit: false }); setYeniKategori(""); }}>+</button>
            </div>
          )}
          {yeni && !kategoriler.some((k) => k.ad === yeni.kategori) && (
            <div style={{ padding: "4px 10px", display: "grid", gap: 4 }}>
              <div className="kanal-kategori">{yeni.kategori}</div>
              <input className="input" style={{ height: 28 }} autoFocus placeholder="İlk oda adı" value={yeni.ad} maxLength={40}
                     onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") odaAc(); if (e.key === "Escape") setYeni(null); }} />
              <div style={{ display: "flex", gap: 4 }}>
                <button className="btn btn-gold" style={{ height: 26, flex: 1 }} onClick={odaAc}>Aç</button>
                <button className="btn btn-ghost" style={{ height: 26 }} onClick={() => setYeni(null)}>İptal</button>
              </div>
            </div>
          )}
        </div>

        {/* Alt: ben */}
        <div className="ben-cubugu">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{benAd}</div>
            <div className="faint small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.baglaniyor ? "Bağlanıyor…" : d.bagli ? <span className="good">● {d.etiket}</span> : "Bağlı değil"}
              {d.anonsAcik && <span className="anons-rozet" title="Tüm odalara konuşuyorsun">📢 anons</span>}
            </div>
          </div>
          <button className="btn btn-ghost ikon-btn" disabled={!d.bagli || d.ptt || d.sagir} title={d.ptt ? `Bas-konuş: ${ayarlar.pttAd}` : d.mikrofon ? "Mikrofonu kapat" : "Mikrofonu aç"} onClick={() => ses.mikrofon(!d.mikrofon)}>
            <MikIkon acik={d.bagli ? d.mikrofon : false} size={18} />
          </button>
          <button className="btn btn-ghost ikon-btn" disabled={!d.bagli} title={d.sagir ? "Kulaklığı aç" : "Kulaklığı kapat"} onClick={() => ses.sagirlik(!d.sagir)}>
            <KulaklikIkon acik={!d.sagir} size={18} />
          </button>
          <button className={`btn ikon-btn ${sag === "ayar" ? "" : "btn-ghost"}`} title="Ses ayarları" onClick={() => setSag(sag === "ayar" ? "oda" : "ayar")}>⚙</button>
          {d.bagli && <button className="btn btn-ghost ikon-btn" title="Odadan ayrıl" style={{ color: "var(--t-bad)" }} onClick={() => ses.ayril()}>✕</button>}
        </div>
      </div>

      {/* Orta: sohbet (ya da ses ayarları) */}
      <div style={{ minHeight: 0, display: "grid", gridTemplateRows: d.anonsKonusanlar.length ? "auto 1fr" : "1fr" }}>
        {d.anonsKonusanlar.length > 0 && <div className="anons-serit">📢 {d.anonsKonusanlar.join(", ")} tüm odalara konuşuyor</div>}
        {sag === "ayar" ? (
          <div style={{ overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Ses ayarları</span><span style={{ flex: 1 }} />
              <button className="btn btn-ghost" style={{ height: 28 }} onClick={() => setSag("oda")}>Sohbete dön</button>
            </div>
            <SesAyarlariPaneli ayarlar={ayarlar} onAyar={onAyar} yonetici={yonetici} />
          </div>
        ) : <Sohbet benId={benId} benAd={benAd} online={online} />}
      </div>

      {/* Sağ: çevrimiçi */}
      <div className="card" style={{ minHeight: 0, overflow: "auto" }}>
        <div className="kanal-kategori" style={{ paddingTop: 10 }}>Çevrimiçi — {online.length}</div>
        {online.length === 0 && <div className="faint small" style={{ padding: "4px 12px" }}>Kimse yok.</div>}
        {online.map((u) => (
          <div key={u.id} className="online-uye" style={u.id === benId ? { color: "var(--t-gold)" } : undefined}>
            <i />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.familyName}</span>
            <span className="faint small">{sinifAdi(u.class)}{u.guild ? ` · ${u.guild}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
