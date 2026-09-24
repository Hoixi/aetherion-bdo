"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Upload, Swords, Trash2, ChevronLeft, Clock, Users } from "lucide-react";
import { TestShell, Card, Head, Empty } from "@/components/app-shell";
import { ozet, zamanCizgisi } from "@/lib/savas-gunlugu";

/**
 * Savaş günlüğü — kim kimi öldürdü.
 *
 * Kaynak iki türlü: masaüstü uygulamasının canlı kaydı ya da elle yüklenen
 * bir `.log` dosyası. Ekran ikisini de aynı biçimde gösteriyor: kişi başı
 * K/D, dakikalık eğri ve ham olay akışı.
 *
 * Yönün güvenilirliği kaynağa bağlı (kayıt aracı zaman zaman kill/ölüm
 * yönünü ters işaretleyebiliyor); bu yüzden "bizden" olan satırlar aile
 * adı eşleşmesiyle ayrılıyor ve toplamlar buna göre veriliyor.
 */

type Liste = {
  id: number; warId: number | null; title: string; source: string;
  startedAt: string | null; endedAt: string | null; createdAt: string;
  uploader: { id: number; familyName: string }; _count: { kills: number };
};
type Kill = { id: number; at: string; killerName: string; victimName: string; guildName: string | null; killerUserId: number | null; victimUserId: number | null };
type Detay = Liste & { war: { id: number; title: string; date: string } | null; kills: Kill[] };

export default function SavasGunluguPage() {
  const { data: session } = useSession();
  const [liste, setListe] = useState<Liste[] | null>(null);
  const [acik, setAcik] = useState<Detay | null>(null);
  const [uyeAdlari, setUyeAdlari] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dosya = useRef<HTMLInputElement>(null);

  const yukle = useCallback(() => {
    fetch("/api/combat-log").then((r) => (r.ok ? r.json() : [])).then(setListe).catch(() => setListe([]));
  }, []);
  useEffect(yukle, [yukle]);
  useEffect(() => {
    fetch("/api/members").then((r) => (r.ok ? r.json() : []))
      .then((m: Array<{ familyName: string }>) => setUyeAdlari(new Set(m.map((x) => (x.familyName ?? "").toLocaleLowerCase("tr")).filter(Boolean))))
      .catch(() => {});
  }, []);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); }, [msg]);

  async function dosyaYukle(f: File) {
    setBusy(true);
    try {
      const text = await f.text();
      const r = await fetch("/api/combat-log", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: f.name.replace(/\.log$/i, "").slice(0, 120), text, source: "import" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Yüklenemedi.");
      setMsg(`${d.events} olay kaydedildi.`);
      yukle();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); if (dosya.current) dosya.current.value = ""; }
  }

  async function ac(id: number) {
    const r = await fetch(`/api/combat-log/${id}`);
    if (r.ok) setAcik(await r.json());
  }
  async function sil(id: number) {
    if (!window.confirm("Bu günlük silinsin mi?")) return;
    await fetch(`/api/combat-log/${id}`, { method: "DELETE" });
    setAcik(null); yukle();
  }

  const analiz = useMemo(() => {
    if (!acik) return null;
    const o = ozet(acik.kills.map((k) => ({ killer: k.killerName, victim: k.victimName })), uyeAdlari);
    const cizgi = zamanCizgisi(acik.kills.map((k) => ({ at: k.at, killerBizden: uyeAdlari.has(k.killerName.toLocaleLowerCase("tr")) })));
    return { ...o, cizgi };
  }, [acik, uyeAdlari]);

  if (acik && analiz) {
    const enYuksek = Math.max(1, ...analiz.cizgi.map((c) => Math.max(c.kill, c.death)));
    return (
      <TestShell title={acik.title}
                 subtitle={`${acik.kills.length} olay · ${acik.source === "logger" ? "canlı kayıt" : "dosya"} · ${acik.uploader.familyName}`}
                 aside={
                   <>
                     <button onClick={() => sil(acik.id)} className="t-tab"><Trash2 className="w-3.5 h-3.5" /> Sil</button>
                     <button onClick={() => setAcik(null)} className="t-tab"><ChevronLeft className="w-3.5 h-3.5" /> Listeye dön</button>
                   </>
                 }>
        <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0,1fr) 340px", alignItems: "start" }}>
          <div className="space-y-4">
            <Card>
              <Head icon={Users} title="Bizimkiler" meta={`${analiz.toplamKill} öldürme · ${analiz.toplamDeath} ölüm`} />
              <div className="p-3 grid gap-1">
                {analiz.biz.length === 0 && <p className="text-[12.5px] px-2 py-3" style={{ color: "var(--t-faint)" }}>Bu günlükte tanıdık aile adı yok.</p>}
                {analiz.biz.map((p) => (
                  <div key={p.ad} className="flex items-center gap-3 px-2 py-1.5 rounded-lg" style={{ background: "var(--t-raised)" }}>
                    <span className="text-[12.5px] flex-1 truncate">{p.ad}</span>
                    <span className="t-num text-[12.5px]" style={{ color: "var(--t-good)" }}>{p.kill}</span>
                    <span className="t-num text-[12.5px]" style={{ color: "var(--t-bad)" }}>{p.death}</span>
                    <span className="t-num text-[11px] w-10 text-right" style={{ color: "var(--t-faint)" }}>
                      {p.death ? (p.kill / p.death).toFixed(2) : p.kill.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <Head icon={Clock} title="Dakikalık akış" meta={`${analiz.cizgi.length} dk`} />
              <div className="p-4 flex items-end gap-[2px]" style={{ height: 140 }}>
                {analiz.cizgi.map((c) => (
                  <div key={c.dk} className="flex-1 flex flex-col justify-end gap-[1px]" title={`${c.dk}. dk · ${c.kill} öldürme / ${c.death} ölüm`}>
                    <div style={{ height: `${(c.kill / enYuksek) * 60}%`, background: "var(--t-good)", borderRadius: 2, minHeight: c.kill ? 2 : 0 }} />
                    <div style={{ height: `${(c.death / enYuksek) * 60}%`, background: "var(--t-bad)", borderRadius: 2, minHeight: c.death ? 2 : 0 }} />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <Head icon={Swords} title="Olaylar" meta={`${acik.kills.length}`} />
              <div className="max-h-[420px] overflow-y-auto">
                {acik.kills.map((k) => {
                  const biz = uyeAdlari.has(k.killerName.toLocaleLowerCase("tr"));
                  return (
                    <div key={k.id} className="flex items-center gap-2 px-4 py-1.5 text-[12px]" style={{ borderBottom: "1px solid var(--t-line)" }}>
                      <span className="t-num" style={{ color: "var(--t-faint)" }}>
                        {new Date(k.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <span style={{ color: biz ? "var(--t-good)" : "var(--t-text)" }}>{k.killerName}</span>
                      <span style={{ color: "var(--t-faint)" }}>→</span>
                      <span style={{ color: biz ? "var(--t-text)" : "var(--t-bad)" }}>{k.victimName}</span>
                      {k.guildName && <span className="ml-auto text-[10.5px] truncate" style={{ color: "var(--t-faint)" }}>{k.guildName}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card>
            <Head icon={Users} title="Karşı taraf" meta={`${analiz.digerleri.length} kişi`} />
            <div className="p-3 grid gap-1 max-h-[70vh] overflow-y-auto">
              {analiz.digerleri.map((p) => (
                <div key={p.ad} className="flex items-center gap-3 px-2 py-1 text-[12px]">
                  <span className="flex-1 truncate" style={{ color: "var(--t-dim)" }}>{p.ad}</span>
                  <span className="t-num" style={{ color: "var(--t-good)" }}>{p.kill}</span>
                  <span className="t-num" style={{ color: "var(--t-bad)" }}>{p.death}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </TestShell>
    );
  }

  return (
    <TestShell title="Savaş Günlüğü"
               subtitle="Kim kimi öldürdü — uygulamanın canlı kaydı ya da yüklediğin .log dosyası"
               aside={msg ? <span className="t-chip" style={{ color: "var(--t-gold)" }}>{msg}</span> : null}>
      <Card className="mb-4">
        <div className="p-4 flex items-center gap-3 flex-wrap">
          <input ref={dosya} type="file" accept=".log,.txt" className="hidden"
                 onChange={(e) => { const f = e.target.files?.[0]; if (f) void dosyaYukle(f); }} />
          <button onClick={() => dosya.current?.click()} disabled={busy} className="t-tab" data-on>
            <Upload className="w-3.5 h-3.5" /> {busy ? "Yükleniyor…" : ".log dosyası yükle"}
          </button>
          <p className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
            Kayıt aracının kaydettiği dosyayı seç; satırlar okunup olaylara çevrilir. Aile adı eşleşen üyeler otomatik işaretlenir.
          </p>
        </div>
      </Card>

      {!liste && <Empty>Yükleniyor…</Empty>}
      {liste?.length === 0 && <Empty>Henüz günlük yok.</Empty>}
      <div className="grid gap-2">
        {liste?.map((l) => (
          <button key={l.id} onClick={() => ac(l.id)} className="t-card p-3 flex items-center gap-3 text-left">
            <Swords className="w-4 h-4 shrink-0" style={{ color: "var(--t-gold)" }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold truncate">{l.title}</span>
              <span className="block text-[11px]" style={{ color: "var(--t-faint)" }}>
                {l.startedAt ? new Date(l.startedAt).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                {" · "}{l.uploader.familyName}{" · "}{l.source === "logger" ? "canlı kayıt" : "dosya"}
              </span>
            </span>
            <span className="t-num text-[12.5px] shrink-0" style={{ color: "var(--t-gold)" }}>{l._count.kills}</span>
            {(l.uploader.id === session?.user?.id || session?.user?.canManageWars) && (
              <span onClick={(e) => { e.stopPropagation(); void sil(l.id); }} className="shrink-0" role="button" aria-label="Sil">
                <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--t-bad)" }} />
              </span>
            )}
          </button>
        ))}
      </div>
    </TestShell>
  );
}
