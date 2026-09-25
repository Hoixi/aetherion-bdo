"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio, RefreshCw, CircleDot, CircleCheck, CircleAlert } from "lucide-react";

/**
 * Sunucudaki kill-feed kayıtlarını seçme.
 *
 * Companion savaş sırasında olayları parti parti sunucuya yazıyor; burada
 * önce savaş, sonra o savaşa ait kayıt oturumu seçiliyor ve olaylar
 * sayfa sayfa çekilip haritaya veriliyor.
 *
 * Tek oturum seçtiriyoruz, bilerek: aynı savaşı birden çok kişi kaydetmiş
 * olabilir ve oturumları toplamak kill/ölüm sayılarını şişirir. Kayıtları
 * birleştirmek ayrı bir uzlaştırma işi, burada yapılmıyor.
 *
 * Uçlar yönetici yetkisi istiyor ve sunucuda `ENABLE_COMBAT_SYNC` açık
 * değilse 503 dönüyor; ikisinde de bileşen sessizce kapanıyor, sayfadaki
 * elle yapıştırma yolu çalışmaya devam ediyor.
 */

type Savas = { id: number; title: string; date: string; isAllyWar?: boolean };
type Oturum = {
  id: string; allianceName: string; parserVersion: string;
  startedAt: string; endedAt: string | null; phase: string; lastSeq: number;
  updatedAt: string; uploader: { id: number; familyName: string };
};

/** Olayın harita okuyucusuna verilecek hâli */
type Olay = { mapRow: unknown };

const OLAY_SAYFA_SINIRI = 40; // 40 × 250 = 10.000 olay; oturum sınırı 5.000

export function KayitSecici({ onYukle }: {
  onYukle: (satirlar: unknown[], etiket: string) => void;
}) {
  const [savaslar, setSavaslar] = useState<Savas[] | null>(null);
  const [savasId, setSavasId] = useState<number | "">("");
  const [oturumlar, setOturumlar] = useState<Oturum[] | null>(null);
  const [kapali, setKapali] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/app/war-reports")
      .then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { wars: Savas[] }) => setSavaslar(d.wars ?? []))
      .catch(() => setSavaslar([]));   // yetkisi yok: bileşen görünmez
  }, []);

  const oturumlariGetir = useCallback(async (id: number) => {
    setOturumlar(null); setHata(null); setKapali(false);
    try {
      const r = await fetch(`/api/app/wars/${id}/combat-sessions`);
      if (r.status === 503) { setKapali(true); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Kayıtlar alınamadı.");
      setOturumlar(d.sessions ?? []);
    } catch (e) { setHata((e as Error).message); }
  }, []);

  useEffect(() => { if (savasId !== "") void oturumlariGetir(savasId); }, [savasId, oturumlariGetir]);

  /** Tüm sayfaları sırayla çeker; imleç boşalınca durur */
  async function oturumuAc(o: Oturum) {
    if (savasId === "") return;
    setMesgul(o.id); setHata(null);
    try {
      const satirlar: unknown[] = [];
      let imlec: number | null = 0;
      for (let sayfa = 0; sayfa < OLAY_SAYFA_SINIRI; sayfa++) {
        const r: Response = await fetch(
          `/api/app/wars/${savasId}/combat-sessions/${encodeURIComponent(o.id)}/events?after=${imlec ?? 0}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Olaylar alınamadı.");
        for (const e of (d.events ?? []) as Olay[]) satirlar.push(e.mapRow);
        imlec = d.nextCursor;
        if (imlec == null) break;
      }
      if (satirlar.length === 0) { setHata("Bu kayıtta olay yok."); return; }
      onYukle(satirlar, `${o.allianceName} · ${o.uploader.familyName}`);
    } catch (e) { setHata((e as Error).message); }
    finally { setMesgul(null); }
  }

  if (savaslar !== null && savaslar.length === 0) return null;

  return (
    <div className="p-3 space-y-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
      <div className="flex items-center gap-1.5">
        <Radio className="w-3.5 h-3.5" style={{ color: "var(--t-gold)" }} />
        <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
          Sunucudaki kayıtlar
        </span>
        {savasId !== "" && (
          <button onClick={() => void oturumlariGetir(savasId)} className="t-tab ml-auto" title="Yenile">
            <RefreshCw className="w-3 h-3" />
          </button>
        )}
      </div>

      <select value={savasId} onChange={(e) => setSavasId(e.target.value ? Number(e.target.value) : "")}
              className="w-full h-[32px] px-2 rounded-[var(--t-r-sm)] text-[12px] outline-none"
              style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }}>
        <option value="">Savaş seç…</option>
        {(savaslar ?? []).map((w) => (
          <option key={w.id} value={w.id}>
            {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} · {w.title}
          </option>
        ))}
      </select>

      {kapali && (
        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
          Kill-feed aktarımı sunucuda kapalı (<span className="t-num">ENABLE_COMBAT_SYNC</span>).
        </p>
      )}
      {hata && <p className="text-[11px]" style={{ color: "var(--t-bad)" }}>{hata}</p>}

      {oturumlar?.length === 0 && (
        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>Bu savaşta kayıt yok.</p>
      )}

      {oturumlar?.map((o) => {
        const bitti = !!o.endedAt;
        const bekliyor = !bitti && Date.now() - Date.parse(o.updatedAt) > 10 * 60_000;
        const Ikon = bitti ? CircleCheck : bekliyor ? CircleAlert : CircleDot;
        const renk = bitti ? "var(--t-good)" : bekliyor ? "var(--t-bad)" : "var(--t-gold)";
        return (
          <button key={o.id} onClick={() => void oturumuAc(o)} disabled={!!mesgul}
                  className="w-full text-left px-2 py-1.5 rounded-lg disabled:opacity-60"
                  style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
            <div className="flex items-center gap-1.5">
              <Ikon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: renk }} />
              <span className="text-[12.5px] font-semibold truncate flex-1">{o.allianceName}</span>
              <span className="t-num text-[11px]" style={{ color: "var(--t-gold)" }}>{o.lastSeq}</span>
            </div>
            <div className="text-[10.5px] mt-0.5" style={{ color: "var(--t-faint)" }}>
              {o.uploader.familyName} · {new Date(o.startedAt).toLocaleString("tr-TR", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
              {" · "}
              {mesgul === o.id ? "yükleniyor…"
                : bitti ? `tamamlandı (${o.phase})`
                  : bekliyor ? "yarım kalmış olabilir" : "kayıt sürüyor"}
            </div>
          </button>
        );
      })}

      {oturumlar && oturumlar.length > 1 && (
        <p className="text-[10px]" style={{ color: "var(--t-faint)" }}>
          Aynı savaşı birden çok kişi kaydetmiş; kayıtlar toplanmıyor, tek tek bakılıyor.
        </p>
      )}
    </div>
  );
}
