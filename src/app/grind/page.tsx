"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock, MapPin, Radio, Users, TrendingUp, Package } from "lucide-react";
import { TestShell, Card, Head, Empty, loadJson, fmt } from "@/components/app-shell";
import { getClassByID } from "@/lib/classes";

/**
 * Grind — uygulamanın saydığı oturumlar, spot bazlı.
 *
 * Veri kaynağı masaüstü uygulaması (Aetherion Companion): ekrandaki
 * ganimet balonunu sayıp 30 sn'de bir buraya yazıyor. Bu sayfa yalnızca
 * gösterir: kim şu an nerede kasıyor, son oturumlarda ne düştü, spotun
 * saatlik ortalaması ne. Fiyat yok — istenmedi.
 */

interface Spot { id: number; name: string; region: string }
interface Esya { itemId: number; name: string; grade: number; icon: string; quantity: number; drops: number }
interface Oturum {
  id: number; character: string; class: string; startedAt: string; lastSeenAt: string; endedAt: string | null;
  durationSec: number; drops: number; live: boolean;
  user: { id: number; familyName: string; class: string; avatarUrl: string };
  spot: { id: number; name: string } | null;
  items: Esya[];
}
interface Istatistik {
  oturum: number; kisi: number; saat: number;
  esyalar: Array<{ itemId: number; name: string; grade: number; icon: string; quantity: number; saatlik: number }>;
}
interface Veri { serverTime: string; sessions: Oturum[]; stats: Istatistik | null }

const GRADE_COLOR: Record<number, string> = { 0: "#8a8a92", 1: "#f4f4f5", 2: "#5fd39a", 3: "#6b93ff", 4: "#e8b451" };

function sure(sn: number): string {
  const dk = Math.floor(sn / 60);
  return dk >= 60 ? `${Math.floor(dk / 60)} sa ${dk % 60} dk` : `${dk} dk`;
}
function once(iso: string, simdi: number): string {
  const dk = Math.round((simdi - Date.parse(iso)) / 60_000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  return `${Math.floor(sa / 24)} gün önce`;
}
const sinifAdi = (id: string) => getClassByID(id)?.name ?? id;

function Ikon({ e, size = 28 }: { e: { icon: string; name: string; grade: number }; size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded flex-shrink-0 overflow-hidden"
          style={{ width: size, height: size, border: `1px solid ${GRADE_COLOR[e.grade] ?? GRADE_COLOR[0]}55`, background: "var(--t-raised)" }}>
      {e.icon ? <img src={e.icon} alt="" width={size} height={size} loading="lazy" style={{ display: "block" }} />
              : <Package className="w-3.5 h-3.5" style={{ color: "var(--t-faint)" }} />}
    </span>
  );
}

/** Bir oturum kartı — canlıysa süre işler */
function OturumKarti({ o, simdi }: { o: Oturum; simdi: number }) {
  // Canlı oturumda süre son nabızdan bu yana da işler; kapalıda kayıtlı süre
  const saniye = o.live ? o.durationSec + Math.max(0, (simdi - Date.parse(o.lastSeenAt)) / 1000) : o.durationSec;
  const dkBasi = saniye >= 60 ? o.drops / (saniye / 60) : 0;
  const goster = o.items.slice(0, 6);
  return (
    <Card className={`p-4 ${o.live ? "t-card-hi" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{ background: "var(--t-raised)" }}>
          {o.user.avatarUrl && <img src={o.user.avatarUrl} alt="" width={36} height={36} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[14px]">{o.user.familyName || "—"}</span>
            {o.character && <span className="text-[12.5px]" style={{ color: "var(--t-dim)" }}>{o.character}</span>}
            {(o.class || o.user.class) && <span className="t-chip">{sinifAdi(o.class || o.user.class)}</span>}
            {o.live && (
              <span className="t-chip inline-flex items-center gap-1" style={{ color: "#5fd39a", borderColor: "#5fd39a44" }}>
                <Radio className="w-3 h-3" /> canlı
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[12px] flex-wrap" style={{ color: "var(--t-dim)" }}>
            {o.spot && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{o.spot.name}</span>}
            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{sure(saniye)}</span>
            <span>{o.drops} düşüş{dkBasi ? ` · ${dkBasi.toFixed(1)}/dk` : ""}</span>
            <span className="ml-auto">{o.live ? `başladı ${once(o.startedAt, simdi)}` : once(o.lastSeenAt, simdi)}</span>
          </div>
          {goster.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {goster.map((e) => (
                <span key={e.itemId} className="inline-flex items-center gap-2 rounded-md pr-2.5 py-1 pl-1"
                      style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }} title={`${e.name} · ${e.drops} düşüş`}>
                  <Ikon e={e} size={24} />
                  <span className="text-[12px]" style={{ color: GRADE_COLOR[e.grade] ?? "var(--t-text)" }}>{e.name}</span>
                  <span className="text-[12.5px] font-semibold tabular-nums">{fmt(e.quantity)}</span>
                </span>
              ))}
              {o.items.length > goster.length && (
                <span className="text-[12px] self-center" style={{ color: "var(--t-faint)" }}>+{o.items.length - goster.length} eşya</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function GrindPage() {
  const [spotlar, setSpotlar] = useState<Spot[]>([]);
  const [secili, setSecili] = useState<number | null>(null);
  const [veri, setVeri] = useState<Veri | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());

  useEffect(() => {
    loadJson<Spot[]>("/api/grind/spots").then(setSpotlar).catch(() => setSpotlar([]));
  }, []);

  const yukle = useCallback(async () => {
    try {
      setVeri(await loadJson<Veri>(`/api/grind/sessions${secili ? `?spot=${secili}` : ""}`));
      setHata(null);
    } catch (e) { setHata((e as Error).message); }
  }, [secili]);

  // 30 sn'de bir yenile (uygulamanın nabzıyla aynı), saat her saniye işlesin
  useEffect(() => { void yukle(); const t = setInterval(yukle, 30_000); return () => clearInterval(t); }, [yukle]);
  useEffect(() => { const t = setInterval(() => setSimdi(Date.now()), 1000); return () => clearInterval(t); }, []);

  const canli = useMemo(() => (veri?.sessions ?? []).filter((o) => o.live), [veri]);
  const gecmis = useMemo(() => (veri?.sessions ?? []).filter((o) => !o.live), [veri]);
  const ist = veri?.stats ?? null;

  const sekmeler = (
    <div className="flex gap-1 flex-wrap">
      <button className="t-tab" data-on={secili === null} onClick={() => setSecili(null)}>Tümü</button>
      {spotlar.map((s) => (
        <button key={s.id} className="t-tab" data-on={secili === s.id} onClick={() => setSecili(s.id)}>{s.name}</button>
      ))}
    </div>
  );

  return (
    <TestShell title="Grind" subtitle="Uygulamadan gelen oturumlar — kim nerede kasıyor, ne düşüyor" tabs={sekmeler}>
      {hata && <Empty>{hata}</Empty>}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4" style={{ color: "#5fd39a" }} />
              <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--t-dim)" }}>
                Şu an kasanlar {canli.length ? `· ${canli.length}` : ""}
              </h2>
            </div>
            {canli.length === 0
              ? <Empty>Şu an kimse kasmıyor. Uygulamada sayacı başlatan burada görünür.</Empty>
              : <div className="space-y-3">{canli.map((o) => <OturumKarti key={o.id} o={o} simdi={simdi} />)}</div>}
          </section>
          <section>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
              <h2 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--t-dim)" }}>Son oturumlar</h2>
            </div>
            {gecmis.length === 0
              ? <Empty>Henüz kayıtlı oturum yok.</Empty>
              : <div className="space-y-3">{gecmis.map((o) => <OturumKarti key={o.id} o={o} simdi={simdi} />)}</div>}
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <Head icon={TrendingUp} title={secili ? "Spot ortalaması" : "Spot seç"}
                  meta={ist ? `son 30 gün` : undefined} />
            {!secili ? (
              <p className="p-5 text-[12.5px]" style={{ color: "var(--t-dim)" }}>
                Saatlik ortalama için yukarıdan bir spot seç. En az 10 dakikalık oturumlar sayılır.
              </p>
            ) : !ist || ist.oturum === 0 ? (
              <p className="p-5 text-[12.5px]" style={{ color: "var(--t-dim)" }}>Bu spotta henüz yeterli oturum yok.</p>
            ) : (
              <div className="p-4">
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { l: "oturum", v: String(ist.oturum) },
                    { l: "kişi", v: String(ist.kisi) },
                    { l: "saat", v: ist.saat.toFixed(1) },
                  ].map((k) => (
                    <div key={k.l} className="rounded-md p-2 text-center" style={{ background: "var(--t-raised)" }}>
                      <div className="text-[16px] font-semibold tabular-nums">{k.v}</div>
                      <div className="text-[11px]" style={{ color: "var(--t-faint)" }}>{k.l}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--t-faint)" }}>eşya / saat</div>
                <div className="space-y-1.5">
                  {ist.esyalar.slice(0, 12).map((e) => (
                    <div key={e.itemId} className="flex items-center gap-2">
                      <Ikon e={e} size={24} />
                      <span className="text-[12.5px] truncate flex-1" style={{ color: GRADE_COLOR[e.grade] ?? "var(--t-text)" }}>{e.name}</span>
                      <span className="text-[13px] font-semibold tabular-nums">{e.saatlik >= 10 ? Math.round(e.saatlik) : e.saatlik.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Card>
            <Head icon={Users} title="Nasıl çalışır" />
            <p className="p-5 text-[12.5px] leading-relaxed" style={{ color: "var(--t-dim)" }}>
              Aetherion Companion oyundaki ganimet balonunu sayar; oturumlar Discord hesabına işlenir.
              Uygulamayı <a href="/uygulama" className="underline" style={{ color: "var(--t-gold)" }}>buradan</a> eşleştir.
            </p>
          </Card>
        </aside>
      </div>
    </TestShell>
  );
}
