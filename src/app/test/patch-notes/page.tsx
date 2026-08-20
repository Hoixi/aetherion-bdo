"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FileText, RefreshCw, Database, Download, Swords, RotateCw, Loader2,
  CheckCircle2, XCircle, LayoutList,
} from "lucide-react";
import { SKILL_CLASS_IDS } from "@/lib/skill-class-ids";
import { TestShell, Card, Bar, Empty } from "@/components/test-shell";

/**
 * Global Lab yama notları.
 *
 * Liste herkese açık; çekme ve yeniden işleme yalnızca adminlerde.
 * Skill veritabanı sınıf sınıf çekiliyor — tek istekte hepsini istemek
 * kaynak tarafında zaman aşımına düşüyor.
 */

type PatchNote = {
  id: number;
  boardNo: number;
  title: string;
  titleTr: string;
  thumbnail: string | null;
  publishedAt: string;
  fetchedAt: string;
  summary: string | null;
  summaryEn: string | null;
  hasStructured: boolean;
};

type MsgTone = "ok" | "err" | "busy";
type Msg = { tone: MsgTone; text: string } | null;

const MSG_COLOR: Record<MsgTone, { fg: string; bg: string; border: string }> = {
  ok: { fg: "var(--t-good)", bg: "rgba(56,208,127,.10)", border: "rgba(56,208,127,.25)" },
  err: { fg: "var(--t-bad)", bg: "rgba(239,95,95,.10)", border: "rgba(239,95,95,.25)" },
  busy: { fg: "var(--t-dim)", bg: "var(--t-raised)", border: "var(--t-line)" },
};
const MSG_ICON = { ok: CheckCircle2, err: XCircle, busy: Loader2 };

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

export default function PatchNotesPage() {
  const { data: session } = useSession();

  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [reprocessing, setReprocessing] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const [skillStats, setSkillStats] = useState<{ total: number; classesDone: number; totalClasses: number } | null>(null);
  const [skillBusy, setSkillBusy] = useState(false);
  const [skillProgress, setSkillProgress] = useState<{ done: number; total: number } | null>(null);
  const [skillMsg, setSkillMsg] = useState<Msg>(null);

  async function refresh() {
    const r = await fetch("/api/patch-notes");
    const d = await r.json();
    setNotes(Array.isArray(d) ? d : []);
  }

  useEffect(() => {
    fetch("/api/patch-notes")
      .then((r) => r.json())
      .then((d) => setNotes(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
    fetch("/api/admin/fetch-skills")
      .then((r) => r.json())
      .then((d) => { if (d.total !== undefined) setSkillStats(d); })
      .catch(() => {});
  }, []);

  async function fetchLatest() {
    setFetching(true);
    setMsg({ tone: "busy", text: "Son yama notu kontrol ediliyor…" });
    const res = await fetch("/api/admin/fetch-patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.ok) setMsg({ tone: "err", text: `Hata: ${data.error}` });
    else if (data.upToDate) setMsg({ tone: "ok", text: "Son yama notu zaten mevcut." });
    else {
      setMsg({ tone: "ok", text: `#${data.boardNo} işlendi.` });
      await refresh();
    }
    setFetching(false);
    setTimeout(() => setMsg(null), 6000);
  }

  async function reprocess(boardNo: number, noteId: number) {
    setReprocessing(noteId);
    setMsg({ tone: "busy", text: `#${boardNo} yeniden işleniyor…` });
    const res = await fetch("/api/admin/fetch-patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardNo }),
    });
    const data = await res.json();
    setMsg(data.ok
      ? { tone: "ok", text: `#${boardNo} yeniden yapılandırıldı.` }
      : { tone: "err", text: `Hata: ${data.error}` });
    if (data.ok) await refresh();
    setReprocessing(null);
    setTimeout(() => setMsg(null), 6000);
  }

  async function fetchAllSkills() {
    setSkillBusy(true);
    setSkillProgress({ done: 0, total: SKILL_CLASS_IDS.length });
    setSkillMsg({ tone: "busy", text: "Skill veritabanı oluşturuluyor…" });
    let done = 0;

    for (const classId of SKILL_CLASS_IDS) {
      setSkillMsg({ tone: "busy", text: `Sınıf ${classId}… (${done}/${SKILL_CLASS_IDS.length})` });
      let offset = 0;
      let skillIds: number[] | undefined;
      // Kaynak sayfalama yapıyor; bitene kadar aynı sınıfta ilerliyoruz
      for (;;) {
        try {
          const res: Response = await fetch("/api/admin/fetch-skills", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ classId, offset, skillIds }),
          });
          const data = await res.json();
          if (!data.ok) { console.warn(`Sınıf ${classId} hatası: ${data.error}`); break; }
          if (data.skillIds) skillIds = data.skillIds;
          if (data.done) break;
          offset = data.nextOffset;
        } catch {
          console.warn(`Sınıf ${classId} ağ hatası`);
          break;
        }
      }
      done++;
      setSkillProgress({ done, total: SKILL_CLASS_IDS.length });
    }

    const stats = await (await fetch("/api/admin/fetch-skills")).json();
    if (stats.total !== undefined) setSkillStats(stats);
    setSkillBusy(false);
    setSkillProgress(null);
    setSkillMsg({ tone: "ok", text: `Tamamlandı — ${stats.total ?? "?"} skill kaydedildi.` });
    setTimeout(() => setSkillMsg(null), 8000);
  }

  const isAdmin = !!session?.user?.isAdmin;

  return (
    <TestShell
      title="Global Lab Yama Notları"
      subtitle="Black Desert Online Global Lab güncellemeleri — Türkçe çeviriyle."
      aside={isAdmin ? (
        <button onClick={fetchLatest} disabled={fetching}
                className="t-chip inline-flex items-center gap-1 disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${fetching ? "animate-spin" : ""}`} />
          {fetching ? "Kontrol ediliyor…" : "Son yamayı çek"}
        </button>
      ) : null}
    >
      <MsgBar msg={msg} />

      {/* ── Skill veritabanı (admin) ───────────────────────────────── */}
      {isAdmin && (
        <Card className="p-3.5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 flex-shrink-0" strokeWidth={1.8} style={{ color: "var(--t-gold)" }} />
              <div>
                <p className="text-[12.5px] font-medium leading-tight">Skill Veritabanı</p>
                <p className="text-[11px] leading-tight mt-0.5" style={{ color: "var(--t-faint)" }}>
                  {skillStats
                    ? `${skillStats.total.toLocaleString("tr-TR")} skill · ${skillStats.classesDone}/${skillStats.totalClasses} sınıf`
                    : "Yükleniyor…"}
                </p>
              </div>
            </div>
            <button onClick={fetchAllSkills} disabled={skillBusy}
                    className="text-[12px] font-semibold px-3 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
              <Download className="w-3.5 h-3.5" strokeWidth={2} />
              {skillBusy ? "Çekiliyor…" : skillStats?.total ? "Yenile" : "Oluştur"}
            </button>
          </div>

          {skillProgress && (
            <div className="mt-3">
              <Bar pct={Math.round((skillProgress.done / skillProgress.total) * 100)} />
              <p className="t-num text-[10px] mt-1 text-right" style={{ color: "var(--t-faint)" }}>
                {skillProgress.done}/{skillProgress.total}
              </p>
            </div>
          )}
          {skillMsg && <div className="mt-2.5"><MsgBar msg={skillMsg} /></div>}
        </Card>
      )}

      {/* ── Liste ──────────────────────────────────────────────────── */}
      {loading ? (
        <Empty>Yama notları geliyor…</Empty>
      ) : notes.length === 0 ? (
        <Card className="p-10 flex flex-col items-center gap-3">
          <FileText className="w-6 h-6" strokeWidth={1.5} style={{ color: "var(--t-faint)" }} />
          <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>Henüz yama notu çekilmemiş.</span>
          {isAdmin && (
            <button onClick={fetchLatest} disabled={fetching}
                    className="text-[12px] font-semibold px-3 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                             border: "1px solid rgba(232,180,81,.3)" }}>
              <Download className="w-3.5 h-3.5" strokeWidth={2} /> İlk yamayı çek
            </button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <div key={note.id} className="relative group">
              <Link href={`/test/patch-notes/${note.id}`} className="block">
                <Card className="overflow-hidden transition-colors hover:border-[rgba(232,180,81,.3)]">
                  {note.thumbnail ? (
                    <div className="aspect-video overflow-hidden" style={{ background: "var(--t-canvas)" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={note.thumbnail} alt=""
                           className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                    </div>
                  ) : (
                    <div className="aspect-video grid place-items-center" style={{ background: "var(--t-raised)" }}>
                      <Swords className="w-7 h-7 opacity-30" strokeWidth={1.5} style={{ color: "var(--t-faint)" }} />
                    </div>
                  )}

                  <div className="p-3.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                                     border: "1px solid rgba(232,180,81,.25)" }}>
                        Global Lab
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                        {fmtDate(note.publishedAt)}
                      </span>
                      {note.hasStructured && (
                        <LayoutList className="ml-auto w-3 h-3 flex-shrink-0 opacity-60"
                                    strokeWidth={1.8} style={{ color: "var(--t-faint)" }}
                                    aria-label="Yapılandırılmış içerik var" />
                      )}
                    </div>

                    <p className="text-[13px] font-semibold leading-snug line-clamp-2">
                      {note.titleTr || note.title}
                    </p>
                    {note.summary ? (
                      <p className="text-[11px] mt-1.5 leading-relaxed line-clamp-2" style={{ color: "var(--t-faint)" }}>
                        {note.summary}
                      </p>
                    ) : (
                      <p className="text-[10px] mt-1.5 italic line-clamp-1 opacity-70" style={{ color: "var(--t-faint)" }}>
                        {note.title}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>

              {isAdmin && (
                <button onClick={(e) => { e.preventDefault(); reprocess(note.boardNo, note.id); }}
                        disabled={reprocessing === note.id}
                        title="Yeniden işle"
                        className="absolute top-2 right-2 p-1.5 rounded-[var(--t-r-sm)] backdrop-blur-sm transition-colors disabled:opacity-50"
                        style={{ color: "var(--t-dim)", background: "rgba(5,5,5,.85)",
                                 border: "1px solid var(--t-line-strong)" }}>
                  <RotateCw className={`w-3 h-3 ${reprocessing === note.id ? "animate-spin" : ""}`} strokeWidth={2} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="pb-6" />
    </TestShell>
  );
}

function MsgBar({ msg }: { msg: Msg }) {
  if (!msg) return null;
  const Icon = MSG_ICON[msg.tone];
  const c = MSG_COLOR[msg.tone];
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--t-r-sm)] text-[12px]"
         style={{ color: c.fg, background: c.bg, border: `1px solid ${c.border}` }}>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${msg.tone === "busy" ? "animate-spin" : ""}`} strokeWidth={2} />
      {msg.text}
    </div>
  );
}
