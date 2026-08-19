"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { PortraitPanel } from "@/components/portrait-panel";
import { MobileLoginGenerator } from "@/components/mobile-login-generator";
import { UserPerformanceStats } from "@/components/user-performance-stats";
import { BDO_CLASSES, getClassByID, getClassIconUrl } from "@/lib/classes";
import { Pencil, ArrowLeft, Check, Search, Swords, Shield, History } from "lucide-react";
import { Loading, Button, Card, CardHeader, Empty } from "@/components/ui";

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

const inputCls = "w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-[13px] text-bdo-text-primary placeholder-bdo-text-secondary focus:border-bdo-gold/40 focus:outline-none transition-colors";
const labelCls = "block text-[10px] uppercase text-bdo-text-secondary tracking-wider mb-1.5";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const [familyName, setFamilyName] = useState("");
  const [ap, setAp] = useState(0);
  const [dp, setDp] = useState(0);
  const [bdoClass, setBdoClass] = useState("");
  const [spec, setSpec] = useState("awakening");
  const [classSearch, setClassSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  if (status === "loading" || loading) return <Loading />;
  if (!session || !user) return null;

  const filteredClasses = classSearch
    ? BDO_CLASSES.filter((c) => c.name.toLowerCase().includes(classSearch.toLowerCase()))
    : BDO_CLASSES;

  const specBtn = (active: boolean, disabled = false) =>
    `flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
      active ? "bg-bdo-gold text-bdo-bg" : "bg-bdo-bg border border-bdo-border text-bdo-text-muted hover:border-bdo-border-2"
    }`;

  /* ── EDIT ── */
  if (editMode) {
    return (
      <div>
        <button
          onClick={() => setEditMode(false)}
          className="flex items-center gap-1.5 text-[12px] text-bdo-text-secondary hover:text-bdo-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Profili görüntüle
        </button>

        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:items-start">
          <div className="md:sticky md:top-4">
            <PortraitPanel classId={bdoClass} spec={spec} ap={ap} dp={dp} controlledSpec={spec} onSpecChange={handleSpecChange} />
          </div>

          <div>
            <div className="mb-4">
              <h1 className="section-title">Profili Düzenle</h1>
              <p className="section-desc">Soldaki önizleme anlık olarak güncellenir.</p>
            </div>

            <div className="card p-4 space-y-4">
              <div>
                <label className={labelCls}>Aile Adı</label>
                <input type="text" value={familyName} onChange={(e) => setFamilyName(e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>AP</label>
                  <input type="number" value={ap} onChange={(e) => setAp(Number(e.target.value))} className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>DP</label>
                  <input type="number" value={dp} onChange={(e) => setDp(Number(e.target.value))} className={`${inputCls} font-mono`} />
                </div>
              </div>

              {bdoClass && (
                <div>
                  <label className={labelCls}>Spec</label>
                  <div className="flex gap-2">
                    <button onClick={() => handleSpecChange("awakening")} className={specBtn(spec !== "succession")}>
                      Awakening
                    </button>
                    <button
                      onClick={() => handleSpecChange("succession")}
                      disabled={!getClassByID(bdoClass)?.hasSuccession}
                      className={specBtn(spec === "succession")}
                    >
                      Succession
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className={labelCls}>Class</label>
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-bdo-text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                  <input
                    type="text" placeholder="Class ara..." value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    className={`${inputCls} pl-9`}
                  />
                </div>
                <div className="overflow-y-auto rounded-lg" style={{ maxHeight: "230px" }}>
                  <div className="grid grid-cols-5 sm:grid-cols-7 gap-1.5 p-0.5">
                    {filteredClasses.map((cls) => {
                      const iconUrl = getClassIconUrl(cls.id);
                      const isActive = bdoClass === cls.id;
                      return (
                        <button
                          key={cls.id}
                          type="button"
                          onClick={() => handleClassSelect(cls.id)}
                          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                            isActive
                              ? "border-bdo-gold/50 bg-bdo-gold/10"
                              : "border-bdo-border bg-bdo-bg hover:border-bdo-border-2"
                          }`}
                        >
                          {iconUrl
                            ? <img src={iconUrl} alt="" className={`w-7 h-7 ${isActive ? "" : "opacity-60"}`} />
                            : <div className="w-7 h-7 rounded bg-bdo-surface-2" />
                          }
                          <span className={`text-[8px] text-center leading-tight ${isActive ? "text-bdo-gold" : "text-bdo-text-secondary"}`}>
                            {cls.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="primary" size="md" className="flex-1" onClick={handleSave} disabled={saving} icon={saved ? Check : undefined}>
                  {saving ? "Kaydediliyor..." : saved ? "Kaydedildi" : "Kaydet"}
                </Button>
                <Button variant="ghost" size="md" onClick={() => setEditMode(false)}>İptal</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── VIEW ── */
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 md:items-start">
      <div className="md:sticky md:top-4">
        <PortraitPanel classId={user.class} spec={user.spec} ap={user.ap} dp={user.dp} />
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="section-title">{user.familyName || "Kahraman"}</h1>
            <p className="section-desc">Profil bilgilerin, gear score geçmişin ve savaş istatistiklerin.</p>
          </div>
          <Button variant="ghost" icon={Pencil} onClick={enterEdit}>Düzenle</Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="card px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">Katılım</p>
              <Swords className="w-3.5 h-3.5 text-bdo-text-secondary/50" strokeWidth={1.75} />
            </div>
            <p className="text-xl font-bold font-mono text-bdo-text-primary">{user.participations.length}</p>
            <p className="text-[10px] text-bdo-text-secondary mt-0.5">katılınan etkinlik</p>
          </div>
          <div className="card px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">Gear Puanı</p>
              <Shield className="w-3.5 h-3.5 text-bdo-text-secondary/50" strokeWidth={1.75} />
            </div>
            <p className="text-xl font-bold font-mono text-bdo-gold">{user.ap + user.dp}</p>
            <p className="text-[10px] text-bdo-text-secondary mt-0.5">{user.ap} AP · {user.dp} DP</p>
          </div>
        </div>

        <Card>
          <CardHeader title="Hasar İstatistiklerim" />
          <div className="p-4">
            <UserPerformanceStats userId={session.user.id} />
          </div>
        </Card>

        <MobileLoginGenerator />

        <Card>
          <CardHeader title="Etkinlik Geçmişi" icon={History} meta={`${user.participations.length} kayıt`} />
          {user.participations.length === 0 ? (
            <Empty text="Henüz bir etkinliğe katılmadın." />
          ) : (
            user.participations.map((p) => (
              <div key={p.id} className="card-row justify-between">
                <span className="text-[13px] text-bdo-text-primary truncate">{p.war.title}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] bg-bdo-surface-2 border border-bdo-border text-bdo-text-muted px-1.5 py-0.5 rounded">
                    {p.war.type === "NODE_WAR" ? "Node War" : p.war.type === "SIEGE" ? "Siege" : p.war.type}
                  </span>
                  <span className="text-[11px] text-bdo-text-secondary font-mono">
                    {new Date(p.war.date).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
