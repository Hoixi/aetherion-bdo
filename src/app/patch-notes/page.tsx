"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

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

function timeAgo(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

import { SKILL_CLASS_IDS } from "@/lib/skill-class-ids";

export default function PatchNotesPage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  // Skill DB state
  const [skillStats, setSkillStats] = useState<{ total: number; classesDone: number; totalClasses: number } | null>(null);
  const [fetchingSkills, setFetchingSkills] = useState(false);
  const [skillProgress, setSkillProgress] = useState<{ done: number; total: number } | null>(null);
  const [skillMsg, setSkillMsg] = useState<string | null>(null);

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
    setFetchMsg("⏳ Son yama notu kontrol ediliyor...");
    const res = await fetch("/api/admin/fetch-patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.ok) {
      setFetchMsg(`❌ Hata: ${data.error}`);
    } else if (data.upToDate) {
      setFetchMsg("✅ Son yama notu zaten mevcut.");
    } else {
      setFetchMsg(`✅ #${data.boardNo} işlendi.`);
      await refreshList();
    }
    setFetching(false);
    setTimeout(() => setFetchMsg(null), 6000);
  }

  async function fetchAllSkills() {
    setFetchingSkills(true);
    setSkillProgress({ done: 0, total: SKILL_CLASS_IDS.length });
    setSkillMsg("⏳ Skill veritabanı oluşturuluyor...");
    let classesDone = 0;

    for (const classId of SKILL_CLASS_IDS) {
      setSkillMsg(`⏳ Sınıf ${classId}... (${classesDone}/${SKILL_CLASS_IDS.length})`);
      let offset = 0;
      let skillIds: number[] | undefined = undefined;
      while (true) {
        const res = await fetch("/api/admin/fetch-skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId, offset, skillIds }),
        });
        const data = await res.json();
        if (!data.ok) {
          setSkillMsg(`❌ Sınıf ${classId} hatası: ${data.error}`);
          setFetchingSkills(false);
          setSkillProgress(null);
          return;
        }
        // Cache skill IDs from first batch — reuse to skip list re-fetch
        if (data.skillIds) skillIds = data.skillIds;
        if (data.done) break;
        offset = data.nextOffset;
      }
      classesDone++;
      setSkillProgress({ done: classesDone, total: SKILL_CLASS_IDS.length });
    }

    // Refresh stats
    const statsRes = await fetch("/api/admin/fetch-skills");
    const stats = await statsRes.json();
    if (stats.total !== undefined) setSkillStats(stats);
    setFetchingSkills(false);
    setSkillProgress(null);
    setSkillMsg(`✅ Tamamlandı! ${stats.total ?? "?"} skill kaydedildi.`);
    setTimeout(() => setSkillMsg(null), 8000);
  }

  async function reprocessNote(boardNo: number, noteId: number) {
    setReprocessingId(noteId);
    setFetchMsg(`♻️ #${boardNo} yeniden işleniyor...`);
    const res = await fetch("/api/admin/fetch-patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boardNo }),
    });
    const data = await res.json();
    if (data.ok) {
      setFetchMsg(`✅ #${boardNo} yeniden yapılandırıldı.`);
      await refreshList();
    } else {
      setFetchMsg(`❌ Hata: ${data.error}`);
    }
    setReprocessingId(null);
    setTimeout(() => setFetchMsg(null), 6000);
  }

  if (!session) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-bdo-text-primary flex items-center gap-2">
            📋 Global Lab Yama Notları
          </h1>
          <p className="text-sm text-bdo-text-muted mt-1">
            Black Desert Online Global Lab — Türkçe çeviri
          </p>
        </div>
        {session.user.isAdmin && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchLatest}
              disabled={fetching}
              className="bg-bdo-gold/10 text-bdo-gold border border-bdo-gold/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-bdo-gold/20 transition-colors disabled:opacity-50"
            >
              {fetching ? "⏳ Kontrol ediliyor..." : "🔄 Son Yamayı Çek"}
            </button>
          </div>
        )}
      </div>

      {fetchMsg && (
        <div className={`mb-2 px-4 py-3 rounded-lg text-sm border ${fetchMsg.startsWith("✅") ? "bg-green-500/10 border-green-500/20 text-green-400" : fetchMsg.startsWith("❌") ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-bdo-gold/10 border-bdo-gold/20 text-bdo-gold"}`}>
          {fetchMsg}
        </div>
      )}

      {/* Admin: Skill DB panel */}
      {session.user.isAdmin && (
        <div className="mb-6 bg-bdo-surface border border-bdo-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-bold text-bdo-text-primary mb-0.5">🗃 Skill Veritabanı</p>
              {skillStats ? (
                <p className="text-[11px] text-bdo-text-muted">
                  {skillStats.total.toLocaleString()} skill kayıtlı — {skillStats.classesDone}/{skillStats.totalClasses} sınıf
                </p>
              ) : (
                <p className="text-[11px] text-bdo-text-muted">Yükleniyor...</p>
              )}
            </div>
            <button
              onClick={fetchAllSkills}
              disabled={fetchingSkills}
              className="bg-violet-500/10 text-violet-400 border border-violet-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-violet-500/20 transition-colors disabled:opacity-50 shrink-0"
            >
              {fetchingSkills ? "⏳ Çekiliyor..." : skillStats?.total ? "🔄 Yenile" : "📥 Skill DB Oluştur"}
            </button>
          </div>
          {skillProgress && (
            <div className="mt-3">
              <div className="h-1 bg-bdo-border rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((skillProgress.done / skillProgress.total) * 100)}%` }} />
              </div>
              <p className="text-[10px] text-bdo-text-muted mt-1 text-right">{skillProgress.done}/{skillProgress.total} sınıf</p>
            </div>
          )}
          {skillMsg && (
            <p className={`mt-2 text-[11px] ${skillMsg.startsWith("✅") ? "text-green-400" : skillMsg.startsWith("❌") ? "text-red-400" : "text-bdo-text-muted"}`}>
              {skillMsg}
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-20 text-bdo-text-muted">Yükleniyor...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-bdo-text-muted text-sm mb-4">Henüz yama notu çekilmemiş.</p>
          {session.user.isAdmin && (
            <button onClick={fetchLatest} disabled={fetching} className="bg-bdo-gold text-bdo-bg font-semibold px-6 py-2 rounded-lg text-sm hover:bg-bdo-gold-dim disabled:opacity-50">
              İlk Yamayı Çek
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <div key={note.id} className="relative group">
              <Link href={`/patch-notes/${note.id}`}>
                <div className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden hover:border-bdo-gold/40 transition-all">
                  {note.thumbnail ? (
                    <div className="aspect-video overflow-hidden bg-bdo-bg">
                      <img
                        src={note.thumbnail}
                        alt={note.titleTr || note.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-bdo-gold/10 to-bdo-bg flex items-center justify-center">
                      <span className="text-4xl">⚔️</span>
                    </div>
                  )}
                  <div className="p-4">
                    <p className="text-[10px] text-bdo-text-muted mb-1.5 flex items-center gap-1.5">
                      <span className="bg-bdo-gold/10 text-bdo-gold px-1.5 py-0.5 rounded text-[9px] font-bold uppercase">Global Lab</span>
                      {timeAgo(note.publishedAt)}
                      {note.hasStructured && (
                        <span className="ml-auto bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">
                          📋
                        </span>
                      )}
                    </p>
                    <h2 className="text-sm font-semibold text-bdo-text-primary group-hover:text-bdo-gold transition-colors leading-snug line-clamp-2">
                      {note.titleTr || note.title}
                    </h2>
                    {note.summary ? (
                      <p className="text-xs text-bdo-text-muted mt-2 leading-relaxed line-clamp-2">{note.summary}</p>
                    ) : (
                      <p className="text-[10px] text-bdo-text-muted mt-2 italic opacity-60">{note.title}</p>
                    )}
                  </div>
                </div>
              </Link>
              {/* Admin: re-process button */}
              {session?.user.isAdmin && (
                <button
                  onClick={(e) => { e.preventDefault(); reprocessNote(note.boardNo, note.id); }}
                  disabled={reprocessingId === note.id}
                  title="Yapılandırılmış formata dönüştür"
                  className="absolute top-2 right-2 bg-bdo-bg/90 border border-bdo-border text-bdo-text-muted hover:text-bdo-gold hover:border-bdo-gold/50 text-[10px] px-2 py-0.5 rounded-lg transition-colors disabled:opacity-50 backdrop-blur-sm"
                >
                  {reprocessingId === note.id ? "⏳" : "♻️ İşle"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
