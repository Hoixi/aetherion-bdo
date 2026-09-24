"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Trash2, Globe, Lock, Link2, Check, FolderOpen } from "lucide-react";

/**
 * Kurulum kaydetme şeridi — kristal ve eser ekranlarının ortak parçası.
 *
 * Kurulumun kendisi zaten adres çubuğundaki kısa kod; burada ona bir ad
 * verip saklıyoruz. "Herkese açık" işaretliyse bütün üyeler listede görüp
 * açabiliyor, kapalıysa yalnızca sahibi. Aynı adla ikinci kez kaydedince
 * üstüne yazılır.
 */

export type KayitliBuild = {
  id: number; kind: string; name: string; code: string; isPublic: boolean; updatedAt: string;
  user: { id: number; familyName: string; class: string };
};

export function BuildKaydet({ kind, code, ad, onAd, onYukle, benId }: {
  kind: "kristal" | "eser" | "build";
  /** Şu anki kurulumun kodu (boşsa kaydedilemez) */
  code: string;
  ad: string;
  onAd: (v: string) => void;
  /** Kayıtlı kurulumu aç */
  onYukle: (b: KayitliBuild) => void;
  benId?: number;
}) {
  const [mine, setMine] = useState<KayitliBuild[]>([]);
  const [shared, setShared] = useState<KayitliBuild[]>([]);
  const [acik, setAcik] = useState(false);
  const [herkese, setHerkese] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const yukle = useCallback(() => {
    fetch(`/api/builds?kind=${kind}`)
      .then((r) => (r.ok ? r.json() : { mine: [], shared: [] }))
      .then((d: { mine: KayitliBuild[]; shared: KayitliBuild[] }) => { setMine(d.mine); setShared(d.shared); })
      .catch(() => {});
  }, [kind]);
  useEffect(yukle, [yukle]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t); }, [msg]);

  async function kaydet() {
    if (!ad.trim()) { setMsg("Önce bir ad yaz."); return; }
    if (!code) { setMsg("Boş kurulum kaydedilmez."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/builds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name: ad.trim(), code, isPublic: herkese }),
      });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Kaydedilemedi.");
      setMsg(herkese ? "Kaydedildi — herkes görebilir." : "Kaydedildi.");
      yukle();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  async function sil(id: number) {
    if (!window.confirm("Bu kayıt silinsin mi?")) return;
    await fetch(`/api/builds?id=${id}`, { method: "DELETE" });
    yukle();
  }

  const kopyala = () => {
    navigator.clipboard?.writeText(window.location.href)
      .then(() => { setKopyalandi(true); setTimeout(() => setKopyalandi(false), 1800); })
      .catch(() => {});
  };

  const satir = (b: KayitliBuild, benim: boolean) => (
    <div key={b.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
         style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      <button onClick={() => { onYukle(b); setHerkese(b.isPublic); setAcik(false); }}
              className="flex-1 min-w-0 text-left">
        <span className="block text-[12.5px] truncate">{b.name}</span>
        <span className="block text-[10.5px] truncate" style={{ color: "var(--t-faint)" }}>
          {benim ? "" : `${b.user.familyName} · `}
          {new Date(b.updatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
        </span>
      </button>
      {b.isPublic
        ? <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--t-good)" }} />
        : <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--t-faint)" }} />}
      {(benim || b.user.id === benId) && (
        <button onClick={() => sil(b.id)} aria-label="Sil" className="shrink-0">
          <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--t-bad)" }} />
        </button>
      )}
    </div>
  );

  return (
    <div className="relative">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <input value={ad} onChange={(e) => onAd(e.target.value)} maxLength={60}
                 placeholder="Kurulum adı (ör. PvP Genel)"
                 className="w-full h-[38px] pl-3 pr-12 rounded-lg text-[13px] outline-none"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 t-num text-[11px]" style={{ color: "var(--t-faint)" }}>
            {ad.length}
          </span>
        </div>

        <button onClick={() => setHerkese((v) => !v)} className="t-tab !h-[38px]" data-on={herkese}
                title={herkese ? "Herkes görebilir" : "Yalnızca sen görebilirsin"}>
          {herkese ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
          {herkese ? "Herkese açık" : "Gizli"}
        </button>

        <button onClick={kaydet} disabled={busy} className="t-tab !h-[38px]" data-on>
          <Save className="w-3.5 h-3.5" /> {busy ? "Kaydediliyor…" : "Kaydet"}
        </button>

        <button onClick={() => setAcik((v) => !v)} className="t-tab !h-[38px]" data-on={acik}>
          <FolderOpen className="w-3.5 h-3.5" /> Kayıtlar
          <span className="t-num" style={{ color: "var(--t-faint)" }}>{mine.length + shared.length}</span>
        </button>

        <button onClick={kopyala} className="t-tab !h-[38px]" title="Bu kurulumun linkini kopyala">
          {kopyalandi ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        </button>

        {msg && <span className="t-chip" style={{ color: "var(--t-gold)" }}>{msg}</span>}
      </div>

      {acik && (
        <div className="absolute right-0 top-[44px] z-30 w-[300px] max-h-[60vh] overflow-y-auto rounded-xl p-2 space-y-2"
             style={{ background: "var(--t-surface)", border: "1px solid var(--t-line-strong)", boxShadow: "0 14px 34px rgba(0,0,0,.6)" }}>
          <div className="text-[10px] uppercase tracking-[0.08em] px-1" style={{ color: "var(--t-faint)" }}>Benim kurulumlarım</div>
          {mine.length === 0 && <p className="text-[11.5px] px-1" style={{ color: "var(--t-faint)" }}>Henüz kayıt yok.</p>}
          {mine.map((b) => satir(b, true))}

          <div className="text-[10px] uppercase tracking-[0.08em] px-1 pt-1" style={{ color: "var(--t-faint)" }}>Klandan paylaşılanlar</div>
          {shared.length === 0 && <p className="text-[11.5px] px-1" style={{ color: "var(--t-faint)" }}>Paylaşılan kurulum yok.</p>}
          {shared.map((b) => satir(b, false))}
        </div>
      )}
    </div>
  );
}
