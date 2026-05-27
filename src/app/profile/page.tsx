"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { PortraitPanel } from "@/components/portrait-panel";
import { MobileLoginGenerator } from "@/components/mobile-login-generator";
import { UserPerformanceStats } from "@/components/user-performance-stats";
import { BDO_CLASSES, getClassByID, getClassIconUrl } from "@/lib/classes";

interface Participation {
  id: number;
  war: { id: number; title: string; type: string; date: string };
}

interface UserProfile {
  familyName: string;
  ap: number;
  dp: number;
  class: string;
  spec: string;
  avatarUrl: string;
  participations: Participation[];
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser]     = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // Edit form state (live preview)
  const [familyName, setFamilyName] = useState("");
  const [ap, setAp]           = useState(0);
  const [dp, setDp]           = useState(0);
  const [bdoClass, setBdoClass] = useState("");
  const [spec, setSpec]       = useState("awakening");
  const [classSearch, setClassSearch] = useState("");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    fetch("/api/user/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          setUser(data);
          setFamilyName(data.familyName);
          setAp(data.ap);
          setDp(data.dp);
          setBdoClass(data.class);
          setSpec(data.spec || "awakening");
        }
        setLoading(false);
      });
  }, [status]);

  function enterEdit() {
    // Reset form to current saved values
    if (user) {
      setFamilyName(user.familyName);
      setAp(user.ap);
      setDp(user.dp);
      setBdoClass(user.class);
      setSpec(user.spec || "awakening");
    }
    setClassSearch("");
    setEditMode(true);
  }

  function cancelEdit() {
    setEditMode(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/user/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyName, ap, dp, class: bdoClass, spec }),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser((prev) => prev ? { ...prev, ...updated } : prev);
      setSaved(true);
      setTimeout(() => { setSaved(false); setEditMode(false); }, 1200);
    }
    setSaving(false);
  }

  function handleClassSelect(id: string) {
    const cls = getClassByID(id);
    setBdoClass(id);
    if (cls && !cls.hasSuccession) setSpec("awakening");
  }

  function handleSpecChange(newSpec: string) {
    const cls = getClassByID(bdoClass);
    if (newSpec === "succession" && cls && !cls.hasSuccession) return;
    setSpec(newSpec);
  }

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-bdo-text-muted">Yükleniyor...</p></div>;
  }
  if (!session || !user) return null;

  const filteredClasses = classSearch
    ? BDO_CLASSES.filter((c) => c.name.toLowerCase().includes(classSearch.toLowerCase()))
    : BDO_CLASSES;

  // ── EDIT MODE ──
  if (editMode) {
    return (
      <div className="space-y-4">
        <button onClick={cancelEdit} className="text-sm text-bdo-text-muted hover:text-bdo-gold transition-colors">
          ← Profili görüntüle
        </button>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
          {/* Live preview portrait */}
          <PortraitPanel
            classId={bdoClass}
            spec={spec}
            ap={ap}
            dp={dp}
            controlledSpec={spec}
            onSpecChange={handleSpecChange}
          />

          {/* Edit form */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-black text-white">Profili Düzenle</h1>
              <p className="text-sm text-bdo-text-muted mt-0.5">Sol tarafta önizleme anlık güncellenir</p>
            </div>

            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5 space-y-4">
              {/* Aile adı */}
              <div>
                <label className="block text-[11px] uppercase text-bdo-text-muted tracking-wider mb-1.5">Aile Adı</label>
                <input
                  type="text"
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2.5 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
                />
              </div>

              {/* AP / DP */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase text-bdo-text-muted tracking-wider mb-1.5">AP</label>
                  <input
                    type="number"
                    value={ap}
                    onChange={(e) => setAp(Number(e.target.value))}
                    className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2.5 text-bdo-text-primary font-mono focus:border-bdo-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase text-bdo-text-muted tracking-wider mb-1.5">DP</label>
                  <input
                    type="number"
                    value={dp}
                    onChange={(e) => setDp(Number(e.target.value))}
                    className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2.5 text-bdo-text-primary font-mono focus:border-bdo-gold focus:outline-none"
                  />
                </div>
              </div>

              {/* Spec */}
              {bdoClass && (
                <div>
                  <label className="block text-[11px] uppercase text-bdo-text-muted tracking-wider mb-1.5">Spec</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSpecChange("awakening")}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        spec !== "succession"
                          ? "bg-bdo-gold text-bdo-bg"
                          : "bg-bdo-bg border border-bdo-border text-bdo-text-muted hover:border-bdo-gold/30"
                      }`}
                    >
                      Awakening
                    </button>
                    <button
                      onClick={() => handleSpecChange("succession")}
                      disabled={!getClassByID(bdoClass)?.hasSuccession}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                        spec === "succession"
                          ? "bg-bdo-gold text-bdo-bg"
                          : "bg-bdo-bg border border-bdo-border text-bdo-text-muted hover:border-bdo-gold/30 disabled:hover:border-bdo-border"
                      }`}
                    >
                      Succession
                    </button>
                  </div>
                </div>
              )}

              {/* Class grid */}
              <div>
                <label className="block text-[11px] uppercase text-bdo-text-muted tracking-wider mb-1.5">Class</label>
                <input
                  type="text"
                  placeholder="Ara..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none mb-2"
                />
                <div className="overflow-y-auto rounded-lg" style={{ maxHeight: "220px" }}>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 p-1">
                    {filteredClasses.map((cls) => {
                      const iconUrl = getClassIconUrl(cls.id);
                      const isActive = bdoClass === cls.id;
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => handleClassSelect(cls.id)}
                          className={`flex flex-col items-center gap-1 p-2 rounded-lg border transition-all ${
                            isActive
                              ? "border-bdo-gold bg-bdo-gold/10 shadow-[0_0_8px_rgba(212,168,83,0.2)]"
                              : "border-bdo-border bg-bdo-bg hover:border-bdo-gold/30 hover:bg-bdo-gold/5"
                          }`}
                        >
                          {iconUrl ? (
                            <img src={iconUrl} alt={cls.name} className="w-8 h-8" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-bdo-border/30" />
                          )}
                          <span className={`text-[8px] text-center leading-tight ${isActive ? "text-bdo-gold" : "text-bdo-text-muted"}`}>
                            {cls.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-3 bg-bdo-gold text-bdo-bg font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Kaydediliyor..." : saved ? "Kaydedildi ✓" : "Kaydet"}
                </button>
                <button
                  onClick={cancelEdit}
                  className="px-5 py-3 border border-bdo-border text-bdo-text-muted rounded-lg hover:border-bdo-text-muted/30 transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW MODE ──
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">

        {/* Portrait panel */}
        <PortraitPanel
          classId={user.class}
          spec={user.spec}
          ap={user.ap}
          dp={user.dp}
        />

        {/* Right: header + stats + history */}
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-black text-white">{user.familyName || "Kahraman"}</h1>
              <p className="text-sm text-bdo-text-muted mt-0.5">Profilim</p>
            </div>
            <button
              onClick={enterEdit}
              className="px-4 py-2 bg-bdo-gold/10 border border-bdo-gold/30 text-bdo-gold text-sm font-semibold rounded-lg hover:bg-bdo-gold/20 transition-colors"
            >
              ✏️ Düzenle
            </button>
          </div>

          {/* Participation summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-1">Etkinlik Katılımı</div>
              <div className="text-2xl font-bold font-mono text-bdo-gold">{user.participations.length}</div>
              <div className="text-[10px] text-bdo-text-muted">katılınan etkinlik</div>
            </div>
            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4 text-center">
              <div className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-1">Gear Score</div>
              <div className="text-2xl font-bold font-mono text-bdo-gold">{user.ap + user.dp}</div>
              <div className="text-[10px] text-bdo-text-muted">{user.ap} AP / {user.dp} DP</div>
            </div>
          </div>

          {/* Performance stats */}
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
            <h3 className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-4">Hasar İstatistiklerim</h3>
            <UserPerformanceStats userId={session.user.id} />
          </div>

          {/* Mobile login generator */}
          <MobileLoginGenerator />

          {/* War history */}
          {user.participations.length > 0 && (
            <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
              <h3 className="text-[10px] uppercase text-bdo-text-muted tracking-wider mb-3">Etkinlik Geçmişi</h3>
              <div className="space-y-1.5">
                {user.participations.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-bdo-gold/5 transition-colors -mx-1">
                    <span className="text-sm text-bdo-text-primary">{p.war.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded">
                        {p.war.type === "NODE_WAR" ? "Node War" : p.war.type === "SIEGE" ? "Siege" : p.war.type}
                      </span>
                      <span className="text-xs text-bdo-text-muted">
                        {new Date(p.war.date).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
