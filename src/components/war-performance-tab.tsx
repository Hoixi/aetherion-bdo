"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

interface War {
  id: number;
  title: string;
  date: string;
}

interface PerformanceRow {
  id: number;
  inGameName: string;
  kills: number;
  deaths: number;
  killStreak: number;
  damageDealt: number;
  damageTaken: number;
  ccCount: number;
  hpHeal: number;
  allyHpHeal: number;
  castleDamage: number;
  cannonHits: number;
  cannonDestroys: number;
  cannonMaxRange: number;
  trapExplosions: number;
  matched: boolean;
  user: { familyName: string; avatarUrl: string; class: string } | null;
}

interface AbsentMember {
  id: number;
  familyName: string;
  avatarUrl: string;
}

interface PartyMemberInParty {
  id: number;
  familyName: string;
  avatarUrl: string;
  class: string;
  partyName: string;
}

async function compressImage(file: File, maxWidth = 1280, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }) : file),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 100_000) return Math.round(n / 1_000) + "B";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

export function WarPerformanceTab({ wars }: { wars: War[] }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  const [selectedWarId, setSelectedWarId] = useState<number | "">("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [rematching, setRematching] = useState(false);
  const [rematchMsg, setRematchMsg] = useState<string | null>(null);
  const [rows, setRows] = useState<PerformanceRow[] | null>(null);
  const [absent, setAbsent] = useState<AbsentMember[]>([]);
  const [partyMissingFromScreenshot, setPartyMissingFromScreenshot] = useState<PartyMemberInParty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedWarId) { setRows(null); setAbsent([]); setPartyMissingFromScreenshot([]); return; }
    setLoadingExisting(true);
    Promise.all([
      fetch(`/api/wars/${selectedWarId}/performance`).then((r) => r.json()),
      fetch(`/api/wars/${selectedWarId}/parties`).then((r) => r.json()),
    ]).then(([perfData, partiesData]) => {
      const perfs: PerformanceRow[] = perfData.performances ?? [];
      if (perfs.length > 0) {
        setRows(perfs.map((p) => ({ ...p, matched: !!p.user })));
        setAbsent(perfData.absent ?? []);
        computePartyMissing(partiesData, perfs);
      } else {
        setRows(null);
        setAbsent([]);
        setPartyMissingFromScreenshot([]);
      }
    }).finally(() => setLoadingExisting(false));
  }, [selectedWarId]);

  function computePartyMissing(partiesData: { name: string; members: { user: { id: number; familyName: string; avatarUrl: string; class: string } }[] }[], perfs: PerformanceRow[]) {
    const perfNames = new Set(perfs.map((p) => p.inGameName.toLowerCase().trim()));
    const missing: PartyMemberInParty[] = [];
    for (const party of partiesData) {
      for (const m of party.members) {
        if (!perfNames.has(m.user.familyName.toLowerCase().trim())) {
          missing.push({ ...m.user, partyName: party.name });
        }
      }
    }
    setPartyMissingFromScreenshot(missing);
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
    setRows(null);
    setError(null);
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    // Reset input so the same file can be re-added if needed
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  async function analyze() {
    if (!selectedWarId || images.length === 0) return;
    setAnalyzing(true);
    setError(null);
    setProgress({ current: 0, total: images.length });
    try {
      for (let i = 0; i < images.length; i++) {
        setProgress({ current: i + 1, total: images.length });
        const compressed = await compressImage(images[i]);
        const fd = new FormData();
        fd.append("image", compressed);
        if (i === 0) fd.append("clear", "1");

        const res = await fetch(`/api/wars/${selectedWarId}/performance`, { method: "POST", body: fd });
        let data: { rows?: PerformanceRow[]; error?: string };
        try {
          data = await res.json();
        } catch {
          throw new Error(`Resim ${i + 1}: sunucudan geçersiz yanıt. Zaman aşımı olmuş olabilir.`);
        }
        if (!res.ok) throw new Error(data.error ?? `Resim ${i + 1} analizi başarısız`);
      }

      // Fetch final results after all images processed
      const [perfRes, partiesRes] = await Promise.all([
        fetch(`/api/wars/${selectedWarId}/performance`),
        fetch(`/api/wars/${selectedWarId}/parties`),
      ]);
      const perfData = await perfRes.json();
      const savedRows: PerformanceRow[] = (perfData.performances ?? []).map((r: PerformanceRow) => ({ ...r, matched: !!r.user }));
      setRows(savedRows);
      setAbsent(perfData.absent ?? []);
      if (partiesRes.ok) {
        const partiesData = await partiesRes.json();
        computePartyMissing(partiesData, savedRows);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    } finally {
      setAnalyzing(false);
      setProgress(null);
    }
  }

  async function saveEditedName(recordId: number) {
    if (!selectedWarId || !editingName.trim()) return;
    setSavingId(recordId);
    try {
      const res = await fetch(`/api/wars/${selectedWarId}/performance/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inGameName: editingName.trim() }),
      });
      const updated = await res.json();
      if (!res.ok) { setError(updated.error ?? "Kaydedilemedi"); return; }
      setRows((prev) => prev?.map((r) => (r.id === recordId ? { ...updated } : r)) ?? null);
      setEditingId(null);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setSavingId(null);
    }
  }

  async function rematchAll() {
    setRematching(true);
    setRematchMsg(null);
    try {
      const res = await fetch("/api/performances/rematch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setRematchMsg("Hata oluştu"); return; }
      setRematchMsg(`${data.matched} yeni eşleşme bulundu (${data.total} kayıt tarandı)`);
      // Refresh current results if a war is selected
      if (selectedWarId) {
        const perfRes = await fetch(`/api/wars/${selectedWarId}/performance`);
        if (perfRes.ok) {
          const perfData = await perfRes.json();
          setRows((perfData.performances ?? []).map((r: PerformanceRow) => ({ ...r, matched: !!r.user })));
          setAbsent(perfData.absent ?? []);
        }
      }
    } finally {
      setRematching(false);
      setTimeout(() => setRematchMsg(null), 4000);
    }
  }

  function clearAll() {
    previews.forEach((p) => URL.revokeObjectURL(p));
    setImages([]);
    setPreviews([]);
    setRows(null);
    setError(null);
  }

  const selectedWar = wars.find((w) => w.id === selectedWarId);

  return (
    <div className="space-y-6">
      {/* War selector */}
      <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4 space-y-4">
        <h3 className="text-sm font-semibold text-bdo-text-primary">Savaş Seç & İstatistik Yükle</h3>
        <div>
          <label className="block text-xs text-bdo-text-muted mb-1">Savaş</label>
          <select
            value={selectedWarId}
            onChange={(e) => setSelectedWarId(e.target.value ? Number(e.target.value) : "")}
            className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
          >
            <option value="">— Savaş seçin —</option>
            {wars.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title} ({new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })})
              </option>
            ))}
          </select>
        </div>

        {selectedWarId && (
          <>
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-bdo-border hover:border-bdo-gold/50 rounded-lg p-6 text-center cursor-pointer transition-colors"
            >
              {previews.length > 0 ? (
                <p className="text-xs text-bdo-text-muted">+ Daha fazla eklemek için tıklayın veya sürükleyin</p>
              ) : (
                <div className="space-y-2">
                  <div className="text-3xl text-bdo-text-muted">📊</div>
                  <p className="text-sm text-bdo-text-muted">Oyun içi istatistik ekran görüntülerini buraya sürükleyin</p>
                  <p className="text-xs text-bdo-text-muted/60">Birden fazla resim seçebilirsiniz — veya tıklayarak seçin</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Image previews */}
            {previews.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3">
                  {previews.map((src, i) => (
                    <div key={i} className="relative group">
                      <img
                        src={src}
                        alt={`Resim ${i + 1}`}
                        className="h-32 rounded border border-bdo-border object-contain bg-bdo-bg"
                      />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Kaldır"
                      >
                        ×
                      </button>
                      <div className="text-[10px] text-bdo-text-muted text-center mt-1">Resim {i + 1}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 items-center">
                  <button
                    onClick={analyze}
                    disabled={analyzing}
                    className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {analyzing && progress ? (
                      <>
                        <span className="animate-spin inline-block">⟳</span>
                        Resim {progress.current}/{progress.total} analiz ediliyor...
                      </>
                    ) : (
                      `✨ Analiz Et & Kaydet (${images.length} resim)`
                    )}
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-4 py-2 text-sm text-bdo-text-muted hover:text-bdo-text-primary transition-colors"
                  >
                    Temizle
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loadingExisting && (
        <p className="text-bdo-text-muted text-sm">Mevcut veriler yükleniyor...</p>
      )}

      {/* Results */}
      {rows && rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-bdo-text-primary">
              {selectedWar?.title} — Hasar Raporu
              <span className="ml-2 text-bdo-text-muted font-normal">({rows.length} oyuncu)</span>
            </h3>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="text-green-400">✓ Eşleşti: {rows.filter((r) => r.matched).length}</span>
              <span className="text-yellow-400">⚠ Eşleşmedi: {rows.filter((r) => !r.matched).length}</span>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  {rematchMsg && <span className="text-bdo-gold">{rematchMsg}</span>}
                  <button
                    onClick={rematchAll}
                    disabled={rematching}
                    className="bg-bdo-surface border border-bdo-border px-3 py-1 rounded-lg hover:border-bdo-gold/50 transition-colors disabled:opacity-50"
                  >
                    {rematching ? "Taranıyor..." : "↻ Eşleşmeleri Yenile"}
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("Bu savaşın tüm hasar raporu silinecek. Emin misiniz?")) return;
                      const res = await fetch(`/api/wars/${selectedWarId}/performance`, { method: "DELETE" });
                      if (res.ok) { setRows(null); setAbsent([]); }
                    }}
                    className="bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1 rounded-lg hover:bg-red-500/20 transition-colors text-xs"
                  >
                    🗑 Raporu Sil
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-bdo-border text-bdo-text-muted">
                  <th className="text-left py-2 px-2 whitespace-nowrap">Aile Adı</th>
                  <th className="text-center py-2 px-2" title="Öldürme">💀</th>
                  <th className="text-center py-2 px-2" title="Ölüm">🪦</th>
                  <th className="text-center py-2 px-2" title="Seri">🔥</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Ver. Hasar</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Al. Hasar</th>
                  <th className="text-center py-2 px-2" title="CC">CC</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">HP Yenile</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Mütt. HP</th>
                  <th className="text-right py-2 px-2 whitespace-nowrap">Kale Hasar</th>
                  <th className="text-center py-2 px-2" title="Top İsabet">🏹</th>
                  <th className="text-center py-2 px-2" title="Top Yok">💣</th>
                  <th className="text-center py-2 px-2" title="Top Mesafe">📏</th>
                  <th className="text-center py-2 px-2" title="Tuzak">⚙️</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id ?? row.inGameName}
                    className={`group border-b border-bdo-border/50 hover:bg-bdo-surface/50 transition-colors ${
                      !row.matched ? "opacity-75" : ""
                    }`}
                  >
                    <td className="py-2 px-2">
                      {isAdmin && editingId === row.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditedName(row.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="bg-bdo-bg border border-bdo-gold/50 rounded px-2 py-0.5 text-xs text-bdo-text-primary focus:outline-none w-36"
                          />
                          <button
                            onClick={() => saveEditedName(row.id)}
                            disabled={savingId === row.id}
                            className="text-green-400 hover:text-green-300 text-xs px-1 disabled:opacity-50"
                          >
                            {savingId === row.id ? "..." : "✓"}
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-bdo-text-muted hover:text-bdo-text-primary text-xs px-1">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {row.user?.avatarUrl && (
                            <img src={row.user.avatarUrl} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                          )}
                          <span className={row.matched ? "text-bdo-text-primary" : "text-bdo-text-muted"}>
                            {row.inGameName}
                          </span>
                          {!row.matched && (
                            <span className="text-yellow-500 text-[10px] font-bold" title="Eşleşmedi">⚠</span>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => { setEditingId(row.id); setEditingName(row.inGameName); }}
                              className="text-bdo-text-muted/40 hover:text-bdo-gold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                              title="İsmi düzenle"
                            >
                              ✎
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{row.kills}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{row.deaths}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{row.killStreak}</td>
                    <td className="text-right py-2 px-2 text-bdo-gold font-mono">{fmt(row.damageDealt)}</td>
                    <td className="text-right py-2 px-2 text-red-400/80 font-mono">{fmt(row.damageTaken)}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{row.ccCount}</td>
                    <td className="text-right py-2 px-2 text-green-400/80 font-mono">{fmt(row.hpHeal)}</td>
                    <td className="text-right py-2 px-2 text-green-400/60 font-mono">{fmt(row.allyHpHeal)}</td>
                    <td className="text-right py-2 px-2 text-orange-400/80 font-mono">{fmt(row.castleDamage)}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{row.cannonHits}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{row.cannonDestroys}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{row.cannonMaxRange}</td>
                    <td className="text-center py-2 px-2 text-bdo-text-secondary">{row.trapExplosions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Party members not in screenshot */}
          {partyMissingFromScreenshot.length > 0 && (
            <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-orange-400 mb-3">
                ⚠️ Partide var ama ekran görüntüsünde yok ({partyMissingFromScreenshot.length} kişi)
              </h4>
              <div className="space-y-1">
                {partyMissingFromScreenshot.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-xs">
                    {m.avatarUrl && <img src={m.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}
                    <span className="text-orange-300 font-semibold w-36 truncate">{m.familyName}</span>
                    <span className="text-bdo-text-muted bg-bdo-bg border border-bdo-border rounded px-2 py-0.5">{m.partyName}</span>
                    <span className="text-bdo-text-muted">{m.class}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Absent members (attending but not in screenshot) */}
          {absent.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-red-400 mb-3">
                ⚠️ Katılacağını bildirdi ama oyunda görünmüyor ({absent.length} kişi)
              </h4>
              <div className="flex flex-wrap gap-2">
                {absent.map((m) => (
                  <div key={m.id} className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded px-2 py-1">
                    {m.avatarUrl && <img src={m.avatarUrl} alt="" className="w-5 h-5 rounded-full" />}
                    <span className="text-xs text-red-300">{m.familyName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="text-bdo-text-muted text-sm">Resimden hiç veri çıkarılamadı. Daha net bir ekran görüntüsü deneyin.</p>
      )}
    </div>
  );
}
