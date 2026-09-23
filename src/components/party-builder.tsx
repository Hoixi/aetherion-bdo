"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  DndContext, DragOverlay, rectIntersection, pointerWithin, PointerSensor,
  useSensor, useSensors, useDroppable,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Search, Plus, Users, AlertTriangle, Wand2 } from "lucide-react";
import { MemberChip, UserPerfStats, scoreColor, LOW_SAMPLE } from "./member-chip";
import { RECENT_WAR_WINDOW } from "@/lib/perf-window";
import { PartyColumn, ROLES, type PartyMemberData } from "./party-column";
import { getClassByID } from "@/lib/classes";
import type { WarAttendanceSummary, AttendanceStatus } from "@/app/api/wars/attendance-history/route";
import type { GuvenOzet } from "@/components/guven-rozeti";
import { UyeDetay } from "@/components/uye-detay";
import type { KarakterBilgi } from "@/app/api/wars/[id]/characters/route";

/**
 * Parti kurma ekranı.
 *
 * Kalabalık olmasın diye ölçü şu: sürekli lazım olan üstte ve sabit
 * (kim atanmadı, ne kadar doldu, roller nasıl dağıldı), geri kalan
 * ayrıntı karta üstüne gelince açılıyor.
 *
 * Havuzda altmış kişi olabiliyor; aranacak kişiyi gözle bulmak asıl
 * zorluktu, o yüzden arama ve sıralama havuzun kendi başlığında duruyor.
 */

// Havuz geniş alan olduğu için rectIntersection ile yakalanıyor;
// parti ve üyeler için imleç konumu daha isabetli
const collide: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : rectIntersection(args);
};

interface User {
  id: number;
  familyName: string;
  class: string;
  ap: number;
  dp: number;
  avatarUrl: string;
  guild?: { tag: string; color: string } | null;
  not?: string | null;
}

interface PartyData {
  id: number;
  name: string;
  isDefense: boolean;
  role?: string;
  members: PartyMemberData[];
}

interface PartyBuilderProps {
  warId: number;
  attendees: User[];
  initialParties: PartyData[];
  maxParticipants?: number | null;
  tier?: string | null;
  memberStats?: Record<number, UserPerfStats>;
  attendanceHistory?: WarAttendanceSummary[];
  /** userId → güvenilirlik; yalnızca yöneticiye yüklenir */
  guven?: Record<number, GuvenOzet>;
  currentStatuses?: Record<number, AttendanceStatus>;
  /**
   * Tam ekran düzen: havuz solda dikey, partiler ortada, tıklanan üyenin
   * detayı sağda (karakter seçimi dahil). Kart düzeninde yok.
   */
  tam?: boolean;
  /** userId → karakter bilgisi (ana / bildirdiği / alternatifler) — tam görünüm için */
  karakterler?: Record<number, KarakterBilgi>;
}

type PoolSort = "gs" | "score" | "guven" | "name" | "class";

/**
 * Form sıralaması üç bant hâlinde: önce yeterli örneklemi olanlar, sonra
 * bir-iki savaşlık gürültülü puanlar, en sonda son savaşlarda hiç
 * oynamamışlar. Düz puana göre sıralayınca tek gecede parlamış biri
 * beş savaştır istikrarlı olanın üstüne çıkıyordu.
 */
function formRank(p?: UserPerfStats): number {
  if (!p) return -1e6;
  return (p.wars > LOW_SAMPLE ? 1000 : 0) + p.score;
}

const POOL_SORTS: [PoolSort, string, string][] = [
  ["gs", "Gear", "Gear skoruna göre"],
  ["score", "Form", `Son ${RECENT_WAR_WINDOW} savaşın performans puanına göre`],
  ["guven", "Güven", "Katılım güvenilirliğine göre: seçildiğinde gelme oranı (raporlu son savaşlar)"],
  ["class", "Class", "Class'a göre"],
  ["name", "İsim", "Aile adına göre"],
];

function DroppablePool({ children, empty }: { children: React.ReactNode; empty: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: "pool" });
  return (
    <div ref={setNodeRef}
         className={`flex gap-1.5 flex-wrap p-3 rounded-xl border border-dashed transition-colors
                     min-h-[68px] ${isOver ? "border-bdo-gold bg-bdo-gold/5" : "border-bdo-border bg-bdo-bg"}`}>
      {empty
        ? <span className="text-[11px] text-bdo-text-secondary self-center">Herkes bir partiye atandı.</span>
        : children}
    </div>
  );
}

/** Tam ekran: havuz dikey liste */
function DroppablePoolDikey({ children, empty }: { children: React.ReactNode; empty: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: "pool" });
  return (
    <div ref={setNodeRef}
         className={`flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5 transition-colors ${isOver ? "bg-bdo-gold/5" : ""}`}>
      {empty ? <span className="block text-[11px] text-bdo-text-secondary text-center py-6">Herkes bir partiye atandı.</span> : children}
    </div>
  );
}

function userFormScore(user: User, memberStats?: Record<number, UserPerfStats>) {
  const perf = memberStats?.[user.id];
  if (perf) return perf.score;
  return (user.ap + user.dp) * 0.4;
}

function defenseFrequency(userId: number, attendanceHistory?: WarAttendanceSummary[]) {
  return (attendanceHistory ?? []).reduce((count, war) => {
    return count + (war.defenseUsers?.includes(userId) ? 1 : 0);
  }, 0);
}

function buildAutoPartyPlan(
  attendees: User[],
  memberStats: Record<number, UserPerfStats> | undefined,
  attendanceHistory: WarAttendanceSummary[] | undefined,
  maxParticipants?: number | null,
  tier?: string | null,
): { name: string; role: "MAIN" | "DEFENSE" | "FLANK"; members: User[] }[] {
  const sorted = [...attendees].sort((a, b) => {
    const aDefense = defenseFrequency(a.id, attendanceHistory);
    const bDefense = defenseFrequency(b.id, attendanceHistory);
    if (aDefense !== bDefense) return bDefense - aDefense;
    return userFormScore(b, memberStats) - userFormScore(a, memberStats)
      || (b.ap + b.dp) - (a.ap + a.dp);
  });

  const isT1War = tier?.toUpperCase() === "T1" || (!!maxParticipants && maxParticipants <= 30);
  const t1Limit = isT1War ? (maxParticipants && maxParticipants > 0 ? Math.min(maxParticipants, 30) : 30) : Number.POSITIVE_INFINITY;

  const eligible = sorted.slice(0, Number.isFinite(t1Limit) ? Math.min(sorted.length, t1Limit) : sorted.length);
  if (eligible.length === 0) return [];

  const defenseMin = eligible.length >= 3 ? 3 : eligible.length;
  const defenseCount = eligible.length >= 5 ? 4 : defenseMin;
  const defenseCandidates = eligible.filter((user) => defenseFrequency(user.id, attendanceHistory) > 0);

  const defenseSelected: User[] = [];
  for (const user of [...defenseCandidates, ...eligible]) {
    if (defenseSelected.length >= defenseCount) break;
    if (!defenseSelected.some((member) => member.id === user.id)) defenseSelected.push(user);
  }

  const defenseSet = new Set(defenseSelected.map((user) => user.id));
  const remaining = eligible.filter((user) => !defenseSet.has(user.id));

  const plans: { name: string; role: "MAIN" | "DEFENSE" | "FLANK"; members: User[] }[] = [];
  if (defenseSelected.length > 0) {
    plans.push({
      name: "Savunma",
      role: "DEFENSE",
      members: defenseSelected.slice(0, defenseCount),
    });
  }

  if (remaining.length === 0) return plans;

  const main1Target = Math.min(20, Math.max(1, Math.ceil(remaining.length / 2)));
  const main1 = remaining.slice(0, main1Target);
  const main2 = remaining.slice(main1Target, Math.min(remaining.length, main1Target + 20));

  if (main1.length > 0) {
    plans.push({ name: "Main-1", role: "MAIN", members: main1 });
  }
  if (main2.length > 0) {
    plans.push({ name: "Main-2", role: "MAIN", members: main2 });
  }

  return plans;
}

export function PartyBuilder({
  warId, attendees, initialParties, maxParticipants, tier, memberStats,
  attendanceHistory, currentStatuses, guven, tam = false, karakterler,
}: PartyBuilderProps) {
  const [parties, setParties] = useState<PartyData[]>(initialParties);
  const [seciliId, setSeciliId] = useState<number | null>(null);
  /** Havuzdaki (partisiz) üyeler için yöneticinin seçtiği karakter — sunucuda katılım kaydında */
  const [havuzSecim, setHavuzSecim] = useState<Record<number, { class: string; spec: string }>>({});
  // Sürükleme işleyicisi bu ikisini güncel okusun diye ref üzerinden
  const havuzSecimRef = useRef(havuzSecim);
  havuzSecimRef.current = havuzSecim;
  const karakterSecRef = useRef<((partyId: number | null, userId: number, secim: { class: string; spec: string } | null) => Promise<void>) | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<PoolSort>("gs");

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const assigned = new Set(parties.flatMap((p) => p.members.map((m) => m.userId)));
  const totalAssigned = assigned.size;
  const isOverMax = maxParticipants ? totalAssigned > maxParticipants : false;

  const unassigned = useMemo(() => {
    let list = attendees.filter((u) => !assigned.has(u.id));
    const needle = q.trim().toLocaleLowerCase("tr");
    if (needle) {
      list = list.filter((u) => {
        const cls = getClassByID(u.class)?.name ?? u.class;
        return u.familyName.toLocaleLowerCase("tr").includes(needle)
            || cls.toLocaleLowerCase("tr").includes(needle);
      });
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return a.familyName.localeCompare(b.familyName, "tr");
      if (sort === "score") return formRank(memberStats?.[b.id]) - formRank(memberStats?.[a.id]);
      if (sort === "guven") {
        const g = (u: User) => { const x = guven?.[u.id]; return x && x.yuzde !== null ? x.yuzde + Math.min(x.secildi, 10) / 100 : -1; };
        return g(b) - g(a) || (b.ap + b.dp) - (a.ap + a.dp);
      }
      if (sort === "class") {
        const an = getClassByID(a.class)?.name ?? a.class;
        const bn = getClassByID(b.class)?.name ?? b.class;
        return an.localeCompare(bn, "tr") || b.ap + b.dp - (a.ap + a.dp);
      }
      return b.ap + b.dp - (a.ap + a.dp);
    });
    // `assigned` her render'da yeniden kuruluyor; parties'e bağlamak yeterli
  }, [attendees, parties, q, sort, memberStats, guven]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Üstteki özet — rol ve klan dağılımı tek bakışta */
  const summary = useMemo(() => {
    const byRole = new Map<string, number>();
    const byGuild = new Map<string, { tag: string; color: string; n: number }>();
    let gsSum = 0;
    for (const p of parties) {
      const role = p.role ?? (p.isDefense ? "DEFENSE" : "MAIN");
      byRole.set(role, (byRole.get(role) ?? 0) + p.members.length);
      for (const m of p.members) {
        gsSum += m.user.ap + m.user.dp;
        const g = m.user.guild;
        if (!g) continue;
        const cur = byGuild.get(g.tag) ?? { tag: g.tag, color: g.color, n: 0 };
        cur.n++;
        byGuild.set(g.tag, cur);
      }
    }
    return {
      byRole,
      guilds: Array.from(byGuild.values()).sort((a, b) => b.n - a.n),
      avgGs: totalAssigned ? Math.round(gsSum / totalAssigned) : 0,
    };
  }, [parties, totalAssigned]);

  const handleDragStart = useCallback((e: DragStartEvent) => {
    const userId = Number(String(e.active.id).replace("member-", ""));
    const user = attendees.find((u) => u.id === userId);
    if (user) setActiveUser(user);
  }, [attendees]);

  const savePartyMembers = useCallback(async (partyId: number, members: { userId: number }[]) => {
    setSaveStatus("Kaydediliyor…");
    await fetch(`/api/wars/${warId}/parties/${partyId}/members`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: members.map((m) => m.userId) }),
    });
    setSaveStatus("Kaydedildi");
    setTimeout(() => setSaveStatus(null), 2000);
  }, [warId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveUser(null);
    const { active, over } = event;
    if (!over) return;

    const userId = Number(String(active.id).replace("member-", ""));
    const overId = String(over.id);

    if (overId === "pool") {
      const source = parties.find((p) => p.members.some((m) => m.userId === userId));
      if (!source) return;
      const updated = parties.map((p) =>
        p.id === source.id ? { ...p, members: p.members.filter((m) => m.userId !== userId) } : p);
      setParties(updated);
      await savePartyMembers(source.id, updated.find((p) => p.id === source.id)!.members);
      return;
    }

    let targetId: number | null = null;
    if (overId.startsWith("party-")) {
      targetId = Number(overId.replace("party-", ""));
    } else if (overId.startsWith("member-")) {
      const overUserId = Number(overId.replace("member-", ""));
      targetId = parties.find((p) => p.members.some((m) => m.userId === overUserId))?.id ?? null;
    }
    if (!targetId) return;

    const target = parties.find((p) => p.id === targetId);
    if (!target) return;
    if (target.members.length >= 20 && !target.members.some((m) => m.userId === userId)) return;

    const source = parties.find((p) => p.members.some((m) => m.userId === userId));
    const user = attendees.find((u) => u.id === userId)!;

    let updated = [...parties];
    if (source) {
      updated = updated.map((p) =>
        p.id === source.id ? { ...p, members: p.members.filter((m) => m.userId !== userId) } : p);
    }
    updated = updated.map((p) =>
      p.id === targetId ? { ...p, members: [...p.members, { id: 0, userId, user }] } : p);
    setParties(updated);

    await savePartyMembers(targetId, updated.find((p) => p.id === targetId)!.members);
    if (source && source.id !== targetId) {
      await savePartyMembers(source.id, updated.find((p) => p.id === source.id)!.members);
    }
    // Havuzdayken seçilen karakter partiye de taşınsın
    const havuz = havuzSecimRef.current[userId];
    if (!source && havuz) await karakterSecRef.current?.(targetId, userId, havuz);
  }, [parties, attendees, savePartyMembers]);

  async function addParty() {
    const res = await fetch(`/api/wars/${warId}/parties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Parti ${parties.length + 1}` }),
    });
    if (res.ok) setParties([...parties, await res.json()]);
  }

  async function autoCreateParties() {
    const plan = buildAutoPartyPlan(attendees, memberStats, attendanceHistory, maxParticipants, tier);
    if (plan.length === 0) return;

    const created: PartyData[] = [];
    for (const partyPlan of plan) {
      const res = await fetch(`/api/wars/${warId}/parties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: partyPlan.name, role: partyPlan.role }),
      });
      if (!res.ok) continue;

      const createdParty = await res.json();
      const members = partyPlan.members.map((user) => ({
        id: 0,
        userId: user.id,
        user,
      }));

      created.push({
        ...createdParty,
        members,
      });

      await fetch(`/api/wars/${warId}/parties/${createdParty.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: partyPlan.members.map((user) => user.id) }),
      });
    }

    setParties(created);
    setSaveStatus("Otomatik parti kuruldu");
    setTimeout(() => setSaveStatus(null), 2500);
  }

  /**
   * Yönetici seçimi: üyenin bu savaşa geleceği karakter (null = üyenin kendi
   * bildirdiğine dön). Partideyse parti kaydına, havuzdaysa katılım kaydına
   * yazılır — ikisinde de üyenin izin verdiği seçenekler dışına çıkılamaz.
   */
  async function karakterSec(partyId: number | null, userId: number, secim: { class: string; spec: string } | null) {
    const yol = partyId !== null
      ? `/api/wars/${warId}/parties/${partyId}/members/${userId}`
      : `/api/wars/${warId}/characters`;
    const res = await fetch(yol, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, asClass: secim?.class ?? null, asSpec: secim?.spec ?? null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setSaveStatus(d.error ?? "Karakter seçilemedi."); setTimeout(() => setSaveStatus(null), 3000);
      return;
    }
    if (partyId !== null) {
      setParties(parties.map((p) => p.id === partyId
        ? { ...p, members: p.members.map((m) => (m.userId === userId ? { ...m, asClass: secim?.class ?? null, asSpec: secim?.spec ?? null } : m)) }
        : p));
    } else {
      setHavuzSecim((h) => {
        const n = { ...h };
        if (secim) n[userId] = secim; else delete n[userId];
        return n;
      });
    }
    setSaveStatus("Karakter kaydedildi"); setTimeout(() => setSaveStatus(null), 2000);
  }
  karakterSecRef.current = karakterSec;

  async function renameParty(partyId: number, name: string) {
    await fetch(`/api/wars/${warId}/parties/${partyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setParties(parties.map((p) => (p.id === partyId ? { ...p, name } : p)));
  }

  async function setRole(partyId: number, role: string): Promise<{ error?: string }> {
    const res = await fetch(`/api/wars/${warId}/parties/${partyId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: data.error ?? "Rol değiştirilemedi." };
    }
    setParties(parties.map((p) =>
      p.id === partyId ? { ...p, role, isDefense: role === "DEFENSE" } : p));
    return {};
  }

  async function deleteParty(partyId: number) {
    const p = parties.find((x) => x.id === partyId);
    if (p && p.members.length > 0 &&
        !window.confirm(`${p.name} içinde ${p.members.length} kişi var. Silinsin mi?`)) return;
    await fetch(`/api/wars/${warId}/parties/${partyId}`, { method: "DELETE" });
    setParties(parties.filter((x) => x.id !== partyId));
  }

  // Seçili üye — havuzda ya da bir partide
  const seciliUser = seciliId !== null ? attendees.find((u) => u.id === seciliId) ?? null : null;
  const seciliParti = seciliId !== null ? parties.find((p) => p.members.some((m) => m.userId === seciliId)) ?? null : null;
  const seciliUye = seciliParti?.members.find((m) => m.userId === seciliId) ?? null;
  const onSecim = tam ? (id: number) => setSeciliId((v) => (v === id ? null : id)) : undefined;

  const detayPaneli = tam && seciliUser ? (
    <UyeDetay user={seciliUser} perf={memberStats?.[seciliUser.id]} guven={guven?.[seciliUser.id] ?? null}
              history={attendanceHistory} karakter={karakterler?.[seciliUser.id]}
              partyId={seciliParti?.id ?? null}
              secili={seciliUye?.asClass
                ? { class: seciliUye.asClass, spec: seciliUye.asSpec ?? "awakening" }
                : havuzSecim[seciliUser.id] ?? null}
              onKapat={() => setSeciliId(null)}
              onKarakter={(k) => karakterSec(seciliParti?.id ?? null, seciliUser.id, k)} />
  ) : null;

  if (tam) {
    return (
      <DndContext sensors={sensors} collisionDetection={collide}
                  onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "300px 1fr", height: "calc(100vh - 150px)", minHeight: 560 }}>
          {/* Sol: havuz — seçili üyenin detayı hemen altında */}
          <div className="grid gap-3 min-h-0" style={{ gridTemplateRows: seciliUser ? "minmax(120px, 34%) 1fr" : "1fr" }}>
          <div className="flex flex-col min-h-0 rounded-xl border border-bdo-border bg-bdo-surface overflow-hidden">
            <div className="p-2.5 space-y-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold text-bdo-text-muted uppercase tracking-wider">
                  Atanmamış <span className="font-mono text-bdo-text-primary">{unassigned.length}</span>
                </h3>
                <span className="text-[10.5px] text-bdo-text-secondary">{totalAssigned}{maxParticipants ? `/${maxParticipants}` : ""} partide</span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-bdo-text-secondary" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim ya da class"
                       className="pl-8 pr-2 h-[30px] w-full rounded-lg text-[12px] bg-bdo-bg border border-bdo-border focus:border-bdo-gold focus:outline-none" />
              </div>
              <div className="flex flex-wrap gap-0.5">
                {POOL_SORTS.map(([k, label, hint]) => (
                  <button key={k} onClick={() => setSort(k)} title={hint} className="text-[10.5px] px-1.5 py-0.5 rounded-md"
                          style={sort === k ? { background: "rgb(var(--bdo-gold) / .14)", color: "rgb(var(--bdo-gold))" } : { color: "#5e5e66" }}>{label}</button>
                ))}
              </div>
            </div>
            <SortableContext items={unassigned.map((u) => `member-${u.id}`)} strategy={verticalListSortingStrategy}>
              <DroppablePoolDikey empty={unassigned.length === 0 && q.trim() === ""}>
                {unassigned.map((user) => (
                  <MemberChip key={`member-${user.id}`} id={`member-${user.id}`} user={user}
                              perf={memberStats?.[user.id]} attendanceHistory={attendanceHistory}
                              currentStatus={currentStatuses?.[user.id]} compact
                              guven={guven ? guven[user.id] ?? null : undefined}
                              asClass={havuzSecim[user.id]?.class ?? null}
                              onSecim={onSecim} secili={seciliId === user.id} />
                ))}
                {unassigned.length === 0 && q.trim() !== "" && <span className="text-[11px] text-bdo-text-secondary">Aramaya uyan kimse yok.</span>}
              </DroppablePoolDikey>
            </SortableContext>
          </div>
          {detayPaneli}
          </div>

          {/* Sağ: partiler */}
          <div className="flex flex-col min-h-0 gap-3">
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap px-3 py-2 rounded-xl bg-bdo-surface border border-bdo-border text-[12px]">
              {ROLES.map((r) => { const n = summary.byRole.get(r.key) ?? 0; return n ? (
                <span key={r.key} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full" style={{ background: r.tone }} /><span className="text-bdo-text-muted">{r.label}</span><span className="font-mono font-bold">{n}</span></span>
              ) : null; })}
              {summary.avgGs > 0 && <span className="text-bdo-text-muted">Ort. GS <span className="font-mono font-bold text-bdo-gold">{summary.avgGs}</span></span>}
              {summary.guilds.map((g) => <span key={g.tag} className="font-mono" style={{ color: g.color }}>{g.tag} {g.n}</span>)}
              {isOverMax && <span className="flex items-center gap-1 font-semibold text-red-400"><AlertTriangle className="w-3.5 h-3.5" /> Katılım sınırı aşıldı</span>}
              <span className="ml-auto flex items-center gap-1">
                {saveStatus && <span className="text-[11px] text-bdo-gold mr-2">{saveStatus}</span>}
                <button onClick={autoCreateParties} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20"><Wand2 className="w-3 h-3" /> Otomatik</button>
                <button onClick={addParty} className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20"><Plus className="w-3 h-3" /> Yeni parti</button>
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden">
              {parties.length === 0 ? (
                <div className="h-full rounded-xl border border-dashed border-bdo-border grid place-items-center text-[13px] text-bdo-text-muted">Henüz parti yok — soldan sürükle ya da &quot;Yeni parti&quot;.</div>
              ) : (
                <div className="flex gap-3 h-full pb-2">
                  {parties.map((party) => (
                    <div key={party.id} className="h-full overflow-y-auto">
                      <PartyColumn party={party} onRename={renameParty} onDelete={deleteParty} onSetRole={setRole}
                                   memberStats={memberStats} attendanceHistory={attendanceHistory}
                                   currentStatuses={currentStatuses} guven={guven} onSecim={onSecim} seciliId={seciliId} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <DragOverlay>
          {activeUser && <MemberChip id={`overlay-${activeUser.id}`} user={activeUser} perf={memberStats?.[activeUser.id]} isDragOverlay compact />}
        </DragOverlay>
      </DndContext>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collide}
                onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Özet — sayfayı kaydırmadan durumu görebilmek için */}
        <div className="flex items-center gap-x-5 gap-y-2 flex-wrap px-3.5 py-2.5
                        rounded-xl bg-bdo-surface border border-bdo-border">
          <span className="flex items-center gap-1.5 text-[12px]">
            <Users className="w-3.5 h-3.5 text-bdo-text-secondary" />
            <span className="font-mono font-bold text-bdo-text-primary">{totalAssigned}</span>
            {maxParticipants && (
              <span className="font-mono text-bdo-text-secondary">/ {maxParticipants}</span>
            )}
            <span className="text-bdo-text-muted">partilerde</span>
          </span>

          {ROLES.map((r) => {
            const n = summary.byRole.get(r.key) ?? 0;
            if (!n) return null;
            return (
              <span key={r.key} className="flex items-center gap-1.5 text-[12px]">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.tone }} />
                <span className="text-bdo-text-muted">{r.label}</span>
                <span className="font-mono font-bold" style={{ color: r.tone }}>{n}</span>
              </span>
            );
          })}

          {summary.avgGs > 0 && (
            <span className="text-[12px] text-bdo-text-muted">
              Ort. GS <span className="font-mono font-bold text-bdo-gold">{summary.avgGs}</span>
            </span>
          )}

          {summary.guilds.map((g) => (
            <span key={g.tag} className="text-[12px] font-mono" style={{ color: g.color }}>
              {g.tag} {g.n}
            </span>
          ))}

          {isOverMax && (
            <span className="flex items-center gap-1 text-[12px] font-semibold text-red-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Katılım sınırı aşıldı
            </span>
          )}

          {saveStatus && (
            <span className="ml-auto text-[11px] text-bdo-gold">{saveStatus}</span>
          )}
        </div>

        {/* Havuz */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <h3 className="text-[12px] font-semibold text-bdo-text-muted uppercase tracking-wider">
              Atanmamış <span className="font-mono text-bdo-text-primary">{unassigned.length}</span>
            </h3>

            <div className="relative ml-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2
                                 text-bdo-text-secondary" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim ya da class ara"
                     className="pl-8 pr-2 h-[30px] w-[200px] rounded-lg text-[12px] bg-bdo-bg
                                border border-bdo-border focus:border-bdo-gold focus:outline-none" />
            </div>

            <div className="ml-auto flex items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-bdo-text-secondary mr-1">
                Sırala
              </span>
              {POOL_SORTS.map(([k, label, hint]) => (
                <button key={k} onClick={() => setSort(k)} title={hint}
                        className="text-[11px] px-2 py-1 rounded-md transition-colors"
                        style={sort === k
                          ? { background: "rgb(var(--bdo-gold) / .14)", color: "rgb(var(--bdo-gold))" }
                          : { color: "#5e5e66" }}>
                  {label}
                </button>
              ))}
              <button onClick={autoCreateParties}
                      className="ml-2 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md
                                 bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20 transition-colors">
                <Wand2 className="w-3 h-3" /> Otomatik parti kur
              </button>
              <button onClick={addParty}
                      className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md
                                 bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20 transition-colors">
                <Plus className="w-3 h-3" /> Yeni parti
              </button>
            </div>
          </div>

          <SortableContext items={unassigned.map((u) => `member-${u.id}`)}
                           strategy={horizontalListSortingStrategy}>
            <DroppablePool empty={unassigned.length === 0 && q.trim() === ""}>
              {unassigned.map((user) => (
                <MemberChip key={`member-${user.id}`} id={`member-${user.id}`} user={user}
                            perf={memberStats?.[user.id]} attendanceHistory={attendanceHistory}
                            currentStatus={currentStatuses?.[user.id]} compact
                            guven={guven ? guven[user.id] ?? null : undefined} />
              ))}
              {unassigned.length === 0 && q.trim() !== "" && (
                <span className="text-[11px] text-bdo-text-secondary self-center">
                  Aramaya uyan kimse yok.
                </span>
              )}
            </DroppablePool>
          </SortableContext>
        </div>

        {/* Partiler */}
        {parties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-bdo-border py-10 text-center">
            <p className="text-[13px] text-bdo-text-muted">Henüz parti yok.</p>
            <button onClick={addParty}
                    className="mt-3 inline-flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-lg
                               bg-bdo-gold/10 text-bdo-gold hover:bg-bdo-gold/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> İlk partiyi oluştur
            </button>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {parties.map((party) => (
              <PartyColumn key={party.id} party={party} onRename={renameParty}
                           onDelete={deleteParty} onSetRole={setRole}
                           memberStats={memberStats} attendanceHistory={attendanceHistory}
                           currentStatuses={currentStatuses} guven={guven} />
            ))}
          </div>
        )}
      </div>

      <DragOverlay>
        {activeUser && (
          <MemberChip id={`overlay-${activeUser.id}`} user={activeUser}
                      perf={memberStats?.[activeUser.id]} isDragOverlay compact />
        )}
      </DragOverlay>
    </DndContext>
  );
}

export { scoreColor };
