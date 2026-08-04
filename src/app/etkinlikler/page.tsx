"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Castle, Droplet, Swords, Plus, Timer, Trash2, X, LucideIcon, CalendarX, Zap } from "lucide-react";
import { PageHeader, Loading, Button, Empty, Avatar } from "@/components/ui";

interface ActivityUser { id: number; familyName: string; avatarUrl: string }
interface ActivityMember { id: number; userId: number; user: ActivityUser }
interface Activity {
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
}

type ActType = Activity["type"];

const TYPES: Record<ActType, { label: string; icon: LucideIcon; hint: string; accent: string; chip: string }> = {
  KARA_TAPINAK: {
    label: "Kara Tapınak", icon: Castle, hint: "5 kişi",
    accent: "text-purple-400", chip: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  },
  KAN_ALTARI: {
    label: "Kan Altarı", icon: Droplet, hint: "3 kişi",
    accent: "text-red-400", chip: "bg-red-500/10 border-red-500/20 text-red-400",
  },
  PARTI_SLOTLARI: {
    label: "Parti Slotları", icon: Swords, hint: "3 veya 5 kişi",
    accent: "text-bdo-gold", chip: "bg-bdo-gold/10 border-bdo-gold/20 text-bdo-gold",
  },
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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<ActType>("PARTI_SLOTLARI");
  const [formSize, setFormSize] = useState(5);
  const [partySlot, setPartySlot] = useState("");
  const [altarLevel, setAltarLevel] = useState("");
  const [activityNote, setActivityNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    const res = await fetch("/api/activities");
    if (res.ok) setActivities(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchActivities();
    const iv = setInterval(fetchActivities, 30000);
    return () => clearInterval(iv);
  }, [fetchActivities]);

  async function createActivity() {
    setCreating(true);
    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: formType,
        maxSize: formSize,
        partySlot: formType === "PARTI_SLOTLARI" ? partySlot : undefined,
        altarLevel: formType === "KAN_ALTARI" ? altarLevel : undefined,
        note: formType === "KAN_ALTARI" ? activityNote : undefined,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setPartySlot(""); setAltarLevel(""); setActivityNote("");
      fetchActivities();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Etkinlik oluşturulamadı");
      setTimeout(() => setMessage(null), 3000);
    }
    setCreating(false);
  }

  async function join(id: number) {
    setActionLoading(id);
    const res = await fetch(`/api/activities/${id}/join`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { setMessage(data.error); setTimeout(() => setMessage(null), 3000); }
    else fetchActivities();
    setActionLoading(null);
  }

  async function leave(id: number) {
    setActionLoading(id);
    await fetch(`/api/activities/${id}/leave`, { method: "DELETE" });
    fetchActivities();
    setActionLoading(null);
  }

  async function deleteActivity(id: number) {
    setActionLoading(id);
    await fetch(`/api/activities/${id}`, { method: "DELETE" });
    fetchActivities();
    setActionLoading(null);
  }

  if (loading) return <Loading />;

  const inputCls = "w-full rounded-lg border border-bdo-border bg-bdo-bg px-3 py-2 text-[13px] text-bdo-text-primary outline-none transition-colors placeholder:text-bdo-text-secondary focus:border-bdo-gold/40";

  return (
    <div>
      <PageHeader
        title="Etkinlikler"
        desc="Kara Tapınak, Kan Altarı ve parti gruplarını oluştur, boş slotları doldur."
        icon={Zap}
        action={
          <Button variant={showForm ? "ghost" : "primary"} icon={showForm ? X : Plus} onClick={() => setShowForm(!showForm)}>
            {showForm ? "İptal" : "Etkinlik Oluştur"}
          </Button>
        }
      />

      {message && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-[13px] mb-4">
          {message}
        </div>
      )}

      {showForm && (
        <div className="card p-4 space-y-4 mb-4">
          <p className="card-title">Yeni Etkinlik</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(TYPES) as ActType[]).map((t) => {
              const T = TYPES[t];
              const active = formType === t;
              return (
                <button
                  key={t}
                  onClick={() => { setFormType(t); if (t !== "PARTI_SLOTLARI") setFormSize(t === "KAN_ALTARI" ? 3 : 5); }}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    active ? "border-bdo-gold/40 bg-bdo-gold/5" : "border-bdo-border bg-bdo-bg hover:border-bdo-border-2"
                  }`}
                >
                  <T.icon className={`w-4 h-4 mb-1.5 ${active ? T.accent : "text-bdo-text-secondary"}`} strokeWidth={1.75} />
                  <p className="text-[13px] font-medium text-bdo-text-primary">{T.label}</p>
                  <p className="text-[11px] text-bdo-text-secondary">{T.hint}</p>
                </button>
              );
            })}
          </div>

          {formType === "PARTI_SLOTLARI" && (
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <div>
                <label className="block text-[11px] text-bdo-text-secondary uppercase tracking-wider mb-1.5">Kişi sayısı</label>
                <div className="flex gap-1.5">
                  {[3, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setFormSize(s)}
                      className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                        formSize === s ? "bg-bdo-gold text-bdo-bg border-bdo-gold" : "border-bdo-border text-bdo-text-muted hover:border-bdo-border-2"
                      }`}
                    >
                      {s} Kişi
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] text-bdo-text-secondary uppercase tracking-wider mb-1.5">Slot</label>
                <input value={partySlot} onChange={(e) => setPartySlot(e.target.value)} maxLength={120}
                  placeholder="Örn: Gyfin alt, Dehkia Ash, Tungrad..." className={inputCls} />
              </div>
            </div>
          )}

          {formType === "KAN_ALTARI" && (
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <div>
                <label className="block text-[11px] text-bdo-text-secondary uppercase tracking-wider mb-1.5">Seviye</label>
                <input value={altarLevel} onChange={(e) => setAltarLevel(e.target.value)} type="number" min={1}
                  placeholder="Örn: 5" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] text-bdo-text-secondary uppercase tracking-wider mb-1.5">Not</label>
                <input value={activityNote} onChange={(e) => setActivityNote(e.target.value)} maxLength={500}
                  placeholder="Örn: Elixir alın, boss odak..." className={inputCls} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[11px] text-bdo-text-secondary flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5" strokeWidth={1.75} />
              2 saat sonra otomatik silinir · oluşturan otomatik katılır
            </p>
            <Button variant="primary" size="md" onClick={createActivity} disabled={creating}>
              {creating ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="card">
          <Empty
            icon={CalendarX}
            text="Aktif etkinlik yok."
            action={!showForm && <Button variant="primary" icon={Plus} onClick={() => setShowForm(true)}>Etkinlik Oluştur</Button>}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((a) => {
            const T = TYPES[a.type];
            const isMember = a.members.some((m) => m.userId === session?.user?.id);
            const isCreator = a.creator.id === session?.user?.id;
            const isFull = a.members.length >= a.maxSize;
            const isLoading = actionLoading === a.id;

            return (
              <div key={a.id} className="card flex flex-col">
                {/* Header */}
                <div className="card-header">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border ${T.chip}`}>
                    <T.icon className="w-3 h-3" strokeWidth={2} />
                    {T.label}
                  </span>
                  <span className={`text-[13px] font-bold font-mono ${isFull ? "text-red-400" : "text-emerald-400"}`}>
                    {a.members.length}/{a.maxSize}
                  </span>
                </div>

                <div className="p-3 space-y-3 flex-1 flex flex-col">
                  {/* Meta */}
                  <div className="space-y-1">
                    <p className="text-[11px] text-bdo-text-secondary flex items-center gap-1.5">
                      <Timer className="w-3 h-3 flex-shrink-0" strokeWidth={1.75} />
                      {timeLeft(a.expiresAt)} kaldı
                    </p>
                    {a.type === "PARTI_SLOTLARI" && a.partySlot && (
                      <p className="text-[12px] text-bdo-text-muted truncate">
                        <span className="text-bdo-text-secondary">Slot:</span> {a.partySlot}
                      </p>
                    )}
                    {a.type === "KAN_ALTARI" && (
                      <p className="text-[12px] text-bdo-text-muted truncate">
                        <span className="text-bdo-text-secondary">Seviye:</span> {a.altarLevel ?? "—"}
                        {a.note && <span className="text-bdo-text-secondary"> · {a.note}</span>}
                      </p>
                    )}
                  </div>

                  {/* Slots */}
                  <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(a.maxSize, 5)}, 1fr)` }}>
                    {Array.from({ length: a.maxSize }).map((_, i) => {
                      const member = a.members[i];
                      return (
                        <div
                          key={i}
                          className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 ${
                            member ? "bg-bdo-surface-2 border border-bdo-border" : "bg-bdo-bg border border-dashed border-bdo-border"
                          }`}
                          title={member?.user.familyName ?? "Boş"}
                        >
                          {member ? (
                            <>
                              <Avatar src={member.user.avatarUrl} size={22} ring={false} />
                              <span className="text-[8px] text-bdo-text-secondary truncate w-full text-center px-0.5 leading-none">
                                {member.user.familyName || "?"}
                              </span>
                            </>
                          ) : (
                            <Plus className="w-3.5 h-3.5 text-bdo-text-secondary/30" strokeWidth={2} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[10px] text-bdo-text-secondary mt-auto">
                    Oluşturan: {a.creator.familyName || "—"}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    {isMember && !isCreator && (
                      <Button variant="ghost" className="flex-1" onClick={() => leave(a.id)} disabled={isLoading}>Ayrıl</Button>
                    )}
                    {!isMember && !isFull && (
                      <Button variant="success" className="flex-1" onClick={() => join(a.id)} disabled={isLoading}>
                        {isLoading ? "..." : "Katıl"}
                      </Button>
                    )}
                    {!isMember && isFull && (
                      <span className="flex-1 text-[11px] py-1.5 text-center text-bdo-text-secondary">Dolu</span>
                    )}
                    {(isCreator || session?.user?.isAdmin) && (
                      <Button variant="danger" icon={Trash2} onClick={() => deleteActivity(a.id)} disabled={isLoading} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
