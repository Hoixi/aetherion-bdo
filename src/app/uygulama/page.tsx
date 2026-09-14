"use client";

import { useCallback, useEffect, useState } from "react";
import { Monitor, RefreshCw, Trash2, Download, KeyRound } from "lucide-react";
import { TestShell, Card, Head, loadJson } from "@/components/app-shell";

/**
 * Masaüstü uygulaması eşleştirme.
 *
 * TV uygulaması akışı: burada 6 haneli kod görünür, kullanıcı uygulamaya
 * yazar. Kod 5 dakika geçerli ve tek kullanımlık; anahtar uygulamada
 * kalır, burada yalnızca hangi cihazların bağlı olduğu görünür.
 */

type Cihaz = { id: number; label: string; lastSeenAt: string | null; createdAt: string };

export default function UygulamaPage() {
  const [kod, setKod] = useState<{ code: string; expiresAt: string } | null>(null);
  const [kalan, setKalan] = useState(0);
  const [cihazlar, setCihazlar] = useState<Cihaz[]>([]);
  const [busy, setBusy] = useState(false);

  const cihazlariYukle = useCallback(() => {
    loadJson<Cihaz[]>("/api/app/tokens").then(setCihazlar).catch(() => {});
  }, []);

  useEffect(() => { cihazlariYukle(); }, [cihazlariYukle]);

  // Kodun kalan süresi
  useEffect(() => {
    if (!kod) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((Date.parse(kod.expiresAt) - Date.now()) / 1000));
      setKalan(s);
      if (s === 0) setKod(null);
    }, 500);
    return () => clearInterval(t);
  }, [kod]);

  // Cihaz bağlanınca liste kendiliğinden yenilensin
  useEffect(() => {
    if (!kod) return;
    const t = setInterval(cihazlariYukle, 3000);
    return () => clearInterval(t);
  }, [kod, cihazlariYukle]);

  async function kodAl() {
    setBusy(true);
    try {
      const r = await fetch("/api/app/pair", { method: "POST" });
      if (r.ok) setKod(await r.json());
    } finally {
      setBusy(false);
    }
  }

  async function iptal(id: number) {
    if (!confirm("Bu cihazın bağlantısı kesilsin mi? Uygulama yeniden eşleştirme ister.")) return;
    await fetch("/api/app/tokens", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    cihazlariYukle();
  }

  const zaman = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "—";

  return (
    <TestShell title="Masaüstü Uygulaması"
               subtitle="Oyun içi overlay, savaş bildirimleri ve kale buff'ları için Aetherion Companion.">
      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <Card hi>
          <Head icon={KeyRound} title="Uygulamayı bağla" />
          <div className="px-5 py-5">
            {kod ? (
              <>
                <p className="text-[12.5px] mb-3" style={{ color: "var(--t-dim)" }}>
                  Bu kodu uygulamadaki <b style={{ color: "var(--t-text)" }}>Bağlan</b> ekranına yaz:
                </p>
                <div className="t-num text-[44px] font-bold tracking-[0.25em] leading-none select-all"
                     style={{ color: "var(--t-gold)" }}>
                  {kod.code}
                </div>
                <p className="text-[11.5px] mt-3" style={{ color: "var(--t-faint)" }}>
                  {Math.floor(kalan / 60)}:{String(kalan % 60).padStart(2, "0")} içinde geçersiz olur · tek kullanımlık
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] leading-relaxed mb-4" style={{ color: "var(--t-dim)" }}>
                  Uygulamayı kur, <b style={{ color: "var(--t-text)" }}>Bağlan</b>&apos;a bas, sonra
                  buradan bir kod al. Kod 5 dakika geçerli; her cihaz için yeni kod alınır.
                </p>
                <button className="t-tab" data-on onClick={kodAl} disabled={busy}>
                  <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} strokeWidth={2} />
                  {busy ? "Üretiliyor…" : "Eşleştirme kodu al"}
                </button>
              </>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <Head icon={Monitor} title="Bağlı cihazlar" meta={String(cihazlar.length)} />
            {cihazlar.length === 0 ? (
              <p className="px-5 py-4 text-[12.5px]" style={{ color: "var(--t-faint)" }}>
                Henüz bağlı cihaz yok.
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--t-line)" }}>
                {cihazlar.map((c) => (
                  <div key={c.id} className="px-5 py-3 flex items-center gap-3 t-row">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] truncate">{c.label || "Adsız cihaz"}</div>
                      <div className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                        son görülme {zaman(c.lastSeenAt)}
                      </div>
                    </div>
                    <button onClick={() => iptal(c.id)} aria-label="Bağlantıyı kes"
                            className="p-1.5 rounded" style={{ color: "var(--t-faint)" }}>
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <Head icon={Download} title="İndir" meta="Windows" />
            <div className="px-5 py-4 space-y-3">
              <a href="/api/companion/download" className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 rounded-[9px]"
                 style={{ background: "var(--t-gold)", color: "#000" }}>
                <Download className="w-4 h-4" /> Aetherion Companion'ı indir
              </a>
              <p className="text-[12px] leading-relaxed" style={{ color: "var(--t-faint)" }}>
                Kurulum dosyası (.exe). Windows SmartScreen uyarırsa "Daha fazla bilgi → Yine de çalıştır".
                Kurduktan sonra yukarıdan eşleştirme kodu alıp uygulamaya gir. Grind tracker için oyun
                pencereli/kenarlıksız modda olmalı; tam ekran (exclusive) modda ekran yakalanamaz.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </TestShell>
  );
}
