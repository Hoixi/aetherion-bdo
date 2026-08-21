"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChevronLeft, Check, X, HelpCircle, AlertTriangle, Users, Send, Clock,
  Swords, Trophy, Layers, Flame, Image as ImageIcon, StickyNote,
} from "lucide-react";
import { PartyBuilder } from "@/components/party-builder";
import type { UserPerfStats } from "@/components/member-chip";
import type { WarAttendanceSummary } from "@/app/api/wars/attendance-history/route";
import { getTypeName, BDO_CLASSES } from "@/lib/classes";
import { classifyAttendance, ATTENDANCE_META, attendanceKnown } from "@/lib/attendance";
import { RECENT_WAR_WINDOW } from "@/lib/perf-window";
import {
  TestShell, Card, Head, Empty, GuildTag, fmt, type Guild,
} from "@/components/app-shell";

/**
 * Savaş detayı.
 *
 * Tek sayfada dört ayrı iş var: cevap vermek, kimin geldiğine bakmak,
 * parti kurmak ve raporu okumak. Hepsi alt alta dizilince sayfa uzuyordu,
 * bu yüzden üstte savaşın künyesi sabit duruyor, geri kalanı sekmelere
 * ayrıldı. Sekme seçimi kişinin yetkisine göre açılıyor — parti kurmayan
 * biri için ilk bakılacak şey kendi katılım durumu.
 */

type User = {
  id: number; familyName: string; class: string; ap: number; dp: number;
  avatarUrl: string; guild?: (Guild & { id: number }) | null;
};
type PartyMember = { id: number; userId: number; order: number; asClass?: string | null; user: User };
type Party = { id: number; name: string; order: number; isDefense: boolean; role?: string; members: PartyMember[] };
type Participant = { id: number; status: string; user: User };

type WarDetail = {
  id: number;
  title: string;
  type: string;
  date: string;
  notes: string;
  deadline: string | null;
  result: "WIN" | "LOSS" | "DRAW" | null;
  tier?: string | null;
  isAllyWar?: boolean;
  maxParticipants: number | null;
  participants: Participant[];
  parties: Party[];
};

type WarPerf = {
  id: number;
  inGameName: string;
  kills: number; deaths: number; killStreak: number;
  damageDealt: number; damageTaken: number; ccCount: number;
  hpHeal: number; allyHpHeal: number; castleDamage: number;
  cannonHits: number; cannonDestroys: number; cannonMaxRange: number;
  trapExplosions: number;
  user: { familyName: string; avatarUrl: string; class: string } | null;
};

/** Node war kademesi — savaş listesiyle aynı renkler */
const TIER_COLOR: Record<string, string> = {
  T1: "#e8b451", T2: "#9a9aa2", T3: "#b87333",
};

const PERF_COLS = [
  { key: "kills", label: "Kill", tone: "var(--t-text)", bold: true },
  { key: "deaths", label: "Ölüm", tone: "var(--t-dim)" },
  { key: "killStreak", label: "Seri", tone: "var(--t-dim)" },
  { key: "damageDealt", label: "Ver. Hasar", tone: "var(--t-gold)", big: true, bold: true },
  { key: "damageTaken", label: "Al. Hasar", tone: "#ef8080", big: true },
  { key: "ccCount", label: "CC", tone: "var(--t-dim)" },
  { key: "hpHeal", label: "HP Yenile", tone: "#5fd39a", big: true },
  { key: "allyHpHeal", label: "Mütt. HP", tone: "#5fd39a", big: true },
  { key: "castleDamage", label: "Kale", tone: "#f0994c", big: true },
  { key: "cannonHits", label: "Top", tone: "var(--t-dim)" },
  { key: "trapExplosions", label: "Tuzak", tone: "var(--t-dim)" },
] as const;

type Tab = "katilim" | "partiler" | "rapor";

export default function SavasDetayPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const warId = params?.id;

  const [war, setWar] = useState<WarDetail | null>(null);
  const [allMembers, setAllMembers] = useState<User[]>([]);
  const [perfs, setPerfs] = useState<WarPerf[]>([]);
  const [absent, setAbsent] = useState<{ id: number; familyName: string; avatarUrl: string }[]>([]);
  const [memberStats, setMemberStats] = useState<Record<number, UserPerfStats>>({});
  const [history, setHistory] = useState<WarAttendanceSummary[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Boş = profildeki karakter */
  const [joinClass, setJoinClass] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("katilim");

  const canManage = !!session?.user?.canManageWars;

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated" || !warId) return;
    let dead = false;

    (async () => {
      const [warRes, memRes, perfRes, statRes, histRes] = await Promise.all([
        fetch(`/api/wars/${warId}`),
        fetch("/api/members"),
        fetch(`/api/wars/${warId}/performance`),
        fetch("/api/performances/user-averages"),
        fetch("/api/wars/attendance-history"),
      ]);
      if (dead) return;

      if (!warRes.ok) { setErr("Savaş bulunamadı."); return; }
      const data: WarDetail = await warRes.json();
      setWar(data);
      setMyStatus(data.participants.find((p) => p.user.id === session?.user?.id)?.status ?? null);

      if (memRes.ok) setAllMembers(await memRes.json());
      if (perfRes.ok) {
        const pd = await perfRes.json();
        setPerfs(pd.performances ?? []);
        setAbsent(pd.absent ?? []);
      }
      if (statRes.ok) setMemberStats(await statRes.json());
      if (histRes.ok) setHistory(await histRes.json());
    })().catch(() => { if (!dead) setErr("Veri alınamadı."); });

    return () => { dead = true; };
  }, [status, warId, session?.user?.id]);

  async function participate(next: string, cls?: string) {
    if (!war) return;
    setSaving(true);
    const res = await fetch(`/api/wars/${war.id}/participate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Seçim yapılmazsa sunucu profildeki class'ı yazıyor
      body: JSON.stringify({ status: next, asClass: cls ?? (joinClass || undefined) }),
    });
    if (res.ok) {
      setMyStatus(next);
      const again = await fetch(`/api/wars/${war.id}`);
      if (again.ok) setWar(await again.json());
    }
    setSaving(false);
  }

  // ── Türetilen veriler ────────────────────────────────────────────────

  const lists = useMemo(() => {
    if (!war) return null;
    const attending = war.participants.filter((p) => p.status === "ATTENDING").map((p) => p.user);
    const declined = war.participants.filter((p) => p.status === "DECLINED").map((p) => p.user);
    const responded = new Set(war.participants.map((p) => p.user.id));
    return {
      attending, declined,
      silent: allMembers.filter((m) => !responded.has(m.id)),
    };
  }, [war, allMembers]);

  /** Rapor gelmeden kimin geldiği bilinemez; o ana kadar sadece seçim durumu var */
  const knows = attendanceKnown(perfs.length);

  const statuses = useMemo(() => {
    if (!war) return { current: {} as Record<number, ReturnType<typeof classifyAttendance>>, counts: new Map<string, number>() };

    const selected = new Set(war.parties.flatMap((p) => p.members.map((m) => m.userId)));
    const came = new Set<number>();
    const byName = new Map(allMembers.map((m) => [m.familyName.toLowerCase(), m.id]));
    for (const perf of perfs) {
      const uid = perf.user
        ? byName.get(perf.user.familyName.toLowerCase())
        : byName.get(perf.inGameName.toLowerCase());
      if (uid) came.add(uid);
    }

    const current: Record<number, ReturnType<typeof classifyAttendance>> = {};
    const counts = new Map<string, number>();
    for (const p of war.participants) {
      const st = classifyAttendance(p.status, selected.has(p.user.id), knows ? came.has(p.user.id) : false);
      current[p.user.id] = st;
      if (p.status === "ATTENDING") counts.set(st, (counts.get(st) ?? 0) + 1);
    }
    return { current, counts };
  }, [war, allMembers, perfs, knows]);

  /** Katılanların klan dağılımı — müttefikli savaşta kimin kaç kişiyle geldiği */
  const guildSplit = useMemo(() => {
    const map = new Map<number, { guild: Guild & { id: number }; count: number }>();
    for (const u of lists?.attending ?? []) {
      if (!u.guild) continue;
      map.set(u.guild.id, { guild: u.guild, count: (map.get(u.guild.id)?.count ?? 0) + 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [lists]);

  // ── Durum ekranları ──────────────────────────────────────────────────

  if (err) {
    return (
      <TestShell title="Savaş" subtitle="Bulunamadı">
        <Card className="p-4">
          <p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p>
        </Card>
      </TestShell>
    );
  }
  if (!war || !lists) {
    return <TestShell title="Savaş" subtitle="Yükleniyor…"><Empty>Savaş geliyor…</Empty></TestShell>;
  }

  const date = new Date(war.date);
  const deadlinePassed = war.deadline ? new Date() > new Date(war.deadline) : false;
  const overCap = !!war.maxParticipants && lists.attending.length > war.maxParticipants;
  const partyCount = war.parties.filter((p) => p.members.length > 0).length;
  const selectedCount = war.parties.reduce((s, p) => s + p.members.length, 0);
  const tier = war.tier ?? "T1";

  const TABS: { id: Tab; label: string; icon: React.ElementType; meta?: number }[] = [
    { id: "katilim", label: "Katılım", icon: Users, meta: lists.attending.length },
    { id: "partiler", label: "Partiler", icon: Layers, meta: partyCount },
    { id: "rapor", label: "Hasar Raporu", icon: Flame, meta: perfs.length },
  ];

  return (
    <TestShell bare title={war.title}>
      <div className="space-y-5 pb-8">
        <Link href="/savaslar"
              className="inline-flex items-center gap-1 text-[12px] transition-colors hover:opacity-80"
              style={{ color: "var(--t-dim)" }}>
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.2} /> Savaş listesi
        </Link>

        {/* ── Künye ───────────────────────────────────────────────── */}
        <Card hi className="overflow-hidden">
          <div className="p-5 flex items-start justify-between gap-5 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[26px] font-bold tracking-tight leading-none">{war.title}</h1>
                <span className="t-chip"
                      style={{ color: TIER_COLOR[tier] ?? "var(--t-dim)",
                               borderColor: (TIER_COLOR[tier] ?? "#888") + "55" }}>
                  {tier}
                </span>
                <span className="t-chip">{getTypeName(war.type)}</span>
                {war.isAllyWar === false && <span className="t-chip">KLAN İÇİ</span>}
              </div>
              <p className="text-[12.5px] mt-2 flex items-center gap-1.5" style={{ color: "var(--t-dim)" }}>
                <Clock className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} />
                {date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", weekday: "long" })}
                {" · "}
                {date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2.5">
              {war.result && (
                <span className="text-[11px] font-bold px-2.5 py-1.5 rounded-md flex items-center gap-1.5"
                      style={{
                        color: war.result === "WIN" ? "var(--t-good)" : war.result === "LOSS" ? "var(--t-bad)" : "var(--t-dim)",
                        background: war.result === "WIN" ? "rgba(56,208,127,.10)"
                          : war.result === "LOSS" ? "rgba(239,95,95,.10)" : "rgba(255,255,255,.05)",
                      }}>
                  <Trophy className="w-3.5 h-3.5" strokeWidth={2.2} />
                  {war.result === "WIN" ? "GALİBİYET" : war.result === "LOSS" ? "MAĞLUBİYET" : "BERABERE"}
                </span>
              )}

              {deadlinePassed ? (
                <span className="text-[11.5px] flex items-center gap-1.5" style={{ color: "var(--t-bad)" }}>
                  <Clock className="w-3.5 h-3.5" strokeWidth={1.9} /> Katılım süresi doldu
                </span>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button onClick={() => participate("ATTENDING")} disabled={saving}
                          className="text-[12px] font-semibold px-3 h-[34px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          style={myStatus === "ATTENDING"
                            ? { color: "var(--t-good)", background: "rgba(56,208,127,.13)", border: "1px solid rgba(56,208,127,.32)" }
                            : { color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                    <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> Katılıyorum
                  </button>

                  <select value={joinClass}
                          onChange={(e) => {
                            setJoinClass(e.target.value);
                            // Zaten katılıyorsa seçim anında kaydedilsin
                            if (myStatus === "ATTENDING") participate("ATTENDING", e.target.value);
                          }}
                          title="Bu savaşa hangi karakterle geleceksin?"
                          className="h-[34px] px-2.5 rounded-[var(--t-r-sm)] text-[12px] outline-none"
                          style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }}>
                    <option value="">Kayıtlı karakterim</option>
                    {BDO_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  <button onClick={() => participate("DECLINED")} disabled={saving || myStatus === "DECLINED"}
                          className="text-[12px] font-semibold px-3 h-[34px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          style={myStatus === "DECLINED"
                            ? { color: "var(--t-bad)", background: "rgba(239,95,95,.13)", border: "1px solid rgba(239,95,95,.32)" }
                            : { color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} /> Katılmıyorum
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Sayı şeridi */}
          <div className="grid grid-cols-2 sm:grid-cols-4"
               style={{ borderTop: "1px solid var(--t-line)" }}>
            <Stat label="Katılan" value={lists.attending.length}
                  sub={war.maxParticipants ? `/ ${war.maxParticipants} kontenjan` : undefined}
                  tone={overCap ? "var(--t-gold)" : "var(--t-good)"} />
            <Stat label="Katılmayan" value={lists.declined.length} tone="var(--t-bad)" />
            <Stat label="Bildirmedi" value={lists.silent.length} tone="var(--t-dim)" />
            <Stat label="Partiye seçilen" value={selectedCount}
                  sub={partyCount > 0 ? `${partyCount} parti` : undefined} tone="var(--t-gold)" />
          </div>

          {overCap && (
            <div className="flex items-center gap-1.5 px-5 py-2"
                 style={{ borderTop: "1px solid var(--t-line)", background: "rgba(232,180,81,.06)" }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
              <span className="text-[11.5px]" style={{ color: "var(--t-gold)" }}>
                Kontenjandan {lists.attending.length - war.maxParticipants!} kişi fazla — parti kurarken eleme yapman gerekecek.
              </span>
            </div>
          )}
        </Card>

        {war.notes && (
          <Card className="p-4 flex gap-2.5">
            <StickyNote className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={1.8} style={{ color: "var(--t-gold)" }} />
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--t-dim)" }}>
              {war.notes}
            </p>
          </Card>
        )}

        {/* ── Sekmeler ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map((t) => (
            <button key={t.id} className="t-tab" data-on={tab === t.id} onClick={() => setTab(t.id)}>
              <t.icon className="w-3.5 h-3.5" strokeWidth={2} />
              {t.label}
              {!!t.meta && (
                <span className="t-num text-[11px]" style={{ color: "var(--t-faint)" }}>{t.meta}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "katilim" && (
          <Katilim lists={lists} guildSplit={guildSplit} counts={statuses.counts}
                   current={statuses.current} />
        )}

        {tab === "partiler" && (
          canManage ? (
            <AdminPartiler war={war} attendees={lists.attending} memberStats={memberStats}
                           history={history} current={statuses.current}
                           publishing={publishing} publishMsg={publishMsg}
                           onPublish={async () => {
                             setPublishing(true);
                             const res = await fetch("/api/discord/publish", {
                               method: "POST",
                               headers: { "Content-Type": "application/json" },
                               body: JSON.stringify({ type: "parties", id: war.id }),
                             });
                             setPublishMsg(res.ok ? "Discord'a gönderildi." : "Gönderilemedi.");
                             setPublishing(false);
                             setTimeout(() => setPublishMsg(null), 4000);
                           }} />
          ) : (
            <Partiler parties={war.parties} />
          )
        )}

        {tab === "rapor" && <Rapor perfs={perfs} absent={absent} />}
      </div>
    </TestShell>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function Stat({ label, value, sub, tone }: {
  label: string; value: number; sub?: string; tone: string;
}) {
  return (
    <div className="px-5 py-3.5" style={{ borderRight: "1px solid var(--t-line)" }}>
      <div className="t-num text-[22px] leading-none" style={{ color: tone }}>{value}</div>
      <div className="text-[10.5px] mt-1.5 uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
        {label}{sub && <span className="normal-case tracking-normal"> · {sub}</span>}
      </div>
    </div>
  );
}

function Katilim({ lists, guildSplit, counts, current }: {
  lists: { attending: User[]; declined: User[]; silent: User[] };
  guildSplit: { guild: Guild & { id: number }; count: number }[];
  counts: Map<string, number>;
  current: Record<number, ReturnType<typeof classifyAttendance>>;
}) {
  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="overflow-hidden">
        <Head icon={Check} title="Katılanlar" meta={`${lists.attending.length} KİŞİ`} />

        {counts.size > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 py-2.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
            {Array.from(counts.entries()).map(([st, n]) => {
              const meta = ATTENDANCE_META[st as keyof typeof ATTENDANCE_META];
              return (
                <span key={st} title={meta.label}
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
                      style={{ color: meta.color, background: meta.bg }}>
                  {meta.mark} {meta.short} <span className="t-num">{n}</span>
                </span>
              );
            })}
          </div>
        )}

        {guildSplit.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 py-2.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
            {guildSplit.map(({ guild, count }) => (
              <span key={guild.id}
                    className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border"
                    style={{ color: guild.color, borderColor: guild.color + "35", background: guild.color + "12" }}>
                {guild.tag} <span className="t-num font-normal">{count}</span>
              </span>
            ))}
          </div>
        )}

        {lists.attending.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-faint)" }}>
            Henüz katılan yok.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {lists.attending.map((u) => {
              const meta = ATTENDANCE_META[current[u.id] ?? "attending_not_selected"];
              return (
                <div key={u.id} className="t-row px-5 py-2.5 flex items-center gap-2.5">
                  <Ava src={u.avatarUrl} />
                  <span className="text-[12.5px] truncate flex-1">{u.familyName}</span>
                  <span title={meta.label}
                        className="text-[9.5px] font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                        style={{ color: meta.color, background: meta.bg }}>
                    {meta.mark} {meta.short}
                  </span>
                  <GuildTag g={u.guild ?? null} />
                  <span className="t-num text-[11.5px] flex-shrink-0" style={{ color: "var(--t-gold)" }}>
                    {u.ap + u.dp}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <Head icon={X} title="Katılmayanlar" meta={`${lists.declined.length} KİŞİ`} />
        {lists.declined.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-faint)" }}>
            Kimse reddetmedi.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {lists.declined.map((u) => (
              <div key={u.id} className="t-row px-5 py-2.5 flex items-center gap-2.5 opacity-60">
                <Ava src={u.avatarUrl} />
                <span className="text-[12.5px] truncate flex-1" style={{ color: "var(--t-dim)" }}>
                  {u.familyName}
                </span>
                <GuildTag g={u.guild ?? null} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <Head icon={HelpCircle} title="Bildirmedi" meta={`${lists.silent.length} KİŞİ`} />
        {lists.silent.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-faint)" }}>
            Herkes cevap verdi.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {lists.silent.map((u) => (
              <div key={u.id} className="t-row px-5 py-2.5 flex items-center gap-2.5 opacity-50">
                <Ava src={u.avatarUrl} />
                <span className="text-[12.5px] truncate flex-1" style={{ color: "var(--t-dim)" }}>
                  {u.familyName}
                </span>
                <GuildTag g={u.guild ?? null} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AdminPartiler({
  war, attendees, memberStats, history, current, publishing, publishMsg, onPublish,
}: {
  war: WarDetail;
  attendees: User[];
  memberStats: Record<number, UserPerfStats>;
  history: WarAttendanceSummary[];
  current: Record<number, ReturnType<typeof classifyAttendance>>;
  publishing: boolean;
  publishMsg: string | null;
  onPublish: () => void;
}) {
  const hasParties = war.parties.some((p) => p.members.length > 0);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[14px] font-semibold">Parti Kurulumu</h2>
          <p className="text-[11.5px] mt-0.5" style={{ color: "var(--t-dim)" }}>
            Katılanları partilere dağıt, sonra Discord&apos;a gönder. Seçilen herkese
            ayrıca özel mesaj gider.
          </p>
        </div>

        {hasParties && (
          <div className="flex items-center gap-2 flex-wrap">
            {publishMsg && (
              <span className="text-[11.5px]" style={{ color: "var(--t-gold)" }}>{publishMsg}</span>
            )}
            <a href={`/api/party-card/${war.id}`} target="_blank" rel="noreferrer"
               className="text-[12px] font-semibold px-3 h-[34px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5"
               style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
              <ImageIcon className="w-3.5 h-3.5" strokeWidth={2} /> Görseli önizle
            </a>
            <button onClick={onPublish} disabled={publishing}
                    className="text-[12px] font-semibold px-3 h-[34px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                             border: "1px solid rgba(232,180,81,.3)" }}>
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
              {publishing ? "Gönderiliyor…" : "Discord'a gönder"}
            </button>
          </div>
        )}
      </Card>

      {history.length > 0 && (
        <Card className="px-4 py-2.5">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] items-center"
               style={{ color: "var(--t-faint)" }}>
            <span className="font-semibold" style={{ color: "var(--t-dim)" }}>
              Kartlardaki son {history.length} savaş işareti:
            </span>
            <span><b style={{ color: "#6b93ff" }}>✓</b> başvurdu, seçilmedi</span>
            <span><b style={{ color: "#e05252" }}>✕</b> seçildi, gelmedi</span>
            <span><b style={{ color: "#2bca6e" }}>✓</b> savaşa geldi</span>
            <span style={{ color: "var(--t-faint)" }}>
              · Sağdaki puan son {RECENT_WAR_WINDOW} savaşın form ortalaması
            </span>
          </div>
        </Card>
      )}

      <PartyBuilder
        warId={war.id}
        attendees={attendees}
        initialParties={war.parties}
        maxParticipants={war.maxParticipants}
        memberStats={memberStats}
        attendanceHistory={history}
        currentStatuses={current}
      />
    </div>
  );
}

/** Yetkisi olmayanların gördüğü salt okunur parti listesi */
function Partiler({ parties }: { parties: Party[] }) {
  const filled = parties.filter((p) => p.members.length > 0);
  if (filled.length === 0) {
    return <Empty>Partiler henüz kurulmadı. Kurulduğunda burada ve Discord&apos;da görünecek.</Empty>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {filled.map((party) => {
        const avg = Math.round(
          party.members.reduce((s, m) => s + m.user.ap + m.user.dp, 0) / party.members.length);
        return (
          <Card key={party.id} className="overflow-hidden">
            <Head icon={Users} title={party.name} meta={`${party.members.length} · ORT ${avg}`} />
            {party.members.map((m, i) => (
              <div key={m.id} className="t-row px-4 py-2 flex items-center gap-2.5">
                <span className="t-num text-[10px] w-3.5 flex-shrink-0" style={{ color: "var(--t-faint)" }}>
                  {i + 1}
                </span>
                <Ava src={m.user.avatarUrl} size={20} />
                <span className="text-[12px] truncate flex-1">{m.user.familyName}</span>
                <GuildTag g={m.user.guild ?? null} />
                <span className="t-num text-[11px] flex-shrink-0" style={{ color: "var(--t-gold)" }}>
                  {m.user.ap + m.user.dp}
                </span>
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

function Rapor({ perfs, absent }: {
  perfs: WarPerf[];
  absent: { id: number; familyName: string; avatarUrl: string }[];
}) {
  if (perfs.length === 0) {
    return <Empty>Bu savaşın hasar raporu henüz yüklenmedi.</Empty>;
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <Head icon={Swords} title="Hasar Raporu" meta={`${perfs.length} OYUNCU`} />
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--t-line)" }}>
                <th className="text-left py-2.5 px-4 text-[10px] uppercase tracking-[0.06em] font-medium whitespace-nowrap"
                    style={{ color: "var(--t-faint)" }}>
                  Aile Adı
                </th>
                {PERF_COLS.map((c) => (
                  <th key={c.key}
                      className="text-right py-2.5 px-3 text-[10px] uppercase tracking-[0.06em] font-medium whitespace-nowrap"
                      style={{ color: "var(--t-faint)" }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perfs.map((p) => (
                <tr key={p.id} className="t-row">
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <Ava src={p.user?.avatarUrl} size={20} />
                      <span className="font-medium whitespace-nowrap">{p.inGameName}</span>
                    </div>
                  </td>
                  {PERF_COLS.map((c) => {
                    const val = p[c.key as keyof WarPerf] as number;
                    return (
                      <td key={c.key} className="py-2 px-3 text-right t-num"
                          style={{ color: c.tone, fontWeight: "bold" in c && c.bold ? 600 : 400 }}>
                        {"big" in c && c.big ? fmt(val) : val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {absent.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-bad)" }} />
            <p className="text-[12px] font-semibold" style={{ color: "var(--t-bad)" }}>
              Geleceğini söyledi, oyunda görünmüyor ({absent.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {absent.map((m) => (
              <span key={m.id} className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--t-r-sm)]"
                    style={{ background: "rgba(239,95,95,.08)", border: "1px solid rgba(239,95,95,.2)" }}>
                <Ava src={m.avatarUrl} size={14} />
                <span className="text-[11px]" style={{ color: "#ef8080" }}>{m.familyName}</span>
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Ava({ src, size = 22 }: { src?: string | null; size?: number }) {
  const style = { width: size, height: size, border: "1px solid var(--t-line)" };
  // Avatarı olmayan üye az değil; kırık resim yerine boş daire
  if (!src) {
    return <div className="rounded-full flex-shrink-0" style={{ ...style, background: "var(--t-raised)" }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="rounded-full flex-shrink-0 object-cover" style={style} />
  );
}
