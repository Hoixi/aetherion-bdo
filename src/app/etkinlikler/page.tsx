"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface ActivityUser {
  id: number;
  familyName: string;
  avatarUrl: string;
}

interface ActivityMember {
  id: number;
  userId: number;
  user: ActivityUser;
}

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

const TYPE_LABELS: Record<string, string> = {
  KARA_TAPINAK: "Kara Tapınak",
  KAN_ALTARI: "Kan Altarı",
  PARTI_SLOTLARI: "Parti Slotları",
};

const TYPE_ICONS: Record<string, string> = {
  KARA_TAPINAK: "🏰",
  KAN_ALTARI: "🩸",
  PARTI_SLOTLARI: "⚔️",
};

const TYPE_COLORS: Record<string, string> = {
  KARA_TAPINAK: "text-purple-400 border-purple-500/20 bg-purple-500/10",
  KAN_ALTARI: "text-red-400 border-red-500/20 bg-red-500/10",
  PARTI_SLOTLARI: "text-bdo-gold border-bdo-gold/20 bg-bdo-gold/10",
};

function timeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Süresi doldu";
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}sa ${m % 60}dk`;
  return `${m}dk`;
}

export default function EtkinliklerPage() {
  const { data: session } = useSession();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"KARA_TAPINAK" | "KAN_ALTARI" | "PARTI_SLOTLARI">("PARTI_SLOTLARI");
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
    const interval = setInterval(fetchActivities, 30000); // refresh every 30s
    return () => clearInterval(interval);
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
      setPartySlot("");
      setAltarLevel("");
      setActivityNote("");
      fetchActivities();
    } else {
      const data = await res.json().catch(() => null);
      setMessage(data?.error ?? "Etkinlik olusturulamadi");
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

  if (loading) return <div className="flex items-center justify-center min-h-[40vh] text-bdo-text-muted">Yükleniyor...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bdo-gold">Etkinlikler</h1>
          <p className="text-sm text-bdo-text-muted mt-0.5">Kara Tapınak, Kan Altarı ve Parti grupları</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-bdo-gold/10 text-bdo-gold px-4 py-2 rounded-lg hover:bg-bdo-gold/20 transition-colors font-semibold"
        >
          + Etkinlik Oluştur
        </button>
      </div>

      {message && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-sm">{message}</div>
      )}

      {showForm && (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-bdo-text-primary">Yeni Etkinlik</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(["KARA_TAPINAK", "KAN_ALTARI", "PARTI_SLOTLARI"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setFormType(t); if (t !== "PARTI_SLOTLARI") setFormSize(t === "KAN_ALTARI" ? 3 : 5); }}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  formType === t ? "border-bdo-gold bg-bdo-gold/10" : "border-bdo-border bg-bdo-bg hover:border-bdo-gold/40"
                }`}
              >
                <div className="text-lg mb-1">{TYPE_ICONS[t]}</div>
                <div className="text-sm font-semibold text-bdo-text-primary">{TYPE_LABELS[t]}</div>
                <div className="text-xs text-bdo-text-muted">
                  {t === "KARA_TAPINAK" ? "5 kişi" : t === "KAN_ALTARI" ? "3 kişi" : "3 veya 5 kişi"}
                </div>
              </button>
            ))}
          </div>

          {formType === "PARTI_SLOTLARI" && (
            <div>
              <label className="block text-sm text-bdo-text-muted mb-2">Kaç kişilik?</label>
              <div className="flex gap-2">
                {[3, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFormSize(s)}
                    className={`px-6 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                      formSize === s ? "bg-bdo-gold text-bdo-bg border-bdo-gold" : "border-bdo-border text-bdo-text-muted hover:border-bdo-gold/40"
                    }`}
                  >
                    {s} Kişi
                  </button>
                ))}
              </div>
            </div>
          )}

          {formType === "PARTI_SLOTLARI" && (
            <div>
              <label className="block text-sm text-bdo-text-muted mb-2">Hangi slot?</label>
              <input
                value={partySlot}
                onChange={(e) => setPartySlot(e.target.value)}
                maxLength={120}
                placeholder="Orn: Gyfin alt, Dehkia Ash, Tungrad..."
                className="w-full rounded-lg border border-bdo-border bg-bdo-bg px-3 py-2 text-sm text-bdo-text-primary outline-none transition-colors placeholder:text-bdo-text-secondary focus:border-bdo-gold/60"
              />
            </div>
          )}

          {formType === "KAN_ALTARI" && (
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <div>
                <label className="block text-sm text-bdo-text-muted mb-2">Seviye</label>
                <input
                  value={altarLevel}
                  onChange={(e) => setAltarLevel(e.target.value)}
                  type="number"
                  min={1}
                  placeholder="Orn: 5"
                  className="w-full rounded-lg border border-bdo-border bg-bdo-bg px-3 py-2 text-sm text-bdo-text-primary outline-none transition-colors placeholder:text-bdo-text-secondary focus:border-bdo-gold/60"
                />
              </div>
              <div>
                <label className="block text-sm text-bdo-text-muted mb-2">Not</label>
                <input
                  value={activityNote}
                  onChange={(e) => setActivityNote(e.target.value)}
                  maxLength={500}
                  placeholder="Orn: Elixir alin, boss odak..."
                  className="w-full rounded-lg border border-bdo-border bg-bdo-bg px-3 py-2 text-sm text-bdo-text-primary outline-none transition-colors placeholder:text-bdo-text-secondary focus:border-bdo-gold/60"
                />
              </div>
            </div>
          )}

          <div className="text-xs text-bdo-text-muted">
            ⏱ Etkinlik 2 saat sonra otomatik silinir. Oluşturan kişi otomatik katılmış sayılır.
          </div>

          <div className="flex gap-2">
            <button
              onClick={createActivity}
              disabled={creating}
              className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50"
            >
              {creating ? "Oluşturuluyor..." : "Oluştur"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-bdo-text-muted hover:text-bdo-text-primary">
              İptal
            </button>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="text-center py-16 text-bdo-text-muted">
          <div className="text-4xl mb-3">🏹</div>
          <p>Aktif etkinlik yok. Bir tane oluştur!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activities.map((a) => {
            const isMember = a.members.some((m) => m.userId === session?.user?.id);
            const isCreator = a.creator.id === session?.user?.id;
            const isFull = a.members.length >= a.maxSize;
            const isLoading = actionLoading === a.id;

            return (
              <div key={a.id} className="bg-bdo-surface border border-bdo-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full border ${TYPE_COLORS[a.type]}`}>
                      {TYPE_ICONS[a.type]} {TYPE_LABELS[a.type]}
                    </span>
                    <div className="text-xs text-bdo-text-muted mt-1.5">⏱ {timeLeft(a.expiresAt)} kaldı</div>
                    {a.type === "PARTI_SLOTLARI" && a.partySlot && (
                      <div className="text-xs text-bdo-gold mt-1.5">Slot: {a.partySlot}</div>
                    )}
                    {a.type === "KAN_ALTARI" && (
                      <div className="text-xs text-bdo-gold mt-1.5">
                        Seviye: {a.altarLevel ?? "-"}
                        {a.note ? <span className="text-bdo-text-muted"> - {a.note}</span> : null}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold font-mono ${isFull ? "text-red-400" : "text-bdo-gold"}`}>
                      {a.members.length}/{a.maxSize}
                    </span>
                  </div>
                </div>

                {/* Slot grid */}
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(a.maxSize, 5)}, 1fr)` }}>
                  {Array.from({ length: a.maxSize }).map((_, i) => {
                    const member = a.members[i];
                    return (
                      <div key={i} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs ${
                        member ? "bg-bdo-gold/10 border border-bdo-gold/20" : "bg-bdo-bg border border-bdo-border border-dashed"
                      }`}>
                        {member ? (
                          <>
                            {member.user.avatarUrl ? (
                              <img src={member.user.avatarUrl} alt="" className="w-7 h-7 rounded-full mb-1" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-bdo-border mb-1" />
                            )}
                            <span className="text-[9px] text-bdo-text-muted truncate w-full text-center px-0.5">
                              {member.user.familyName || "?"}
                            </span>
                          </>
                        ) : (
                          <span className="text-bdo-text-muted/40 text-lg">+</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="text-[11px] text-bdo-text-muted">
                  Oluşturan: {a.creator.familyName}
                </div>

                <div className="flex gap-2">
                  {isMember && !isCreator && (
                    <button
                      onClick={() => leave(a.id)}
                      disabled={isLoading}
                      className="flex-1 text-xs py-1.5 rounded-lg border border-bdo-border text-bdo-text-muted hover:border-red-500/40 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      Ayrıl
                    </button>
                  )}
                  {!isMember && !isFull && (
                    <button
                      onClick={() => join(a.id)}
                      disabled={isLoading}
                      className="flex-1 text-xs py-1.5 rounded-lg bg-bdo-gold/10 text-bdo-gold border border-bdo-gold/20 hover:bg-bdo-gold/20 transition-colors disabled:opacity-50"
                    >
                      {isLoading ? "..." : "Katıl"}
                    </button>
                  )}
                  {!isMember && isFull && (
                    <span className="flex-1 text-xs py-1.5 text-center text-red-400/70">Dolu</span>
                  )}
                  {(isCreator || session?.user?.isAdmin) && (
                    <button
                      onClick={() => deleteActivity(a.id)}
                      disabled={isLoading}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      Sil
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
