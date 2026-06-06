const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const http = require("http");

const app = express();
const PORT = 7432;

app.use(cors({ origin: ["http://localhost:3000", "https://aetheri.online"] }));
app.use(express.json());

// Chrome Private Network Access — HTTPS public site → localhost requires this header
app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.sendStatus(204);
});

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Private-Network", "true");
  next();
});

// Run a PowerShell script, resolve with stdout string
function runPS(script) {
  return new Promise((resolve, reject) => {
    const ps = spawn("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "-",
    ]);
    let out = "",
      err = "";
    ps.stdout.on("data", (d) => (out += d));
    ps.stderr.on("data", (d) => (err += d));
    ps.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err.trim() || `PS exit ${code}`));
    });
    ps.stdin.write(script);
    ps.stdin.end();
  });
}

// ─── Status & CPU info ───────────────────────────────────────────────────────

app.get("/status", async (req, res) => {
  try {
    const cpuJson = await runPS(`
      $cpu = Get-WmiObject Win32_Processor | Select-Object -First 1
      $ram = Get-WmiObject Win32_OperatingSystem
      $totalRam = [math]::Round($ram.TotalVisibleMemorySize / 1MB, 1)
      $freeRam  = [math]::Round($ram.FreePhysicalMemory / 1MB, 1)
      $usedRam  = [math]::Round($totalRam - $freeRam, 1)
      [PSCustomObject]@{
        cpuName    = $cpu.Name.Trim()
        cores      = $cpu.NumberOfCores
        threads    = $cpu.NumberOfLogicalProcessors
        totalRamGB = $totalRam
        freeRamGB  = $freeRam
        usedRamGB  = $usedRam
      } | ConvertTo-Json -Compress
    `);
    const info = JSON.parse(cpuJson);

    const bdoRunning = await runPS(`
      $p = Get-Process -Name "BlackDesert64" -ErrorAction SilentlyContinue
      if ($p) { "true" } else { "false" }
    `);

    let bdoAffinity = null;
    let bdoPriority = null;
    if (bdoRunning === "true") {
      const bdoInfo = await runPS(`
        $p = Get-Process -Name "BlackDesert64" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($p) {
          [PSCustomObject]@{
            affinity = [int64]$p.ProcessorAffinity
            priority = $p.PriorityClass.ToString()
          } | ConvertTo-Json -Compress
        }
      `);
      if (bdoInfo) {
        const parsed = JSON.parse(bdoInfo);
        bdoAffinity = parsed.affinity;
        bdoPriority = parsed.priority;
      }
    }

    res.json({
      ok: true,
      ...info,
      bdoRunning: bdoRunning === "true",
      bdoAffinity,
      bdoPriority,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── RAM info ────────────────────────────────────────────────────────────────

app.get("/ram", async (req, res) => {
  try {
    const json = await runPS(`
      $ram = Get-WmiObject Win32_OperatingSystem
      $total = [math]::Round($ram.TotalVisibleMemorySize / 1MB, 2)
      $free  = [math]::Round($ram.FreePhysicalMemory / 1MB, 2)
      [PSCustomObject]@{
        totalGB = $total
        freeGB  = $free
        usedGB  = [math]::Round($total - $free, 2)
        usedPct = [math]::Round(($total - $free) / $total * 100, 1)
      } | ConvertTo-Json -Compress
    `);
    res.json({ ok: true, ...JSON.parse(json) });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── RAM flush ───────────────────────────────────────────────────────────────
// Trims working sets of all accessible processes (no admin required for own processes)
// For standby list flush (needs admin), tries EmptyStandbyList.exe if present

app.post("/ram/flush", async (req, res) => {
  try {
    const before = await runPS(`
      $ram = Get-WmiObject Win32_OperatingSystem
      [math]::Round($ram.FreePhysicalMemory / 1MB, 2)
    `);

    // Trim working sets - this frees private working set pages back to standby
    await runPS(`
      $ErrorActionPreference = 'SilentlyContinue'
      Get-Process | ForEach-Object {
        try {
          $_.MinWorkingSet = $_.MinWorkingSet
        } catch {}
      }
      [System.GC]::Collect()
      [System.GC]::WaitForPendingFinalizers()
    `);

    // Try EmptyStandbyList if available (flushes standby list, needs admin)
    let standbyFlushed = false;
    try {
      await runPS(`
        $tool = "$env:TEMP\\EmptyStandbyList.exe"
        if (Test-Path $tool) {
          & $tool workingsets
          & $tool modifiedpagelist
          & $tool standbylist
        }
      `);
      standbyFlushed = true;
    } catch {}

    const after = await runPS(`
      $ram = Get-WmiObject Win32_OperatingSystem
      [math]::Round($ram.FreePhysicalMemory / 1MB, 2)
    `);

    res.json({
      ok: true,
      beforeFreeGB: parseFloat(before),
      afterFreeGB: parseFloat(after),
      freedGB: Math.max(0, parseFloat(after) - parseFloat(before)).toFixed(2),
      standbyFlushed,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── CPU Affinity ────────────────────────────────────────────────────────────

app.post("/affinity", async (req, res) => {
  const { mask } = req.body; // bitmask integer, e.g. 255 = all 8 cores
  if (typeof mask !== "number" || mask < 1) {
    return res.status(400).json({ ok: false, error: "Invalid mask" });
  }
  try {
    const result = await runPS(`
      $p = Get-Process -Name "BlackDesert64" -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $p) { Write-Output "notrunning"; exit 0 }
      $p.ProcessorAffinity = [IntPtr]${mask}
      Write-Output "ok"
    `);
    if (result === "notrunning") {
      res.json({ ok: false, error: "BDO is not running" });
    } else {
      res.json({ ok: true, mask });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Process Priority ────────────────────────────────────────────────────────

const VALID_PRIORITIES = ["Idle", "BelowNormal", "Normal", "AboveNormal", "High", "RealTime"];

app.post("/priority", async (req, res) => {
  const { priority } = req.body;
  if (!VALID_PRIORITIES.includes(priority)) {
    return res.status(400).json({ ok: false, error: "Invalid priority" });
  }
  // RealTime requires admin and can cause system instability - block it
  if (priority === "RealTime") {
    return res.status(400).json({ ok: false, error: "RealTime priority is unsafe" });
  }
  try {
    const result = await runPS(`
      $p = Get-Process -Name "BlackDesert64" -ErrorAction SilentlyContinue | Select-Object -First 1
      if (-not $p) { Write-Output "notrunning"; exit 0 }
      $p.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::${priority}
      Write-Output "ok"
    `);
    if (result === "notrunning") {
      res.json({ ok: false, error: "BDO is not running" });
    } else {
      res.json({ ok: true, priority });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Background process list ─────────────────────────────────────────────────

// Common background processes that can safely be stopped while gaming
const KNOWN_BACKGROUND = [
  { name: "Discord", process: "Discord" },
  { name: "Google Chrome", process: "chrome" },
  { name: "Microsoft Edge", process: "msedge" },
  { name: "OneDrive", process: "OneDrive" },
  { name: "Dropbox", process: "Dropbox" },
  { name: "Spotify", process: "Spotify" },
  { name: "Steam", process: "steam" },
  { name: "EpicGamesLauncher", process: "EpicGamesLauncher" },
  { name: "Teams", process: "Teams" },
  { name: "Slack", process: "slack" },
  { name: "AdobeUpdateManager", process: "AdobeUpdateManager" },
  { name: "CCleaner", process: "CCleaner64" },
  { name: "Zoom", process: "Zoom" },
  { name: "obs64 (OBS)", process: "obs64" },
];

app.get("/processes", async (req, res) => {
  try {
    const names = KNOWN_BACKGROUND.map((p) => p.process).join('","');
    const json = await runPS(`
      $targets = @("${names}")
      $running = @()
      foreach ($t in $targets) {
        $p = Get-Process -Name $t -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($p) {
          $running += [PSCustomObject]@{ process = $t; pid = $p.Id; mem = [math]::Round($p.WorkingSet64 / 1MB, 1) }
        }
      }
      $running | ConvertTo-Json -Compress
    `);
    const running = json ? JSON.parse(json) : [];
    const list = Array.isArray(running) ? running : running ? [running] : [];
    res.json({ ok: true, processes: list });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Kill list of processes by name
app.post("/processes/kill", async (req, res) => {
  const { processes } = req.body; // string[]
  if (!Array.isArray(processes) || processes.length === 0) {
    return res.status(400).json({ ok: false, error: "No processes specified" });
  }
  // Sanitize: only allow alphanumeric + common chars
  const safe = processes.filter((p) => /^[a-zA-Z0-9_\-. ]+$/.test(p));
  if (safe.length !== processes.length) {
    return res.status(400).json({ ok: false, error: "Invalid process name" });
  }
  try {
    const killed = [];
    for (const proc of safe) {
      try {
        await runPS(`Stop-Process -Name "${proc}" -Force -ErrorAction SilentlyContinue`);
        killed.push(proc);
      } catch {}
    }
    res.json({ ok: true, killed });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Launch BDO ──────────────────────────────────────────────────────────────

app.post("/launch", async (req, res) => {
  const { path: gamePath, affinityMask, priority } = req.body;

  const launchPath =
    gamePath ||
    "C:\\Program Files (x86)\\Black Desert Online\\BlackDesert_Launcher.exe";

  try {
    // Launch the game
    await runPS(`Start-Process "${launchPath}" -ErrorAction SilentlyContinue`);

    res.json({ ok: true, message: "Launcher started. Apply settings after BDO process appears." });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── Start server ─────────────────────────────────────────────────────────────

app.listen(PORT, "127.0.0.1", () => {
  console.log(`BDO Optimizer Agent running on http://127.0.0.1:${PORT}`);
  console.log("Keep this window open while using the optimizer on aetheri.online");
});
