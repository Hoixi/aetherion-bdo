"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { WarForm } from "@/components/war-form";
import { WarPerformanceTab } from "@/components/war-performance-tab";
import { getTypeName } from "@/lib/classes";

interface War {
  id: number;
  title: string;
  type: string;
  date: string;
  notes: string;
  deadline: string | null;
  result: string | null;
  maxParticipants: number | null;
}

interface Member {
  id: number;
  familyName: string;
  class: string;
  isAdmin: boolean;
  avatarUrl: string;
  siteRole: { name: string; color: string } | null;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  creator: { familyName: string; avatarUrl: string };
}

interface SiteRole {
  id: number;
  name: string;
  isAdmin: boolean;
  color: string;
  discordRoleIds: string;
  _count: { users: number };
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [wars, setWars] = useState<War[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [roles, setRoles] = useState<SiteRole[]>([]);
  const [showWarForm, setShowWarForm] = useState(false);
  const [editingWar, setEditingWar] = useState<War | null>(null);
  const [tab, setTab] = useState<"wars" | "members" | "announcements" | "roles" | "hasar">("wars");
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annSaving, setAnnSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Role form state
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState(false);
  const [newRoleColor, setNewRoleColor] = useState("#d4a853");
  const [newRoleDiscordIds, setNewRoleDiscordIds] = useState("");
  const [editingRole, setEditingRole] = useState<SiteRole | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [settingResult, setSettingResult] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ softDeleted: number; restored: number; created: number; totalWithRole: number; incomplete: { id: number; discordId: string; familyName: string; avatarUrl: string; ap: number; dp: number; class: string; discordUsername: string }[] } | null>(null);
  const [dmSending, setDmSending] = useState<number | null>(null);
  const [dmSendingAll, setDmSendingAll] = useState(false);
  const [dmAllResult, setDmAllResult] = useState<{ sent: number; failed: number } | null>(null);
  const [registeringCmds, setRegisteringCmds] = useState(false);
  const [registerCmdsResult, setRegisterCmdsResult] = useState<string | null>(null);
  const [syncingClassRoles, setSyncingClassRoles] = useState(false);
  const [classRolesResult, setClassRolesResult] = useState<{ created: string[]; existing: string[]; assigned: number; removed: number; errors: number } | null>(null);
  const [recalcingAbsences, setRecalcingAbsences] = useState(false);
  const [recalcResult, setRecalcResult] = useState<{ warsProcessed: number; totalAbsences: number; affectedUsers: number } | null>(null);

  async function setWarResult(warId: number, result: string | null) {
    setSettingResult(warId);
    const res = await fetch(`/api/wars/${warId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    if (res.ok) {
      setWars(wars.map((w) => w.id === warId ? { ...w, result } : w));
      setMessage(result ? "Sonuç kaydedildi!" : "Sonuç kaldırıldı.");
      setTimeout(() => setMessage(null), 3000);
    }
    setSettingResult(null);
  }

  async function publishToDiscord(type: "war" | "announcement", id: number) {
    setPublishing(id);
    const res = await fetch("/api/discord/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    if (res.ok) {
      setMessage("Discord'a gönderildi!");
    } else {
      setMessage("Discord'a gönderilemedi.");
    }
    setPublishing(null);
    setTimeout(() => setMessage(null), 3000);
  }

  useEffect(() => {
    if (session && !session.user.isAdmin) router.push("/dashboard");
  }, [session, router]);

  useEffect(() => {
    fetchWars();
    fetchMembers();
    fetchAnnouncements();
    fetchRoles();
  }, []);

  async function fetchWars() {
    const res = await fetch("/api/wars");
    if (res.ok) setWars(await res.json());
  }

  async function fetchMembers() {
    const res = await fetch("/api/members");
    if (res.ok) setMembers(await res.json());
  }

  async function fetchAnnouncements() {
    const res = await fetch("/api/announcements");
    if (res.ok) setAnnouncements(await res.json());
  }

  async function fetchRoles() {
    const res = await fetch("/api/roles");
    if (res.ok) setRoles(await res.json());
  }

  async function deleteWar(id: number) {
    await fetch(`/api/wars/${id}`, { method: "DELETE" });
    setWars(wars.filter((w) => w.id !== id));
    setMessage("Etkinlik silindi.");
    setTimeout(() => setMessage(null), 3000);
  }

  async function toggleAdmin(memberId: number, isAdmin: boolean) {
    await fetch(`/api/members/${memberId}/admin`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin }),
    });
    setMembers(members.map((m) => (m.id === memberId ? { ...m, isAdmin } : m)));
    setMessage(isAdmin ? "Admin yetkisi verildi." : "Admin yetkisi kaldırıldı.");
    setTimeout(() => setMessage(null), 3000);
  }

  async function syncMembers() {
    setSyncing(true);
    setSyncResult(null);
    const res = await fetch("/api/admin/sync", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setSyncResult(data);
      fetchMembers();
    } else {
      setMessage(data.error ?? "Sync hatası");
      setTimeout(() => setMessage(null), 4000);
    }
    setSyncing(false);
  }

  async function sendDm(userId: number) {
    setDmSending(userId);
    const res = await fetch(`/api/admin/dm/${userId}`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "DM gönderildi ✓" : (data.error ?? "DM gönderilemedi"));
    setTimeout(() => setMessage(null), 3000);
    setDmSending(null);
  }

  async function sendDmAll() {
    if (!syncResult || syncResult.incomplete.length === 0) return;
    if (!confirm(`${syncResult.incomplete.length} kişiye toplu DM gönderilecek. Devam edilsin mi?`)) return;
    setDmSendingAll(true);
    setDmAllResult(null);
    let sent = 0;
    let failed = 0;
    for (const u of syncResult.incomplete) {
      const res = await fetch(`/api/admin/dm/${u.id}`, { method: "POST" });
      if (res.ok) sent++; else failed++;
    }
    setDmSendingAll(false);
    setDmAllResult({ sent, failed });
    setMessage(`Toplu DM: ${sent} gönderildi${failed > 0 ? `, ${failed} başarısız` : ""}`);
    setTimeout(() => setMessage(null), 5000);
  }

  async function registerDiscordCommands() {
    setRegisteringCmds(true);
    setRegisterCmdsResult(null);
    const res = await fetch("/api/discord/register-commands", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setRegisterCmdsResult(`✅ ${data.registered} komut başarıyla kaydedildi.`);
    } else {
      setRegisterCmdsResult(`❌ Hata: ${JSON.stringify(data.error)}`);
    }
    setRegisteringCmds(false);
  }

  async function recalcAbsences() {
    if (!confirm("Tüm kullanıcıların absenceCount'u sıfırlanıp geçmiş savaşlardan yeniden hesaplanacak. Devam edilsin mi?")) return;
    setRecalcingAbsences(true);
    setRecalcResult(null);
    const res = await fetch("/api/admin/recalc-absences", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setRecalcResult(data);
    } else {
      setMessage(`❌ Hata: ${data.error}`);
      setTimeout(() => setMessage(null), 4000);
    }
    setRecalcingAbsences(false);
  }

  async function syncClassRoles() {
    if (!confirm("Tüm sınıf rolleri Discord'da kontrol edilecek, eksikler oluşturulacak ve üyelere atanacak. Devam edilsin mi?")) return;
    setSyncingClassRoles(true);
    setClassRolesResult(null);
    const res = await fetch("/api/admin/class-roles", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setClassRolesResult(data);
    } else {
      setMessage(`❌ Hata: ${data.error}`);
      setTimeout(() => setMessage(null), 4000);
    }
    setSyncingClassRoles(false);
  }

  async function deleteMember(memberId: number, name: string) {
    if (!confirm(`"${name}" kullanıcısını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    const res = await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    if (res.ok) {
      setMembers(members.filter((m) => m.id !== memberId));
      setMessage("Üye silindi.");
    } else {
      const data = await res.json();
      setMessage(data.error ?? "Silinemedi.");
    }
    setTimeout(() => setMessage(null), 3000);
  }

  async function createAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setAnnSaving(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: annTitle, content: annContent }),
    });
    if (res.ok) {
      setAnnTitle("");
      setAnnContent("");
      fetchAnnouncements();
      setMessage("Duyuru başarıyla yayınlandı!");
      setTimeout(() => setMessage(null), 3000);
    }
    setAnnSaving(false);
  }

  async function deleteAnnouncement(id: number) {
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    setAnnouncements(announcements.filter((a) => a.id !== id));
    setMessage("Duyuru silindi.");
    setTimeout(() => setMessage(null), 3000);
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    setRoleSaving(true);

    const discordIds = newRoleDiscordIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (editingRole) {
      await fetch(`/api/roles/${editingRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName,
          isAdmin: newRoleIsAdmin,
          color: newRoleColor,
          discordRoleIds: discordIds,
        }),
      });
      setMessage("Rol güncellendi.");
    } else {
      await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName,
          isAdmin: newRoleIsAdmin,
          color: newRoleColor,
          discordRoleIds: discordIds,
        }),
      });
      setMessage("Rol oluşturuldu.");
    }

    resetRoleForm();
    fetchRoles();
    setRoleSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }

  async function deleteRole(id: number) {
    await fetch(`/api/roles/${id}`, { method: "DELETE" });
    setRoles(roles.filter((r) => r.id !== id));
    setMessage("Rol silindi.");
    setTimeout(() => setMessage(null), 3000);
  }

  function startEditRole(role: SiteRole) {
    setEditingRole(role);
    setNewRoleName(role.name);
    setNewRoleIsAdmin(role.isAdmin);
    setNewRoleColor(role.color);
    const ids: string[] = JSON.parse(role.discordRoleIds || "[]");
    setNewRoleDiscordIds(ids.join(", "));
  }

  function resetRoleForm() {
    setEditingRole(null);
    setNewRoleName("");
    setNewRoleIsAdmin(false);
    setNewRoleColor("#d4a853");
    setNewRoleDiscordIds("");
  }

  if (!session?.user.isAdmin) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-bdo-gold">Admin Panel</h1>

      {message && (
        <div className="bg-bdo-gold/10 border border-bdo-gold/30 text-bdo-gold px-4 py-2 rounded-lg text-sm">
          {message}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {(["wars", "announcements", "members", "roles", "hasar"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t ? "bg-bdo-gold text-bdo-bg" : "bg-bdo-surface text-bdo-text-muted hover:text-bdo-gold"
            }`}
          >
            {t === "wars" ? "Savaşlar" : t === "announcements" ? "Duyurular" : t === "members" ? "Üyeler" : t === "roles" ? "Roller" : "Hasar Raporu"}
          </button>
        ))}
      </div>

      {tab === "wars" && (
        <div className="space-y-4">
          <button
            onClick={() => { setEditingWar(null); setShowWarForm(true); }}
            className="text-sm bg-bdo-gold/10 text-bdo-gold px-4 py-2 rounded-lg hover:bg-bdo-gold/20 transition-colors"
          >
            + Yeni Etkinlik
          </button>

          {(showWarForm || editingWar) && (
            <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
              <WarForm
                initial={editingWar ? { ...editingWar } : undefined}
                onSubmit={() => { setShowWarForm(false); setEditingWar(null); fetchWars(); setMessage("Etkinlik başarıyla oluşturuldu!"); setTimeout(() => setMessage(null), 3000); }}
              />
            </div>
          )}

          <div className="space-y-2">
            {wars.map((war) => (
              <div key={war.id} className="bg-bdo-surface border border-bdo-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-bdo-text-primary font-semibold">{war.title}</span>
                  <span className="ml-2 text-xs bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded">
                    {getTypeName(war.type)}
                  </span>
                  <div className="text-sm text-bdo-text-muted mt-1">
                    {new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap justify-end">
                  <select
                    value={war.result || ""}
                    onChange={(e) => setWarResult(war.id, e.target.value || null)}
                    disabled={settingResult === war.id}
                    className="text-xs bg-bdo-bg border border-bdo-border rounded px-2 py-1 text-bdo-text-primary focus:border-bdo-gold focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Sonuç yok</option>
                    <option value="WIN">🏆 Kazandık</option>
                    <option value="LOSS">💀 Kaybettik</option>
                    <option value="DRAW">🤝 Berabere</option>
                  </select>
                  <button
                    onClick={() => publishToDiscord("war", war.id)}
                    disabled={publishing === war.id}
                    className="text-xs bg-[#5865F2]/10 text-[#5865F2] px-2 py-1 rounded hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50"
                  >
                    {publishing === war.id ? "..." : "Discord'a Gönder"}
                  </button>
                  <button
                    onClick={() => { setEditingWar(war); setShowWarForm(false); }}
                    className="text-xs text-bdo-gold hover:underline"
                  >
                    Düzenle
                  </button>
                  <button
                    onClick={() => deleteWar(war.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "announcements" && (
        <div className="space-y-4">
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-bdo-text-primary mb-3">Yeni Duyuru</h3>
            <form onSubmit={createAnnouncement} className="space-y-3">
              <div>
                <label className="block text-sm text-bdo-text-muted mb-1">Başlık</label>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  required
                  className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-bdo-text-muted mb-1">İçerik</label>
                <textarea
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  required
                  rows={3}
                  className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={annSaving}
                className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50"
              >
                {annSaving ? "Kaydediliyor..." : "Yayınla"}
              </button>
            </form>
          </div>

          <div className="space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className="bg-bdo-surface border border-bdo-border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-bdo-gold font-semibold">{a.title}</span>
                  <p className="text-sm text-bdo-text-secondary mt-1">{a.content}</p>
                  <div className="text-xs text-bdo-text-muted mt-1">
                    {new Date(a.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} — {a.creator.familyName}
                  </div>
                </div>
                <div className="flex gap-2 items-center flex-shrink-0">
                  <button
                    onClick={() => publishToDiscord("announcement", a.id)}
                    disabled={publishing === a.id}
                    className="text-xs bg-[#5865F2]/10 text-[#5865F2] px-2 py-1 rounded hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50"
                  >
                    {publishing === a.id ? "..." : "Discord'a Gönder"}
                  </button>
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Sil
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-4">
          {/* Sync Section */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">Discord Üye Senkronizasyonu</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Guild rolü olanları çeker, rolü olmayanları gizler.</p>
              </div>
              <button
                onClick={syncMembers}
                disabled={syncing}
                className="text-sm bg-bdo-gold/10 text-bdo-gold px-4 py-2 rounded-lg hover:bg-bdo-gold/20 transition-colors disabled:opacity-50 font-semibold"
              >
                {syncing ? "Syncleniyor..." : "🔄 Sync"}
              </button>
            </div>

            {syncResult && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg">
                    ✅ {syncResult.created} yeni üye eklendi
                  </span>
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg">
                    🔁 {syncResult.restored} üye geri getirildi
                  </span>
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg">
                    🗑 {syncResult.softDeleted} üye gizlendi
                  </span>
                  <span className="bg-bdo-gold/10 text-bdo-gold border border-bdo-gold/20 px-3 py-1.5 rounded-lg">
                    👥 Toplam {syncResult.totalWithRole} guild üyesi
                  </span>
                </div>

                {syncResult.incomplete.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-400">
                        ⚠️ {syncResult.incomplete.length} üye profilini henüz doldurmamış
                      </p>
                      <button
                        onClick={sendDmAll}
                        disabled={dmSendingAll}
                        className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {dmSendingAll ? "Gönderiliyor..." : "📨 Tümüne DM Gönder"}
                      </button>
                    </div>
                    {dmAllResult && (
                      <p className="text-xs text-bdo-text-muted">
                        ✅ {dmAllResult.sent} gönderildi{dmAllResult.failed > 0 && ` · ❌ ${dmAllResult.failed} başarısız`}
                      </p>
                    )}
                    {syncResult.incomplete.map((u) => (
                      <div key={u.id} className="flex items-center justify-between bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-bdo-border flex items-center justify-center text-xs text-bdo-text-muted">?</div>
                          )}
                          <div>
                            <span className="text-sm text-bdo-text-primary">{u.familyName || u.discordUsername}</span>
                            <span className="ml-2 text-xs text-bdo-text-muted font-mono">{u.discordId}</span>
                            <div className="text-xs text-bdo-text-muted">
                              {[!u.familyName && "Aile adı yok", !u.class && "Class yok", !u.ap && !u.dp && "GS yok"].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => sendDm(u.id)}
                          disabled={dmSending === u.id}
                          className="text-xs bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/20 px-3 py-1.5 rounded-lg hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          {dmSending === u.id ? "Gönderiliyor..." : "💬 DM Gönder"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {syncResult.incomplete.length === 0 && (
                  <p className="text-xs text-green-400">✅ Tüm üyeler profillerini doldurmuş!</p>
                )}
              </div>
            )}
          </div>

          {/* Register Discord Commands */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">Discord Slash Komutları</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Yeni komutları Discord'a kaydetmek için tıkla.</p>
              </div>
              <button
                onClick={registerDiscordCommands}
                disabled={registeringCmds}
                className="text-sm bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-lg hover:bg-indigo-500/20 transition-colors disabled:opacity-50 font-semibold"
              >
                {registeringCmds ? "Kaydediliyor..." : "🤖 Komutları Kaydet"}
              </button>
            </div>
            {registerCmdsResult && (
              <p className="text-xs mt-2 text-bdo-text-muted">{registerCmdsResult}</p>
            )}
          </div>

          {/* Class Roles Sync */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">🎭 Karakter Rolleri</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Eksik class rollerini oluşturur ve üyelere otomatik atar.</p>
              </div>
              <button
                onClick={syncClassRoles}
                disabled={syncingClassRoles}
                className="text-sm bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap"
              >
                {syncingClassRoles ? "⏳ Çalışıyor..." : "🎭 Rolleri Sync Et"}
              </button>
            </div>
            {syncingClassRoles && (
              <p className="text-xs mt-2 text-bdo-text-muted animate-pulse">Roller oluşturuluyor ve atanıyor, bu işlem 1-2 dakika sürebilir…</p>
            )}
            {classRolesResult && !syncingClassRoles && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {classRolesResult.created.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                    <span className="font-semibold text-emerald-400">✅ {classRolesResult.created.length} rol oluşturuldu</span>
                    <p className="text-bdo-text-muted mt-0.5 leading-relaxed">{classRolesResult.created.join(", ")}</p>
                  </div>
                )}
                <div className="bg-bdo-bg/50 border border-bdo-border rounded-lg p-2 space-y-1">
                  <div className="flex justify-between"><span className="text-bdo-text-muted">Mevcut roller</span><span className="font-mono text-bdo-gold">{classRolesResult.existing.length}</span></div>
                  <div className="flex justify-between"><span className="text-bdo-text-muted">Rol atandı</span><span className="font-mono text-emerald-400">{classRolesResult.assigned}</span></div>
                  <div className="flex justify-between"><span className="text-bdo-text-muted">Yanlış rol kaldırıldı</span><span className="font-mono text-orange-400">{classRolesResult.removed}</span></div>
                  {classRolesResult.errors > 0 && <div className="flex justify-between"><span className="text-bdo-text-muted">Hata</span><span className="font-mono text-red-400">{classRolesResult.errors}</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* Retroactive Absence Recalc */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">⚠️ Geçmiş Devamsızlık Hesapla</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Tüm eski savaşlara bakarak absenceCount'u sıfırdan hesaplar.</p>
              </div>
              <button
                onClick={recalcAbsences}
                disabled={recalcingAbsences}
                className="text-sm bg-red-500/10 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap"
              >
                {recalcingAbsences ? "⏳ Hesaplanıyor..." : "🔄 Yeniden Hesapla"}
              </button>
            </div>
            {recalcResult && !recalcingAbsences && (
              <div className="mt-3 flex gap-4 text-xs">
                <div className="bg-bdo-bg/50 border border-bdo-border rounded-lg px-3 py-2">
                  <span className="text-bdo-text-muted">İşlenen savaş</span>
                  <span className="ml-2 font-mono text-bdo-gold font-bold">{recalcResult.warsProcessed}</span>
                </div>
                <div className="bg-bdo-bg/50 border border-bdo-border rounded-lg px-3 py-2">
                  <span className="text-bdo-text-muted">Toplam devamsızlık</span>
                  <span className="ml-2 font-mono text-red-400 font-bold">{recalcResult.totalAbsences}</span>
                </div>
                <div className="bg-bdo-bg/50 border border-bdo-border rounded-lg px-3 py-2">
                  <span className="text-bdo-text-muted">Etkilenen üye</span>
                  <span className="ml-2 font-mono text-orange-400 font-bold">{recalcResult.affectedUsers}</span>
                </div>
              </div>
            )}
          </div>

          {/* Member List */}
          <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="bg-bdo-surface border border-bdo-border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {member.avatarUrl && <img src={member.avatarUrl} alt="" className="w-8 h-8 rounded-full" />}
                <div>
                  <span className="text-bdo-text-primary">{member.familyName || "İsimsiz"}</span>
                  {member.siteRole && (
                    <span
                      className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border"
                      style={{ color: member.siteRole.color, borderColor: `${member.siteRole.color}40`, backgroundColor: `${member.siteRole.color}15` }}
                    >
                      {member.siteRole.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAdmin(member.id, !member.isAdmin)}
                  className={`text-xs px-3 py-1 rounded transition-colors ${
                    member.isAdmin
                      ? "bg-bdo-gold text-bdo-bg"
                      : "bg-bdo-border text-bdo-text-muted hover:bg-bdo-gold/20 hover:text-bdo-gold"
                  }`}
                >
                  {member.isAdmin ? "Admin ✓" : "Admin Yap"}
                </button>
                <button
                  onClick={() => deleteMember(member.id, member.familyName || "İsimsiz")}
                  className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {tab === "hasar" && (
        <WarPerformanceTab wars={wars} />
      )}

      {tab === "roles" && (
        <div className="space-y-4">
          {/* Role creation/edit form */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-bdo-text-primary mb-3">
              {editingRole ? "Rolü Düzenle" : "Yeni Rol Oluştur"}
            </h3>
            <form onSubmit={saveRole} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-bdo-text-muted mb-1">Rol Adı</label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    required
                    placeholder="Örn: Yönetici, Subay, Üye"
                    className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-bdo-text-muted mb-1">Renk</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                      className="w-10 h-10 rounded border border-bdo-border cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                      className="flex-1 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary font-mono text-sm focus:border-bdo-gold focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm text-bdo-text-muted mb-1">
                  Discord Rol ID&apos;leri <span className="text-bdo-text-muted/60">(virgülle ayırın)</span>
                </label>
                <input
                  type="text"
                  value={newRoleDiscordIds}
                  onChange={(e) => setNewRoleDiscordIds(e.target.value)}
                  placeholder="Örn: 1327570450070634521, 1327570450070634522"
                  className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary font-mono text-sm focus:border-bdo-gold focus:outline-none"
                />
                <p className="text-[11px] text-bdo-text-muted mt-1">
                  Bu Discord rollerine sahip kişiler otomatik olarak bu site rolünü alır. Discord&apos;da Geliştirici Modu açıp roldeki sağ tık &gt; ID Kopyala.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRoleIsAdmin}
                    onChange={(e) => setNewRoleIsAdmin(e.target.checked)}
                    className="w-4 h-4 rounded border-bdo-border accent-bdo-gold"
                  />
                  <span className="text-sm text-bdo-text-secondary">Admin yetkisi ver</span>
                </label>
                <span className="text-[11px] text-bdo-text-muted">(Etkinlik/Parti/Duyuru yönetimi)</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={roleSaving || !newRoleName}
                  className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50"
                >
                  {roleSaving ? "Kaydediliyor..." : editingRole ? "Güncelle" : "Oluştur"}
                </button>
                {editingRole && (
                  <button
                    type="button"
                    onClick={resetRoleForm}
                    className="px-4 py-2 rounded-lg text-sm text-bdo-text-muted hover:text-bdo-text-primary transition-colors"
                  >
                    İptal
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Role list */}
          <div className="space-y-2">
            {roles.length === 0 && (
              <p className="text-bdo-text-muted text-sm">Henüz rol oluşturulmamış.</p>
            )}
            {roles.map((role) => {
              const discordIds: string[] = JSON.parse(role.discordRoleIds || "[]");
              return (
                <div key={role.id} className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color }} />
                      <span className="text-bdo-text-primary font-semibold">{role.name}</span>
                      {role.isAdmin && (
                        <span className="text-[10px] bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded font-bold uppercase">
                          Admin
                        </span>
                      )}
                      <span className="text-xs text-bdo-text-muted">
                        {role._count.users} üye
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditRole(role)}
                        className="text-xs text-bdo-gold hover:underline"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => deleteRole(role.id)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                  {discordIds.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {discordIds.map((id) => (
                        <span key={id} className="text-[11px] font-mono bg-bdo-bg border border-bdo-border rounded px-2 py-0.5 text-bdo-text-muted">
                          {id}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
