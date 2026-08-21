"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Swords, CalendarClock, Plus, Pencil, Trash2, Send, Power, X,
  ChevronLeft, Trophy, Users, Lock,
} from "lucide-react";
import { getTypeName } from "@/lib/classes";
import { WarForm } from "@/components/war-form";
import { TestShell, Card, Head, Empty, loadJson } from "@/components/test-shell";

/**
 * Savaş yönetimi — elle açılan savaşlar ve otomatik program bir arada.
 *
 * İkisi de aynı işin iki ucu: program haftalık olanı kendiliğinden açıyor,
 * form tek seferlikleri. Admin panelinin içinde diğer her şeyle karışık
 * duruyorlardı; savaş açacak kişinin oraya girip sekme araması gerekiyordu.
 *
 * Yalnızca savaş yönetme yetkisi olanlara açık.
 */

const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const TIERS = ["T1", "T2", "T3"] as const;

/** Form alanları tek biçim dursun diye */
const INP = "w-full px-3 h-[34px] rounded-[var(--t-r-sm)] text-[12.5px] outline-none " +
  "bg-[var(--t-raised)] border border-[var(--t-line)] text-[var(--t-text)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.08em] mb-1"
             style={{ color: "var(--t-faint)" }}>{label}</label>
      {children}
    </div>
  );
}
const TIER_COLOR: Record<string, string> = { T1: "#e8b451", T2: "#9a9aa2", T3: "#b87333" };

type War = {
  id: number; title: string; type: string; date: string; notes: string;
  deadline: string | null; result: string | null; maxParticipants: number | null;
  isAllyWar?: boolean; tier?: string;
  _count?: { participants: number };
};

type Schedule = {
  id: number; name: string; type: string; dayOfWeek: number; hour: number; minute: number;
  createDaysBefore: number; deadlineHours: number | null; maxParticipants: number | null;
  tier?: string; notes: string | null; sendToDiscord: boolean; isActive: boolean;
};

export default function SavasYonetimiPage() {
  const { data: session, status } = useSession();
  const [wars, setWars] = useState<War[] | null>(null);
  const [scheds, setScheds] = useState<Schedule[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<War | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  // Yeni program alanları
  const [sOpen, setSOpen] = useState(false);
  const [sName, setSName] = useState("");
  const [sDay, setSDay] = useState(2);
  const [sHour, setSHour] = useState(21);
  const [sMinute, setSMinute] = useState(0);
  const [sBefore, setSBefore] = useState(1);
  const [sTier, setSTier] = useState("T1");
  const [sMax, setSMax] = useState("");
  const [sDeadlineH, setSDeadlineH] = useState("");
  const [sDiscord, setSDiscord] = useState(true);
  const [sSaving, setSSaving] = useState(false);

  const canManage = session?.user.canManageWars ?? false;

  const load = useMemo(() => async () => {
    try {
      const [w, s] = await Promise.all([
        loadJson<War[]>("/api/wars"),
        loadJson<Schedule[]>("/api/war-schedules"),
      ]);
      setWars(w);
      setScheds(s);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => { if (canManage) load(); }, [canManage, load]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  async function publish(id: number, type: "war" | "parties") {
    setBusy(id);
    const res = await fetch("/api/discord/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok
      ? type === "parties"
        ? `Partiler gönderildi${data.dm ? ` · ${data.dm.sent} kişiye özel mesaj` : ""}`
        : "Savaş Discord'a gönderildi."
      : (data.error ?? "Gönderilemedi."));
    setBusy(null);
  }

  async function removeWar(w: War) {
    if (!window.confirm(`"${w.title}" silinsin mi? Geri alınamaz.`)) return;
    await fetch(`/api/wars/${w.id}`, { method: "DELETE" });
    setMsg("Savaş silindi.");
    load();
  }

  /** Savaş bitince sonucu buradan işaretleniyor — geçmiş savaşlarda görünür */
  async function setResult(w: War, result: string | null) {
    setBusy(w.id);
    const res = await fetch(`/api/wars/${w.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    if (res.ok) {
      setWars((prev) => prev?.map((x) => (x.id === w.id ? { ...x, result } : x)) ?? null);
      setMsg(result ? "Sonuç kaydedildi." : "Sonuç kaldırıldı.");
    } else {
      setMsg("Sonuç kaydedilemedi.");
    }
    setBusy(null);
  }

  async function toggleSchedule(s: Schedule) {
    await fetch(`/api/war-schedules/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    setScheds((prev) => prev?.map((x) => x.id === s.id ? { ...x, isActive: !x.isActive } : x) ?? null);
  }

  async function setScheduleTier(s: Schedule, tier: string) {
    await fetch(`/api/war-schedules/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier }),
    });
    setScheds((prev) => prev?.map((x) => x.id === s.id ? { ...x, tier } : x) ?? null);
  }

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSSaving(true);
    const res = await fetch("/api/war-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: sName, type: "NODE_WAR", dayOfWeek: sDay,
        hour: sHour, minute: sMinute, createDaysBefore: sBefore,
        deadlineHours: sDeadlineH ? Number(sDeadlineH) : null,
        maxParticipants: sMax ? Number(sMax) : null,
        tier: sTier, sendToDiscord: sDiscord,
      }),
    });
    if (res.ok) {
      setSOpen(false); setSName(""); setSMax(""); setSDeadlineH("");
      setSTier("T1"); setSDiscord(true);
      setMsg("Program oluşturuldu.");
      load();
    } else {
      setMsg("Program oluşturulamadı.");
    }
    setSSaving(false);
  }

  async function removeSchedule(s: Schedule) {
    if (!window.confirm(`"${s.name}" programı silinsin mi? Bundan sonra savaş açılmaz.`)) return;
    await fetch(`/api/war-schedules/${s.id}`, { method: "DELETE" });
    setMsg("Program silindi.");
    load();
  }

  // ── Yetki
  if (status === "loading") {
    return <TestShell title="Savaş Yönetimi"><Empty>Yükleniyor…</Empty></TestShell>;
  }
  if (!canManage) {
    return (
      <TestShell title="Savaş Yönetimi">
        <Card className="p-8 text-center">
          <Lock className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--t-faint)" }} />
          <p className="text-[13px]" style={{ color: "var(--t-dim)" }}>
            Bu ekran savaş yönetme yetkisi olanlara açık.
          </p>
        </Card>
      </TestShell>
    );
  }

  const upcoming = (wars ?? []).filter((w) => new Date(w.date).getTime() >= Date.now());
  const past = (wars ?? []).filter((w) => new Date(w.date).getTime() < Date.now());

  return (
    <TestShell
      title="Savaş Yönetimi"
      subtitle={
        wars && scheds
          ? `${upcoming.length} yaklaşan savaş · ${scheds.filter((s) => s.isActive).length} aktif program`
          : "Yükleniyor…"
      }
      aside={
        <>
          {msg && <span className="t-chip" style={{ color: "var(--t-gold)" }}>{msg}</span>}
          <Link href="/test/savaslar" className="t-tab">
            <ChevronLeft className="w-3.5 h-3.5" /> Savaşlar
          </Link>
        </>
      }
    >
      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}

      {/* Savaş oluştur / düzenle */}
      <Card className="overflow-hidden">
        <Head icon={Swords} title={editing ? "Savaşı Düzenle" : "Yeni Savaş"} />
        {showForm || editing ? (
          <div className="p-5">
            <WarForm
              initial={editing ?? undefined}
              onSubmit={() => {
                setShowForm(false); setEditing(null); load();
                setMsg(editing ? "Savaş güncellendi." : "Savaş oluşturuldu.");
              }}
            />
            <button className="t-tab mt-3" onClick={() => { setShowForm(false); setEditing(null); }}>
              <X className="w-3.5 h-3.5" /> Vazgeç
            </button>
          </div>
        ) : (
          <div className="p-5">
            <button className="t-tab" data-on onClick={() => setShowForm(true)}>
              <Plus className="w-3.5 h-3.5" /> Savaş oluştur
            </button>
          </div>
        )}
      </Card>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
        {/* Savaşlar */}
        <Card className="overflow-hidden">
          <Head icon={Swords} title="Savaşlar"
                meta={wars ? `${upcoming.length} YAKLAŞAN` : undefined} />
          {!wars && <Empty>Savaşlar geliyor…</Empty>}
          {wars && wars.length === 0 && <Empty>Henüz savaş yok.</Empty>}

          {[...upcoming, ...past].slice(0, 30).map((w) => {
            const soon = new Date(w.date).getTime() >= Date.now();
            return (
              <div key={w.id} className="t-row px-5 py-3 flex items-center gap-3 flex-wrap">
                <div className="w-1 h-8 rounded-full flex-shrink-0"
                     style={{ background: soon ? "var(--t-gold)"
                              : w.result === "WIN" ? "var(--t-good)"
                              : w.result === "LOSS" ? "var(--t-bad)" : "var(--t-faint)" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-medium truncate">{w.title}</span>
                    {w.tier && (
                      <span className="t-chip flex-shrink-0"
                            style={{ color: TIER_COLOR[w.tier], borderColor: TIER_COLOR[w.tier] + "55" }}>
                        {w.tier}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                    {getTypeName(w.type)} ·{" "}
                    {new Date(w.date).toLocaleString("tr-TR",
                      { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    {w._count ? ` · ${w._count.participants} katılım` : ""}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!soon && (
                    <select value={w.result ?? ""} disabled={busy === w.id}
                            onChange={(e) => setResult(w, e.target.value || null)}
                            title="Savaş sonucu"
                            className="h-[30px] px-2 rounded-lg text-[11px] outline-none disabled:opacity-50"
                            style={{
                              background: "var(--t-raised)", border: "1px solid var(--t-line)",
                              color: w.result === "WIN" ? "var(--t-good)"
                                : w.result === "LOSS" ? "var(--t-bad)" : "var(--t-faint)",
                            }}>
                      <option value="">Sonuç yok</option>
                      <option value="WIN">Kazandık</option>
                      <option value="LOSS">Kaybettik</option>
                      <option value="DRAW">Berabere</option>
                    </select>
                  )}
                  <button className="t-tab" title="Discord'a savaşı gönder"
                          disabled={busy === w.id} onClick={() => publish(w.id, "war")}>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button className="t-tab" title="Discord'a parti listesini gönder"
                          disabled={busy === w.id} onClick={() => publish(w.id, "parties")}>
                    <Users className="w-3.5 h-3.5" />
                  </button>
                  <Link href={`/test/savaslar/${w.id}`} className="t-tab" title="Savaş sayfası">
                    <Trophy className="w-3.5 h-3.5" />
                  </Link>
                  <button className="t-tab" title="Düzenle"
                          onClick={() => { setEditing(w); setShowForm(false); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button className="t-tab" title="Sil" onClick={() => removeWar(w)}>
                    <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--t-bad)" }} />
                  </button>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Otomatik programlar */}
        <Card className="overflow-hidden">
          <Head icon={CalendarClock} title="Otomatik Savaşlar"
                meta={scheds ? `${scheds.length} PROGRAM` : undefined} />
          <p className="px-5 pt-3 text-[11.5px]" style={{ color: "var(--t-faint)" }}>
            Her program, savaştan belirtilen gün önce savaşı kendiliğinden açar.
            Kademeyi buradan değiştirebilirsin; açılan savaşlar onu devralır.
          </p>

          {!scheds && <Empty>Programlar geliyor…</Empty>}
          {scheds && scheds.length === 0 && <Empty>Program yok.</Empty>}

          {(scheds ?? []).map((s) => (
            <div key={s.id} className="t-row px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: s.isActive ? "var(--t-good)" : "var(--t-faint)" }} />
                <span className="text-[13px] font-medium truncate flex-1"
                      style={{ opacity: s.isActive ? 1 : 0.5 }}>{s.name}</span>
                <button className="t-tab" title={s.isActive ? "Durdur" : "Başlat"}
                        onClick={() => toggleSchedule(s)}>
                  <Power className="w-3.5 h-3.5"
                         style={{ color: s.isActive ? "var(--t-good)" : "var(--t-faint)" }} />
                </button>
                <button className="t-tab" title="Sil" onClick={() => removeSchedule(s)}>
                  <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--t-bad)" }} />
                </button>
              </div>

              <div className="text-[11px] mt-1 ml-3.5" style={{ color: "var(--t-faint)" }}>
                {DAYS[s.dayOfWeek]} {String(s.hour).padStart(2, "0")}:{String(s.minute).padStart(2, "0")}
                {" · "}{s.createDaysBefore} gün önce açılır
                {s.maxParticipants ? ` · maks ${s.maxParticipants}` : ""}
                {s.sendToDiscord ? " · Discord'a gider" : ""}
              </div>

              <div className="flex items-center gap-1 mt-2 ml-3.5">
                <span className="text-[10px] uppercase tracking-[0.08em] mr-1"
                      style={{ color: "var(--t-faint)" }}>Kademe</span>
                {TIERS.map((t) => (
                  <button key={t} onClick={() => setScheduleTier(s, t)}
                          className="text-[11px] px-2 py-0.5 rounded-md transition-colors"
                          style={(s.tier ?? "T1") === t
                            ? { background: TIER_COLOR[t] + "26", color: TIER_COLOR[t] }
                            : { color: "var(--t-faint)" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="px-5 py-4" style={{ borderTop: "1px solid var(--t-line)" }}>
            {sOpen ? (
              <form onSubmit={createSchedule} className="space-y-3">
                <Field label="Başlık">
                  <input value={sName} onChange={(e) => setSName(e.target.value)} required
                         placeholder="Örn: [Node War] Salı" className={INP} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Gün">
                    <select value={sDay} onChange={(e) => setSDay(Number(e.target.value))} className={INP}>
                      {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Kademe">
                    <select value={sTier} onChange={(e) => setSTier(e.target.value)} className={INP}>
                      {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Saat">
                    <input type="number" min={0} max={23} value={sHour}
                           onChange={(e) => setSHour(Number(e.target.value))} className={INP} />
                  </Field>
                  <Field label="Dakika">
                    <input type="number" min={0} max={59} value={sMinute}
                           onChange={(e) => setSMinute(Number(e.target.value))} className={INP} />
                  </Field>
                  <Field label="Kaç gün önce açılsın">
                    <input type="number" min={0} max={7} value={sBefore}
                           onChange={(e) => setSBefore(Number(e.target.value))} className={INP} />
                  </Field>
                  <Field label="Maks. katılım">
                    <input value={sMax} onChange={(e) => setSMax(e.target.value.replace(/[^0-9]/g, ""))}
                           placeholder="boş = sınırsız" className={INP} />
                  </Field>
                </div>

                <Field label="Deadline (savaştan kaç saat önce)">
                  <input value={sDeadlineH}
                         onChange={(e) => setSDeadlineH(e.target.value.replace(/[^0-9]/g, ""))}
                         placeholder="boş = yok" className={INP} />
                </Field>

                <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--t-dim)" }}>
                  <input type="checkbox" checked={sDiscord}
                         onChange={(e) => setSDiscord(e.target.checked)} />
                  Açılınca Discord&apos;a duyurulsun
                </label>

                <div className="flex gap-2">
                  <button type="submit" className="t-tab" data-on disabled={sSaving}>
                    {sSaving ? "Kaydediliyor…" : "Programı oluştur"}
                  </button>
                  <button type="button" className="t-tab" onClick={() => setSOpen(false)}>
                    <X className="w-3.5 h-3.5" /> Vazgeç
                  </button>
                </div>
              </form>
            ) : (
              <button className="t-tab" onClick={() => setSOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Yeni program
              </button>
            )}
          </div>
        </Card>
      </div>

      <div className="pb-6" />
    </TestShell>
  );
}
