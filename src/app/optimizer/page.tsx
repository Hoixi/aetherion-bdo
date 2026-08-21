"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Zap, MemoryStick, Cpu, XCircle, Settings, Play, Download, Lightbulb,
  RefreshCw, CheckCircle2, X,
} from "lucide-react";
import { getBdoPreset, PRIORITY_OPTIONS } from "@/lib/bdo-cpu-presets";
import { TestShell, Card, Head } from "@/components/app-shell";

/**
 * PC Optimizer.
 *
 * Tarayıcı işletim sistemine dokunamıyor; bütün iş kullanıcının kendi
 * makinesinde çalışan küçük bir agent'ta. Sayfa yalnızca 127.0.0.1:7432
 * ile konuşuyor — agent kapalıysa kurulum yönergesi gösteriliyor.
 */

const AGENT = "http://127.0.0.1:7432";

type StatusData = {
  ok: boolean;
  cpuName: string; cores: number; threads: number;
  totalRamGB: number; freeRamGB: number; usedRamGB: number;
  bdoRunning: boolean; bdoAffinity: number | null; bdoPriority: string | null;
};
type RamData = { ok: boolean; totalGB: number; freeGB: number; usedGB: number; usedPct: number };
type Process = { process: string; pid: number; mem: number };

/** Süreç adları kullanıcıya tanıdık gelsin */
const KNOWN_NAME: Record<string, string> = {
  Discord: "Discord", chrome: "Google Chrome", msedge: "Microsoft Edge",
  OneDrive: "OneDrive", Dropbox: "Dropbox", Spotify: "Spotify", steam: "Steam",
  EpicGamesLauncher: "Epic Games Launcher", Teams: "Microsoft Teams", slack: "Slack",
  AdobeUpdateManager: "Adobe Update Manager", CCleaner64: "CCleaner",
  Zoom: "Zoom", obs64: "OBS Studio",
};

export default function OptimizerPage() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [ram, setRam] = useState<RamData | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const [mask, setMask] = useState<number | null>(null);
  const [priority, setPriority] = useState("High");
  const [bdoPath, setBdoPath] = useState("");
  const [settings, setSettings] = useState(false);

  const [launching, setLaunching] = useState(false);
  const [flushing, setFlushing] = useState(false);
  const [flushResult, setFlushResult] = useState<{ freedGB: string; standbyFlushed: boolean } | null>(null);
  const [applyingMask, setApplyingMask] = useState(false);
  const [applyingPriority, setApplyingPriority] = useState(false);
  const [killing, setKilling] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("bdo-optimizer-path");
    if (saved) setBdoPath(saved);
  }, []);

  function savePath(v: string) {
    setBdoPath(v);
    localStorage.setItem("bdo-optimizer-path", v);
  }

  function flash(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 3500);
  }

  const fetchStatus = useCallback(async () => {
    try {
      const d: StatusData = await (await fetch(`${AGENT}/status`, { signal: AbortSignal.timeout(3000) })).json();
      if (!d.ok) return;
      setStatus(d);
      setOnline(true);
      // İlk açılışta BDO'nun mevcut maskesi, yoksa bütün thread'ler
      setMask((prev) => prev ?? d.bdoAffinity ?? Math.pow(2, d.threads) - 1);
    } catch {
      setOnline(false);
    }
  }, []);

  const fetchRam = useCallback(async () => {
    try {
      const d: RamData = await (await fetch(`${AGENT}/ram`, { signal: AbortSignal.timeout(3000) })).json();
      if (d.ok) setRam(d);
    } catch { /* agent kapalı; durum yoklaması zaten yakalıyor */ }
  }, []);

  const fetchProcesses = useCallback(async () => {
    try {
      const d = await (await fetch(`${AGENT}/processes`, { signal: AbortSignal.timeout(3000) })).json();
      if (d.ok) setProcesses(d.processes || []);
    } catch { /* yukarıdaki gibi */ }
  }, []);

  useEffect(() => {
    fetchStatus(); fetchRam(); fetchProcesses();
    const t = setInterval(() => { fetchStatus(); fetchRam(); }, 5000);
    return () => clearInterval(t);
  }, [fetchStatus, fetchRam, fetchProcesses]);

  async function post(path: string, body?: unknown) {
    const res = await fetch(`${AGENT}${path}`, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  async function flushRam() {
    setFlushing(true);
    setFlushResult(null);
    try {
      const d = await post("/ram/flush");
      if (d.ok) {
        setFlushResult({ freedGB: d.freedGB, standbyFlushed: d.standbyFlushed });
        fetchRam();
        flash(true, `RAM temizlendi — ${d.freedGB} GB serbest bırakıldı.`);
      } else flash(false, d.error || "RAM temizleme başarısız.");
    } catch {
      flash(false, "Agent'a bağlanılamadı.");
    } finally {
      setFlushing(false);
    }
  }

  async function applyMask() {
    if (!mask) return;
    setApplyingMask(true);
    try {
      const d = await post("/affinity", { mask });
      flash(!!d.ok, d.ok ? "CPU affinity uygulandı." : d.error || "Uygulanamadı.");
    } catch {
      flash(false, "Agent'a bağlanılamadı.");
    } finally {
      setApplyingMask(false);
      fetchStatus();
    }
  }

  async function applyPriority() {
    setApplyingPriority(true);
    try {
      const d = await post("/priority", { priority });
      flash(!!d.ok, d.ok ? `Öncelik ${priority} olarak ayarlandı.` : d.error || "Uygulanamadı.");
    } catch {
      flash(false, "Agent'a bağlanılamadı.");
    } finally {
      setApplyingPriority(false);
      fetchStatus();
    }
  }

  async function launch() {
    setLaunching(true);
    try {
      const d = await post("/launch", { path: bdoPath || undefined, affinityMask: mask ?? undefined });
      flash(!!d.ok, d.ok ? d.message || "BDO başlatıldı." : d.error || "Başlatılamadı.");
    } catch {
      flash(false, "Agent'a bağlanılamadı.");
    } finally {
      setLaunching(false);
    }
  }

  async function kill() {
    if (picked.size === 0) return;
    setKilling(true);
    try {
      const d = await post("/processes/kill", { processes: Array.from(picked) });
      if (d.ok) {
        flash(true, `${d.killed.length} uygulama kapatıldı.`);
        setPicked(new Set());
        fetchProcesses();
        fetchRam();
      } else flash(false, d.error || "Kapatma başarısız.");
    } catch {
      flash(false, "Agent'a bağlanılamadı.");
    } finally {
      setKilling(false);
    }
  }

  // ── Agent durumu ─────────────────────────────────────────────────────

  if (online === null) {
    return (
      <TestShell title="PC Optimizer" subtitle="Agent'a bağlanılıyor…">
        <Card className="p-12 text-center">
          <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin" strokeWidth={1.6}
                     style={{ color: "var(--t-faint)" }} />
          <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>
            127.0.0.1:7432 yoklanıyor…
          </span>
        </Card>
      </TestShell>
    );
  }

  if (online === false) return <AgentOffline />;

  const threads = status?.threads ?? 0;
  const allMask = threads > 0 ? Math.pow(2, threads) - 1 : 0;
  const preset = status ? getBdoPreset(status.cpuName) : null;
  const isOn = (i: number) => (mask ? (mask & (1 << i)) !== 0 : true);
  const onCount = threads > 0 ? Array.from({ length: threads }, (_, i) => isOn(i)).filter(Boolean).length : 0;

  return (
    <TestShell
      title="PC Optimizer"
      subtitle="BDO için sistem ayarları — RAM, öncelik, çekirdek dağılımı ve arka plan uygulamaları."
      aside={
        <div className="flex items-center gap-2">
          <span className="t-chip inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${status?.bdoRunning ? "animate-pulse" : ""}`}
                  style={{ background: status?.bdoRunning ? "var(--t-good)" : "var(--t-faint)" }} />
            {status?.bdoRunning ? "BDO çalışıyor" : "BDO kapalı"}
          </span>
          {!status?.bdoRunning && (
            <button onClick={launch} disabled={launching}
                    className="t-chip inline-flex items-center gap-1 disabled:opacity-50"
                    style={{ color: "var(--t-good)", borderColor: "rgba(56,208,127,.35)" }}>
              <Play className="w-3 h-3" /> {launching ? "Başlatılıyor…" : "BDO başlat"}
            </button>
          )}
          <button onClick={() => setSettings((v) => !v)} aria-label="Ayarlar"
                  className="t-chip" style={settings ? { color: "var(--t-gold)" } : undefined}>
            <Settings className="w-3 h-3" />
          </button>
        </div>
      }
    >
      {toast && (
        <div className="fixed top-20 right-5 z-[200] px-4 py-3 rounded-[var(--t-r-sm)] text-[13px] font-medium flex items-center gap-2"
             style={{
               color: toast.ok ? "var(--t-good)" : "var(--t-bad)",
               background: toast.ok ? "rgba(56,208,127,.12)" : "rgba(239,95,95,.12)",
               border: `1px solid ${toast.ok ? "rgba(56,208,127,.3)" : "rgba(239,95,95,.3)"}`,
               boxShadow: "0 12px 32px rgba(0,0,0,.6)",
             }}>
          {toast.ok ? <CheckCircle2 className="w-4 h-4" strokeWidth={2} /> : <XCircle className="w-4 h-4" strokeWidth={2} />}
          {toast.msg}
        </div>
      )}

      {/* ── Ayarlar ────────────────────────────────────────────────── */}
      {settings && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-[14px] font-semibold">Ayarlar</h2>
            <a href="/downloads/bdo-optimizer-agent.zip" download
               className="text-[12px] px-3 h-[30px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5"
               style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                        border: "1px solid rgba(232,180,81,.3)" }}>
              <Download className="w-3 h-3" strokeWidth={2} /> Agent indir (.zip)
            </a>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
              BDO Launcher konumu
            </label>
            <div className="flex gap-2">
              <input value={bdoPath} onChange={(e) => savePath(e.target.value)}
                     placeholder="C:\\Program Files (x86)\\Black Desert Online\\BlackDesert_Launcher.exe"
                     className="t-num flex-1 h-[34px] px-3 rounded-[var(--t-r-sm)] text-[12px] outline-none"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                              color: "var(--t-text)" }} />
              {bdoPath && (
                <button onClick={() => savePath("")} aria-label="Temizle"
                        className="px-2.5 rounded-[var(--t-r-sm)]"
                        style={{ color: "var(--t-faint)", border: "1px solid var(--t-line)" }}>
                  <X className="w-3.5 h-3.5" strokeWidth={2.2} />
                </button>
              )}
            </div>
            <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
              Boş bırakırsan varsayılan yol kullanılır.
            </p>
          </div>
        </Card>
      )}

      {/* ── CPU künyesi ────────────────────────────────────────────── */}
      {status && (
        <Card className="p-4 flex flex-wrap gap-6 text-[13px]">
          <div>
            <span className="block text-[11px] mb-0.5" style={{ color: "var(--t-faint)" }}>CPU</span>
            <span className="font-medium">{status.cpuName}</span>
          </div>
          <div>
            <span className="block text-[11px] mb-0.5" style={{ color: "var(--t-faint)" }}>Çekirdek</span>
            <span className="t-num font-medium">{status.cores}C / {status.threads}T</span>
          </div>
          {status.bdoRunning && status.bdoPriority && (
            <div>
              <span className="block text-[11px] mb-0.5" style={{ color: "var(--t-faint)" }}>BDO önceliği</span>
              <span className="font-medium" style={{ color: "var(--t-gold)" }}>{status.bdoPriority}</span>
            </div>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* ── RAM ──────────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <Head icon={MemoryStick} title="RAM Optimize" />
          <div className="p-4 space-y-3.5">
            {ram && (
              <div className="space-y-2">
                <div className="flex justify-between text-[13px]">
                  <span style={{ color: "var(--t-dim)" }}>Kullanım</span>
                  <span className="t-num font-medium">
                    {ram.usedGB} GB / {ram.totalGB} GB
                    <span style={{ color: "var(--t-faint)" }}> ({ram.usedPct}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--t-raised)" }}>
                  <div className="h-full transition-all duration-500"
                       style={{
                         width: `${ram.usedPct}%`,
                         background: ram.usedPct > 85 ? "var(--t-bad)"
                           : ram.usedPct > 65 ? "var(--t-gold)" : "var(--t-good)",
                       }} />
                </div>
                <div className="t-num text-[11px]" style={{ color: "var(--t-faint)" }}>{ram.freeGB} GB boş</div>
              </div>
            )}

            {flushResult && (
              <div className="text-[11.5px] px-3 py-2 rounded-[var(--t-r-sm)]"
                   style={{ color: "var(--t-good)", background: "rgba(56,208,127,.10)",
                            border: "1px solid rgba(56,208,127,.25)" }}>
                {flushResult.freedGB} GB serbest bırakıldı
                {flushResult.standbyFlushed && " · Standby listesi temizlendi"}
              </div>
            )}

            <ActionButton onClick={flushRam} busy={flushing} tone="#6b93ff">
              {flushing ? "Temizleniyor…" : "RAM temizle"}
            </ActionButton>

            <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--t-faint)" }}>
              Working set&apos;leri küçültür ve standby listesini temizler. Sürekli otomatik
              temizlik için{" "}
              <span className="font-medium" style={{ color: "var(--t-gold)" }}>ISLC</span>{" "}
              (Intelligent Standby List Cleaner) kullanabilirsin.
            </p>
          </div>
        </Card>

        {/* ── Öncelik ──────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <Head icon={Zap} title="Process Önceliği" />
          <div className="p-4 space-y-3.5">
            <div className="space-y-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <span className="w-4 h-4 rounded-full grid place-items-center flex-shrink-0"
                        style={{ border: `2px solid ${priority === opt.value ? "var(--t-gold)" : "var(--t-line-strong)"}` }}>
                    {priority === opt.value && (
                      <span className="w-2 h-2 rounded-full" style={{ background: "var(--t-gold)" }} />
                    )}
                  </span>
                  <input type="radio" className="sr-only" value={opt.value}
                         checked={priority === opt.value} onChange={() => setPriority(opt.value)} />
                  <span className="text-[13px]" style={{ color: opt.color }}>{opt.label}</span>
                </label>
              ))}
            </div>

            <ActionButton onClick={applyPriority} busy={applyingPriority}
                          disabled={!status?.bdoRunning} tone="#e8b451">
              {applyingPriority ? "Uygulanıyor…" : "BDO'ya uygula"}
            </ActionButton>

            {!status?.bdoRunning && (
              <p className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                BDO çalışır durumda olmalı.
              </p>
            )}
          </div>
        </Card>

        {/* ── CPU affinity ─────────────────────────────────────────── */}
        <Card className="md:col-span-2 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <Cpu className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
            <h2 className="text-[14px] font-semibold">CPU Affinity</h2>
            <span className="t-chip ml-auto">{onCount} / {threads} THREAD</span>
          </div>

          <div className="p-4 space-y-3.5">
            {preset && preset.mask > 0 && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-[var(--t-r-sm)]"
                   style={{ background: "var(--t-gold-soft)", border: "1px solid rgba(232,180,81,.3)" }}>
                <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-semibold mb-0.5" style={{ color: "var(--t-gold)" }}>
                    ACanadianDude rehberi — {preset.label}
                  </p>
                  <p className="text-[11.5px]" style={{ color: "var(--t-dim)" }}>{preset.note}</p>
                  <p className="text-[11.5px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                    Aktif thread&apos;ler:{" "}
                    <span className="t-num">{preset.enabledThreads.join(", ")}</span>
                  </p>
                </div>
                <button onClick={() => setMask(preset.mask)}
                        className="text-[11.5px] font-medium px-3 h-[28px] rounded-[var(--t-r-sm)] flex-shrink-0"
                        style={{ color: "var(--t-gold)", background: "rgba(232,180,81,.18)",
                                 border: "1px solid rgba(232,180,81,.4)" }}>
                  Uygula
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Chip onClick={() => setMask(allMask)}>Tümü</Chip>
              {threads >= 4 && (
                <Chip onClick={() => setMask((1 << Math.ceil(threads / 2)) - 1)}>
                  İlk {Math.ceil(threads / 2)} thread
                </Chip>
              )}
              {threads >= 8 && (
                <Chip onClick={() => {
                  let m = 0;
                  for (let i = 0; i < threads; i += 2) m |= 1 << i;
                  setMask(m);
                }}>
                  Çift thread (SMT kapat)
                </Chip>
              )}
            </div>

            {threads > 0 && (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: threads }, (_, i) => {
                  const on = isOn(i);
                  return (
                    <button key={i}
                            onClick={() => {
                              if (!mask) return;
                              const next = mask ^ (1 << i);
                              // Boş maske süreci öldürür; en az bir thread kalmalı
                              if (next > 0) setMask(next);
                            }}
                            className="t-num w-10 h-10 rounded-[var(--t-r-sm)] text-[12px] font-bold transition-colors"
                            style={on
                              ? { color: "#c8a4ff", background: "rgba(168,85,247,.18)",
                                  border: "1px solid rgba(168,85,247,.55)" }
                              : { color: "var(--t-faint)", background: "var(--t-raised)",
                                  border: "1px solid var(--t-line)" }}>
                      {i}
                    </button>
                  );
                })}
              </div>
            )}

            <div>
              <ActionButton onClick={applyMask} busy={applyingMask}
                            disabled={!status?.bdoRunning} tone="#a855f7" inline>
                {applyingMask ? "Uygulanıyor…" : "BDO'ya uygula"}
              </ActionButton>
            </div>

            <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--t-faint)" }}>
              Intel 12. nesil ve sonrasında E-core&apos;ları hariç tutmak FPS kararlılığını
              artırabilir. Çalışan BDO sürecine anında uygulanır.
            </p>
          </div>
        </Card>

        {/* ── Arka plan uygulamaları ───────────────────────────────── */}
        <Card className="md:col-span-2 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <XCircle className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
            <h2 className="text-[14px] font-semibold">Arka Plan Uygulamaları</h2>
            <button onClick={fetchProcesses}
                    className="ml-auto text-[11.5px] inline-flex items-center gap-1 transition-colors hover:opacity-80"
                    style={{ color: "var(--t-faint)" }}>
              <RefreshCw className="w-3 h-3" strokeWidth={2} /> Yenile
            </button>
          </div>

          {processes.length === 0 ? (
            <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-faint)" }}>
              Kapatılabilecek bilinen uygulama bulunamadı.
            </p>
          ) : (
            <>
              <div>
                {processes.map((p) => {
                  const on = picked.has(p.process);
                  return (
                    <label key={p.process} className="t-row px-5 py-2.5 flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={on}
                             onChange={() => setPicked((prev) => {
                               const next = new Set(prev);
                               if (on) next.delete(p.process); else next.add(p.process);
                               return next;
                             })}
                             className="w-4 h-4" style={{ accentColor: "#ef5f5f" }} />
                      <span className="flex-1 text-[13px]">{KNOWN_NAME[p.process] ?? p.process}</span>
                      <span className="t-num text-[11.5px]" style={{ color: "var(--t-faint)" }}>{p.mem} MB</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 px-5 py-3" style={{ borderTop: "1px solid var(--t-line)" }}>
                <button onClick={() => setPicked(new Set(processes.map((p) => p.process)))}
                        className="text-[11.5px] transition-colors hover:opacity-80" style={{ color: "var(--t-faint)" }}>
                  Tümünü seç
                </button>
                <button onClick={() => setPicked(new Set())}
                        className="text-[11.5px] transition-colors hover:opacity-80" style={{ color: "var(--t-faint)" }}>
                  Temizle
                </button>
                <div className="flex-1" />
                <button onClick={kill} disabled={picked.size === 0 || killing}
                        className="text-[12.5px] font-semibold px-4 h-[34px] rounded-[var(--t-r-sm)] disabled:opacity-40"
                        style={{ color: "var(--t-bad)", background: "rgba(239,95,95,.12)",
                                 border: "1px solid rgba(239,95,95,.3)" }}>
                  {killing ? "Kapatılıyor…" : `${picked.size} uygulamayı kapat`}
                </button>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="pb-6" />
    </TestShell>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function ActionButton({ onClick, busy, disabled, tone, inline, children }: {
  onClick: () => void; busy?: boolean; disabled?: boolean;
  tone: string; inline?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={busy || disabled}
            className={`${inline ? "px-5" : "w-full"} h-[38px] rounded-[var(--t-r-sm)] text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40`}
            style={{ color: tone, background: tone + "1f", border: `1px solid ${tone}4d` }}>
      {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />}
      {children}
    </button>
  );
}

function Chip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
            className="text-[11.5px] px-3 h-[30px] rounded-[var(--t-r-sm)] transition-colors"
            style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      {children}
    </button>
  );
}

function AgentOffline() {
  return (
    <TestShell title="PC Optimizer" subtitle="Agent çalışmıyor">
      <div className="max-w-lg mx-auto text-center space-y-6 py-6">
        <div className="w-16 h-16 rounded-full grid place-items-center mx-auto"
             style={{ background: "rgba(239,95,95,.10)", border: "1px solid rgba(239,95,95,.3)" }}>
          <Zap className="w-7 h-7" strokeWidth={1.8} style={{ color: "var(--t-bad)" }} />
        </div>

        <div>
          <h2 className="text-[19px] font-bold mb-2">Agent çalışmıyor</h2>
          <p className="text-[13px]" style={{ color: "var(--t-dim)" }}>
            PC Optimizer&apos;ı kullanmak için bilgisayarında küçük bir agent&apos;ın açık olması gerekiyor.
          </p>
        </div>

        <Card className="p-5 text-left space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[13px] font-semibold">Nasıl kurulur?</p>
            <a href="/downloads/bdo-optimizer-agent.zip" download
               className="text-[12px] px-3 h-[30px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5"
               style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                        border: "1px solid rgba(232,180,81,.35)" }}>
              <Download className="w-3 h-3" strokeWidth={2} /> Agent indir (.zip)
            </a>
          </div>

          <ol className="space-y-2 text-[13px] list-decimal list-inside" style={{ color: "var(--t-dim)" }}>
            <li>Yukarıdaki bağlantıdan zip&apos;i indir ve bir klasöre çıkar</li>
            <li>
              <code className="t-num text-[11.5px] px-1.5 py-0.5 rounded"
                    style={{ color: "var(--t-gold)", background: "var(--t-canvas)" }}>
                BDO-Optimizer-Agent.exe
              </code>{" "}
              dosyasına çift tıkla
            </li>
            <li>Komut penceresi açık kalsın — sonra bu sayfayı yenile</li>
          </ol>

          <p className="text-[11.5px] pt-1" style={{ color: "var(--t-faint)", borderTop: "1px solid var(--t-line)" }}>
            Kurulum gerekmez. Agent yalnızca{" "}
            <code className="t-num px-1 rounded" style={{ background: "var(--t-canvas)" }}>127.0.0.1:7432</code>
            &apos;de dinler, internete açılmaz.
          </p>
        </Card>
      </div>
    </TestShell>
  );
}
