"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { FileText, RefreshCw, Database, Download, Swords, RotateCw, Loader2, CheckCircle2, XCircle, LayoutList } from "lucide-react";
import { PageHeader, Button, Empty, Card, Loading } from "@/components/ui";
import { SKILL_CLASS_IDS } from "@/lib/skill-class-ids";

interface PatchNote {
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
}

type MsgTone = "ok" | "err" | "busy";
type Msg = { tone: MsgTone; text: string } | null;

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

const MSG_STYLE: Record<MsgTone, string> = {
  ok: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  err: "bg-red-500/10 border-red-500/20 text-red-400",
  busy: "bg-bdo-surface border-bdo-border text-bdo-text-muted",
};
const MSG_ICON = { ok: CheckCircle2, err: XCircle, busy: Loader2 };

export default function PatchNotesPage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);
  const [fetchMsg, setFetchMsg] = useState<Msg>(null);

  const [skillStats, setSkillStats] = useState<{ total: number; classesDone: number; totalClasses: number } | null>(null);
  const [fetchingSkills, setFetchingSkills] = useState(false);
  const [skillProgress, setSkillProgress] = useState<{ done: number; total: number } | null>(null);
  const [skillMsg, setSkillMsg] = useState<Msg>(null);

  async function refreshList() {
    const r = await fetch("/api/patch-notes");
    const d = await r.json();
    setNotes(Array.isArray(d) ? d : []);
  }

  useEffect(() => {
    fetch("/api/patch-notes").then((r) => r.json()).then((data) => {
      setNotes(Array.isArray(data) ? data : []);
      setLoading(false);
    });
    fetch("/api/admin/fetch-skills").then((r) => r.json()).then((d) => {
      if (d.total !== undefined) setSkillStats(d);
    }).catch(() => {});
  }, []);

  async function fetchLatest() {
    setFetching(true);
    setFetchMsg({ tone: "busy", text: "Son yama notu kontrol ediliyor..." });
    const res = await fetch("/api/admin/fetch-patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.ok) setFetchMsg({ tone: "err", text: `Hata: ${data.error}` });
    else if (data.upToDate) setFetchMsg({ tone: "ok", text: "Son yama notu zaten mevcut." });
    else {
      setFetchMsg({ tone: "ok", text: `#${data.boardNo} işlendi.` });
      await refreshList();
    }
    setFetching(false);
    setTimeout(() => setFetchMsg(null), 6000);
  }

  async function fetchAllSkills() {
    setFetchingSkills(true);
    setSkillProgress({ done: 0, total: SKILL_CLASS_IDS.length });
    setSkillMsg({ tone: "busy", text: "Skill veritabanı oluşturuluyor..." });
    let classesDone = 0;

    for (const classId of SKILL_CLASS_IDS) {
      setSkillMsg({ tone: "busy", text: `Sınıf ${classId}... (${classesDone}/${SKILL_CLASS_IDS.length})` });
      let offset = 0;
      let skillIds: number[] | undefined = undefined;
      while (true) {
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
      classesDone++;
      setSkillProgress({ done: classesDone, total: SKILL_CLASS_IDS.length });
    }

    const statsRes = await fetch("/api/admin/fetch-skills");
    const stats = await statsRes.json();
    if (stats.total !== undefined) setSkillStats(stats);
    setFetchingSkills(false);
    setSkillProgress(null);
    setSkillMsg({ tone: "ok", text: `Tamamlandı — ${stats.total ?? "?"} skill kaydedildi.` });
    setTimeout(() => setSkillMsg(null), 8000);
  }

  async function reprocessNote(boardNo: number, noteId: number) {
    setReprocessingId(noteId);
    setFetchMsg({ tone: "busy", text: `#${boardNo} yeniden işleniyor...` });
    const res = await fetch("/api/admin/fetch-patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardNo }),
    });
    const data = await res.json();
    setFetchMsg(data.ok
      ? { tone: "ok", text: `#${boardNo} yeniden yapılandırıldı.` }
      : { tone: "err", text: `Hata: ${data.error}` });
    if (data.ok) await refreshList();
    setReprocessingId(null);
    setTimeout(() => setFetchMsg(null), 6000);
  }

  if (!session) return null;

  function MsgBar({ msg }: { msg: Msg }) {
    if (!msg) return null;
    const Icon = MSG_ICON[msg.tone];
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] border mb-3 ${MSG_STYLE[msg.tone]}`}>
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${msg.tone === "busy" ? "animate-spin" : ""}`} strokeWidth={2} />
        {msg.text}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Global Lab Yama Notları"
        desc="Black Desert Online Global Lab güncellemeleri — Türkçe çeviri."
        icon={FileText}
        action={session.user.isAdmin && (
          <Button variant="ghost" icon={RefreshCw} onClick={fetchLatest} disabled={fetching}>
            {fetching ? "Kontrol ediliyor..." : "Son Yamayı Çek"}
          </Button>
        )}
      />

      <MsgBar msg={fetchMsg} />

      {/* Admin: skill DB */}
      {session.user.isAdmin && (
        <Card className="p-3 mb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />
              <div>
                <p className="text-[12px] font-medium text-bdo-text-primary leading-tight">Skill Veritabanı</p>
                <p className="text-[11px] text-bdo-text-secondary leading-tight mt-0.5">
                  {skillStats
                    ? `${skillStats.total.toLocaleString("tr-TR")} skill · ${skillStats.classesDone}/${skillStats.totalClasses} sınıf`
                    : "Yükleniyor..."}
                </p>
              </div>
            </div>
            <Button variant="ghost" icon={Download} onClick={fetchAllSkills} disabled={fetchingSkills}>
              {fetchingSkills ? "Çekiliyor..." : skillStats?.total ? "Yenile" : "Oluştur"}
            </Button>
          </div>
          {skillProgress && (
            <div className="mt-3">
              <div className="h-1 bg-bdo-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-bdo-gold rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((skillProgress.done / skillProgress.total) * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-bdo-text-secondary mt-1 text-right font-mono">
                {skillProgress.done}/{skillProgress.total}
              </p>
            </div>
          )}
          {skillMsg && <div className="mt-2"><MsgBar msg={skillMsg} /></div>}
        </Card>
      )}

      {loading ? (
        <Loading />
      ) : notes.length === 0 ? (
        <div className="card">
          <Empty
            icon={FileText}
            text="Henüz yama notu çekilmemiş."
            action={session.user.isAdmin && (
              <Button variant="primary" icon={Download} onClick={fetchLatest} disabled={fetching}>
                İlk Yamayı Çek
              </Button>
            )}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <div key={note.id} className="relative group">
              <Link href={`/patch-notes/${note.id}`} className="card block overflow-hidden hover:border-bdo-gold/30 transition-colors">
                {note.thumbnail ? (
                  <div className="aspect-video overflow-hidden bg-bdo-bg">
                    <img
                      src={note.thumbnail}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-bdo-surface-2 flex items-center justify-center">
                    <Swords className="w-7 h-7 text-bdo-text-secondary/30" strokeWidth={1.5} />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="bg-bdo-gold/10 text-bdo-gold border border-bdo-gold/20 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide">
                      Global Lab
                    </span>
                    <span className="text-[10px] text-bdo-text-secondary">{fmtDate(note.publishedAt)}</span>
                    {note.hasStructured && (
                      <LayoutList className="ml-auto w-3 h-3 text-bdo-text-secondary/60 flex-shrink-0" strokeWidth={1.75} />
                    )}
                  </div>
                  <p className="text-[13px] font-semibold text-bdo-text-primary group-hover:text-bdo-gold transition-colors leading-snug line-clamp-2">
                    {note.titleTr || note.title}
                  </p>
                  {note.summary ? (
                    <p className="text-[11px] text-bdo-text-secondary mt-1.5 leading-relaxed line-clamp-2">{note.summary}</p>
                  ) : (
                    <p className="text-[10px] text-bdo-text-secondary/70 mt-1.5 italic line-clamp-1">{note.title}</p>
                  )}
                </div>
              </Link>

              {session.user.isAdmin && (
                <button
                  onClick={(e) => { e.preventDefault(); reprocessNote(note.boardNo, note.id); }}
                  disabled={reprocessingId === note.id}
                  title="Yeniden işle"
                  className="absolute top-2 right-2 bg-bdo-bg/85 backdrop-blur-sm border border-bdo-border text-bdo-text-secondary hover:text-bdo-gold hover:border-bdo-gold/40 p-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <RotateCw
                    className={`w-3 h-3 ${reprocessingId === note.id ? "animate-spin" : ""}`}
                    strokeWidth={2}
                  />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
