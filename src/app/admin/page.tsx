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
import {
  Settings, Swords, Megaphone, Users, Shield, BarChart3, Wrench, Map as MapIcon,
  Plus, Trash2, Pencil, Send, CalendarClock, RefreshCw, Bot, UserCog, Database,
  AlertTriangle, Trophy, Skull, Handshake, X, Info, Flag, Star, Search, Check,
} from "lucide-react";
import { PageHeader, Button, Card, CardHeader, Empty, Avatar } from "@/components/ui";

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

interface GuildRow {
  id: number;
  name: string;
  tag: string;
  color: string;
  isPrimary: boolean;
  discordServerId: string | null;
  discordRoleIds: string;
  warChannelId: string | null;
  _count: { members: number };
}

interface DiscordRoleOption { id: string; name: string; color: string }
interface DiscordServer { id: string; name: string; icon: string | null; roles: DiscordRoleOption[] }
interface DiscordChannel { id: string; name: string; category: string | null; isAnnouncement: boolean }

interface Member {
  id: number;
  familyName: string;
  class: string;
  isAdmin: boolean;
  avatarUrl: string;
  siteRole: { name: string; color: string } | null;
  guild: { id: number; name: string; tag: string; color: string } | null;
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
  all: "Tüm Klan (kanal)",
  no_login: "👤 Siteye giriş yapmamışlar (DM)",
  no_gear: "Gear doldurmamışlar (DM)",
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
  isGuildAdmin: boolean;
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
  const [tab, setTab] = useState<"wars" | "members" | "announcements" | "roles" | "guilds" | "hasar" | "araçlar" | "geo">("wars");

  // ── Klanlar ──
  const [guilds, setGuilds] = useState<GuildRow[]>([]);
  const [editingGuild, setEditingGuild] = useState<GuildRow | null>(null);
  const [gName, setGName] = useState("");
  const [gTag, setGTag] = useState("");
  const [gColor, setGColor] = useState("#4a7cf5");
  const [gRoleIds, setGRoleIds] = useState<string[]>([]);
  const [gSaving, setGSaving] = useState(false);

  // Discord sunucu/rol listesi (klan ↔ rol eşleştirmesi için)
  const [discordServers, setDiscordServers] = useState<DiscordServer[]>([]);
  const [dcLoading, setDcLoading] = useState(false);
  const [dcError, setDcError] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [gWarChannel, setGWarChannel] = useState<string>("");
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [chLoading, setChLoading] = useState(false);
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
  const [newRoleIsGuildAdmin, setNewRoleIsGuildAdmin] = useState(false);
  const [newRoleColor, setNewRoleColor] = useState("#d4a853");
  const [newRoleDiscordIds, setNewRoleDiscordIds] = useState("");
  const [newRolePriority, setNewRolePriority] = useState(0);
  const [editingRole, setEditingRole] = useState<SiteRole | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);
  const [settingResult, setSettingResult] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    softDeleted: number; restored: number; created: number; guildUpdated: number;
    totalWithRole: number; serversRead: number; serverErrors: string[];
    perGuild: { tag: string; name: string; count: number }[];
    incomplete: {
      id: number; discordId: string; familyName: string; avatarUrl: string;
      ap: number; dp: number; class: string; discordUsername: string;
      guild?: { tag: string; color: string } | null;
    }[];
  } | null>(null);
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

  const isSiteAdmin = session?.user.isAdmin ?? false;
  const isGuildAdmin = session?.user.isGuildAdmin ?? false;

  useEffect(() => {
    // Klan yöneticileri de girebilir ama sınırlı sekmelerle
    if (session && !session.user.isAdmin && !session.user.isGuildAdmin) router.push("/dashboard");
  }, [session, router]);

  // Klan yöneticisi site-admin sekmesindeyse savaşlara döndür
  useEffect(() => {
    if (!session || isSiteAdmin) return;
    if (!["wars", "members", "hasar"].includes(tab)) setTab("wars");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isSiteAdmin, tab]);

  // Klanlar sekmesi ilk açıldığında Discord rollerini çek
  useEffect(() => {
    if (tab === "guilds" && discordServers.length === 0 && !dcLoading && !dcError) {
      fetchDiscordRoles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    fetchWars();
    fetchMembers();
    fetchAnnouncements();
    fetchRoles();
    fetchWarSchedules();
    fetchGeoImages();
    fetchGuilds();
  }, []);

  async function fetchWars() {
    const res = await fetch("/api/wars");
    if (res.ok) setWars(await res.json());
  }

  // ── Klan işlemleri ──

  async function fetchGuilds() {
    const res = await fetch("/api/guilds");
    if (res.ok) setGuilds(await res.json());
  }

  async function fetchDiscordRoles() {
    setDcLoading(true);
    setDcError(null);
    const res = await fetch("/api/discord/roles");
    const data = await res.json();
    if (res.ok) {
      setDiscordServers(data);
      // Tek sunucu varsa otomatik seç
      if (data.length === 1) setSelectedServerId(data[0].id);
    } else {
      setDcError(data.error ?? "Roller çekilemedi.");
    }
    setDcLoading(false);
  }

  async function fetchChannels(serverId: string) {
    if (!serverId) { setChannels([]); return; }
    setChLoading(true);
    const res = await fetch(`/api/discord/channels?serverId=${serverId}`);
    setChannels(res.ok ? await res.json() : []);
    setChLoading(false);
  }

  /** Tüm sunuculardaki rolleri id → {rol, sunucu} olarak düzleştirir */
  function findRole(roleId: string) {
    for (const s of discordServers) {
      const r = s.roles.find((x) => x.id === roleId);
      if (r) return { role: r, server: s };
    }
    return null;
  }

  /** Bir rolün başka bir klana bağlı olup olmadığını döner */
  function roleOwner(roleId: string): GuildRow | null {
    for (const g of guilds) {
      if (editingGuild && g.id === editingGuild.id) continue;
      try {
        const ids = JSON.parse(g.discordRoleIds || "[]") as string[];
        if (ids.includes(roleId)) return g;
      } catch { /* ignore */ }
    }
    return null;
  }

  function toggleRoleId(roleId: string) {
    setGRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((x) => x !== roleId) : [...prev, roleId]
    );
  }

  function resetGuildForm() {
    setEditingGuild(null);
    setGName(""); setGTag(""); setGColor("#4a7cf5"); setGRoleIds([]);
    setRoleSearch("");
    setSelectedServerId(discordServers.length === 1 ? discordServers[0].id : "");
    setGWarChannel("");
  }

  function startEditGuild(g: GuildRow) {
    setEditingGuild(g);
    setGName(g.name);
    setGTag(g.tag);
    setGColor(g.color);
    setRoleSearch("");
    setSelectedServerId(g.discordServerId ?? "");
    setGWarChannel(g.warChannelId ?? "");
    if (g.discordServerId) fetchChannels(g.discordServerId);
    try {
      setGRoleIds(JSON.parse(g.discordRoleIds || "[]") as string[]);
    } catch {
      setGRoleIds([]);
    }
    if (discordServers.length === 0 && !dcLoading) fetchDiscordRoles();
  }

  async function saveGuild(e: React.FormEvent) {
    e.preventDefault();
    setGSaving(true);
    const payload = {
      name: gName, tag: gTag, color: gColor,
      discordRoleIds: gRoleIds.join(","),
      discordServerId: selectedServerId || null,
      warChannelId: gWarChannel || null,
    };
    const res = await fetch("/api/guilds", {
      method: editingGuild ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingGuild ? { ...payload, id: editingGuild.id } : payload),
    });
    const data = await res.json();
    if (res.ok) {
      resetGuildForm();
      await fetchGuilds();
      await fetchMembers();
      setMessage(editingGuild ? "Klan güncellendi." : "Klan oluşturuldu.");
    } else {
      setMessage(data.error ?? "Kaydedilemedi.");
    }
    setGSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }

  async function deleteGuild(g: GuildRow) {
    if (!confirm(`"${g.name}" klanını silmek istediğine emin misin? ${g._count.members} üye klansız kalacak.`)) return;
    const res = await fetch("/api/guilds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: g.id }),
    });
    const data = await res.json();
    setMessage(res.ok ? "Klan silindi." : (data.error ?? "Silinemedi."));
    await fetchGuilds();
    await fetchMembers();
    setTimeout(() => setMessage(null), 3000);
  }

  async function setMemberGuild(memberId: number, guildId: string) {
    await fetch(`/api/members/${memberId}/guild`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: guildId || null }),
    });
    await fetchMembers();
    await fetchGuilds();
  }

  async function fetchMembers() {
    // Site admin tüm klanları, klan yöneticisi sadece kendi klanını görür
    const res = await fetch(session?.user.isAdmin ? "/api/members?all=1" : "/api/members");
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
      setRegisterCmdsResult(`${data.registered} komut kaydedildi.`);
    } else {
      setRegisterCmdsResult(`Hata: ${JSON.stringify(data.error)}`);
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
      setMessage(`Hata: ${data.error}`);
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
      setMessage(`Hata: ${data.error}`);
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
          isGuildAdmin: newRoleIsGuildAdmin,
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
          isGuildAdmin: newRoleIsGuildAdmin,
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
    setNewRoleIsGuildAdmin(role.isGuildAdmin ?? false);
    setNewRoleColor(role.color);
    setNewRolePriority(role.priority ?? 0);
    const ids: string[] = JSON.parse(role.discordRoleIds || "[]");
    setNewRoleDiscordIds(ids.join(", "));
  }

  function resetRoleForm() {
    setEditingRole(null);
    setNewRoleName("");
    setNewRoleIsAdmin(false);
    setNewRoleIsGuildAdmin(false);
    setNewRoleColor("#d4a853");
    setNewRoleDiscordIds("");
    setNewRolePriority(0);
  }

  if (!isSiteAdmin && !isGuildAdmin) return null;

  const ALL_TABS = [
    { key: "wars",          label: "Savaşlar",     icon: Swords,     guildAdmin: true },
    { key: "announcements", label: "Duyurular",    icon: Megaphone,  guildAdmin: false },
    { key: "members",       label: "Üyeler",       icon: Users,      guildAdmin: true },
    { key: "guilds",        label: "Klanlar",      icon: Flag,       guildAdmin: false },
    { key: "roles",         label: "Roller",       icon: Shield,     guildAdmin: false },
    { key: "hasar",         label: "Hasar Raporu", icon: BarChart3,  guildAdmin: true },
    { key: "araçlar",       label: "Araçlar",      icon: Wrench,     guildAdmin: false },
    { key: "geo",           label: "GeoGuessr",    icon: MapIcon,    guildAdmin: false },
  ] as const;

  const TAB_ITEMS = isSiteAdmin ? ALL_TABS : ALL_TABS.filter((t) => t.guildAdmin);
  const myGuild = session?.user.guild;

  return (
    <div>
      <PageHeader
        title={isSiteAdmin ? "Admin Panel" : "Klan Yönetimi"}
        desc={isSiteAdmin
          ? "Savaş, duyuru, üye ve rol yönetimi."
          : "Savaş aç, parti kur ve klan üyelerini yönet."}
        icon={Settings}
        action={!isSiteAdmin && myGuild && (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border"
            style={{
              color: myGuild.color,
              borderColor: `${myGuild.color}38`,
              backgroundColor: `${myGuild.color}14`,
            }}
          >
            {myGuild.tag}
          </span>
        )}
      />

      {message && (
        <div className="card card-accent px-4 py-2.5 mb-3 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-bdo-gold flex-shrink-0" strokeWidth={2} />
          <span className="text-[13px] text-bdo-gold">{message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Sekmeler */}
        <div className="card w-full md:w-44 flex-shrink-0 p-1.5 flex md:flex-col gap-0.5 overflow-x-auto">
          {TAB_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-left transition-all whitespace-nowrap group ${
                  active
                    ? "bg-bdo-surface-2 text-bdo-text-primary"
                    : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-surface-2/60"
                }`}
              >
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    active ? "text-bdo-gold" : "text-bdo-text-secondary group-hover:text-bdo-text-muted"
                  }`}
                  strokeWidth={1.75}
                />
                {label}
                {active && <span className="ml-auto w-1 h-1 rounded-full bg-bdo-gold flex-shrink-0 hidden md:block" />}
              </button>
            );
          })}
        </div>

        {/* İçerik */}
        <div className="flex-1 min-w-0 w-full">

      {tab === "wars" && (
        <div className="space-y-4">
          {(showWarForm || editingWar) ? (
            <Card>
              <div className="card-header">
                <span className="card-title">{editingWar ? "Etkinliği Düzenle" : "Yeni Etkinlik"}</span>
                <button
                  onClick={() => { setShowWarForm(false); setEditingWar(null); }}
                  className="p-1 rounded-md text-bdo-text-secondary hover:text-bdo-text-primary hover:bg-bdo-surface-2 transition-colors"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </div>
              <div className="p-4">
                <WarForm
                  initial={editingWar ? { ...editingWar } : undefined}
                  onSubmit={() => { setShowWarForm(false); setEditingWar(null); fetchWars(); setMessage("Etkinlik başarıyla oluşturuldu!"); setTimeout(() => setMessage(null), 3000); }}
                />
              </div>
            </Card>
          ) : (
            <Button variant="primary" icon={Plus} onClick={() => { setEditingWar(null); setShowWarForm(true); }}>
              Yeni Etkinlik
            </Button>
          )}

          <Card>
            <CardHeader title="Etkinlikler" icon={Swords} meta={`${wars.length} kayıt`} />
            {wars.length === 0 ? (
              <Empty icon={Swords} text="Henüz etkinlik yok." />
            ) : (
              wars.map((war) => {
                const RIcon = war.result === "WIN" ? Trophy : war.result === "LOSS" ? Skull : war.result === "DRAW" ? Handshake : null;
                return (
                  <div key={war.id} className="card-row flex-wrap gap-x-3 gap-y-2 py-2.5">
                    <Link href={`/wars/${war.id}`} className="flex-1 min-w-[180px] group">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-bdo-text-primary group-hover:text-bdo-gold transition-colors">
                          {war.title}
                        </span>
                        <span className="text-[10px] bg-bdo-surface-2 border border-bdo-border text-bdo-text-muted px-1.5 py-0.5 rounded">
                          {getTypeName(war.type)}
                        </span>
                        {RIcon && (
                          <RIcon
                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                              war.result === "WIN" ? "text-emerald-400" : war.result === "LOSS" ? "text-red-400" : "text-bdo-text-muted"
                            }`}
                            strokeWidth={1.75}
                          />
                        )}
                      </div>
                      <p className="text-[11px] text-bdo-text-secondary mt-0.5">
                        {new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </Link>

                    <div className="flex gap-1.5 items-center flex-wrap justify-end">
                      <select
                        value={war.result || ""}
                        onChange={(e) => setWarResult(war.id, e.target.value || null)}
                        disabled={settingResult === war.id}
                        className="text-[11px] bg-bdo-bg border border-bdo-border rounded-lg px-2 py-1 text-bdo-text-muted focus:border-bdo-gold/40 focus:outline-none disabled:opacity-50"
                      >
                        <option value="">Sonuç yok</option>
                        <option value="WIN">Kazandık</option>
                        <option value="LOSS">Kaybettik</option>
                        <option value="DRAW">Berabere</option>
                      </select>
                      <Button variant="ghost" size="xs" icon={Send} onClick={() => publishToDiscord("war", war.id)} disabled={publishing === war.id}>
                        {publishing === war.id ? "..." : "Discord"}
                      </Button>
                      <Link href={`/wars/${war.id}`}>
                        <Button variant="ghost" size="xs" icon={Users}>Parti</Button>
                      </Link>
                      <Button variant="ghost" size="xs" icon={Pencil} onClick={() => { setEditingWar(war); setShowWarForm(false); }} />
                      <Button variant="danger" size="xs" icon={Trash2} onClick={() => deleteWar(war.id)} />
                    </div>
                  </div>
                );
              })
            )}
          </Card>

          {/* ── Otomatik Savaş Programı ── */}
          <Card>
            <div className="card-header">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarClock className="w-3.5 h-3.5 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="card-title">Otomatik Savaş Programı</p>
                  <p className="text-[11px] text-bdo-text-secondary mt-0.5 leading-tight">
                    Belirtilen günlerde savaşlar otomatik oluşturulup Discord&apos;a gönderilir.
                  </p>
                </div>
              </div>
              <Button
                variant={showScheduleForm ? "ghost" : "primary"}
                size="xs"
                icon={showScheduleForm ? X : Plus}
                onClick={() => setShowScheduleForm(!showScheduleForm)}
              >
                {showScheduleForm ? "İptal" : "Ekle"}
              </Button>
            </div>

            {showScheduleForm && (
              <form onSubmit={createSchedule} className="p-4 space-y-3 border-b border-bdo-border">
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
                <Button type="submit" variant="primary" size="md" disabled={schedSaving}>
                  {schedSaving ? "Kaydediliyor..." : "Program Oluştur"}
                </Button>
              </form>
            )}

            {warSchedules.length === 0 ? (
              !showScheduleForm && <Empty icon={CalendarClock} text="Henüz otomatik program yok." />
            ) : (
              warSchedules.map((s) => (
                <div key={s.id} className={`card-row flex-wrap gap-x-3 gap-y-2 py-2.5 ${s.isActive ? "" : "opacity-45"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-medium text-bdo-text-primary">{s.name}</span>
                      <span className="text-[10px] bg-bdo-surface-2 border border-bdo-border text-bdo-text-muted px-1.5 py-0.5 rounded">
                        {s.type.replace("_", " ")}
                      </span>
                      {!s.isActive && (
                        <span className="text-[10px] text-bdo-text-secondary border border-bdo-border px-1.5 py-0.5 rounded">Pasif</span>
                      )}
                    </div>
                    <div className="text-[11px] text-bdo-text-secondary mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Her {DAY_NAMES[s.dayOfWeek]} {String(s.hour).padStart(2, "0")}:{String(s.minute).padStart(2, "0")}</span>
                      <span>· {s.createDaysBefore}g önce oluştur</span>
                      {s.deadlineHours && <span>· {s.deadlineHours}s deadline</span>}
                      {s.maxParticipants && <span>· maks {s.maxParticipants}</span>}
                      {s.sendToDiscord && <span>· Discord otomatik</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant={s.isActive ? "ghost" : "success"}
                      size="xs"
                      onClick={() => toggleSchedule(s.id, !s.isActive)}
                    >
                      {s.isActive ? "Durdur" : "Aktifleştir"}
                    </Button>
                    <Button variant="danger" size="xs" icon={Trash2} onClick={() => deleteSchedule(s.id)} />
                  </div>
                </div>
              ))
            )}
          </Card>
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
                      <span className="text-bdo-gold font-semibold">#klan kanalına</span> <code className="text-xs">@everyone</code> ile gönderilecek.
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
                              Bu duyuru <span className="text-bdo-gold font-semibold">#klan kanalına</span> gönderilecek (<code className="text-xs">@everyone</code> ile).
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
          <Card>
            <div className="card-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <RefreshCw className="w-3.5 h-3.5 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="card-title">Discord Üye Senkronizasyonu</p>
                  <p className="text-[11px] text-bdo-text-secondary mt-0.5 leading-tight">
                    Guild rolü olanları çeker, rolü olmayanları gizler.
                  </p>
                </div>
              </div>
              <Button variant="primary" size="xs" icon={RefreshCw} onClick={syncMembers} disabled={syncing}>
                {syncing ? "Syncleniyor..." : "Sync"}
              </Button>
            </div>

            {syncResult && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: "Yeni üye", value: syncResult.created, tone: "text-emerald-400" },
                    { label: "Geri döndü", value: syncResult.restored, tone: "text-[#6b93ff]" },
                    { label: "Gizlendi", value: syncResult.softDeleted, tone: "text-red-400" },
                    { label: "Toplam üye", value: syncResult.totalWithRole, tone: "text-bdo-gold" },
                  ].map((s) => (
                    <div key={s.label} className="bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2">
                      <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">{s.label}</p>
                      <p className={`text-[15px] font-bold font-mono ${s.tone}`}>{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Klan bazlı dağılım */}
                {syncResult.perGuild?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-bdo-text-secondary">
                      {syncResult.serversRead} sunucu tarandı:
                    </span>
                    {syncResult.perGuild.map((g) => (
                      <span
                        key={g.tag}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md border border-bdo-border bg-bdo-bg text-bdo-text-muted"
                        title={g.name}
                      >
                        {g.tag}
                        <span className="font-mono text-bdo-text-primary">{g.count}</span>
                      </span>
                    ))}
                    {syncResult.guildUpdated > 0 && (
                      <span className="text-[11px] text-[#6b93ff]">
                        {syncResult.guildUpdated} üyenin klanı güncellendi
                      </span>
                    )}
                  </div>
                )}

                {syncResult.serverErrors?.length > 0 && (
                  <div className="bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
                    {syncResult.serverErrors.map((err, i) => (
                      <p key={i} className="text-[11px] text-red-400 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2} />
                        {err}
                      </p>
                    ))}
                  </div>
                )}

                {syncResult.incomplete.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[12px] font-medium text-yellow-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                        {syncResult.incomplete.length} üye profilini doldurmamış
                      </p>
                      <Button variant="ghost" size="xs" icon={Send} onClick={sendDmAll} disabled={dmSendingAll}>
                        {dmSendingAll ? "Gönderiliyor..." : "Tümüne DM"}
                      </Button>
                    </div>
                    {dmAllResult && (
                      <p className="text-[11px] text-bdo-text-secondary">
                        {dmAllResult.sent} gönderildi{dmAllResult.failed > 0 && ` · ${dmAllResult.failed} başarısız`}
                      </p>
                    )}
                    <div className="space-y-1">
                      {syncResult.incomplete.map((u) => (
                        <div key={u.id} className="flex items-center gap-2.5 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2">
                          <Avatar src={u.avatarUrl} size={26} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] text-bdo-text-primary truncate">{u.familyName || u.discordUsername}</span>
                              {u.guild && (
                                <span
                                  className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border flex-shrink-0"
                                  style={{
                                    color: u.guild.color,
                                    borderColor: `${u.guild.color}38`,
                                    backgroundColor: `${u.guild.color}14`,
                                  }}
                                >
                                  {u.guild.tag}
                                </span>
                              )}
                              <span className="text-[10px] text-bdo-text-secondary font-mono">{u.discordId}</span>
                            </div>
                            <p className="text-[11px] text-bdo-text-secondary">
                              {[!u.familyName && "Aile adı yok", !u.class && "Class yok", !u.ap && !u.dp && "GS yok"].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <Button variant="ghost" size="xs" icon={Send} onClick={() => sendDm(u.id)} disabled={dmSending === u.id}>
                            {dmSending === u.id ? "..." : "DM"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-emerald-400">Tüm üyeler profillerini doldurmuş.</p>
                )}
              </div>
            )}
          </Card>

          {/* Discord Slash Commands */}
          <Card>
            <div className="card-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <Bot className="w-3.5 h-3.5 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="card-title">Discord Slash Komutları</p>
                  <p className="text-[11px] text-bdo-text-secondary mt-0.5 leading-tight">
                    Yeni komutları Discord&apos;a kaydeder.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="xs" onClick={registerDiscordCommands} disabled={registeringCmds}>
                {registeringCmds ? "Kaydediliyor..." : "Komutları Kaydet"}
              </Button>
            </div>
            {registerCmdsResult && <p className="px-4 py-2.5 text-[11px] text-bdo-text-secondary">{registerCmdsResult}</p>}
          </Card>

          {/* Class Roles Sync */}
          <Card>
            <div className="card-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserCog className="w-3.5 h-3.5 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="card-title">Karakter Rolleri</p>
                  <p className="text-[11px] text-bdo-text-secondary mt-0.5 leading-tight">
                    Eksik class rollerini oluşturur ve üyelere atar.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="xs" onClick={syncClassRoles} disabled={syncingClassRoles}>
                {syncingClassRoles ? "Çalışıyor..." : "Sync Et"}
              </Button>
            </div>
            {syncingClassRoles && (
              <p className="px-4 py-2.5 text-[11px] text-bdo-text-secondary animate-pulse">
                Roller oluşturuluyor ve atanıyor, 1-2 dakika sürebilir…
              </p>
            )}
            {classRolesResult && !syncingClassRoles && (
              <div className="p-4 grid sm:grid-cols-2 gap-2">
                {classRolesResult.created.length > 0 && (
                  <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-2.5">
                    <p className="text-[12px] font-semibold text-emerald-400">{classRolesResult.created.length} rol oluşturuldu</p>
                    <p className="text-[11px] text-bdo-text-secondary mt-1 leading-relaxed">{classRolesResult.created.join(", ")}</p>
                  </div>
                )}
                <div className="bg-bdo-bg border border-bdo-border rounded-lg p-2.5 space-y-1">
                  {[
                    { l: "Mevcut", v: classRolesResult.existing.length, t: "text-bdo-gold" },
                    { l: "Atandı", v: classRolesResult.assigned, t: "text-emerald-400" },
                    { l: "Kaldırıldı", v: classRolesResult.removed, t: "text-orange-400" },
                    ...(classRolesResult.errors > 0 ? [{ l: "Hata", v: classRolesResult.errors, t: "text-red-400" }] : []),
                  ].map((r) => (
                    <div key={r.l} className="flex justify-between text-[11px]">
                      <span className="text-bdo-text-secondary">{r.l}</span>
                      <span className={`font-mono font-semibold ${r.t}`}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* DB Fix */}
          <Card>
            <div className="card-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <Database className="w-3.5 h-3.5 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="card-title">Forum DB Düzelt</p>
                  <p className="text-[11px] text-bdo-text-secondary mt-0.5 leading-tight">
                    forum_posts.content → LONGTEXT (resim yükleme için).
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="xs" onClick={fixLongText} disabled={fixingDb}>
                {fixingDb ? "Çalışıyor..." : "Fix Uygula"}
              </Button>
            </div>
            {fixDbResult && <p className="px-4 py-2.5 text-[11px] text-bdo-text-secondary">{fixDbResult}</p>}
          </Card>

          {/* Retroactive Absence Recalc */}
          <Card>
            <div className="card-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
                <div className="min-w-0">
                  <p className="card-title">Geçmiş Devamsızlık Hesapla</p>
                  <p className="text-[11px] text-bdo-text-secondary mt-0.5 leading-tight">
                    Tüm eski savaşlara bakarak absenceCount&apos;u sıfırdan hesaplar.
                  </p>
                </div>
              </div>
              <Button variant="danger" size="xs" onClick={recalcAbsences} disabled={recalcingAbsences}>
                {recalcingAbsences ? "Hesaplanıyor..." : "Yeniden Hesapla"}
              </Button>
            </div>
            {recalcResult && !recalcingAbsences && (
              <div className="p-4 grid grid-cols-3 gap-2">
                {[
                  { l: "İşlenen savaş", v: recalcResult.warsProcessed, t: "text-bdo-gold" },
                  { l: "Toplam devamsızlık", v: recalcResult.totalAbsences, t: "text-red-400" },
                  { l: "Etkilenen üye", v: recalcResult.affectedUsers, t: "text-orange-400" },
                ].map((r) => (
                  <div key={r.l} className="bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2">
                    <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">{r.l}</p>
                    <p className={`text-[15px] font-bold font-mono ${r.t}`}>{r.v}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "members" && (
        <Card>
          <CardHeader title="Üyeler" icon={Users} meta={`${members.length} kayıt`} />
          {members.length === 0 ? (
            <Empty icon={Users} text="Henüz üye yok." />
          ) : (
            members.map((member) => (
              <div key={member.id} className="card-row gap-3 flex-wrap">
                <Link href={`/members/${member.id}`} className="flex items-center gap-2.5 flex-1 min-w-[160px] group">
                  <Avatar src={member.avatarUrl} size={26} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] text-bdo-text-primary group-hover:text-bdo-gold transition-colors truncate">
                        {member.familyName || "İsimsiz"}
                      </span>
                      {member.guild && (
                        <span
                          className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded border"
                          style={{
                            color: member.guild.color,
                            borderColor: `${member.guild.color}35`,
                            backgroundColor: `${member.guild.color}12`,
                          }}
                        >
                          {member.guild.tag}
                        </span>
                      )}
                      {member.siteRole && (
                        <span
                          className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border"
                          style={{
                            color: member.siteRole.color,
                            borderColor: `${member.siteRole.color}30`,
                            backgroundColor: `${member.siteRole.color}12`,
                          }}
                        >
                          {member.siteRole.name}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isSiteAdmin ? (
                    <>
                      <select
                        value={member.guild?.id ?? ""}
                        onChange={(e) => setMemberGuild(member.id, e.target.value)}
                        className="text-[11px] bg-bdo-bg border border-bdo-border rounded-lg px-2 py-1 text-bdo-text-muted focus:border-bdo-gold/40 focus:outline-none"
                      >
                        <option value="">Klansız</option>
                        {guilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <Button
                        variant={member.isAdmin ? "primary" : "ghost"}
                        size="xs"
                        icon={Shield}
                        onClick={() => toggleAdmin(member.id, !member.isAdmin)}
                      >
                        {member.isAdmin ? "Admin" : "Admin Yap"}
                      </Button>
                      <Button
                        variant="danger"
                        size="xs"
                        icon={Trash2}
                        onClick={() => deleteMember(member.id, member.familyName || "İsimsiz")}
                      />
                    </>
                  ) : (
                    <Link href={`/members/${member.id}`}>
                      <Button variant="ghost" size="xs">Profil</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </Card>
      )}

      {tab === "guilds" && (
        <div className="space-y-4">
          {/* Form */}
          <Card>
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Flag className="w-3.5 h-3.5 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
                <span className="card-title">{editingGuild ? "Klanı Düzenle" : "Yeni Klan"}</span>
              </div>
              {editingGuild && (
                <button
                  onClick={resetGuildForm}
                  className="p-1 rounded-md text-bdo-text-secondary hover:text-bdo-text-primary hover:bg-bdo-surface-2 transition-colors"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>

            <form onSubmit={saveGuild} className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_110px_90px] gap-3">
                <div>
                  <label className="block text-[10px] uppercase text-bdo-text-secondary tracking-wider mb-1.5">Klan Adı</label>
                  <input
                    value={gName} onChange={(e) => setGName(e.target.value)} required maxLength={40}
                    placeholder="Örn: Nexus"
                    className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-[13px] text-bdo-text-primary placeholder-bdo-text-secondary focus:border-bdo-gold/40 focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-bdo-text-secondary tracking-wider mb-1.5">Tag</label>
                  <input
                    value={gTag} onChange={(e) => setGTag(e.target.value.toUpperCase())} required maxLength={5}
                    placeholder="NEX"
                    className="w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-[13px] font-mono font-bold text-bdo-text-primary placeholder-bdo-text-secondary focus:border-bdo-gold/40 focus:outline-none transition-colors uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase text-bdo-text-secondary tracking-wider mb-1.5">Renk</label>
                  <input
                    type="color" value={gColor} onChange={(e) => setGColor(e.target.value)}
                    className="w-full h-[38px] bg-bdo-bg border border-bdo-border rounded-lg px-1 cursor-pointer"
                  />
                </div>
              </div>

              {/* Discord rol eşleştirme */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-[10px] uppercase text-bdo-text-secondary tracking-wider">
                    Discord Rolleri
                    <span className="normal-case opacity-60"> — bu rollere sahip olanlar girişte otomatik bu klana atanır</span>
                  </label>
                  <Button
                    variant="ghost" size="xs" icon={RefreshCw}
                    onClick={fetchDiscordRoles} disabled={dcLoading}
                  >
                    {dcLoading ? "Çekiliyor..." : discordServers.length ? "Yenile" : "Rolleri Çek"}
                  </Button>
                </div>

                {dcError && (
                  <p className="text-[11px] text-red-400 mb-2">{dcError}</p>
                )}

                {/* Seçili roller */}
                {gRoleIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {gRoleIds.map((rid) => {
                      const found = findRole(rid);
                      return (
                        <span
                          key={rid}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border"
                          style={found
                            ? { color: found.role.color, borderColor: `${found.role.color}40`, backgroundColor: `${found.role.color}15` }
                            : { color: "#7a8ba3", borderColor: "#1e2a3c", backgroundColor: "#1a2233" }}
                        >
                          {found ? found.role.name : rid}
                          <button
                            type="button"
                            onClick={() => toggleRoleId(rid)}
                            className="hover:opacity-60 transition-opacity"
                          >
                            <X className="w-3 h-3" strokeWidth={2.5} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {discordServers.length === 0 ? (
                  <div className="bg-bdo-bg border border-dashed border-bdo-border rounded-lg px-3 py-4 text-center">
                    <p className="text-[12px] text-bdo-text-secondary">
                      {dcLoading ? "Discord sunucuları yükleniyor..." : "Rolleri listelemek için \"Rolleri Çek\"e bas."}
                    </p>
                  </div>
                ) : (
                  <div className="bg-bdo-bg border border-bdo-border rounded-lg overflow-hidden">
                    {/* Sunucu seçici */}
                    <div className="p-2 border-b border-bdo-border space-y-2">
                      <div>
                        <label className="block text-[10px] uppercase text-bdo-text-secondary tracking-wider mb-1">
                          Discord Sunucusu
                        </label>
                        <select
                          value={selectedServerId}
                          onChange={(e) => {
                            const next = e.target.value;
                            setRoleSearch("");
                            // Sunucu değişince başka sunucunun rolleri seçili kalmasın
                            if (next !== selectedServerId) {
                              const valid = new Set(
                                (discordServers.find((s) => s.id === next)?.roles ?? []).map((r) => r.id)
                              );
                              setGRoleIds((prev) => prev.filter((id) => valid.has(id)));
                            }
                            setSelectedServerId(next);
                            setGWarChannel("");
                            fetchChannels(next);
                          }}
                          className="w-full bg-bdo-surface border border-bdo-border rounded-md px-2 py-1.5 text-[12px] text-bdo-text-primary focus:border-bdo-gold/40 focus:outline-none transition-colors"
                        >
                          <option value="">Sunucu seç ({discordServers.length} sunucu)</option>
                          {discordServers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} — {s.roles.length} rol
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedServerId && (
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-bdo-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                          <input
                            value={roleSearch}
                            onChange={(e) => setRoleSearch(e.target.value)}
                            placeholder="Rol ara..."
                            className="w-full bg-bdo-surface border border-bdo-border rounded-md pl-8 pr-2 py-1.5 text-[12px] text-bdo-text-primary placeholder-bdo-text-secondary focus:border-bdo-gold/40 focus:outline-none transition-colors"
                          />
                        </div>
                      )}
                    </div>

                    {/* Rol listesi */}
                    {!selectedServerId ? (
                      <div className="px-3 py-6 text-center">
                        <p className="text-[12px] text-bdo-text-secondary">
                          Rolleri görmek için yukarıdan bir sunucu seç.
                        </p>
                      </div>
                    ) : (() => {
                      const server = discordServers.find((s) => s.id === selectedServerId);
                      const visible = (server?.roles ?? []).filter((r) =>
                        r.name.toLowerCase().includes(roleSearch.toLowerCase())
                      );
                      if (visible.length === 0) {
                        return (
                          <div className="px-3 py-6 text-center">
                            <p className="text-[12px] text-bdo-text-secondary">
                              {roleSearch ? "Eşleşen rol yok." : "Bu sunucuda atanabilir rol yok."}
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="max-h-64 overflow-y-auto">
                          {visible.map((role) => {
                            const selected = gRoleIds.includes(role.id);
                            const owner = roleOwner(role.id);
                            return (
                              <button
                                key={role.id}
                                type="button"
                                onClick={() => toggleRoleId(role.id)}
                                disabled={!!owner}
                                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors border-b border-bdo-border/40 last:border-0 ${
                                  owner
                                    ? "opacity-40 cursor-not-allowed"
                                    : selected
                                    ? "bg-bdo-gold/[0.08]"
                                    : "hover:bg-bdo-surface-2/60"
                                }`}
                              >
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: role.color }}
                                />
                                <span className={`text-[12px] flex-1 truncate ${selected ? "text-bdo-text-primary font-medium" : "text-bdo-text-muted"}`}>
                                  {role.name}
                                </span>
                                {owner && (
                                  <span className="text-[10px] text-bdo-text-secondary flex-shrink-0">
                                    {owner.tag}&apos;a bağlı
                                  </span>
                                )}
                                {selected && !owner && (
                                  <Check className="w-3.5 h-3.5 text-bdo-gold flex-shrink-0" strokeWidth={2.5} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Savaş duyuru kanalı */}
              <div>
                <label className="block text-[10px] uppercase text-bdo-text-secondary tracking-wider mb-1.5">
                  Savaş Duyuru Kanalı
                  <span className="normal-case opacity-60"> — savaş açıldığında duyuru buraya gider</span>
                </label>

                {!selectedServerId ? (
                  <div className="bg-bdo-bg border border-dashed border-bdo-border rounded-lg px-3 py-3 text-center">
                    <p className="text-[12px] text-bdo-text-secondary">Önce yukarıdan sunucu seç.</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={gWarChannel}
                      onChange={(e) => setGWarChannel(e.target.value)}
                      disabled={chLoading}
                      className="flex-1 bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2 text-[13px] text-bdo-text-primary focus:border-bdo-gold/40 focus:outline-none transition-colors disabled:opacity-50"
                    >
                      <option value="">
                        {chLoading ? "Kanallar yükleniyor..." : "Kanal seçilmedi (varsayılan kanal kullanılır)"}
                      </option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category ? `${c.category} / ` : ""}#{c.name}{c.isAnnouncement ? " (duyuru)" : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="ghost" icon={RefreshCw}
                      onClick={() => fetchChannels(selectedServerId)}
                      disabled={chLoading}
                    />
                  </div>
                )}

                <p className="text-[11px] text-bdo-text-secondary mt-1.5">
                  Her klan kendi kanalını seçebilir — savaş duyurusu tüm klanların kanallarına ayrı ayrı
                  gönderilir ve katılım sayıları hepsinde birlikte güncellenir.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" variant="primary" size="md" disabled={gSaving}>
                  {gSaving ? "Kaydediliyor..." : editingGuild ? "Güncelle" : "Klan Oluştur"}
                </Button>
                {editingGuild && (
                  <Button variant="ghost" size="md" onClick={resetGuildForm}>İptal</Button>
                )}
              </div>
            </form>
          </Card>

          {/* Liste */}
          <Card>
            <CardHeader title="Klanlar" icon={Flag} meta={`${guilds.length} klan`} />
            {guilds.length === 0 ? (
              <Empty icon={Flag} text="Henüz klan yok." />
            ) : (
              guilds.map((g) => {
                let roleIds: string[] = [];
                try { roleIds = JSON.parse(g.discordRoleIds || "[]"); } catch { /* ignore */ }
                return (
                  <div key={g.id} className={`card-row gap-3 flex-wrap ${g.isPrimary ? "card-row-active" : ""}`}>
                    <span
                      className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded border flex-shrink-0 font-mono"
                      style={{ color: g.color, borderColor: `${g.color}40`, backgroundColor: `${g.color}15` }}
                    >
                      {g.tag}
                    </span>
                    <div className="flex-1 min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13px] font-medium text-bdo-text-primary truncate">{g.name}</p>
                        {g.isPrimary && (
                          <Star className="w-3 h-3 text-bdo-gold flex-shrink-0" strokeWidth={2} fill="currentColor" />
                        )}
                      </div>
                      <p className="text-[11px] text-bdo-text-secondary mt-0.5">
                        {g._count.members} üye
                        {g.isPrimary && " · ana klan (eşleşmeyenler buraya düşer)"}
                      </p>
                      {roleIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {roleIds.map((rid) => {
                            const found = findRole(rid);
                            return (
                              <span
                                key={rid}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
                                style={found
                                  ? { color: found.role.color, borderColor: `${found.role.color}30`, backgroundColor: `${found.role.color}12` }
                                  : { color: "#4d5c73", borderColor: "#1e2a3c", backgroundColor: "#131820" }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: found?.role.color ?? "#4d5c73" }}
                                />
                                {found ? found.role.name : `ID: ${rid}`}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Button variant="ghost" size="xs" icon={Pencil} onClick={() => startEditGuild(g)} />
                      {!g.isPrimary && (
                        <Button variant="danger" size="xs" icon={Trash2} onClick={() => deleteGuild(g)} />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </Card>
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
              </div>

              {/* Yetki seviyesi */}
              <div className="space-y-2">
                <p className="text-[10px] uppercase text-bdo-text-secondary tracking-wider">Yetki Seviyesi</p>

                <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-bdo-border bg-bdo-bg hover:border-bdo-border-2 transition-colors">
                  <input
                    type="checkbox"
                    checked={newRoleIsGuildAdmin}
                    onChange={(e) => { setNewRoleIsGuildAdmin(e.target.checked); if (e.target.checked) setNewRoleIsAdmin(false); }}
                    className="w-4 h-4 rounded border-bdo-border accent-bdo-gold mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-[13px] text-bdo-text-primary font-medium">Klan Yöneticisi</p>
                    <p className="text-[11px] text-bdo-text-secondary mt-0.5 leading-relaxed">
                      Savaş açabilir, parti kurabilir, hasar raporu girebilir.
                      Sadece kendi klanının üyelerini görür — başka klanların verisine erişemez.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-lg border border-red-500/20 bg-red-500/5 hover:border-red-500/30 transition-colors">
                  <input
                    type="checkbox"
                    checked={newRoleIsAdmin}
                    onChange={(e) => { setNewRoleIsAdmin(e.target.checked); if (e.target.checked) setNewRoleIsGuildAdmin(false); }}
                    className="w-4 h-4 rounded border-bdo-border accent-red-400 mt-0.5 flex-shrink-0"
                  />
                  <div>
                    <p className="text-[13px] text-red-400 font-medium">Site Admini</p>
                    <p className="text-[11px] text-bdo-text-secondary mt-0.5 leading-relaxed">
                      Tam yetki — <span className="text-red-400/80">tüm klanların</span> verisini görür ve düzenler,
                      üye silebilir, klan ve rol yönetir. Müttefiklere verme.
                    </p>
                  </div>
                </label>
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
                        <span className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-bold uppercase">
                          Site Admin
                        </span>
                      )}
                      {role.isGuildAdmin && !role.isAdmin && (
                        <span className="text-[10px] bg-bdo-gold/10 text-bdo-gold border border-bdo-gold/20 px-2 py-0.5 rounded font-bold uppercase">
                          Klan Yön.
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
          <h2 className="text-[15px] font-bold text-bdo-text-primary">GeoGuessr Resimleri</h2>

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
                      ? `Seçildi (${(geoPickX * 100).toFixed(1)}%, ${(geoPickY! * 100).toFixed(1)}%)`
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
        </div> {/* sağ içerik */}
      </div> {/* flex wrapper */}
    </div>
  );
}
