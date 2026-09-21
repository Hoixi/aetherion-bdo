"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ChevronLeft, Send } from "lucide-react";
import { TestShell, Empty } from "@/components/app-shell";
import { PartyBuilder } from "@/components/party-builder";
import type { UserPerfStats } from "@/components/member-chip";
import type { WarAttendanceSummary } from "@/app/api/wars/attendance-history/route";
import type { GuvenOzet } from "@/components/guven-rozeti";
import type { KarakterBilgi } from "@/app/api/wars/[id]/characters/route";
import { classifyAttendance, attendanceKnown } from "@/lib/attendance";

/**
 * Parti kurulumu — tam ekran.
 *
 * Kart görünümü (savaş sayfası → Partiler) hızlı iş için; burası dikkatli
 * kurulum için: solda havuz, ortada partiler, tıklanan üyenin her şeyi
 * sağda — form, güvenilirlik, son savaşlar ve bu savaşa hangi karakterle
 * geleceği (üyenin izin verdiği alternatiflerden yönetici seçer).
 */

type User = { id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string; guild?: { id: number; tag: string; color: string } | null };
type Participant = { id: number; status: string; asClass?: string | null; asSpec?: string | null; note?: string | null; user: User };
type Party = { id: number; name: string; order: number; isDefense: boolean; role?: string; members: Array<{ id: number; userId: number; asClass?: string | null; asSpec?: string | null; user: User }> };
type WarDetail = { id: number; title: string; date: string; tier?: string | null; maxParticipants: number | null; participants: Participant[]; parties: Party[]; participantsHidden?: boolean };
type Perf = { inGameName: string; user?: { familyName: string } | null };

export default function PartiTamEkran() {
  const { id } = useParams<{ id: string }>();
  const { status, data: session } = useSession();
  const [war, setWar] = useState<WarDetail | null>(null);
  const [uyeler, setUyeler] = useState<User[]>([]);
  const [perfs, setPerfs] = useState<Perf[]>([]);
  const [stats, setStats] = useState<Record<number, UserPerfStats>>({});
  const [history, setHistory] = useState<WarAttendanceSummary[]>([]);
  const [guven, setGuven] = useState<Record<number, GuvenOzet> | undefined>();
  const [karakterler, setKarakterler] = useState<Record<number, KarakterBilgi>>({});
  const [err, setErr] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let dead = false;
    (async () => {
      const [w, m, p, s, h, g, k] = await Promise.all([
        fetch(`/api/wars/${id}`), fetch("/api/members"), fetch(`/api/wars/${id}/performance`),
        fetch("/api/performances/user-averages"), fetch("/api/wars/attendance-history"),
        fetch("/api/wars/reliability"), fetch(`/api/wars/${id}/characters`),
      ]);
      if (dead) return;
      if (!w.ok) { setErr("Savaş bulunamadı."); return; }
      const wd: WarDetail = await w.json();
      if (wd.participantsHidden) { setErr("Parti kurma yetkin yok."); return; }
      setWar(wd);
      if (m.ok) setUyeler(await m.json());
      if (p.ok) setPerfs(((await p.json()) as { performances?: Perf[] }).performances ?? []);
      if (s.ok) setStats(await s.json());
      if (h.ok) setHistory(await h.json());
      if (g.ok) setGuven(((await g.json()) as { kisiler: Record<number, GuvenOzet> }).kisiler);
      if (k.ok) setKarakterler(await k.json());
    })().catch(() => { if (!dead) setErr("Veri alınamadı."); });
    return () => { dead = true; };
  }, [status, id]);

  // Katılanlar — class'ı bu savaş için bildirdiği (yoksa profildeki)
  const attendees = useMemo(() => (war?.participants ?? [])
    .filter((p) => p.status === "ATTENDING")
    .map((p) => ({ ...p.user, class: p.asClass || p.user.class, not: p.note ?? null })), [war]);

  const current = useMemo(() => {
    if (!war) return {};
    const selected = new Set(war.parties.flatMap((p) => p.members.map((m) => m.userId)));
    const byName = new Map(uyeler.map((u) => [u.familyName.toLowerCase(), u.id]));
    const came = new Set<number>();
    for (const perf of perfs) { const uid = byName.get((perf.user?.familyName ?? perf.inGameName).toLowerCase()); if (uid) came.add(uid); }
    const knows = attendanceKnown(perfs.length);
    const out: Record<number, ReturnType<typeof classifyAttendance>> = {};
    for (const p of war.participants) out[p.user.id] = classifyAttendance(p.status, selected.has(p.user.id), knows ? came.has(p.user.id) : false);
    return out;
  }, [war, uyeler, perfs]);

  async function publish() {
    if (!war) return;
    setPublishing(true);
    const r = await fetch("/api/discord/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "parties", id: war.id }) });
    setMsg(r.ok ? "Discord'a gönderildi." : "Gönderilemedi.");
    setPublishing(false);
    setTimeout(() => setMsg(null), 3000);
  }

  if (status === "loading" || (!war && !err)) return <TestShell title="Parti Kurulumu"><Empty>Yükleniyor…</Empty></TestShell>;
  if (err || !war) return <TestShell title="Parti Kurulumu"><Empty>{err ?? "Savaş yok."}</Empty></TestShell>;
  if (!session?.user?.canManageWars) return <TestShell title="Parti Kurulumu"><Empty>Yetkin yok.</Empty></TestShell>;

  return (
    <TestShell
      title={`Parti Kurulumu · ${war.title}`}
      subtitle={`${new Date(war.date).toLocaleString("tr-TR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · üyeye tıkla: detay ve karakter seçimi`}
      aside={
        <>
          {msg && <span className="t-chip" style={{ color: "var(--t-gold)" }}>{msg}</span>}
          <button onClick={publish} disabled={publishing} className="t-tab" data-on={!publishing}>
            <Send className="w-3.5 h-3.5" /> {publishing ? "Gönderiliyor…" : "Discord'a gönder"}
          </button>
          <Link href={`/savaslar/${war.id}`} className="t-tab"><ChevronLeft className="w-3.5 h-3.5" /> Savaş sayfası</Link>
        </>
      }
    >
      <PartyBuilder
        tam
        warId={war.id}
        attendees={attendees}
        initialParties={war.parties}
        maxParticipants={war.maxParticipants}
        tier={war.tier ?? (war.maxParticipants && war.maxParticipants <= 30 ? "T1" : "T2")}
        memberStats={stats}
        attendanceHistory={history}
        currentStatuses={current}
        guven={guven}
        karakterler={karakterler}
      />
    </TestShell>
  );
}
