"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Castle, Droplet, Swords, Plus, Timer, Trash2, X, Zap, CalendarX,
} from "lucide-react";
import { TestShell, Card, Empty } from "@/components/app-shell";

/**
 * Etkinlik panosu.
 *
 * Kısa ömürlü ilanlar: kim ne için kaç kişi arıyor. Kayıtlar iki saat
 * sonra sunucuda siliniyor, o yüzden liste 30 saniyede bir tazeleniyor —
 * dolu bir slota tıklamak kimseyi mutlu etmiyor.
 */

type ActivityUser = { id: number; familyName: string; avatarUrl: string };
type ActivityMember = { id: number; userId: number; user: ActivityUser };
type Activity = {
  id: number;
  type: "KARA_TAPINAK" | "KAN_ALTARI" | "PARTI_SLOTLARI";
  maxSize: number;
  partySlot: string | null;
  altarLevel: number | null;
  note: string | null;
  expiresAt: string;
  createdAt: string;
  creator: ActivityUser;
  members: ActivityMember[];
};

type ActType = Activity["type"];

const TYPES: Record<ActType, { label: string; icon: React.ElementType; hint: string; color: string }> = {
  KARA_TAPINAK: { label: "Kara Tapınak", icon: Castle, hint: "5 kişi", color: "#a855f7" },
  KAN_ALTARI: { label: "Kan Altarı", icon: Droplet, hint: "3 kişi", color: "#ef5f5f" },
  PARTI_SLOTLARI: { label: "Parti Slotları", icon: Swords, hint: "3 veya 5 kişi", color: "#e8b451" },
};

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Süresi doldu";
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}sa ${m % 60}dk` : `${m}dk`;
}

export default function EtkinliklerPage() {
  const { data: session } = useSession();

  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(false);
  const [type, setType] = useState<ActType>("PARTI_SLOTLARI");
  const [size, setSize] = useState(5);
  const [slot, setSlot] = useState("");
  const [level, setLevel] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/activities");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // İlanlar 2 saatte sönüyor; liste bayat kalmasın
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [load]);

  function flash(text: string) {
    setMsg(text);
    setTimeout(() => setMsg(null), 3500);
  }

  async function create() {
    setCreating(true);
    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type, maxSize: size,
        partySlot: type === "PARTI_SLOTLARI" ? slot : undefined,
        altarLevel: type === "KAN_ALTARI" ? level : undefined,
        note: type === "KAN_ALTARI" ? note : undefined,
      }),
    });
    if (res.ok) {
      setForm(false);
      setSlot(""); setLevel(""); setNote("");
      load();
    } else {
      const data = await res.json().catch(() => null);
      flash(data?.error ?? "Etkinlik oluşturulamadı.");
    }
    setCreating(false);
  }

  async function join(id: number) {
    setBusy(id);
    const res = await fetch(`/api/activities/${id}/join`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) flash(data.error ?? "Katılınamadı."); else load();
    setBusy(null);
  }

  async function leave(id: number) {
    setBusy(id);
    await fetch(`/api/activities/${id}/leave`, { method: "DELETE" });
    load();
    setBusy(null);
  }

  async function remove(id: number) {
    setBusy(id);
    await fetch(`/api/activities/${id}`, { method: "DELETE" });
    load();
    setBusy(null);
  }

  const open = items.filter((a) => a.members.length < a.maxSize).length;

  return (
    <TestShell
      title="Etkinlikler"
      subtitle="Kara Tapınak, Kan Altarı ve parti gruplarını oluştur, boş slotları doldur."
      aside={
        <button onClick={() => setForm(!form)}
                className="t-chip inline-flex items-center gap-1"
                style={form ? undefined : { color: "var(--t-gold)", borderColor: "rgba(232,180,81,.4)" }}>
          {form ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          {form ? "İptal" : "Etkinlik oluştur"}
        </button>
      }
    >
      {msg && (
        <Card className="px-4 py-2.5">
          <p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{msg}</p>
        </Card>
      )}

      {/* ── Yeni etkinlik ──────────────────────────────────────────── */}
      {form && (
        <Card hi className="p-4 space-y-4">
          <h2 className="text-[14px] font-semibold">Yeni Etkinlik</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(TYPES) as ActType[]).map((t) => {
              const T = TYPES[t];
              const on = type === t;
              return (
                <button key={t}
                        onClick={() => { setType(t); if (t !== "PARTI_SLOTLARI") setSize(t === "KAN_ALTARI" ? 3 : 5); }}
                        className="p-3 rounded-[var(--t-r-sm)] text-left transition-colors"
                        style={{
                          background: on ? "var(--t-gold-soft)" : "var(--t-raised)",
                          border: `1px solid ${on ? "rgba(232,180,81,.4)" : "var(--t-line)"}`,
                        }}>
                  <T.icon className="w-4 h-4 mb-1.5" strokeWidth={1.9}
                          style={{ color: on ? T.color : "var(--t-faint)" }} />
                  <p className="text-[13px] font-medium">{T.label}</p>
                  <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>{T.hint}</p>
                </button>
              );
            })}
          </div>

          {type === "PARTI_SLOTLARI" && (
            <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
              <Field label="Kişi sayısı">
                <div className="flex gap-1.5">
                  {[3, 5].map((s) => (
                    <button key={s} onClick={() => setSize(s)}
                            className="flex-1 h-[34px] rounded-[var(--t-r-sm)] text-[12px] font-semibold transition-colors"
                            style={size === s
                              ? { background: "var(--t-gold)", color: "#0b0b0c", border: "1px solid var(--t-gold)" }
                              : { color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                      {s} Kişi
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Slot">
                <Input value={slot} onChange={setSlot} maxLength={120}
                       placeholder="Örn: Gyfin alt, Dehkia Ash, Tungrad…" />
              </Field>
            </div>
          )}

          {type === "KAN_ALTARI" && (
            <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
              <Field label="Seviye">
                <Input value={level} onChange={setLevel} type="number" placeholder="Örn: 5" />
              </Field>
              <Field label="Not">
                <Input value={note} onChange={setNote} maxLength={500}
                       placeholder="Örn: Elixir alın, boss odak…" />
              </Field>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1 flex-wrap">
            <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--t-faint)" }}>
              <Timer className="w-3.5 h-3.5" strokeWidth={1.8} />
              2 saat sonra otomatik silinir · oluşturan otomatik katılır
            </p>
            <button onClick={create} disabled={creating}
                    className="text-[12px] font-semibold px-3.5 h-[34px] rounded-[var(--t-r-sm)] disabled:opacity-50"
                    style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                             border: "1px solid rgba(232,180,81,.3)" }}>
              {creating ? "Oluşturuluyor…" : "Oluştur"}
            </button>
          </div>
        </Card>
      )}

      {/* ── Liste ──────────────────────────────────────────────────── */}
      {loading ? (
        <Empty>Etkinlikler geliyor…</Empty>
      ) : items.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-3">
          <CalendarX className="w-6 h-6" strokeWidth={1.5} style={{ color: "var(--t-faint)" }} />
          <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>Şu an aktif etkinlik yok.</span>
          {!form && (
            <button onClick={() => setForm(true)}
                    className="text-[12px] font-semibold px-3 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5"
                    style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                             border: "1px solid rgba(232,180,81,.3)" }}>
              <Plus className="w-3.5 h-3.5" strokeWidth={2} /> İlk etkinliği aç
            </button>
          )}
        </Card>
      ) : (
        <>
          <p className="text-[11.5px] flex items-center gap-1.5" style={{ color: "var(--t-faint)" }}>
            <Zap className="w-3.5 h-3.5" strokeWidth={1.8} />
            {items.length} etkinlik · {open} tanesinde boş slot var
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((a) => (
              <ActivityCard key={a.id} a={a}
                            meId={session?.user?.id}
                            isAdmin={!!session?.user?.isAdmin}
                            busy={busy === a.id}
                            onJoin={() => join(a.id)}
                            onLeave={() => leave(a.id)}
                            onDelete={() => remove(a.id)} />
            ))}
          </div>
        </>
      )}

      <div className="pb-6" />
    </TestShell>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.06em] mb-1.5" style={{ color: "var(--t-faint)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, maxLength, type = "text" }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; maxLength?: number; type?: string;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
           maxLength={maxLength} type={type} min={type === "number" ? 1 : undefined}
           className="w-full h-[34px] px-3 rounded-[var(--t-r-sm)] text-[13px] outline-none"
           style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
  );
}

function ActivityCard({ a, meId, isAdmin, busy, onJoin, onLeave, onDelete }: {
  a: Activity; meId?: number; isAdmin: boolean; busy: boolean;
  onJoin: () => void; onLeave: () => void; onDelete: () => void;
}) {
  const T = TYPES[a.type];
  const mine = a.members.some((m) => m.userId === meId);
  const owner = a.creator.id === meId;
  const full = a.members.length >= a.maxSize;

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md"
              style={{ color: T.color, background: T.color + "14", border: `1px solid ${T.color}30` }}>
          <T.icon className="w-3 h-3" strokeWidth={2} />
          {T.label}
        </span>
        <span className="t-num text-[13px] font-bold ml-auto"
              style={{ color: full ? "var(--t-bad)" : "var(--t-good)" }}>
          {a.members.length}/{a.maxSize}
        </span>
      </div>

      <div className="p-3.5 space-y-3 flex-1 flex flex-col">
        <div className="space-y-1">
          <p className="text-[11px] flex items-center gap-1.5" style={{ color: "var(--t-faint)" }}>
            <Timer className="w-3 h-3 flex-shrink-0" strokeWidth={1.8} />
            {timeLeft(a.expiresAt)} kaldı
          </p>
          {a.type === "PARTI_SLOTLARI" && a.partySlot && (
            <p className="text-[12px] truncate" style={{ color: "var(--t-dim)" }}>
              <span style={{ color: "var(--t-faint)" }}>Slot:</span> {a.partySlot}
            </p>
          )}
          {a.type === "KAN_ALTARI" && (
            <p className="text-[12px] truncate" style={{ color: "var(--t-dim)" }}>
              <span style={{ color: "var(--t-faint)" }}>Seviye:</span> {a.altarLevel ?? "—"}
              {a.note && <span style={{ color: "var(--t-faint)" }}> · {a.note}</span>}
            </p>
          )}
        </div>

        {/* Slotlar */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(a.maxSize, 5)}, 1fr)` }}>
          {Array.from({ length: a.maxSize }).map((_, i) => {
            const m = a.members[i];
            return (
              <div key={i} title={m?.user.familyName ?? "Boş"}
                   className="aspect-square rounded-[var(--t-r-sm)] flex flex-col items-center justify-center gap-1"
                   style={{
                     background: m ? "var(--t-raised)" : "transparent",
                     border: m ? "1px solid var(--t-line)" : "1px dashed var(--t-line-strong)",
                   }}>
                {m ? (
                  <>
                    {m.user.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.user.avatarUrl} alt="" className="w-[22px] h-[22px] rounded-full object-cover" />
                    ) : (
                      <span className="w-[22px] h-[22px] rounded-full" style={{ background: "var(--t-surface)" }} />
                    )}
                    <span className="text-[8px] truncate w-full text-center px-0.5 leading-none"
                          style={{ color: "var(--t-faint)" }}>
                      {m.user.familyName || "?"}
                    </span>
                  </>
                ) : (
                  <Plus className="w-3.5 h-3.5 opacity-30" strokeWidth={2} style={{ color: "var(--t-faint)" }} />
                )}
              </div>
            );
          })}
        </div>

        <p className="text-[10px] mt-auto" style={{ color: "var(--t-faint)" }}>
          Oluşturan: {a.creator.familyName || "—"}
        </p>

        <div className="flex gap-1.5">
          {mine && !owner && (
            <button onClick={onLeave} disabled={busy}
                    className="flex-1 text-[12px] font-semibold h-[32px] rounded-[var(--t-r-sm)] disabled:opacity-50"
                    style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
              Ayrıl
            </button>
          )}
          {!mine && !full && (
            <button onClick={onJoin} disabled={busy}
                    className="flex-1 text-[12px] font-semibold h-[32px] rounded-[var(--t-r-sm)] disabled:opacity-50"
                    style={{ color: "var(--t-good)", background: "rgba(56,208,127,.12)",
                             border: "1px solid rgba(56,208,127,.3)" }}>
              {busy ? "…" : "Katıl"}
            </button>
          )}
          {!mine && full && (
            <span className="flex-1 text-[11px] h-[32px] grid place-items-center" style={{ color: "var(--t-faint)" }}>
              Dolu
            </span>
          )}
          {(owner || isAdmin) && (
            <button onClick={onDelete} disabled={busy} aria-label="Etkinliği sil"
                    className="px-2.5 h-[32px] rounded-[var(--t-r-sm)] disabled:opacity-50"
                    style={{ color: "var(--t-bad)", background: "rgba(239,95,95,.10)",
                             border: "1px solid rgba(239,95,95,.25)" }}>
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
