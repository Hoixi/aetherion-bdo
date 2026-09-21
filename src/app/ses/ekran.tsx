"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { sesApi, type Savas, type OdaListesi, type OnlineUye, type OdaUyesi } from "@/lib/ses-api";
import type { SesAyarlar } from "@/lib/ses-ayarlar";
import { ses, useSes } from "@/lib/ses-web";
import { MikIkon, KulaklikIkon, HoparlorIkon } from "./ikon";
import { SesAyarlariPaneli } from "./ayarlar";
import { Sohbet } from "./sohbet";
import { YayinPaneli } from "./yayin";
import { onayla, toast } from "./dialog";
import { getClassByID } from "@/lib/classes";

const sinifAdi = (id: string) => getClassByID(id)?.name ?? id;

/**
 * Ses — Discord düzeni (tarayıcı sürümü).
 *  Sol: kategoriler ve odalar; odanın altında içindekiler (avatarlı). Odanın
 *  adına tıkla → gir. Kişiye tıkla ya da sağ tıkla → ses/sustur kutusu;
 *  yönetici, konuşma kısıtlı odada aynı kutudan konuşma yetkisi verir/alır.
 *  En altta kendi kontrollerim + gecikme (ms). Orta: #genel sohbet. Sağ:
 *  çevrimiçi üyeler.
 *
 *  Oda listesi sunucunun canlı akışıyla (SSE) anında güncellenir.
 */

interface Oda { anahtar: string; ad: string; id?: number; uyeler: OdaUyesi[]; kilit?: boolean; kisitli?: boolean; gir: () => void; sil?: () => void }
interface Kategori { ad: string; odalar: Oda[]; savas?: boolean }

function Avatar({ src, size = 16 }: { src: string | null | undefined; size?: number }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: 99, objectFit: "cover", flexShrink: 0, background: "var(--t-raised)" }} />
    : <span style={{ width: size, height: size, borderRadius: 99, background: "var(--t-raised)", border: "1px solid var(--t-line-strong)", flexShrink: 0 }} />;
}

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
  const [secili, setSecili] = useState<{ oda: string; id: number } | null>(null); // popover
  const [yeni, setYeni] = useState<{ kategori: string; ad: string; kilit: boolean; kisitli: boolean } | null>(null);
  const [yeniKategori, setYeniKategori] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const simdi = Date.now();

  const savas = useMemo(() => savaslar.filter((w) => Date.parse(w.date) > simdi - 6 * 3600_000)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0] ?? null, [savaslar, simdi]);
  const partim = savas?.parties.find((p) => p.members.some((m) => m.id === benId)) ?? null;

  const yukle = useCallback(() => { api.voiceRooms().then(setOdalar).catch(() => {}); }, [api]);
  // Odadakiler canlı: sunucu her giriş/çıkışta SSE ile haber veriyor; 30 sn'lik
  // yoklama yalnızca bağlantı koparsa diye
  useEffect(() => {
    yukle();
    const es = new EventSource("/api/app/voice/events");
    es.onmessage = () => yukle();
    const t = setInterval(yukle, 30_000);
    const gor = () => { if (document.visibilityState === "visible") yukle(); };
    document.addEventListener("visibilitychange", gor);
    return () => { es.close(); clearInterval(t); document.removeEventListener("visibilitychange", gor); };
  }, [yukle]);
  useEffect(() => { const t = setTimeout(yukle, 1500); return () => clearTimeout(t); }, [d.bagli, d.oda, d.yayinIzni, yukle]);

  // Avatar sözlüğü: oda listeleri + çevrimiçi (bağlıyken canlı listede avatar yok)
  const avatarlar = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const r of odalar?.rooms ?? []) for (const u of r.memberList ?? []) m.set(u.id, u.avatar);
    for (const r of odalar?.warRooms ?? []) for (const u of r.memberList ?? []) m.set(u.id, u.avatar);
    for (const u of online) if (!m.has(u.id)) m.set(u.id, u.avatar ?? null);
    return m;
  }, [odalar, online]);

  const uyeler = (anahtar: string, savasOda = false): OdaUyesi[] => {
    const liste = (savasOda ? odalar?.warRooms.find((r) => r.room === anahtar)?.memberList : odalar?.rooms.find((r) => `oda-${r.slug}` === anahtar)?.memberList) ?? [];
    // Bağlı olduğum odada canlı listeyi kullan (konuşma ışığı anlık); izin bilgisi listeden
    if (d.bagli && d.oda === anahtar) {
      const izin = new Map(liste.map((u) => [u.id, u.canSpeak]));
      return d.katilimcilar.map((k) => ({ id: Number(k.id), name: k.ad, avatar: avatarlar.get(Number(k.id)) ?? null, canSpeak: izin.get(Number(k.id)) ?? true }));
    }
    return liste;
  };

  const kategoriler: Kategori[] = [];
  if (savas) {
    const odalarS: Oda[] = [
      { anahtar: `savas-${savas.id}-genel`, ad: "Genel", uyeler: uyeler(`savas-${savas.id}-genel`, true), gir: () => ses.baglan(api, savas.id, "genel") },
      ...savas.parties.map((p) => ({
        anahtar: `savas-${savas.id}-parti-${p.id}`, ad: p.name + (p.id === partim?.id ? " · partin" : ""),
        uyeler: uyeler(`savas-${savas.id}-parti-${p.id}`, true), gir: () => ses.baglan(api, savas.id, "parti", p.id),
      })),
    ];
    kategoriler.push({ ad: savas.title, odalar: odalarS, savas: true });
  }
  const gruplar = new Map<string, Oda[]>();
  for (const o of odalar?.rooms ?? []) {
    const oda: Oda = {
      anahtar: `oda-${o.slug}`, ad: o.name, id: o.id, kilit: o.adminOnly, kisitli: o.speakRestricted, uyeler: uyeler(`oda-${o.slug}`),
      gir: () => { if (o.canJoin) void ses.odayaBaglan(api, o.id); else toast("Bu oda yöneticiye özel.", "kotu"); },
      sil: odalar?.canManage ? async () => { if (await onayla(`"${o.name}" odası silinsin mi?`, "Sil")) api.voiceRoomDelete(o.id).then(yukle); } : undefined,
    };
    gruplar.set(o.category, [...(gruplar.get(o.category) ?? []), oda]);
  }
  for (const [ad, ods] of Array.from(gruplar)) kategoriler.push({ ad, odalar: ods });

  async function odaAc() {
    if (!yeni?.ad.trim()) return;
    try { await api.voiceRoomCreate(yeni.ad.trim(), yeni.kilit, yeni.kategori, yeni.kisitli); setYeni(null); yukle(); }
    catch (e) { toast((e as Error).message, "kotu"); }
  }
  async function yetki(odaId: number, userId: number, ver: boolean) {
    try { await api.voiceSpeaker(odaId, userId, ver); toast(ver ? "Konuşma yetkisi verildi." : "Konuşma yetkisi alındı.", "iyi"); yukle(); }
    catch (e) { toast((e as Error).message, "kotu"); }
  }
  useEffect(() => { if (hata) { toast(hata, "kotu"); setHata(null); } }, [hata]);
  useEffect(() => { if (d.hata) toast(d.hata, "kotu"); }, [d.hata]);
  useEffect(() => { if (d.bagli && !d.yayinIzni) toast("Bu odada konuşma yetkin yok — dinleyicisin. Yönetici yetki verince mikrofonun açılır.", "bilgi", 6000); }, [d.bagli, d.yayinIzni]);

  const konusanlar = new Set(d.katilimcilar.filter((k) => k.konusuyor).map((k) => Number(k.id)));
  const sessizler = new Set(d.katilimcilar.filter((k) => k.sessiz).map((k) => Number(k.id)));
  const pingRenk = d.gecikmeMs === null ? "var(--t-faint)" : d.gecikmeMs < 80 ? "var(--t-good)" : d.gecikmeMs < 150 ? "#e09832" : "var(--t-bad)";

  const yeniForm = (kategoriAdi: string, ilk = false) => yeni && yeni.kategori === kategoriAdi && (
    <div style={{ padding: "4px 10px", display: "grid", gap: 4 }}>
      {ilk && <div className="kanal-kategori">{yeni.kategori}</div>}
      <input className="input" style={{ height: 28 }} autoFocus placeholder={ilk ? "İlk oda adı" : "Oda adı"} value={yeni.ad} maxLength={40}
             onChange={(e) => setYeni({ ...yeni, ad: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") odaAc(); if (e.key === "Escape") setYeni(null); }} />
      <label className="faint small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={yeni.kilit} onChange={(e) => setYeni({ ...yeni, kilit: e.target.checked })} /> yöneticiye özel (sadece yöneticiler girer)
      </label>
      <label className="faint small" style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type="checkbox" checked={yeni.kisitli} onChange={(e) => setYeni({ ...yeni, kisitli: e.target.checked })} /> konuşma kısıtlı (herkes girer, yetki verilen konuşur)
      </label>
      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn btn-gold" style={{ height: 26, flex: 1 }} onClick={odaAc}>Aç</button>
        <button className="btn btn-ghost" style={{ height: 26 }} onClick={() => setYeni(null)}>İptal</button>
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "250px 1fr 210px", gap: 10, height: "100%", minHeight: 0 }} onClick={() => secili && setSecili(null)}>
      {/* Sol: kanal listesi */}
      <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        <div style={{ flex: 1, overflow: "auto", padding: "6px 0" }}>
          {kategoriler.length === 0 && <div className="faint small" style={{ padding: 12 }}>Henüz oda yok.</div>}
          {kategoriler.map((k) => (
            <div key={k.ad} style={{ marginBottom: 6 }}>
              <div className="kanal-kategori">
                <span style={{ flex: 1 }}>{k.savas ? "⚔ " : ""}{k.ad}</span>
                {odalar?.canManage && !k.savas && (
                  <button className="kanal-arti" title="Bu kategoriye oda aç" onClick={() => setYeni({ kategori: k.ad, ad: "", kilit: false, kisitli: false })}>+</button>
                )}
              </div>
              {k.odalar.map((o) => {
                const buradayim = d.bagli && d.oda === o.anahtar;
                return (
                  <div key={o.anahtar}>
                    <div className={`kanal ${buradayim ? "on" : ""}`} onClick={() => !buradayim && o.gir()}
                         title={buradayim ? "Buradasın" : o.kisitli ? "Konuşma kısıtlı oda: girmek serbest, konuşmak için yetki gerekir" : "Girmek için tıkla"}>
                      <span className="kanal-ikon">{o.kilit ? "🔒" : o.kisitli ? "🎙" : "🔊"}</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.ad}</span>
                      {o.uyeler.length > 0 && <span className="faint small">{o.uyeler.length}</span>}
                      {o.sil && <button className="kanal-sil" title="Odayı sil" onClick={(e) => { e.stopPropagation(); o.sil!(); }}>×</button>}
                    </div>
                    {o.uyeler.map((u) => {
                      const k = buradayim ? d.katilimcilar.find((x) => Number(x.id) === u.id) : undefined;
                      const ben = u.id === benId;
                      // Popover: bağlıysam başkası için ses/sustur; yönetici kısıtlı odada yetki için (bağlı olmasa da)
                      const acilir = (!!k && !k.ben) || (!!odalar?.canManage && !!o.kisitli && !ben);
                      const acik = secili?.oda === o.anahtar && secili.id === u.id;
                      return (
                        <div key={u.id} style={{ position: "relative" }}>
                          <div className={`kanal-kisi ${konusanlar.has(u.id) ? "konusuyor" : ""} ${acilir ? "tiklanir" : ""}`}
                               onClick={(e) => { if (!acilir) return; e.stopPropagation(); setSecili(acik ? null : { oda: o.anahtar, id: u.id }); }}
                               onContextMenu={(e) => { if (!acilir) return; e.preventDefault(); e.stopPropagation(); setSecili({ oda: o.anahtar, id: u.id }); }}>
                            <i />
                            <Avatar src={u.avatar} />
                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}{ben ? " (sen)" : ""}</span>
                            {buradayim && d.yayinlar.some((y) => y.id === String(u.id)) && <span title="Ekran yayınlıyor" style={{ fontSize: 10 }}>📺</span>}
                            {o.kisitli && !u.canSpeak && <span className="faint" title="Dinleyici — konuşma yetkisi yok" style={{ fontSize: 10 }}>👂</span>}
                            {k?.susturuldu && <HoparlorIkon acik={false} size={11} />}
                            {sessizler.has(u.id) && <MikIkon acik={false} size={11} />}
                          </div>
                          {acik && (
                            <div className="popover" onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 6 }}><Avatar src={u.avatar} size={20} />{u.name}</div>
                              {k && !k.ben && (
                                <>
                                  <div className="small dim" style={{ display: "flex", justifyContent: "space-between" }}><span>Ses</span><span className="t-num">{k.susturuldu ? "—" : `%${k.seviye}`}</span></div>
                                  <input type="range" min={0} max={200} value={k.susturuldu ? 0 : k.seviye} disabled={k.susturuldu} style={{ width: "100%" }}
                                         onChange={(e) => ses.hacim(k.id, Number(e.target.value))} />
                                  <button className={`btn ${k.susturuldu ? "" : "btn-ghost"}`} style={{ width: "100%", height: 28, marginTop: 6, color: k.susturuldu ? "var(--t-bad)" : undefined }}
                                          onClick={() => ses.sustur(k.id, !k.susturuldu)}>{k.susturuldu ? "Sesini aç" : "Sustur"}</button>
                                </>
                              )}
                              {odalar?.canManage && o.kisitli && o.id !== undefined && (
                                <button className="btn btn-ghost" style={{ width: "100%", height: 28, marginTop: 6, color: u.canSpeak ? "var(--t-bad)" : "var(--t-good)" }}
                                        onClick={() => { void yetki(o.id!, u.id, !u.canSpeak); setSecili(null); }}>
                                  {u.canSpeak ? "Konuşma yetkisini al" : "Konuşma yetkisi ver"}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {yeniForm(k.ad)}
            </div>
          ))}
          {odalar?.canManage && (
            <div style={{ padding: "8px 10px", display: "flex", gap: 4 }}>
              <input className="input" style={{ height: 28 }} placeholder="Yeni kategori…" value={yeniKategori} maxLength={40}
                     onChange={(e) => setYeniKategori(e.target.value)}
                     onKeyDown={(e) => { if (e.key === "Enter" && yeniKategori.trim()) { setYeni({ kategori: yeniKategori.trim(), ad: "", kilit: false, kisitli: false }); setYeniKategori(""); } }} />
              <button className="btn btn-ghost" style={{ height: 28, padding: "0 8px" }} disabled={!yeniKategori.trim()}
                      onClick={() => { setYeni({ kategori: yeniKategori.trim(), ad: "", kilit: false, kisitli: false }); setYeniKategori(""); }}>+</button>
            </div>
          )}
          {yeni && !kategoriler.some((k) => k.ad === yeni.kategori) && yeniForm(yeni.kategori, true)}
        </div>

        {/* Alt: ben */}
        <div className="ben-cubugu">
          <Avatar src={avatarlar.get(benId)} size={26} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{benAd}</div>
            <div className="faint small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
              {d.baglaniyor ? "Bağlanıyor…" : d.bagli ? <span className="good">● {d.etiket}{!d.yayinIzni ? " · dinleyici" : ""}</span> : "Bağlı değil"}
              {d.bagli && d.gecikmeMs !== null && <span className="t-num" style={{ color: pingRenk }} title="Sunucuya gidiş-dönüş">{d.gecikmeMs} ms</span>}
              {d.anonsAcik && <span className="anons-rozet" title="Tüm odalara konuşuyorsun">📢 anons</span>}
            </div>
          </div>
          <button className="btn btn-ghost ikon-btn" disabled={!d.bagli || d.ptt || d.sagir || !d.yayinIzni}
                  title={!d.yayinIzni ? "Bu odada konuşma yetkin yok" : d.ptt ? `Bas-konuş: ${ayarlar.pttAd}` : d.mikrofon ? "Mikrofonu kapat" : "Mikrofonu aç"} onClick={() => ses.mikrofon(!d.mikrofon)}>
            <MikIkon acik={d.bagli && d.yayinIzni ? d.mikrofon : false} size={18} />
          </button>
          <button className="btn btn-ghost ikon-btn" disabled={!d.bagli} title={d.sagir ? "Kulaklığı aç" : "Kulaklığı kapat"} onClick={() => ses.sagirlik(!d.sagir)}>
            <KulaklikIkon acik={!d.sagir} size={18} />
          </button>
          <button className={`btn ikon-btn ${d.ekranPaylasiyorum ? "" : "btn-ghost"}`} disabled={!d.bagli || !d.yayinIzni}
                  title={!d.yayinIzni ? "Bu odada yayın yetkin yok" : d.ekranPaylasiyorum ? "Yayını kapat" : "Ekran yayını aç (ekran / pencere / sekme)"}
                  style={d.ekranPaylasiyorum ? { color: "var(--t-good)", borderColor: "rgba(56,208,127,.5)" } : undefined}
                  onClick={() => ses.ekranPaylas(!d.ekranPaylasiyorum)}>📺</button>
          <button className={`btn ikon-btn ${sag === "ayar" ? "" : "btn-ghost"}`} title="Ses ayarları" onClick={() => setSag(sag === "ayar" ? "oda" : "ayar")}>⚙</button>
          {d.bagli && <button className="btn btn-ghost ikon-btn" title="Odadan ayrıl" style={{ color: "var(--t-bad)" }} onClick={() => ses.ayril()}>✕</button>}
        </div>
      </div>

      {/* Orta: sohbet (ya da ses ayarları) */}
      <div style={{ minHeight: 0, display: "grid", gridTemplateRows: `${d.anonsKonusanlar.length ? "auto " : ""}${d.yayinlar.length ? "minmax(180px, 42%) " : ""}1fr` }}>
        {d.anonsKonusanlar.length > 0 && <div className="anons-serit">📢 {d.anonsKonusanlar.join(", ")} tüm odalara konuşuyor</div>}
        <YayinPaneli yayinlar={d.yayinlar} />
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
            <Avatar src={u.avatar} size={18} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.familyName}</span>
            <span className="faint small">{sinifAdi(u.class)}{u.guild ? ` · ${u.guild}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
