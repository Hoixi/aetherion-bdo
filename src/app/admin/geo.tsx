"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Map as MapIcon, Upload, Link2, Trash2, MapPin, Check } from "lucide-react";
import type { MapMarker } from "@/components/bdo-leaflet-map";
import { Card, Head } from "@/components/app-shell";
import { Blank, Btn, Field, Input } from "./ui";

/**
 * GeoGuessr görselleri.
 *
 * Her kayıt bir ekran görüntüsü ve haritadaki doğru konum. Konum elle
 * yazılmıyor; haritaya tıklanarak alınıyor — koordinatlar 0-1 aralığında
 * normalize duruyor.
 */

const BdoLeafletMap = dynamic(
  () => import("@/components/bdo-leaflet-map").then((m) => ({ default: m.BdoLeafletMap })),
  { ssr: false, loading: () => <div className="w-full h-full" style={{ background: "var(--t-raised)" }} /> },
);

type GeoImage = {
  id: number;
  imageUrl: string;
  mapX: number;
  mapY: number;
  hint: string | null;
  createdAt: string;
  creator: { familyName: string };
};

export default function GeoTab({ flash }: { flash: (msg: string) => void }) {
  const [images, setImages] = useState<GeoImage[] | null>(null);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [url, setUrl] = useState("");
  const [hint, setHint] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const [x, setX] = useState<number | null>(null);
  const [y, setY] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/geo/images");
    if (res.ok) setImages(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/geo/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) setUrl(data.url);
      else flash(data.error || "Yükleme başarısız.");
    } finally {
      setUploading(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!url || x == null || y == null) return;
    setSaving(true);
    const res = await fetch("/api/geo/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: url, mapX: x, mapY: y, hint: hint || null }),
    });
    if (res.ok) {
      setUrl(""); setHint(""); setX(null); setY(null); setPickOpen(false);
      await load();
      flash("Resim eklendi.");
    } else {
      flash((await res.json().catch(() => ({}))).error || "Resim eklenemedi.");
    }
    setSaving(false);
  }

  async function remove(id: number) {
    if (!confirm("Bu resmi silmek istediğine emin misin?")) return;
    await fetch(`/api/geo/images/${id}`, { method: "DELETE" });
    setImages((prev) => prev?.filter((i) => i.id !== id) ?? null);
    flash("Resim silindi.");
  }

  const markers: MapMarker[] =
    x != null && y != null ? [{ x, y, color: "red", label: "Konum" }] : [];

  return (
    <div className="space-y-4">
      {/* ── Yeni görsel ────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <Head icon={MapIcon} title="Yeni Resim Ekle" />
        <form onSubmit={add} className="p-4 space-y-4">
          <div className="flex gap-2">
            {([["file", "Dosya yükle", Upload], ["url", "URL ile", Link2]] as const).map(([m, label, Icon]) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                      className="px-3 h-[30px] rounded-[var(--t-r-sm)] text-[11.5px] font-semibold inline-flex items-center gap-1.5 transition-colors"
                      style={mode === m
                        ? { background: "var(--t-gold)", color: "#0b0b0c" }
                        : { color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <Field label={<>Resim seç {url && <span className="normal-case" style={{ color: "var(--t-good)" }}>· yüklendi</span>}</>}>
              <label className="block cursor-pointer">
                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                       onChange={(e) => {
                         const f = e.target.files?.[0];
                         if (f) upload(f);
                       }} />
                <div className="rounded-[var(--t-r-sm)] px-4 py-5 text-center text-[13px] transition-colors"
                     style={{
                       border: `2px dashed ${uploading ? "var(--t-gold)" : url ? "rgba(56,208,127,.5)" : "var(--t-line-strong)"}`,
                       color: uploading ? "var(--t-gold)" : url ? "var(--t-good)" : "var(--t-faint)",
                     }}>
                  {uploading
                    ? "ImgBB'ye yükleniyor…"
                    : url
                    ? "Yüklendi — başka resim seçmek için tıkla"
                    : "Tıkla veya sürükle → ImgBB'ye otomatik yüklenir"}
                </div>
              </label>
              {url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url} alt="" className="mt-2 h-24 rounded object-cover"
                     style={{ border: "1px solid var(--t-line)" }} />
              )}
            </Field>
          ) : (
            <Field label="Resim URL">
              <Input value={url} onChange={setUrl} type="url" placeholder="https://…" />
            </Field>
          )}

          <Field label="İpucu (opsiyonel — bölge adı)">
            <Input value={hint} onChange={setHint} placeholder="örn. Velia Tepeleri" />
          </Field>

          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>
                Haritada konum
                {x != null && (
                  <span className="normal-case t-num ml-1.5" style={{ color: "var(--t-good)" }}>
                    seçildi ({(x * 100).toFixed(1)}%, {(y! * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
              <Btn small icon={MapPin} tone={pickOpen ? "gold" : "ghost"} onClick={() => setPickOpen((v) => !v)}>
                {pickOpen ? "Haritayı kapat" : "Haritadan seç"}
              </Btn>
            </div>

            {pickOpen && (
              <div className="rounded-[var(--t-r-sm)] overflow-hidden"
                   style={{ height: 380, border: "1px solid var(--t-line)" }}>
                <BdoLeafletMap className="w-full h-full" markers={markers}
                               onPick={(px, py) => { setX(px); setY(py); }} />
              </div>
            )}
          </div>

          <Btn type="submit" tone="gold" icon={Check}
               disabled={saving || uploading || !url || x == null}>
            {saving ? "Kaydediliyor…" : uploading ? "Yükleniyor…" : "Resim ekle"}
          </Btn>
        </form>
      </Card>

      {/* ── Liste ──────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <Head icon={MapIcon} title="Resimler" meta={images ? `${images.length} RESİM` : undefined} />
        {!images && <Blank>Resimler geliyor…</Blank>}
        {images && images.length === 0 && <Blank>Henüz resim eklenmemiş.</Blank>}

        {(images ?? []).map((img) => (
          <div key={img.id} className="t-row px-5 py-3 flex gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.imageUrl} alt="" className="w-32 h-20 object-cover rounded flex-shrink-0"
                 style={{ background: "var(--t-canvas)", border: "1px solid var(--t-line)" }} />
            <div className="flex-1 min-w-0">
              <p className="t-num text-[11px] truncate" style={{ color: "var(--t-faint)" }}>{img.imageUrl}</p>
              {img.hint && (
                <p className="text-[13px] mt-1 flex items-center gap-1.5" style={{ color: "var(--t-gold)" }}>
                  <MapPin className="w-3 h-3" strokeWidth={2} /> {img.hint}
                </p>
              )}
              <p className="text-[11px] mt-1" style={{ color: "var(--t-faint)" }}>
                <span className="t-num">X {(img.mapX * 100).toFixed(1)}% · Y {(img.mapY * 100).toFixed(1)}%</span>
                {" · "}{img.creator.familyName}
                {" · "}{new Date(img.createdAt).toLocaleDateString("tr-TR")}
              </p>
            </div>
            <Btn small icon={Trash2} tone="danger" title="Resmi sil" onClick={() => remove(img.id)} />
          </div>
        ))}
      </Card>
    </div>
  );
}
