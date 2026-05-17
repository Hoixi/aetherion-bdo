"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { StructuredPatchNote, StructuredChange } from "@/lib/patch-notes-types";

interface PatchNote {
  id: number;
  boardNo: number;
  title: string;
  titleTr: string;
  content: string;
  contentTr: string;
  structured: string | null;
  thumbnail: string | null;
  publishedAt: string;
}

// ─── Change type config ───────────────────────────────────────────────────────

const TYPE_META: Record<
  StructuredChange["type"],
  { labelTr: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  BUFF: {
    labelTr: "Güçlendirme",
    bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30",
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 1L10.5 9H1.5L6 1Z" />
      </svg>
    ),
  },
  NERF: {
    labelTr: "Zayıflatma",
    bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30",
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 11L1.5 3H10.5L6 11Z" />
      </svg>
    ),
  },
  FIX: {
    labelTr: "Düzeltme",
    bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/30",
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M9.5 2.5L7 5l-1.5-.5L5 3l2.5-2.5A3 3 0 002 4.5L5.5 8 3 10.5h3l1-1L10.5 6A3 3 0 009.5 2.5z" />
      </svg>
    ),
  },
  NEW: {
    labelTr: "Yeni",
    bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30",
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 0l1.2 3.8H11l-3 2.2 1.1 3.8L6 7.5l-3.1 2.3L4 6 1 3.8h3.8L6 0z" />
      </svg>
    ),
  },
  CHANGE: {
    labelTr: "Değişiklik",
    bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30",
    icon: (
      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="currentColor">
        <path d="M6 0l1.5 4.5H12L8 7.5l1.5 4.5L6 9l-3.5 3L4 7.5 0 4.5h4.5L6 0z" />
      </svg>
    ),
  },
};

function ChangeBadge({ type }: { type: StructuredChange["type"] }) {
  const meta = TYPE_META[type] ?? TYPE_META.CHANGE;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md border shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}>
      {meta.icon}
      <span>{meta.labelTr}</span>
    </span>
  );
}

// ─── Tam Metin: Turkish flat view from structured data ────────────────────────

function FlatTurkishView({ data }: { data: StructuredPatchNote }) {
  return (
    <div className="flex flex-col gap-5">
      {data.sections.map((sec) => (
        <div key={sec.id} className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-bdo-border bg-bdo-bg/40">
            {sec.imageUrl ? (
              <img src={sec.imageUrl} alt={sec.headingTr} className="w-8 h-8 object-contain rounded"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <span className="text-lg">{sec.emoji}</span>
            )}
            <h2 className="text-sm font-bold text-bdo-text-primary">{sec.headingTr}</h2>
          </div>
          <ul className="divide-y divide-bdo-border/40">
            {sec.changes.map((c, i) => (
              <li key={i} className="px-5 py-3 flex items-start gap-3">
                <ChangeBadge type={c.type} />
                <p className="text-sm text-bdo-text-primary leading-relaxed">{c.tr}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Structured view ─────────────────────────────────────────────────────────

function StructuredView({ data }: { data: StructuredPatchNote }) {
  const [activeId, setActiveId] = useState<string>(data.sections[0]?.id ?? "");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [data.sections]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex gap-6 relative">
      {/* Sidebar TOC */}
      <aside className="hidden lg:block w-52 shrink-0">
        <div className="sticky top-20">
          <p className="text-[10px] font-bold uppercase text-bdo-text-muted tracking-widest mb-3">İçerik</p>
          <nav className="flex flex-col gap-0.5">
            {data.sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors ${
                  activeId === sec.id
                    ? "bg-bdo-gold/15 text-bdo-gold font-semibold"
                    : "text-bdo-text-muted hover:text-bdo-text-primary hover:bg-bdo-bg/60"
                }`}
              >
                {sec.imageUrl ? (
                  <img src={sec.imageUrl} alt="" className="w-5 h-5 object-contain rounded shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement("span"), { textContent: sec.emoji })); }} />
                ) : (
                  <span className="text-sm shrink-0">{sec.emoji}</span>
                )}
                <span className="truncate">{sec.headingTr}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Sections */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        {/* Mobile TOC */}
        {data.sections.length > 1 && (
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {data.sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  activeId === sec.id
                    ? "border-bdo-gold bg-bdo-gold/10 text-bdo-gold font-semibold"
                    : "border-bdo-border text-bdo-text-muted hover:border-bdo-gold/50"
                }`}
              >
                <span>{sec.emoji}</span>
                <span>{sec.headingTr}</span>
              </button>
            ))}
          </div>
        )}

        {data.sections.map((sec) => (
          <section
            key={sec.id}
            id={sec.id}
            ref={(el) => { sectionRefs.current[sec.id] = el; }}
            className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden scroll-mt-20"
          >
            {/* Section header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-bdo-border bg-bdo-bg/40">
              {sec.imageUrl ? (
                <img
                  src={sec.imageUrl}
                  alt={sec.headingTr}
                  className="w-9 h-9 object-contain rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <span className="text-xl">{sec.emoji}</span>
              )}
              <div>
                <h2 className="text-sm font-bold text-bdo-text-primary">{sec.headingTr}</h2>
                {sec.heading !== sec.headingTr && (
                  <p className="text-[10px] text-bdo-text-muted">{sec.heading}</p>
                )}
              </div>
              {/* Count pills */}
              <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
                {(["BUFF", "NERF", "FIX", "NEW", "CHANGE"] as const).map((t) => {
                  const count = sec.changes.filter((c) => c.type === t).length;
                  if (!count) return null;
                  const meta = TYPE_META[t];
                  return (
                    <span key={t} className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.bg} ${meta.text} ${meta.border}`}>
                      {meta.icon} {count}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Changes */}
            <ul className="divide-y divide-bdo-border/50">
              {sec.changes.map((change, i) => (
                <li key={i} className="px-5 py-3">
                  {change.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-bdo-border">
                      <img src={change.imageUrl} alt="" className="w-full object-cover max-h-48" loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      <ChangeBadge type={change.type} />
                    </div>
                    <p className="text-sm text-bdo-text-primary leading-relaxed">{change.tr}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatchNoteDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const [note, setNote] = useState<PatchNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"structured" | "flat">("structured");

  useEffect(() => {
    fetch(`/api/patch-notes/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setNote(data);
        setLoading(false);
        if (!data.structured) setViewMode("flat");
      });
  }, [params.id]);

  if (!session) return null;
  if (loading) return (
    <div className="flex items-center justify-center py-20 gap-2 text-bdo-text-muted">
      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      Yükleniyor...
    </div>
  );
  if (!note) return <div className="text-center py-20 text-bdo-text-muted">Yama notu bulunamadı.</div>;

  const structured: StructuredPatchNote | null = note.structured
    ? (() => { try { return JSON.parse(note.structured!); } catch { return null; } })()
    : null;

  const displayTitle = structured?.titleTr || note.titleTr || note.title;
  const summary = structured?.summary;

  // Total change counts for header legend
  const allChanges = structured?.sections.flatMap((s) => s.changes) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
      <Link href="/patch-notes" className="inline-flex items-center gap-1 text-sm text-bdo-text-muted hover:text-bdo-text-primary mb-5 transition-colors">
        ← Tüm Yama Notları
      </Link>

      {/* Hero */}
      <div className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden mb-6">
        {note.thumbnail && (
          <div className="aspect-video bg-bdo-bg overflow-hidden max-h-64">
            <img src={note.thumbnail} alt={displayTitle} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Global Lab</span>
            <span className="text-xs text-bdo-text-muted">
              {new Date(note.publishedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <a
              href={`https://blackdesert.pearlabyss.com/GlobalLab/en-US/News/Notice/Detail?_boardNo=${note.boardNo}`}
              target="_blank" rel="noopener noreferrer"
              className="text-xs text-bdo-text-muted hover:text-bdo-gold transition-colors ml-auto"
            >
              Orjinal ↗
            </a>
          </div>

          <h1 className="text-lg font-bold text-bdo-text-primary leading-snug mb-2">{displayTitle}</h1>

          {summary && (
            <p className="text-sm text-bdo-text-muted leading-relaxed mb-4 border-l-2 border-bdo-gold/40 pl-3">{summary}</p>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View toggle */}
            {structured && (
              <div className="flex items-center gap-1 bg-bdo-bg rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("structured")}
                  className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors ${viewMode === "structured" ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-muted hover:text-bdo-text-primary"}`}
                >
                  📋 Değişiklikler
                </button>
                <button
                  onClick={() => setViewMode("flat")}
                  className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors ${viewMode === "flat" ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-muted hover:text-bdo-text-primary"}`}
                >
                  📄 Tam Metin
                </button>
              </div>
            )}

            {/* Legend counts */}
            {structured && allChanges.length > 0 && (
              <div className="flex flex-wrap gap-1 ml-auto">
                {(["BUFF", "NERF", "FIX", "NEW", "CHANGE"] as const).map((t) => {
                  const count = allChanges.filter((c) => c.type === t).length;
                  if (!count) return null;
                  const meta = TYPE_META[t];
                  return (
                    <span key={t} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border ${meta.bg} ${meta.text} ${meta.border}`}>
                      {meta.icon} {meta.labelTr} ({count})
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "structured" && structured ? (
        <StructuredView data={structured} />
      ) : structured ? (
        <FlatTurkishView data={structured} />
      ) : (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-6">
          <div className="patch-note-content text-sm text-bdo-text-primary leading-relaxed"
            dangerouslySetInnerHTML={{ __html: note.content }} />
        </div>
      )}
    </div>
  );
}
