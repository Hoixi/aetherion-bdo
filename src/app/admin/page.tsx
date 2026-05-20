"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { WarForm } from "@/components/war-form";
import { WarPerformanceTab } from "@/components/war-performance-tab";
import { getTypeName } from "@/lib/classes";
import type { MapMarker } from "@/components/bdo-leaflet-map";

const BdoLeafletMap = dynamic(
  () => import("@/components/bdo-leaflet-map").then((m) => ({ default: m.BdoLeafletMap })),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#1a1a2e]" /> }
);

// Small wrapper so we can pass props cleanly inside the admin JSX
function GeoAdminPicker({
  pickedX,
  pickedY,
  onPick,
}: {
  pickedX: number | null;
  pickedY: number | null;
  onPick: (x: number, y: number) => void;
}) {
  const markers: MapMarker[] = pickedX != null && pickedY != null
    ? [{ x: pickedX, y: pickedY, color: "red", label: "Konum" }]
    : [];
  return (
    <BdoLeafletMap
      className="w-full h-full"
      onPick={onPick}
      markers={markers}
    />
  );
}

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

type AnnouncementTarget = "all" | "no_login" | "no_gear" | "pvp";

interface Announcement {
  id: number;
  title: string;
  content: string;
  target: AnnouncementTarget;
  createdAt: string;
  creator: { familyName: string; avatarUrl: string };
}

const TARGET_LABELS: Record<AnnouncementTarget, string> = {
  all: "📢 Tüm Klan (kanal)",
  no_login: "👤 Siteye giriş yapmamışlar (DM)",
  no_gear: "⚔️ Gear doldurmamışlar (DM)",
  pvp: "🗡️ PvP'ciler — savaşa girenler (DM)",
};

interface WarSchedule {
  id: number;
  name: string;
  type: string;
  dayOfWeek: number;
  hour: number;
  minute: number;
  createDaysBefore: number;
  deadlineHours: number | null;
  maxParticipants: number | null;
  notes: string | null;
  sendToDiscord: boolean;
  isActive: boolean;
}

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

interface SiteRole {
  id: number;
  name: string;
  isAdmin: boolean;
  color: string;
  discordRoleIds: string;
  priority: number;
  _count: { users: number };
}

interface GeoImage {
  id: number;
  imageUrl: string;
  mapX: number;
  mapY: number;
  hint: string | null;
  createdAt: string;
  creator: { familyName: string };
}

export default function AdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [wars, setWars] = useState<War[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [roles, setRoles] = useState<SiteRole[]>([]);
  const [warSchedules, setWarSchedules] = useState<WarSchedule[]>([]);
  const [geoImages, setGeoImages] = useState<GeoImage[]>([]);
  const [geoImgUrl, setGeoImgUrl] = useState("");
  const [geoImgHint, setGeoImgHint] = useState("");
  const [geoPickMode, setGeoPickMode] = useState(false);
  const [geoPickX, setGeoPickX] = useState<number | null>(null);
  const [geoPickY, setGeoPickY] = useState<number | null>(null);
  const [geoSaving, setGeoSaving] = useState(false);
  const [geoUploading, setGeoUploading] = useState(false);
  const [geoUploadMode, setGeoUploadMode] = useState<"url" | "file">("file");

  // War schedule form
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedName, setSchedName] = useState("");
  const [schedType, setSchedType] = useState("NODE_WAR");
  const [schedDay, setSchedDay] = useState(2); // Salı default
  const [schedHour, setSchedHour] = useState(21);
  const [schedMinute, setSchedMinute] = useState(0);
  const [schedCreateBefore, setSchedCreateBefore] = useState(1);
  const [schedDeadlineH, setSchedDeadlineH] = useState<string>("");
  const [schedMaxP, setSchedMaxP] = useState<string>("");
  const [schedNotes, setSchedNotes] = useState("");
  const [schedDiscord, setSchedDiscord] = useState(true);
  const [schedSaving, setSchedSaving] = useState(false);
  const [showWarForm, setShowWarForm] = useState(false);
  const [editingWar, setEditingWar] = useState<War | null>(null);
  const [tab, setTab] = useState<"wars" | "members" | "announcements" | "roles" | "hasar" | "araçlar" | "geo">("wars");
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annTarget, setAnnTarget] = useState<AnnouncementTarget>("all");
  const [annSaving, setAnnSaving] = useState(false);
  const [publishResult, setPublishResult] = useState<{ sent?: number; failed?: number; target?: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form preview state (shown before saving)
  const [formPreviewLoading, setFormPreviewLoading] = useState(false);
  const [formPreviewData, setFormPreviewData] = useState<{
    mode: "channel" | "dm";
    count: number | null;
    users: { id: number; discordId: string; familyName: string; class: string; ap: number; dp: number; avatarUrl: string }[];
  } | null>(null);

  // List preview state: which announcement ID is being previewed, and the fetched user list
  const [previewAnnId, setPreviewAnnId] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{
    mode: "channel" | "dm";
    count: number | null;
    users: { id: number; discordId: string; familyName: string; class: string; ap: number; dp: number; avatarUrl: string }[];
  } | null>(null);

  // Role form state
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState(false);
  const [newRoleColor, setNewRoleColor] = useState("#d4a853");
  const [newRoleDiscordIds, setNewRoleDiscordIds] = useState("");
  const [newRolePriority, setNewRolePriority] = useState(0);
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
  const [fixingDb, setFixingDb] = useState(false);
  const [fixDbResult, setFixDbResult] = useState<string | null>(null);

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
    setPublishResult(null);
    const res = await fetch("/api/discord/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    const data = res.ok ? await res.json() : null;
    if (res.ok) {
      if (data?.sent !== undefined) {
        setPublishResult({ sent: data.sent, failed: data.failed, target: data.target });
        setMessage(`DM gönderildi: ${data.sent} başarılı${data.failed > 0 ? `, ${data.failed} başarısız` : ""}`);
      } else {
        setMessage("Discord'a gönderildi!");
      }
    } else {
      setMessage("Discord'a gönderilemedi.");
    }
    setPublishing(null);
    setPreviewAnnId(null);
    setPreviewData(null);
    setTimeout(() => { setMessage(null); setPublishResult(null); }, 5000);
  }

  async function previewAnnouncement(ann: Announcement) {
    // If already previewing this one, collapse
    if (previewAnnId === ann.id) {
      setPreviewAnnId(null);
      setPreviewData(null);
      return;
    }
    setPreviewAnnId(ann.id);
    setPreviewData(null);
    setPreviewLoading(true);
    const res = await fetch(`/api/announcements/preview-target?target=${ann.target}`);
    if (res.ok) setPreviewData(await res.json());
    setPreviewLoading(false);
  }

  useEffect(() => {
    if (session && !session.user.isAdmin) router.push("/dashboard");
  }, [session, router]);

  useEffect(() => {
    fetchWars();
    fetchMembers();
    fetchAnnouncements();
    fetchRoles();
    fetchWarSchedules();
    fetchGeoImages();
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

  async function fetchWarSchedules() {
    const res = await fetch("/api/war-schedules");
    if (res.ok) setWarSchedules(await res.json());
  }

  async function fetchGeoImages() {
    const res = await fetch("/api/geo/images");
    if (res.ok) setGeoImages(await res.json());
  }

  async function addGeoImage(e: React.FormEvent) {
    e.preventDefault();
    if (!geoImgUrl || geoPickX == null || geoPickY == null) return;
    setGeoSaving(true);
    const res = await fetch("/api/geo/images", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: geoImgUrl, mapX: geoPickX, mapY: geoPickY, hint: geoImgHint || null }),
    });
    if (res.ok) {
      setGeoImgUrl(""); setGeoImgHint(""); setGeoPickX(null); setGeoPickY(null);
      setGeoPickMode(false);
      fetchGeoImages();
      setMessage("Resim eklendi!");
      setTimeout(() => setMessage(null), 3000);
    } else {
      const d = await res.json().catch(() => ({}));
      setMessage(d.error || "Resim eklenemedi");
      setTimeout(() => setMessage(null), 4000);
    }
    setGeoSaving(false);
  }

  async function deleteGeoImage(id: number) {
    if (!confirm("Bu resmi silmek istediğinizden emin misiniz?")) return;
    await fetch(`/api/geo/images/${id}`, { method: "DELETE" });
    setGeoImages(geoImages.filter((img) => img.id !== id));
    setMessage("Resim silindi.");
    setTimeout(() => setMessage(null), 3000);
  }

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSchedSaving(true);
    const res = await fetch("/api/war-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: schedName, type: schedType, dayOfWeek: schedDay,
        hour: schedHour, minute: schedMinute, createDaysBefore: schedCreateBefore,
        deadlineHours: schedDeadlineH ? Number(schedDeadlineH) : null,
        maxParticipants: schedMaxP ? Number(schedMaxP) : null,
        notes: schedNotes || null, sendToDiscord: schedDiscord,
      }),
    });
    if (res.ok) {
      setShowScheduleForm(false);
      setSchedName(""); setSchedType("NODE_WAR"); setSchedDay(2);
      setSchedHour(21); setSchedMinute(0); setSchedCreateBefore(1);
      setSchedDeadlineH(""); setSchedMaxP(""); setSchedNotes(""); setSchedDiscord(true);
      fetchWarSchedules();
      setMessage("Program oluşturuldu!");
      setTimeout(() => setMessage(null), 3000);
    }
    setSchedSaving(false);
  }

  async function toggleSchedule(id: number, isActive: boolean) {
    await fetch(`/api/war-schedules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    setWarSchedules(warSchedules.map((s) => s.id === id ? { ...s, isActive } : s));
  }

  async function deleteSchedule(id: number) {
    if (!confirm("Bu programı silmek istediğinizden emin misiniz?")) return;
    await fetch(`/api/war-schedules/${id}`, { method: "DELETE" });
    setWarSchedules(warSchedules.filter((s) => s.id !== id));
    setMessage("Program silindi.");
    setTimeout(() => setMessage(null), 3000);
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

  async function fixLongText() {
    setFixingDb(true);
    setFixDbResult(null);
    const res = await fetch("/api/admin/fix-longtext", { method: "POST" });
    const data = await res.json();
    setFixDbResult(data.message ?? data.error ?? (res.ok ? "Tamam" : "Hata"));
    setFixingDb(false);
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

  // Step 1: fetch preview, show panel
  async function previewNewAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    setFormPreviewLoading(true);
    setFormPreviewData(null);
    const res = await fetch(`/api/announcements/preview-target?target=${annTarget}`);
    if (res.ok) setFormPreviewData(await res.json());
    setFormPreviewLoading(false);
  }

  // Step 2: actually save + send
  async function createAndSendAnnouncement() {
    setAnnSaving(true);
    // Create in DB
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: annTitle, content: annContent, target: annTarget }),
    });
    if (!res.ok) { setAnnSaving(false); setMessage("Kaydedilemedi."); setTimeout(() => setMessage(null), 3000); return; }
    const ann = await res.json();

    // Send to Discord
    const pubRes = await fetch("/api/discord/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "announcement", id: ann.id }),
    });
    const pubData = pubRes.ok ? await pubRes.json() : null;

    setAnnTitle("");
    setAnnContent("");
    setAnnTarget("all");
    setFormPreviewData(null);
    fetchAnnouncements();
    setAnnSaving(false);

    if (pubData?.sent !== undefined) {
      setMessage(`Duyuru kaydedildi ve ${pubData.sent} kişiye DM gönderildi${pubData.failed > 0 ? ` (${pubData.failed} başarısız)` : ""}!`);
    } else {
      setMessage("Duyuru kaydedildi ve Discord'a gönderildi!");
    }
    setTimeout(() => setMessage(null), 5000);
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
          priority: newRolePriority,
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
          priority: newRolePriority,
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
    setNewRolePriority(role.priority ?? 0);
    const ids: string[] = JSON.parse(role.discordRoleIds || "[]");
    setNewRoleDiscordIds(ids.join(", "));
  }

  function resetRoleForm() {
    setEditingRole(null);
    setNewRoleName("");
    setNewRoleIsAdmin(false);
    setNewRoleColor("#d4a853");
    setNewRoleDiscordIds("");
    setNewRolePriority(0);
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
        {(["wars", "announcements", "members", "roles", "hasar", "araçlar", "geo"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === t ? "bg-bdo-gold text-bdo-bg" : "bg-bdo-surface text-bdo-text-muted hover:text-bdo-gold"
            }`}
          >
            {t === "wars" ? "Savaşlar"
              : t === "announcements" ? "Duyurular"
              : t === "members" ? "Üyeler"
              : t === "roles" ? "Roller"
              : t === "hasar" ? "Hasar Raporu"
              : t === "geo" ? "🗺️ GeoGuessr"
              : "🛠 Araçlar"}
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
                <Link href={`/wars/${war.id}`} className="flex-1 hover:opacity-80 transition-opacity">
                  <span className="text-bdo-text-primary font-semibold cursor-pointer hover:text-bdo-gold transition-colors">{war.title}</span>
                  <span className="ml-2 text-xs bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded">
                    {getTypeName(war.type)}
                  </span>
                  <div className="text-sm text-bdo-text-muted mt-1">
                    {new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </Link>
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
                  <Link
                    href={`/wars/${war.id}`}
                    className="text-xs bg-bdo-gold/10 text-bdo-gold px-2 py-1 rounded hover:bg-bdo-gold/20 transition-colors font-semibold"
                  >
                    ⚔️ Parti Kur
                  </Link>
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

          {/* ── Otomatik Savaş Programı ── */}
          <div className="mt-6 border-t border-bdo-border pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">📅 Otomatik Savaş Programı</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Belirtilen günlerde savaşlar otomatik oluşturulur ve Discord&apos;a gönderilir.</p>
              </div>
              <button onClick={() => setShowScheduleForm(!showScheduleForm)} className="text-xs bg-bdo-gold/10 text-bdo-gold px-3 py-1.5 rounded hover:bg-bdo-gold/20 transition-colors font-semibold">
                {showScheduleForm ? "İptal" : "+ Program Ekle"}
              </button>
            </div>

            {showScheduleForm && (
              <form onSubmit={createSchedule} className="bg-bdo-surface border border-bdo-border rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-bdo-text-muted mb-1">Başlık</label>
                    <input value={schedName} onChange={(e) => setSchedName(e.target.value)} required placeholder="Örn: Haftalık Node Savaşı" className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-bdo-text-muted mb-1">Tür</label>
                    <select value={schedType} onChange={(e) => setSchedType(e.target.value)} className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none">
                      <option value="NODE_WAR">Node Savaşı</option>
                      <option value="SIEGE">Kuşatma</option>
                      <option value="KARA_TAPINAK">Kara Tapınak</option>
                      <option value="OTHER">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-bdo-text-muted mb-1">Savaş Günü</label>
                    <select value={schedDay} onChange={(e) => setSchedDay(Number(e.target.value))} className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none">
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-bdo-text-muted mb-1">Saat (TR saatiyle)</label>
                    <div className="flex gap-2">
                      <input type="number" min={0} max={23} value={schedHour} onChange={(e) => setSchedHour(Number(e.target.value))} className="w-20 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none font-mono" />
                      <span className="text-bdo-text-muted self-center">:</span>
                      <input type="number" min={0} max={59} step={5} value={schedMinute} onChange={(e) => setSchedMinute(Number(e.target.value))} className="w-20 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-bdo-text-muted mb-1">Kaç gün önce oluşturulsun</label>
                    <input type="number" min={1} max={7} value={schedCreateBefore} onChange={(e) => setSchedCreateBefore(Number(e.target.value))} className="w-24 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-bdo-text-muted mb-1">Kayıt deadline (saatten önce, boş = yok)</label>
                    <input type="number" min={1} value={schedDeadlineH} onChange={(e) => setSchedDeadlineH(e.target.value)} placeholder="örn: 2" className="w-24 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none font-mono" />
                  </div>
                  <div>
                    <label className="block text-xs text-bdo-text-muted mb-1">Maks. katılımcı (boş = sınırsız)</label>
                    <input type="number" min={1} value={schedMaxP} onChange={(e) => setSchedMaxP(e.target.value)} placeholder="örn: 100" className="w-28 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none font-mono" />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="schedDiscord" checked={schedDiscord} onChange={(e) => setSchedDiscord(e.target.checked)} className="accent-bdo-gold" />
                    <label htmlFor="schedDiscord" className="text-sm text-bdo-text-secondary cursor-pointer">Otomatik Discord&apos;a gönder</label>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-bdo-text-muted mb-1">Not (opsiyonel)</label>
                  <textarea value={schedNotes} onChange={(e) => setSchedNotes(e.target.value)} rows={2} className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary focus:border-bdo-gold focus:outline-none resize-none" />
                </div>
                <button type="submit" disabled={schedSaving} className="bg-bdo-gold text-bdo-bg font-semibold px-5 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50 text-sm">
                  {schedSaving ? "Kaydediliyor..." : "Program Oluştur"}
                </button>
              </form>
            )}

            {warSchedules.length === 0 && !showScheduleForm && (
              <p className="text-xs text-bdo-text-muted">Henüz otomatik program eklenmemiş.</p>
            )}

            <div className="space-y-2">
              {warSchedules.map((s) => (
                <div key={s.id} className={`border rounded-lg px-4 py-3 flex items-center justify-between gap-3 transition-colors ${s.isActive ? "bg-bdo-surface border-bdo-border" : "bg-bdo-bg border-bdo-border opacity-50"}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-bdo-text-primary">{s.name}</span>
                      <span className="text-[10px] bg-bdo-gold/10 text-bdo-gold px-1.5 py-0.5 rounded">{s.type.replace("_", " ")}</span>
                      {!s.isActive && <span className="text-[10px] text-bdo-text-muted bg-bdo-border px-1.5 py-0.5 rounded">Pasif</span>}
                    </div>
                    <div className="text-xs text-bdo-text-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>📅 Her {DAY_NAMES[s.dayOfWeek]} {String(s.hour).padStart(2,"0")}:{String(s.minute).padStart(2,"0")}</span>
                      <span>⏱ {s.createDaysBefore} gün önce oluştur</span>
                      {s.deadlineHours && <span>🔒 {s.deadlineHours}s önce deadline</span>}
                      {s.maxParticipants && <span>👥 Maks. {s.maxParticipants}</span>}
                      {s.sendToDiscord && <span>💬 Discord otomatik</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => toggleSchedule(s.id, !s.isActive)} className={`text-xs px-2 py-1 rounded transition-colors ${s.isActive ? "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20" : "bg-green-500/10 text-green-400 hover:bg-green-500/20"}`}>
                      {s.isActive ? "Durdur" : "Aktifleştir"}
                    </button>
                    <button onClick={() => deleteSchedule(s.id)} className="text-xs text-red-400 hover:underline">Sil</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "announcements" && (
        <div className="space-y-4">
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <h3 className="text-sm font-semibold text-bdo-text-primary mb-3">Yeni Duyuru</h3>
            <form onSubmit={previewNewAnnouncement} className="space-y-3">
              <div>
                <label className="block text-sm text-bdo-text-muted mb-1">Başlık</label>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => { setAnnTitle(e.target.value); setFormPreviewData(null); }}
                  required
                  className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-bdo-text-muted mb-1">İçerik</label>
                <textarea
                  value={annContent}
                  onChange={(e) => { setAnnContent(e.target.value); setFormPreviewData(null); }}
                  required
                  rows={3}
                  className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary focus:border-bdo-gold focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-bdo-text-muted mb-2">Hedef Kitle</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.entries(TARGET_LABELS) as [AnnouncementTarget, string][]).map(([val, label]) => (
                    <label key={val} onClick={() => setFormPreviewData(null)} className={`flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 border transition-colors ${annTarget === val ? "border-bdo-gold bg-bdo-gold/10 text-bdo-gold" : "border-bdo-border bg-bdo-bg text-bdo-text-muted hover:border-bdo-gold/40"}`}>
                      <input
                        type="radio"
                        name="annTarget"
                        value={val}
                        checked={annTarget === val}
                        onChange={() => setAnnTarget(val)}
                        className="accent-bdo-gold"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Preview result */}
              {formPreviewLoading && (
                <p className="text-xs text-bdo-text-muted animate-pulse">Alıcılar kontrol ediliyor...</p>
              )}
              {formPreviewData && !formPreviewLoading && (
                <div className="rounded-lg border border-bdo-border bg-bdo-bg p-3 space-y-2">
                  {formPreviewData.mode === "channel" ? (
                    <p className="text-sm text-bdo-text-secondary">
                      📢 <span className="text-bdo-gold font-semibold">#klan kanalına</span> <code className="text-xs">@everyone</code> ile gönderilecek.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-bdo-text-secondary">
                        DM ile <span className="text-bdo-gold font-semibold">{formPreviewData.count} kişiye</span> gönderilecek:
                      </p>
                      {formPreviewData.count === 0 ? (
                        <p className="text-xs text-bdo-text-muted">Bu kritere uyan kimse yok.</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-40 overflow-y-auto pr-1">
                          {formPreviewData.users.map((u) => (
                            <div key={u.id} className="bg-bdo-surface border border-bdo-border rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2">
                              {u.avatarUrl
                                ? <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full shrink-0" />
                                : <div className="w-7 h-7 rounded-full bg-bdo-border flex items-center justify-center text-bdo-text-muted shrink-0">?</div>
                              }
                              <div className="min-w-0">
                                <div className="font-semibold text-bdo-text-primary truncate">{u.familyName || <span className="italic text-bdo-text-muted">İsimsiz</span>}</div>
                                <div className="text-bdo-text-muted truncate">{u.class || <span className="font-mono text-[10px]">{u.discordId}</span>}</div>
                                {(u.ap > 0 || u.dp > 0) && <div className="text-bdo-gold font-mono">{u.ap}/{u.dp}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={createAndSendAnnouncement}
                      disabled={annSaving || formPreviewData.count === 0 && formPreviewData.mode === "dm"}
                      className="bg-bdo-gold text-bdo-bg font-semibold px-5 py-1.5 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50 text-sm"
                    >
                      {annSaving ? "Gönderiliyor..." : formPreviewData.mode === "channel" ? "Onayla ve Gönder" : `Onayla — ${formPreviewData.count} kişiye DM`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormPreviewData(null)}
                      className="px-4 py-1.5 rounded-lg text-sm text-bdo-text-muted hover:text-bdo-text-primary transition-colors"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {!formPreviewData && (
                <button
                  type="submit"
                  disabled={formPreviewLoading}
                  className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg hover:bg-bdo-gold-dim transition-colors disabled:opacity-50"
                >
                  {formPreviewLoading ? "Kontrol ediliyor..." : "Önizle →"}
                </button>
              )}
            </form>
          </div>

          <div className="space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className="bg-bdo-surface border border-bdo-border rounded-lg overflow-hidden">
                {/* Main row */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-bdo-gold font-semibold">{a.title}</span>
                      <span className="text-[10px] bg-bdo-bg border border-bdo-border text-bdo-text-muted px-2 py-0.5 rounded-full">
                        {TARGET_LABELS[a.target] ?? a.target}
                      </span>
                    </div>
                    <p className="text-sm text-bdo-text-secondary mt-1">{a.content}</p>
                    <div className="text-xs text-bdo-text-muted mt-1">
                      {new Date(a.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })} — {a.creator.familyName}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center flex-shrink-0">
                    <button
                      onClick={() => previewAnnouncement(a)}
                      disabled={publishing === a.id}
                      className={`text-xs px-2 py-1 rounded transition-colors disabled:opacity-50 whitespace-nowrap ${
                        previewAnnId === a.id
                          ? "bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/40"
                          : "bg-[#5865F2]/10 text-[#5865F2] hover:bg-[#5865F2]/20"
                      }`}
                    >
                      {publishing === a.id ? "Gönderiliyor..." : previewAnnId === a.id ? "Kapat ✕" : "Discord'a Gönder"}
                    </button>
                    <button
                      onClick={() => deleteAnnouncement(a.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                {/* Preview panel */}
                {previewAnnId === a.id && (
                  <div className="border-t border-bdo-border bg-bdo-bg p-4 space-y-3">
                    {previewLoading && (
                      <p className="text-xs text-bdo-text-muted animate-pulse">Yükleniyor...</p>
                    )}

                    {!previewLoading && previewData && (
                      <>
                        {previewData.mode === "channel" ? (
                          <div className="flex items-center gap-3">
                            <p className="text-sm text-bdo-text-secondary">
                              📢 Bu duyuru <span className="text-bdo-gold font-semibold">#klan kanalına</span> gönderilecek (<code className="text-xs">@everyone</code> ile).
                            </p>
                            <button
                              onClick={() => publishToDiscord("announcement", a.id)}
                              disabled={publishing === a.id}
                              className="ml-auto flex-shrink-0 text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap"
                            >
                              ✓ Gönder
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-bdo-text-secondary">
                                DM ile <span className="text-bdo-gold font-semibold">{previewData.count} kişiye</span> gönderilecek:
                              </p>
                              <button
                                onClick={() => publishToDiscord("announcement", a.id)}
                                disabled={publishing === a.id || previewData.count === 0}
                                className="text-xs bg-green-500/10 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap"
                              >
                                {publishing === a.id ? "Gönderiliyor..." : `✓ ${previewData.count} Kişiye Gönder`}
                              </button>
                            </div>

                            {previewData.count === 0 ? (
                              <p className="text-xs text-bdo-text-muted">Bu kritere uyan kimse yok.</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                {previewData.users.map((u) => (
                                  <div key={u.id} className="bg-bdo-surface border border-bdo-border rounded-lg px-2.5 py-1.5 text-xs flex items-center gap-2">
                                    {u.avatarUrl
                                      ? <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full shrink-0" />
                                      : <div className="w-7 h-7 rounded-full bg-bdo-border flex items-center justify-center text-bdo-text-muted shrink-0">?</div>
                                    }
                                    <div className="min-w-0">
                                      <div className="font-semibold text-bdo-text-primary truncate">{u.familyName || <span className="italic text-bdo-text-muted">İsimsiz</span>}</div>
                                      <div className="text-bdo-text-muted truncate">{u.class || <span className="font-mono text-[10px]">{u.discordId}</span>}</div>
                                      {(u.ap > 0 || u.dp > 0) && <div className="text-bdo-gold font-mono">{u.ap}/{u.dp}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {publishResult && publishing === null && (
                              <p className="text-xs text-green-400">
                                ✓ {publishResult.sent} DM gönderildi{publishResult.failed ? ` · ${publishResult.failed} başarısız` : ""}
                              </p>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "araçlar" && (
        <div className="space-y-4">
          {/* Discord Sync */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">🔄 Discord Üye Senkronizasyonu</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Guild rolü olanları çeker, rolü olmayanları gizler.</p>
              </div>
              <button onClick={syncMembers} disabled={syncing} className="text-sm bg-bdo-gold/10 text-bdo-gold px-4 py-2 rounded-lg hover:bg-bdo-gold/20 transition-colors disabled:opacity-50 font-semibold">
                {syncing ? "Syncleniyor..." : "🔄 Sync"}
              </button>
            </div>
            {syncResult && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 text-xs">
                  <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1.5 rounded-lg">✅ {syncResult.created} yeni üye</span>
                  <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1.5 rounded-lg">🔁 {syncResult.restored} geri döndü</span>
                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg">🗑 {syncResult.softDeleted} gizlendi</span>
                  <span className="bg-bdo-gold/10 text-bdo-gold border border-bdo-gold/20 px-3 py-1.5 rounded-lg">👥 {syncResult.totalWithRole} guild üyesi</span>
                </div>
                {syncResult.incomplete.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-amber-400">⚠️ {syncResult.incomplete.length} üye profilini doldurmamış</p>
                      <button onClick={sendDmAll} disabled={dmSendingAll} className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50 whitespace-nowrap">
                        {dmSendingAll ? "Gönderiliyor..." : "📨 Tümüne DM"}
                      </button>
                    </div>
                    {dmAllResult && <p className="text-xs text-bdo-text-muted">✅ {dmAllResult.sent} gönderildi{dmAllResult.failed > 0 && ` · ❌ ${dmAllResult.failed} başarısız`}</p>}
                    {syncResult.incomplete.map((u) => (
                      <div key={u.id} className="flex items-center justify-between bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-7 h-7 rounded-full" /> : <div className="w-7 h-7 rounded-full bg-bdo-border flex items-center justify-center text-xs text-bdo-text-muted">?</div>}
                          <div>
                            <span className="text-sm text-bdo-text-primary">{u.familyName || u.discordUsername}</span>
                            <span className="ml-2 text-xs text-bdo-text-muted font-mono">{u.discordId}</span>
                            <div className="text-xs text-bdo-text-muted">{[!u.familyName && "Aile adı yok", !u.class && "Class yok", !u.ap && !u.dp && "GS yok"].filter(Boolean).join(" · ")}</div>
                          </div>
                        </div>
                        <button onClick={() => sendDm(u.id)} disabled={dmSending === u.id} className="text-xs bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/20 px-3 py-1.5 rounded-lg hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50 whitespace-nowrap">
                          {dmSending === u.id ? "Gönderiliyor..." : "💬 DM"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {syncResult.incomplete.length === 0 && <p className="text-xs text-green-400">✅ Tüm üyeler profillerini doldurmuş!</p>}
              </div>
            )}
          </div>

          {/* Discord Slash Commands */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">🤖 Discord Slash Komutları</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Yeni komutları Discord'a kaydetmek için tıkla.</p>
              </div>
              <button onClick={registerDiscordCommands} disabled={registeringCmds} className="text-sm bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-lg hover:bg-indigo-500/20 transition-colors disabled:opacity-50 font-semibold">
                {registeringCmds ? "Kaydediliyor..." : "Komutları Kaydet"}
              </button>
            </div>
            {registerCmdsResult && <p className="text-xs mt-2 text-bdo-text-muted">{registerCmdsResult}</p>}
          </div>

          {/* Class Roles Sync */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">🎭 Karakter Rolleri</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Eksik class rollerini oluşturur ve üyelere otomatik atar.</p>
              </div>
              <button onClick={syncClassRoles} disabled={syncingClassRoles} className="text-sm bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-lg hover:bg-emerald-500/20 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap">
                {syncingClassRoles ? "⏳ Çalışıyor..." : "Rolleri Sync Et"}
              </button>
            </div>
            {syncingClassRoles && <p className="text-xs mt-2 text-bdo-text-muted animate-pulse">Roller oluşturuluyor ve atanıyor, 1-2 dakika sürebilir…</p>}
            {classRolesResult && !syncingClassRoles && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {classRolesResult.created.length > 0 && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2">
                    <span className="font-semibold text-emerald-400">✅ {classRolesResult.created.length} rol oluşturuldu</span>
                    <p className="text-bdo-text-muted mt-0.5 leading-relaxed">{classRolesResult.created.join(", ")}</p>
                  </div>
                )}
                <div className="bg-bdo-bg/50 border border-bdo-border rounded-lg p-2 space-y-1">
                  <div className="flex justify-between"><span className="text-bdo-text-muted">Mevcut</span><span className="font-mono text-bdo-gold">{classRolesResult.existing.length}</span></div>
                  <div className="flex justify-between"><span className="text-bdo-text-muted">Atandı</span><span className="font-mono text-emerald-400">{classRolesResult.assigned}</span></div>
                  <div className="flex justify-between"><span className="text-bdo-text-muted">Kaldırıldı</span><span className="font-mono text-orange-400">{classRolesResult.removed}</span></div>
                  {classRolesResult.errors > 0 && <div className="flex justify-between"><span className="text-bdo-text-muted">Hata</span><span className="font-mono text-red-400">{classRolesResult.errors}</span></div>}
                </div>
              </div>
            )}
          </div>

          {/* DB Fix */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">🛠 Forum DB Düzelt</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">forum_posts.content → LONGTEXT (resim yükleme için).</p>
              </div>
              <button onClick={fixLongText} disabled={fixingDb} className="text-sm bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap">
                {fixingDb ? "⏳ Çalışıyor..." : "Fix Uygula"}
              </button>
            </div>
            {fixDbResult && <p className="text-xs mt-2 text-bdo-text-muted">{fixDbResult}</p>}
          </div>

          {/* Retroactive Absence Recalc */}
          <div className="bg-bdo-surface border border-bdo-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-bdo-text-primary">⚠️ Geçmiş Devamsızlık Hesapla</h3>
                <p className="text-xs text-bdo-text-muted mt-0.5">Tüm eski savaşlara bakarak absenceCount'u sıfırdan hesaplar.</p>
              </div>
              <button onClick={recalcAbsences} disabled={recalcingAbsences} className="text-sm bg-red-500/10 text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50 font-semibold whitespace-nowrap">
                {recalcingAbsences ? "⏳ Hesaplanıyor..." : "Yeniden Hesapla"}
              </button>
            </div>
            {recalcResult && !recalcingAbsences && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                <div className="bg-bdo-bg/50 border border-bdo-border rounded-lg px-3 py-2"><span className="text-bdo-text-muted">İşlenen savaş</span><span className="ml-2 font-mono text-bdo-gold font-bold">{recalcResult.warsProcessed}</span></div>
                <div className="bg-bdo-bg/50 border border-bdo-border rounded-lg px-3 py-2"><span className="text-bdo-text-muted">Toplam devamsızlık</span><span className="ml-2 font-mono text-red-400 font-bold">{recalcResult.totalAbsences}</span></div>
                <div className="bg-bdo-bg/50 border border-bdo-border rounded-lg px-3 py-2"><span className="text-bdo-text-muted">Etkilenen üye</span><span className="ml-2 font-mono text-orange-400 font-bold">{recalcResult.affectedUsers}</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-4">
          {/* Member List */}
          <div className="space-y-2">
          {members.map((member) => (
            <div key={member.id} className="bg-bdo-surface border border-bdo-border rounded-lg p-3 flex items-center justify-between">
              <Link href={`/members/${member.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                {member.avatarUrl
                  ? <img src={member.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                  : <div className="w-8 h-8 rounded-full bg-bdo-border flex items-center justify-center text-xs text-bdo-text-muted">{member.familyName?.[0] ?? "?"}</div>
                }
                <div>
                  <span className="text-bdo-text-primary hover:text-bdo-gold transition-colors">{member.familyName || "İsimsiz"}</span>
                  {member.siteRole && (
                    <span
                      className="ml-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border"
                      style={{ color: member.siteRole.color, borderColor: `${member.siteRole.color}40`, backgroundColor: `${member.siteRole.color}15` }}
                    >
                      {member.siteRole.name}
                    </span>
                  )}
                </div>
              </Link>
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
              <div>
                <label className="block text-sm text-bdo-text-muted mb-1">
                  Öncelik <span className="text-bdo-text-muted/60">(yüksek = daha önce kontrol edilir)</span>
                </label>
                <input
                  type="number"
                  value={newRolePriority}
                  onChange={(e) => setNewRolePriority(Number(e.target.value))}
                  className="w-32 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-bdo-text-primary font-mono text-sm focus:border-bdo-gold focus:outline-none"
                />
                <p className="text-[11px] text-bdo-text-muted mt-1">
                  Üye gibi herkeste olan roller için 0, Subay/Kurmay gibi özel roller için 10, 20, 30… verin.
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
                      {role.priority > 0 && (
                        <span className="text-[10px] bg-bdo-bg border border-bdo-border text-bdo-text-muted px-1.5 py-0.5 rounded font-mono">
                          öncelik {role.priority}
                        </span>
                      )}
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

      {/* ─── GeoGuessr Images ───────────────────────────────────── */}
      {tab === "geo" && (
        <div className="space-y-6">
          <h2 className="text-lg font-bold text-bdo-gold">🗺️ GeoGuessr Resimleri</h2>

          {/* Add image form */}
          <div className="bg-bdo-surface border border-bdo-border rounded-xl p-5">
            <h3 className="font-semibold text-bdo-text-primary mb-4">Yeni Resim Ekle</h3>
            <form onSubmit={addGeoImage} className="space-y-4">
              {/* Upload mode toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGeoUploadMode("file")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${geoUploadMode === "file" ? "bg-bdo-gold text-bdo-bg" : "bg-bdo-bg border border-bdo-border text-bdo-text-muted hover:text-bdo-gold"}`}
                >
                  📁 Dosya Yükle
                </button>
                <button
                  type="button"
                  onClick={() => setGeoUploadMode("url")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${geoUploadMode === "url" ? "bg-bdo-gold text-bdo-bg" : "bg-bdo-bg border border-bdo-border text-bdo-text-muted hover:text-bdo-gold"}`}
                >
                  🔗 URL ile
                </button>
              </div>

              {geoUploadMode === "file" ? (
                <div>
                  <label className="block text-xs text-bdo-text-muted mb-1">
                    Resim Seç {geoImgUrl && <span className="text-green-400 ml-1">✓ Yüklendi</span>}
                  </label>
                  <div className="flex gap-2 items-center">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={geoUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setGeoUploading(true);
                          try {
                            const fd = new FormData();
                            fd.append("image", file);
                            const res = await fetch("/api/geo/upload", { method: "POST", body: fd });
                            const data = await res.json();
                            if (res.ok) {
                              setGeoImgUrl(data.url);
                            } else {
                              setMessage(data.error || "Yükleme başarısız");
                              setTimeout(() => setMessage(null), 4000);
                            }
                          } finally {
                            setGeoUploading(false);
                          }
                        }}
                      />
                      <div className={`border-2 border-dashed rounded-lg px-4 py-5 text-center text-sm transition ${geoUploading ? "border-bdo-gold text-bdo-gold animate-pulse" : geoImgUrl ? "border-green-500/50 text-green-400" : "border-bdo-border text-bdo-text-muted hover:border-bdo-gold hover:text-bdo-gold"}`}>
                        {geoUploading
                          ? "ImgBB'ye yükleniyor…"
                          : geoImgUrl
                          ? "✓ Yüklendi — başka resim seçmek için tıkla"
                          : "Tıkla veya sürükle → ImgBB'ye otomatik yüklenir"}
                      </div>
                    </label>
                  </div>
                  {geoImgUrl && (
                    <img src={geoImgUrl} alt="" className="mt-2 h-24 rounded object-cover border border-bdo-border" />
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs text-bdo-text-muted mb-1">Resim URL</label>
                  <input
                    type="url"
                    value={geoImgUrl}
                    onChange={(e) => setGeoImgUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-bdo-text-muted mb-1">İpucu (opsiyonel — bölge adı)</label>
                <input
                  type="text"
                  value={geoImgHint}
                  onChange={(e) => setGeoImgHint(e.target.value)}
                  placeholder="örn. Velia Hills"
                  className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-sm text-bdo-text-primary"
                />
              </div>

              {/* Map coordinate picker — Leaflet tile map */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-bdo-text-muted">
                    Haritada Konum{" "}
                    {geoPickX != null
                      ? `✅ seçildi (${(geoPickX * 100).toFixed(1)}%, ${(geoPickY! * 100).toFixed(1)}%)`
                      : "— henüz seçilmedi"}
                  </label>
                  <button
                    type="button"
                    onClick={() => setGeoPickMode((v) => !v)}
                    className="text-xs text-bdo-gold hover:underline"
                  >
                    {geoPickMode ? "Haritayı Kapat" : "Haritadan Seç"}
                  </button>
                </div>
                {geoPickMode && (
                  <div className="border border-bdo-border rounded-lg overflow-hidden" style={{ height: 380 }}>
                    <GeoAdminPicker
                      pickedX={geoPickX}
                      pickedY={geoPickY}
                      onPick={(x, y) => { setGeoPickX(x); setGeoPickY(y); }}
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={geoSaving || geoUploading || !geoImgUrl || geoPickX == null}
                className="px-4 py-2 bg-bdo-gold text-bdo-bg font-semibold rounded-lg text-sm hover:bg-bdo-gold/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {geoSaving ? "Kaydediliyor…" : geoUploading ? "Yükleniyor…" : "Resim Ekle"}
              </button>
            </form>
          </div>

          {/* Image list */}
          <div className="space-y-3">
            <p className="text-sm text-bdo-text-muted">{geoImages.length} resim mevcut</p>
            {geoImages.map((img) => (
              <div key={img.id} className="bg-bdo-surface border border-bdo-border rounded-xl p-4 flex gap-4 items-start">
                <img
                  src={img.imageUrl}
                  alt=""
                  className="w-32 h-20 object-cover rounded flex-shrink-0 bg-bdo-bg"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-bdo-text-muted truncate">{img.imageUrl}</p>
                  {img.hint && <p className="text-sm text-bdo-gold mt-1">📍 {img.hint}</p>}
                  <p className="text-xs text-bdo-text-muted mt-1">
                    X: {(img.mapX * 100).toFixed(1)}% · Y: {(img.mapY * 100).toFixed(1)}%
                    &nbsp;· {img.creator.familyName} · {new Date(img.createdAt).toLocaleDateString("tr-TR")}
                  </p>
                </div>
                <button
                  onClick={() => deleteGeoImage(img.id)}
                  className="text-xs text-red-400 hover:underline flex-shrink-0"
                >
                  Sil
                </button>
              </div>
            ))}
            {geoImages.length === 0 && (
              <p className="text-bdo-text-muted text-sm">Henüz resim eklenmemiş.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
