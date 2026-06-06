"use client";

import { useState, useEffect, useCallback } from "react";

const AGENT = "http://127.0.0.1:7432";

// ACanadianDude's Ultimate BDO Performance Guide — CPU affinity presets
// Masks are decimal equivalents of hex values from the guide.
// Logic: disable core 0 (for Windows headroom) + disable SMT siblings, keep physical cores only.
const BDO_CPU_PRESETS: { match: RegExp; label: string; mask: number; enabledThreads: number[]; note: string }[] = [
  {
    match: /Ryzen [35] (3500)/i,
    label: "Ryzen 5 3500(X)",
    mask: 0,  // no change needed (6c/6t, no SMT)
    enabledThreads: [],
    note: "Değişiklik gerekmiyor (SMT yok).",
  },
  {
    match: /Ryzen 5 (1[46]00|2[46]00|25[0-9]{2}X|3[46]00|5[56]00|7[56]00)/i,
    label: "Ryzen 5 6c/12t",
    mask: 0x555,   // 1365
    enabledThreads: [0, 2, 4, 6, 8, 10],
    note: "6 fiziksel çekirdek, SMT kapalı. Maske: 555",
  },
  {
    match: /Ryzen 5 (1[45]00X?|2[45]00[GX]?|3[45]00[GX]?)/i,
    label: "Ryzen 5 4c/8t",
    mask: 0x50,    // 80
    enabledThreads: [4, 6],
    note: "4c/8t için en iyi CCX'i izole et. Maske: 50",
  },
  {
    match: /Ryzen 3 (1[23]00X?|2200[GE]?|3200[GE]?)/i,
    label: "Ryzen 3 4c/4t",
    mask: 0xC,     // 12
    enabledThreads: [2, 3],
    note: "Çok az çekirdek, sonuç değişebilir. Maske: C",
  },
  {
    match: /Ryzen 7 (1[78]00X?|2700X?)/i,
    label: "Ryzen 7 8c/16t (Zen 1)",
    mask: 0x5500,  // 21760
    enabledThreads: [8, 10, 12, 14],
    note: "2 CCX, 4c her biri. Bir CCX'i izole et. Maske: 5500",
  },
  {
    match: /Ryzen 7 (3700X?|3800X)/i,
    label: "Ryzen 7 8c/16t (Zen 2)",
    mask: 0x5550,  // 21840
    enabledThreads: [4, 6, 8, 10, 12, 14],
    note: "6 fiziksel çekirdek, SMT kapalı. Maske: 5550",
  },
  {
    match: /Ryzen 7 (5800X3D?|7800X3D?)/i,
    label: "Ryzen 7 8c/16t (Zen 3/4, 1 CCX)",
    mask: 0x5554,  // 21844
    enabledThreads: [2, 4, 6, 8, 10, 12, 14],
    note: "Core 0 Windows'a ayrılır, SMT kapalı. Maske: 5554",
  },
  {
    match: /Ryzen 9 7900X3D/i,
    label: "Ryzen 9 7900X3D",
    mask: 0x555,   // 1365 — X3D CCD'yi izole et
    enabledThreads: [0, 2, 4, 6, 8, 10],
    note: "Sadece X3D CCD. SMT kapalı. Maske: 555",
  },
  {
    match: /Ryzen 9 (3900X?|5900X?|7900X?)/i,
    label: "Ryzen 9 12c/24t",
    mask: 0x555000, // 5591040 — tek chiplet izolasyonu
    enabledThreads: [12, 14, 16, 18, 20, 22],
    note: "Bir chiplet'e izole et. SMT kapalı. Maske: 555000",
  },
  {
    match: /Ryzen 9 7950X3D/i,
    label: "Ryzen 9 7950X3D",
    mask: 0x5555,  // 21845 — X3D CCD
    enabledThreads: [0, 2, 4, 6, 8, 10, 12, 14],
    note: "Sadece X3D CCD. SMT kapalı. Maske: 5555",
  },
  {
    match: /Ryzen 9 (3950X?|5950X?|7950X?)/i,
    label: "Ryzen 9 16c/32t",
    mask: 0x5550000, // bir chiplet, 6 core
    enabledThreads: [16, 18, 20, 22, 24, 26],
    note: "Bir chiplet'e izole et. SMT kapalı. Maske: 5550000",
  },
];

function getBdoPreset(cpuName: string) {
  for (const preset of BDO_CPU_PRESETS) {
    if (preset.match.test(cpuName)) return preset;
  }
  return null;
}

const PRIORITY_OPTIONS = [
  { value: "Normal", label: "Normal", color: "text-gray-400" },
  { value: "AboveNormal", label: "Normalin Üstü", color: "text-blue-400" },
  { value: "High", label: "Yüksek (Önerilen)", color: "text-yellow-400" },
];

interface StatusData {
  ok: boolean;
  cpuName: string;
  cores: number;
  threads: number;
  totalRamGB: number;
  freeRamGB: number;
  usedRamGB: number;
  bdoRunning: boolean;
  bdoAffinity: number | null;
  bdoPriority: string | null;
}

interface RamData {
  ok: boolean;
  totalGB: number;
  freeGB: number;
  usedGB: number;
  usedPct: number;
}

interface Process {
  process: string;
  pid: number;
  mem: number;
}

const KNOWN_DISPLAY: Record<string, string> = {
  Discord: "Discord",
  chrome: "Google Chrome",
  msedge: "Microsoft Edge",
  OneDrive: "OneDrive",
  Dropbox: "Dropbox",
  Spotify: "Spotify",
  steam: "Steam",
  EpicGamesLauncher: "Epic Games Launcher",
  Teams: "Microsoft Teams",
  slack: "Slack",
  AdobeUpdateManager: "Adobe Update Manager",
  CCleaner64: "CCleaner",
  Zoom: "Zoom",
  obs64: "OBS Studio",
};

function AgentOffline() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-bold text-bdo-text-primary mb-2">Agent Çalışmıyor</h2>
        <p className="text-bdo-text-muted text-sm max-w-sm">
          PC Optimizer'ı kullanmak için bilgisayarında local agent'ı çalıştırman gerekiyor.
        </p>
      </div>
      <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 text-left max-w-md w-full space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-bdo-text-primary">Nasıl kurulur?</p>
          <a
            href="/downloads/bdo-optimizer-agent.zip"
            download
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bdo-gold/20 border border-bdo-gold/40 text-bdo-gold hover:bg-bdo-gold/30 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Agent İndir (.zip)
          </a>
        </div>
        <ol className="space-y-2 text-sm text-bdo-text-muted list-decimal list-inside">
          <li>Yukarıdaki butona tıklayarak zip'i indir ve bir klasöre çıkart</li>
          <li>
            <code className="text-bdo-gold text-xs bg-bdo-bg px-1.5 py-0.5 rounded">BDO-Optimizer-Agent.exe</code>{" "}
            dosyasına çift tıkla
          </li>
          <li>Komut penceresi açık kalsın — bu sayfayı yenile</li>
        </ol>
        <div className="pt-1 border-t border-bdo-border">
          <p className="text-xs text-bdo-text-muted">
            Kurulum gerekmez. Agent yalnızca{" "}
            <code className="text-xs bg-bdo-bg px-1 rounded">127.0.0.1:7432</code>'de çalışır, internete açılmaz.
          </p>
        </div>
      </div>
    </div>
  );
}

function RamBar({ pct }: { pct: number }) {
  const color = pct > 85 ? "bg-red-500" : pct > 65 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="h-2 bg-bdo-bg rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function OptimizerPage() {
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [status, setStatus] = useState<StatusData | null>(null);
  const [ram, setRam] = useState<RamData | null>(null);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<Set<string>>(new Set());

  const [affinityMask, setAffinityMask] = useState<number | null>(null);
  const [selectedPriority, setSelectedPriority] = useState("High");
  const [bdoPath, setBdoPath] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [launching, setLaunching] = useState(false);

  const [ramFlushing, setRamFlushing] = useState(false);
  const [ramFlushResult, setRamFlushResult] = useState<{ freedGB: string; standbyFlushed: boolean } | null>(null);

  const [applyingAffinity, setApplyingAffinity] = useState(false);
  const [applyingPriority, setApplyingPriority] = useState(false);
  const [killingProcesses, setKillingProcesses] = useState(false);

  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

  // Load saved BDO path from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bdo-optimizer-path");
    if (saved) setBdoPath(saved);
  }, []);

  const saveBdoPath = (val: string) => {
    setBdoPath(val);
    localStorage.setItem("bdo-optimizer-path", val);
  };

  const showFeedback = (type: "ok" | "err", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${AGENT}/status`, { signal: AbortSignal.timeout(3000) });
      const d: StatusData = await r.json();
      if (d.ok) {
        setStatus(d);
        setAgentOnline(true);
        if (affinityMask === null) {
          setAffinityMask(d.bdoAffinity ?? (Math.pow(2, d.threads) - 1));
        }
      }
    } catch {
      setAgentOnline(false);
    }
  }, [affinityMask]);

  const fetchRam = useCallback(async () => {
    try {
      const r = await fetch(`${AGENT}/ram`, { signal: AbortSignal.timeout(3000) });
      const d: RamData = await r.json();
      if (d.ok) setRam(d);
    } catch {}
  }, []);

  const fetchProcesses = useCallback(async () => {
    try {
      const r = await fetch(`${AGENT}/processes`, { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      if (d.ok) setProcesses(d.processes || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchRam();
    fetchProcesses();
    const t = setInterval(() => {
      fetchStatus();
      fetchRam();
    }, 5000);
    return () => clearInterval(t);
  }, [fetchStatus, fetchRam, fetchProcesses]);

  const allCores = status?.threads ?? 0;
  const allMask = allCores > 0 ? Math.pow(2, allCores) - 1 : 0;
  const bdoPreset = status ? getBdoPreset(status.cpuName) : null;

  const toggleCore = (i: number) => {
    if (!affinityMask) return;
    const bit = 1 << i;
    const newMask = affinityMask ^ bit;
    // Don't allow empty mask
    if (newMask > 0) setAffinityMask(newMask);
  };

  const isCoreSelected = (i: number) => {
    if (!affinityMask) return true;
    return (affinityMask & (1 << i)) !== 0;
  };

  const selectedCoreCount = allCores > 0
    ? Array.from({ length: allCores }, (_, i) => isCoreSelected(i)).filter(Boolean).length
    : 0;

  const handleFlushRam = async () => {
    setRamFlushing(true);
    setRamFlushResult(null);
    try {
      const r = await fetch(`${AGENT}/ram/flush`, { method: "POST" });
      const d = await r.json();
      if (d.ok) {
        setRamFlushResult({ freedGB: d.freedGB, standbyFlushed: d.standbyFlushed });
        fetchRam();
        showFeedback("ok", `RAM temizlendi — ${d.freedGB} GB serbest bırakıldı`);
      } else {
        showFeedback("err", d.error || "RAM temizleme başarısız");
      }
    } catch {
      showFeedback("err", "Agent'a bağlanılamadı");
    } finally {
      setRamFlushing(false);
    }
  };

  const handleApplyAffinity = async () => {
    if (!affinityMask) return;
    setApplyingAffinity(true);
    try {
      const r = await fetch(`${AGENT}/affinity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mask: affinityMask }),
      });
      const d = await r.json();
      if (d.ok) showFeedback("ok", "CPU Affinity uygulandı");
      else showFeedback("err", d.error || "Uygulanamadı");
    } catch {
      showFeedback("err", "Agent'a bağlanılamadı");
    } finally {
      setApplyingAffinity(false);
      fetchStatus();
    }
  };

  const handleApplyPriority = async () => {
    setApplyingPriority(true);
    try {
      const r = await fetch(`${AGENT}/priority`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: selectedPriority }),
      });
      const d = await r.json();
      if (d.ok) showFeedback("ok", `Öncelik ${selectedPriority} olarak ayarlandı`);
      else showFeedback("err", d.error || "Uygulanamadı");
    } catch {
      showFeedback("err", "Agent'a bağlanılamadı");
    } finally {
      setApplyingPriority(false);
      fetchStatus();
    }
  };

  const handleLaunch = async () => {
    setLaunching(true);
    try {
      const r = await fetch(`${AGENT}/launch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: bdoPath || undefined }),
      });
      const d = await r.json();
      if (d.ok) showFeedback("ok", d.message || "BDO başlatıldı");
      else showFeedback("err", d.error || "Başlatılamadı");
    } catch {
      showFeedback("err", "Agent'a bağlanılamadı");
    } finally {
      setLaunching(false);
    }
  };

  const handleKillProcesses = async () => {
    if (selectedProcesses.size === 0) return;
    setKillingProcesses(true);
    try {
      const r = await fetch(`${AGENT}/processes/kill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processes: Array.from(selectedProcesses) }),
      });
      const d = await r.json();
      if (d.ok) {
        showFeedback("ok", `${d.killed.length} uygulama kapatıldı`);
        setSelectedProcesses(new Set());
        fetchProcesses();
        fetchRam();
      } else {
        showFeedback("err", d.error || "Kapatma başarısız");
      }
    } catch {
      showFeedback("err", "Agent'a bağlanılamadı");
    } finally {
      setKillingProcesses(false);
    }
  };

  if (agentOnline === false) return <AgentOffline />;
  if (agentOnline === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 text-bdo-text-muted">
          <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
          <span className="text-sm">Agent'a bağlanılıyor…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Feedback toast */}
      {feedback && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg border transition-all ${
          feedback.type === "ok"
            ? "bg-green-900/80 border-green-700 text-green-300"
            : "bg-red-900/80 border-red-700 text-red-300"
        }`}>
          {feedback.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-bdo-text-primary">PC Optimizer</h1>
          <p className="text-sm text-bdo-text-muted mt-0.5">BDO için sistem optimizasyonu</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={`w-2 h-2 rounded-full ${status?.bdoRunning ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
          <span className="text-sm text-bdo-text-muted mr-1">
            {status?.bdoRunning ? "BDO Çalışıyor" : "BDO Kapalı"}
          </span>
          {!status?.bdoRunning && (
            <button
              onClick={handleLaunch}
              disabled={launching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700/80 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {launching ? "Başlatılıyor…" : "BDO Başlat"}
            </button>
          )}
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`p-1.5 rounded-lg border transition-colors ${showSettings ? "border-bdo-gold text-bdo-gold bg-bdo-gold/10" : "border-bdo-border text-bdo-text-muted hover:border-bdo-gold hover:text-bdo-gold"}`}
            title="Ayarlar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-bdo-text-primary">Ayarlar</p>
            <a
              href="/downloads/bdo-optimizer-agent.zip"
              download
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-bdo-gold/10 border border-bdo-gold/30 text-bdo-gold hover:bg-bdo-gold/20 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Agent İndir (.zip)
            </a>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-bdo-text-muted font-medium">BDO Launcher Konumu</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={bdoPath}
                onChange={(e) => saveBdoPath(e.target.value)}
                placeholder="C:\Program Files (x86)\Black Desert Online\BlackDesert_Launcher.exe"
                className="flex-1 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary placeholder:text-bdo-text-muted focus:outline-none focus:border-bdo-gold transition-colors font-mono text-xs"
              />
              {bdoPath && (
                <button
                  onClick={() => saveBdoPath("")}
                  className="px-2.5 py-2 rounded-lg border border-bdo-border text-bdo-text-muted hover:text-red-400 hover:border-red-400/30 transition-colors text-xs"
                  title="Temizle"
                >
                  ✕
                </button>
              )}
            </div>
            <p className="text-xs text-bdo-text-muted">
              Boş bırakırsan varsayılan yol kullanılır:{" "}
              <code className="text-[11px] bg-bdo-bg px-1 rounded">…\Black Desert Online\BlackDesert_Launcher.exe</code>
            </p>
          </div>
        </div>
      )}

      {/* CPU info card */}
      {status && (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-bdo-text-muted block text-xs mb-0.5">CPU</span>
            <span className="text-bdo-text-primary font-medium">{status.cpuName}</span>
          </div>
          <div>
            <span className="text-bdo-text-muted block text-xs mb-0.5">Çekirdek</span>
            <span className="text-bdo-text-primary font-medium">{status.cores}C / {status.threads}T</span>
          </div>
          {status.bdoRunning && status.bdoPriority && (
            <div>
              <span className="text-bdo-text-muted block text-xs mb-0.5">BDO Önceliği</span>
              <span className="text-yellow-400 font-medium">{status.bdoPriority}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* RAM Optimizer */}
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" />
              </svg>
            </div>
            <span className="font-semibold text-bdo-text-primary">RAM Optimize</span>
          </div>

          {ram && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-bdo-text-muted">Kullanım</span>
                <span className="text-bdo-text-primary font-medium">
                  {ram.usedGB} GB / {ram.totalGB} GB
                  <span className="text-bdo-text-muted ml-1">({ram.usedPct}%)</span>
                </span>
              </div>
              <RamBar pct={ram.usedPct} />
              <div className="text-xs text-bdo-text-muted">{ram.freeGB} GB boş</div>
            </div>
          )}

          {ramFlushResult && (
            <div className="text-xs bg-green-900/20 border border-green-700/30 rounded-lg px-3 py-2 text-green-400">
              ✓ {ramFlushResult.freedGB} GB serbest bırakıldı
              {ramFlushResult.standbyFlushed && " · Standby listesi temizlendi"}
            </div>
          )}

          <button
            onClick={handleFlushRam}
            disabled={ramFlushing}
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {ramFlushing ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Temizleniyor…
              </>
            ) : (
              "RAM Temizle"
            )}
          </button>
          <p className="text-xs text-bdo-text-muted">
            Working set'leri küçültür ve standby listesini temizler. Daha güçlü otomatik temizlik için{" "}
            <span className="text-bdo-gold font-medium">ISLC (Intelligent Standby List Cleaner)</span>{" "}
            uygulamasını kullanabilirsin — boş RAM 2000 MB altına düştüğünde otomatik temizler.
          </p>
        </div>

        {/* Process Priority */}
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-bdo-text-primary">Process Önceliği</span>
          </div>

          <div className="space-y-2">
            {PRIORITY_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedPriority === opt.value ? "border-bdo-gold" : "border-bdo-border"
                }`}>
                  {selectedPriority === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-bdo-gold" />
                  )}
                </div>
                <input
                  type="radio"
                  className="sr-only"
                  value={opt.value}
                  checked={selectedPriority === opt.value}
                  onChange={() => setSelectedPriority(opt.value)}
                />
                <span className={`text-sm ${opt.color}`}>{opt.label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={handleApplyPriority}
            disabled={applyingPriority || !status?.bdoRunning}
            className="w-full py-2.5 px-4 rounded-lg bg-yellow-600/80 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {applyingPriority ? "Uygulanıyor…" : "BDO'ya Uygula"}
          </button>
          {!status?.bdoRunning && (
            <p className="text-xs text-bdo-text-muted">BDO çalışır durumda olmalı.</p>
          )}
        </div>

        {/* CPU Affinity */}
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="font-semibold text-bdo-text-primary">CPU Affinity</span>
            </div>
            <span className="text-xs text-bdo-text-muted">{selectedCoreCount} / {allCores} thread seçili</span>
          </div>

          {/* BDO recommended preset banner */}
          {bdoPreset && bdoPreset.mask > 0 && (
            <div className="flex items-start gap-3 bg-bdo-gold/5 border border-bdo-gold/30 rounded-lg px-4 py-3">
              <svg className="w-4 h-4 text-bdo-gold mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-bdo-gold mb-0.5">ACanadianDude Rehberi — {bdoPreset.label}</p>
                <p className="text-xs text-bdo-text-muted">{bdoPreset.note}</p>
                <p className="text-xs text-bdo-text-muted mt-0.5">
                  Aktif thread'ler: <span className="text-bdo-text-secondary font-mono">{bdoPreset.enabledThreads.join(", ")}</span>
                </p>
              </div>
              <button
                onClick={() => setAffinityMask(bdoPreset.mask)}
                className="text-xs px-3 py-1.5 rounded-lg bg-bdo-gold/20 border border-bdo-gold/40 text-bdo-gold hover:bg-bdo-gold/30 transition-colors flex-shrink-0 font-medium"
              >
                Uygula
              </button>
            </div>
          )}

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAffinityMask(allMask)}
              className="text-xs px-3 py-1.5 rounded-lg bg-bdo-bg border border-bdo-border hover:border-bdo-gold text-bdo-text-muted hover:text-bdo-gold transition-colors"
            >
              Tümü
            </button>
            {allCores >= 4 && (
              <button
                onClick={() => {
                  const half = Math.ceil(allCores / 2);
                  setAffinityMask((1 << half) - 1);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-bdo-bg border border-bdo-border hover:border-bdo-gold text-bdo-text-muted hover:text-bdo-gold transition-colors"
              >
                İlk {Math.ceil(allCores / 2)} Thread
              </button>
            )}
            {allCores >= 8 && (
              <button
                onClick={() => {
                  let mask = 0;
                  for (let i = 0; i < allCores; i += 2) mask |= (1 << i);
                  setAffinityMask(mask);
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-bdo-bg border border-bdo-border hover:border-bdo-gold text-bdo-text-muted hover:text-bdo-gold transition-colors"
              >
                Çift Thread (SMT Kapat)
              </button>
            )}
          </div>

          {/* Core grid */}
          {allCores > 0 && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: allCores }, (_, i) => {
                const sel = isCoreSelected(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleCore(i)}
                    className={`w-10 h-10 rounded-lg text-xs font-mono font-bold border transition-all ${
                      sel
                        ? "bg-purple-600/20 border-purple-500 text-purple-300"
                        : "bg-bdo-bg border-bdo-border text-bdo-text-muted"
                    }`}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={handleApplyAffinity}
            disabled={applyingAffinity || !status?.bdoRunning}
            className="py-2.5 px-6 rounded-lg bg-purple-700/80 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {applyingAffinity ? "Uygulanıyor…" : "BDO'ya Uygula"}
          </button>
          <p className="text-xs text-bdo-text-muted">
            Intel 12. nesil+ işlemcilerde E-core'ları hariç tutmak FPS stabilitesini artırabilir.
            Çalışan BDO sürecine anlık uygulanır.
          </p>
        </div>

        {/* Background Process Killer */}
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="font-semibold text-bdo-text-primary">Arka Plan Uygulamalar</span>
            </div>
            <button
              onClick={fetchProcesses}
              className="text-xs text-bdo-text-muted hover:text-bdo-text-primary transition-colors"
            >
              Yenile
            </button>
          </div>

          {processes.length === 0 ? (
            <p className="text-sm text-bdo-text-muted py-2">
              Kapatılabilecek bilinen uygulama bulunamadı.
            </p>
          ) : (
            <div className="space-y-2">
              {processes.map((p) => {
                const checked = selectedProcesses.has(p.process);
                return (
                  <label
                    key={p.process}
                    className="flex items-center gap-3 cursor-pointer p-2.5 rounded-lg hover:bg-bdo-bg transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = new Set(selectedProcesses);
                        if (checked) next.delete(p.process);
                        else next.add(p.process);
                        setSelectedProcesses(next);
                      }}
                      className="w-4 h-4 accent-red-500"
                    />
                    <span className="flex-1 text-sm text-bdo-text-primary">
                      {KNOWN_DISPLAY[p.process] ?? p.process}
                    </span>
                    <span className="text-xs text-bdo-text-muted">{p.mem} MB</span>
                  </label>
                );
              })}
            </div>
          )}

          {processes.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => setSelectedProcesses(new Set(processes.map((p) => p.process)))}
                className="text-xs text-bdo-text-muted hover:text-bdo-text-primary transition-colors"
              >
                Tümünü seç
              </button>
              <button
                onClick={() => setSelectedProcesses(new Set())}
                className="text-xs text-bdo-text-muted hover:text-bdo-text-primary transition-colors"
              >
                Temizle
              </button>
              <div className="flex-1" />
              <button
                onClick={handleKillProcesses}
                disabled={selectedProcesses.size === 0 || killingProcesses}
                className="py-2 px-5 rounded-lg bg-red-700/80 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {killingProcesses
                  ? "Kapatılıyor…"
                  : `${selectedProcesses.size} Uygulamayı Kapat`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
