"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Trash2, ChevronUp, ChevronDown, Check } from "lucide-react";
import { Card, Head } from "@/components/app-shell";
import { BDO_CLASSES, getClassIconUrl, hasClassVariants } from "@/lib/classes";

/**
 * Oynayabildiğim diğer karakterler.
 *
 * Ana karakter profilde; burası "bunlarla da gelebilirim" listesi. Sıra
 * öncelik. "Yönetici seçebilir" açıksa parti kuran, o savaş için bu karakteri
 * seçebilir (fazla Shai varsa Guardian'la gel gibi). Kapalıysa yalnızca
 * bilgi olarak görünür. Kaydet ayrı: liste tek parça yazılır.
 */

type Karakter = { class: string; spec: string; pickable: boolean };

export function Karakterlerim({ anaClass }: { anaClass: string }) {
  const [liste, setListe] = useState<Karakter[] | null>(null);
  const [kayitli, setKayitli] = useState<string>("");
  const [ekle, setEkle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/characters").then((r) => (r.ok ? r.json() : []))
      .then((rows: Karakter[]) => { setListe(rows); setKayitli(JSON.stringify(rows)); })
      .catch(() => setListe([]));
  }, []);

  const dirty = liste !== null && JSON.stringify(liste) !== kayitli;

  function guncelle(i: number, p: Partial<Karakter>) {
    setListe((l) => l ? l.map((k, j) => (j === i ? { ...k, ...p } : k)) : l);
  }
  function tasi(i: number, yon: -1 | 1) {
    setListe((l) => {
      if (!l) return l; const j = i + yon; if (j < 0 || j >= l.length) return l;
      const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c;
    });
  }
  function karakterEkle() {
    if (!ekle || !liste) return;
    if (liste.some((k) => k.class === ekle && k.spec === "awakening") ) { setEkle(""); return; }
    setListe([...liste, { class: ekle, spec: "awakening", pickable: true }]);
    setEkle("");
  }
  async function kaydet() {
    if (!liste || !dirty) return;
    setBusy(true);
    try {
      const r = await fetch("/api/user/characters", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characters: liste }) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "Kaydedilemedi.");
      const rows: Karakter[] = await r.json();
      setListe(rows); setKayitli(JSON.stringify(rows)); setMsg("Kaydedildi.");
      setTimeout(() => setMsg(null), 2500);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Card className="overflow-hidden">
      <Head icon={Users} title="Diğer karakterlerim" meta={msg ?? (liste ? `${liste.length} alternatif` : "…")} />
      <div className="p-4 space-y-3">
        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
          Ana karakterin yukarıda. Buraya &quot;bunlarla da gelebilirim&quot; dediklerini ekle; sıra öncelik.
          <b style={{ color: "var(--t-dim)" }}> Yönetici seçebilir</b> açıksa parti kuran kişi o savaş için bu karakteri isteyebilir.
        </p>

        {liste && liste.length === 0 && (
          <p className="text-[12px] py-2 text-center" style={{ color: "var(--t-faint)" }}>Henüz alternatif karakter yok.</p>
        )}

        <div className="space-y-1.5">
          {liste?.map((k, i) => {
            const meta = BDO_CLASSES.find((c) => c.id === k.class);
            const icon = getClassIconUrl(k.class);
            return (
              <div key={`${k.class}-${i}`} className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                   style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                <span className="t-num text-[10px] w-4" style={{ color: "var(--t-faint)" }}>{i + 1}</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {icon ? <img src={icon} alt="" className="w-4 h-4 opacity-80" /> : <span className="w-4" />}
                <span className="text-[12.5px] font-semibold flex-1 truncate">{meta?.name ?? k.class}{k.class === anaClass ? <span className="text-[10px] font-normal ml-1" style={{ color: "var(--t-faint)" }}>(ana class)</span> : null}</span>
                {hasClassVariants(k.class) ? (
                  <select value={k.spec} onChange={(e) => guncelle(i, { spec: e.target.value })}
                          className="h-[26px] px-1.5 rounded-md text-[11px] outline-none"
                          style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)", color: "var(--t-text)" }}>
                    <option value="awakening">Awakening</option>
                    <option value="succession">Succession</option>
                  </select>
                ) : <span className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>tek spec</span>}
                <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none" title="Parti kuran yönetici bu karakteri o savaş için seçebilir"
                       style={{ color: k.pickable ? "var(--t-good)" : "var(--t-faint)" }}>
                  <input type="checkbox" checked={k.pickable} onChange={(e) => guncelle(i, { pickable: e.target.checked })} className="accent-[#e8b451]" />
                  Yönetici seçebilir
                </label>
                <button onClick={() => tasi(i, -1)} disabled={i === 0} className="p-0.5 disabled:opacity-30" title="Öne al"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => tasi(i, 1)} disabled={i === liste.length - 1} className="p-0.5 disabled:opacity-30" title="Arkaya al"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button onClick={() => setListe(liste.filter((_, j) => j !== i))} className="p-0.5" title="Kaldır" style={{ color: "var(--t-bad)" }}><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <select value={ekle} onChange={(e) => setEkle(e.target.value)}
                  className="flex-1 h-[34px] px-2.5 rounded-lg text-[12px] outline-none"
                  style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }}>
            <option value="">Karakter ekle…</option>
            {BDO_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={karakterEkle} disabled={!ekle} className="t-tab !h-[34px]" data-on={!!ekle}>
            <Plus className="w-3.5 h-3.5" /> Ekle
          </button>
        </div>

        <button onClick={kaydet} disabled={!dirty || busy}
                className="t-tab w-full !justify-center !py-2.5" data-on={dirty}
                style={!dirty ? { opacity: 0.5, cursor: "default" } : undefined}>
          {busy ? "Kaydediliyor…" : dirty ? "Karakterleri kaydet" : <><Check className="w-3.5 h-3.5" /> Kayıtlı</>}
        </button>
      </div>
    </Card>
  );
}
