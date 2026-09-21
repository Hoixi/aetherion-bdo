"use client";

import { useState } from "react";
import { X, Lock } from "lucide-react";
import { BDO_CLASSES, getClassIconUrl, getPortraitUrl, hasClassVariants } from "@/lib/classes";
import type { UserPerfStats } from "@/components/member-chip";
import { LOW_SAMPLE, scoreColor } from "@/components/member-chip";
import { GuvenRozeti, guvenAciklama, type GuvenOzet } from "@/components/guven-rozeti";
import type { WarAttendanceSummary } from "@/app/api/wars/attendance-history/route";
import { displayOf, DISPLAY_META } from "@/lib/attendance";
import { RECENT_WAR_WINDOW } from "@/lib/perf-window";
import type { KarakterBilgi } from "@/app/api/wars/[id]/characters/route";

/**
 * Tam ekran parti kurulumunda sağ panel: tıklanan üyenin her şeyi tek yerde —
 * kimlik, gear, form puanı ve ortalamalar, katılım güvenilirliği, son
 * savaşlar ve bu savaşa hangi karakterle geleceği. Karakter seçimi yalnızca
 * üye bir partideyse ve üyenin izin verdiği seçenekler arasından.
 */

const spesAd = (s: string) => (s === "succession" ? "Succession" : "Awakening");
const fmt = (n: number) => (n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + "M" : n >= 1_000 ? Math.round(n / 1_000) + "K" : String(Math.round(n)));

export function UyeDetay({ user, perf, guven, history, karakter, partyId, secili, onKapat, onKarakter }: {
  user: { id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl?: string; guild?: { tag: string; color: string } | null };
  perf?: UserPerfStats;
  guven?: GuvenOzet | null;
  history?: WarAttendanceSummary[];
  karakter?: KarakterBilgi;
  /** üye şu an bu partide (null = havuzda) */
  partyId: number | null;
  /** partide seçili karakter (override) */
  secili?: { class: string; spec: string } | null;
  onKapat: () => void;
  onKarakter: (secim: { class: string; spec: string } | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const cls = BDO_CLASSES.find((c) => c.id === user.class);
  const etkin = secili ?? karakter?.bildirdi ?? karakter?.ana ?? { class: user.class, spec: "awakening" };
  const portre = getPortraitUrl(etkin.class, etkin.spec);

  // Seçenekler: bildirdiği (varsayılan) → ana → alternatifler; kopyalar atılır
  const secenekler: Array<{ class: string; spec: string; etiket: string; izin: boolean }> = [];
  const ekle = (k: { class: string; spec: string }, etiket: string, izin: boolean) => {
    if (secenekler.some((s) => s.class === k.class && s.spec === k.spec)) return;
    secenekler.push({ ...k, etiket, izin });
  };
  if (karakter) {
    if (karakter.bildirdi) ekle(karakter.bildirdi, "bu savaş için bildirdiği", true);
    ekle(karakter.ana, "ana karakteri", true);
    karakter.alternatifler.forEach((a, i) => ekle(a, `alternatif ${i + 1}`, a.pickable));
  } else {
    ekle({ class: user.class, spec: "awakening" }, "kayıtlı", true);
  }
  const varsayilan = karakter?.bildirdi ?? karakter?.ana ?? secenekler[0];

  async function sec(k: { class: string; spec: string } | null) {
    setBusy(true);
    try { await onKarakter(k); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-bdo-border bg-bdo-surface overflow-hidden">
      <div className="relative p-4 flex items-center gap-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
        {portre
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={portre} alt="" className="w-14 h-14 rounded-xl object-cover object-top" style={{ background: "var(--t-raised)", outline: "1px solid rgba(255,255,255,.12)" }} />
          : <div className="w-14 h-14 rounded-xl" style={{ background: "var(--t-raised)" }} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold truncate">{user.familyName}</span>
            {user.guild && <span className="text-[9px] font-bold tracking-wider" style={{ color: user.guild.color }}>{user.guild.tag}</span>}
          </div>
          <div className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>
            {BDO_CLASSES.find((c) => c.id === etkin.class)?.name ?? etkin.class}{hasClassVariants(etkin.class) ? ` · ${spesAd(etkin.spec)}` : ""}
            {secili && <span className="ml-1.5 text-[10px] font-bold px-1 rounded" style={{ background: "var(--t-gold-soft)", color: "var(--t-gold)" }}>yönetici seçti</span>}
          </div>
          <div className="text-[11px] t-num mt-0.5" style={{ color: "var(--t-faint)" }}>
            {user.ap}/{user.dp} · GS <b style={{ color: "var(--t-gold)" }}>{user.ap + user.dp}</b>
          </div>
        </div>
        <button onClick={onKapat} className="absolute top-2 right-2 p-1 rounded-md hover:bg-bdo-raised" title="Kapat"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[12px]">
        {/* Karakter seçimi */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--t-faint)" }}>Bu savaşa hangi karakterle</div>
          {partyId === null && <p className="text-[11px] mb-1.5" style={{ color: "var(--t-faint)" }}>Partiye alınca buradan karakter seçebilirsin.</p>}
          <div className="space-y-1">
            {secenekler.map((s) => {
              const on = secili ? secili.class === s.class && secili.spec === s.spec : varsayilan && varsayilan.class === s.class && varsayilan.spec === s.spec;
              const icon = getClassIconUrl(s.class);
              const kilit = !s.izin;
              const disabled = busy || partyId === null || kilit;
              return (
                <button key={`${s.class}-${s.spec}`} disabled={disabled}
                        onClick={() => sec(varsayilan && varsayilan.class === s.class && varsayilan.spec === s.spec ? null : { class: s.class, spec: s.spec })}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors disabled:cursor-default"
                        style={{
                          background: on ? "var(--t-gold-soft)" : "var(--t-raised)",
                          border: `1px solid ${on ? "rgba(232,180,81,.5)" : "var(--t-line)"}`,
                          opacity: kilit ? 0.5 : 1,
                        }}
                        title={kilit ? "Üye bu karakter için 'yönetici seçebilir' demedi" : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {icon ? <img src={icon} alt="" className="w-4 h-4" /> : <span className="w-4" />}
                  <span className="font-semibold">{BDO_CLASSES.find((c) => c.id === s.class)?.name ?? s.class}</span>
                  {hasClassVariants(s.class) && <span style={{ color: "var(--t-dim)" }}>{spesAd(s.spec)}</span>}
                  <span className="ml-auto text-[10.5px]" style={{ color: on ? "var(--t-gold)" : "var(--t-faint)" }}>{s.etiket}</span>
                  {kilit && <Lock className="w-3 h-3" style={{ color: "var(--t-faint)" }} />}
                </button>
              );
            })}
          </div>
          {karakter && karakter.alternatifler.length === 0 && (
            <p className="text-[10.5px] mt-1.5" style={{ color: "var(--t-faint)" }}>Profilinde alternatif karakter tanımlamamış.</p>
          )}
        </section>

        {/* Güvenilirlik */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--t-faint)" }}>Katılım güvenilirliği</div>
          <div className="flex items-center gap-2">
            <GuvenRozeti g={guven} />
            <span className="text-[11px]" style={{ color: "var(--t-dim)" }}>{guvenAciklama(guven)}</span>
          </div>
        </section>

        {/* Son savaşlar */}
        {history && history.length > 0 && (
          <section>
            <div className="text-[10px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--t-faint)" }}>Son savaşlar</div>
            <div className="space-y-1">
              {history.map((w) => {
                const st = w.statuses[user.id];
                const d = st ? displayOf(st) : null;
                const meta = d ? DISPLAY_META[d] : null;
                return (
                  <div key={w.warId} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-2 h-2 rounded-full" style={{ background: meta?.color ?? "var(--t-line-strong)" }} />
                    <span className="truncate flex-1" style={{ color: "var(--t-dim)" }}>{w.title}</span>
                    <span style={{ color: "var(--t-faint)" }}>{new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</span>
                    <span className="w-24 text-right" style={{ color: meta?.color ?? "var(--t-faint)" }}>{meta?.label ?? "Katılmadı"}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Form */}
        <section>
          <div className="text-[10px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--t-faint)" }}>Form · son {RECENT_WAR_WINDOW} savaş</div>
          {!perf ? <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>Raporlu savaşı yok.</p> : (
            <>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono font-bold text-[16px]" style={{ color: scoreColor(perf.score), opacity: perf.wars <= LOW_SAMPLE ? 0.6 : 1 }}>{perf.score}</span>
                <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>{perf.wars} savaş{perf.wars <= LOW_SAMPLE ? " · az veri" : ""}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px]">
                {([
                  ["Ort. öldürme", String(perf.avgKills)], ["Ort. ölüm", String(perf.avgDeaths)],
                  ["Öldürme/ölüm", perf.kdr.toFixed(2)], ["Ort. seri", String(perf.avgKillStreak)],
                  ["Ort. hasar", fmt(perf.avgDamage)], ["Ort. alınan", fmt(perf.avgDamageTaken)],
                  ["Ort. kale", perf.avgCastle > 0 ? fmt(perf.avgCastle) : "—"], ["DPS", perf.dps ? fmt(perf.dps) + "/sn" : "—"],
                  ["Ort. iyileştirme", perf.avgHeal > 0 ? fmt(perf.avgHeal) : "—"], ["Ort. CC", perf.avgCc > 0 ? String(perf.avgCc) : "—"],
                  ["En çok öldürme", String(perf.maxKills)], ["En çok hasar", fmt(perf.maxDamage)],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2"><span style={{ color: "var(--t-dim)" }}>{k}</span><span className="font-mono">{v}</span></div>
                ))}
              </div>
            </>
          )}
        </section>

        {cls && karakter && (karakter.ana.class !== user.class) && (
          <p className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>Profil class&apos;ı {BDO_CLASSES.find((c) => c.id === karakter.ana.class)?.name}; bu savaşa {cls.name} ile geleceğini bildirdi.</p>
        )}
      </div>
    </div>
  );
}
