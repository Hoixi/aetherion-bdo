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

// ─── Change type badge ────────────────────────────────────────────────────────

const TYPE_META: Record<
  StructuredChange["type"],
  { label: string; labelTr: string; icon: string; className: string }
> = {
  BUFF:   { label: "Buff",   labelTr: "Güçlendirme", icon: "▲", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  NERF:   { label: "Nerf",   labelTr: "Zayıflatma",  icon: "▼", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  FIX:    { label: "Fix",    labelTr: "Düzeltme",    icon: "🔧", className: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  NEW:    { label: "New",    labelTr: "Yeni",         icon: "✨", className: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  CHANGE: { label: "Change", labelTr: "Değişiklik",  icon: "⚡", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
};

function ChangeBadge({ type, lang }: { type: StructuredChange["type"]; lang: "tr" | "en" }) {
  const meta = TYPE_META[type] ?? TYPE_META.CHANGE;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${meta.className}`}
    >
      <span>{meta.icon}</span>
      <span>{lang === "tr" ? meta.labelTr : meta.label}</span>
    </span>
  );
}

// ─── Structured view ─────────────────────────────────────────────────────────

function StructuredView({ data, lang }: { data: StructuredPatchNote; lang: "tr" | "en" }) {
  const [activeId, setActiveId] = useState<string>(data.sections[0]?.id ?? "");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  // Highlight active section on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [data.sections]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex gap-6 relative">
      {/* ── Sidebar TOC ── */}
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
                <span className="text-sm">{sec.emoji}</span>
                <span className="truncate">{lang === "tr" ? sec.headingTr : sec.heading}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Sections ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-6">
        {/* Mobile TOC (horizontal scroll) */}
        {data.sections.length > 1 && (
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {data.sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollTo(sec.id)}
                className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  activeId === sec.id
                    ? "border-bdo-gold bg-bdo-gold/10 text-bdo-gold font-semibold"
                    : "border-bdo-border text-bdo-text-muted hover:border-bdo-gold/50 hover:text-bdo-text-primary"
                }`}
              >
                <span>{sec.emoji}</span>
                <span>{lang === "tr" ? sec.headingTr : sec.heading}</span>
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
            <div className="flex items-center gap-2.5 px-5 py-3 border-b border-bdo-border bg-bdo-bg/40">
              <span className="text-xl">{sec.emoji}</span>
              <div>
                <h2 className="text-sm font-bold text-bdo-text-primary">
                  {lang === "tr" ? sec.headingTr : sec.heading}
                </h2>
                {lang === "tr" && sec.heading !== sec.headingTr && (
                  <p className="text-[10px] text-bdo-text-muted">{sec.heading}</p>
                )}
              </div>
              {/* Change type summary pills */}
              <div className="ml-auto flex items-center gap-1 flex-wrap justify-end">
                {(["BUFF", "NERF", "FIX", "NEW", "CHANGE"] as const).map((t) => {
                  const count = sec.changes.filter((c) => c.type === t).length;
                  if (!count) return null;
                  const meta = TYPE_META[t];
                  return (
                    <span key={t} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.className}`}>
                      {meta.icon} {count}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Change list */}
            <ul className="divide-y divide-bdo-border/50">
              {sec.changes.map((change, i) => (
                <li key={i} className="px-5 py-3">
                  {/* Image if present */}
                  {change.imageUrl && (
                    <div className="mb-2 rounded-lg overflow-hidden border border-bdo-border">
                      <img
                        src={change.imageUrl}
                        alt=""
                        className="w-full object-cover max-h-48"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 shrink-0">
                      <ChangeBadge type={change.type} lang={lang} />
                    </div>
                    <p className="text-sm text-bdo-text-primary leading-relaxed">
                      {lang === "tr" ? change.tr : change.en}
                    </p>
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
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"structured" | "raw">("structured");

  useEffect(() => {
    fetch(`/api/patch-notes/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        setNote(data);
        setLoading(false);
        // If no structured data, fall back to raw view
        if (!data.structured) setViewMode("raw");
      });
  }, [params.id]);

  if (!session) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-bdo-text-muted">
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Yükleniyor...
      </div>
    );
  }
  if (!note) return <div className="text-center py-20 text-bdo-text-muted">Yama notu bulunamadı.</div>;

  const structured: StructuredPatchNote | null = note.structured
    ? (() => { try { return JSON.parse(note.structured!); } catch { return null; } })()
    : null;

  const displayTitle = lang === "tr" ? (structured?.titleTr || note.titleTr || note.title) : note.title;
  const displayContent = lang === "tr" ? (note.contentTr || note.content) : note.content;

  const summary = lang === "tr" ? structured?.summary : structured?.summaryEn;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-8">
      {/* Back */}
      <Link
        href="/patch-notes"
        className="inline-flex items-center gap-1 text-sm text-bdo-text-muted hover:text-bdo-text-primary mb-5 transition-colors"
      >
        ← Tüm Yama Notları
      </Link>

      {/* Hero header */}
      <div className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden mb-6">
        {note.thumbnail && (
          <div className="aspect-video bg-bdo-bg overflow-hidden max-h-64">
            <img src={note.thumbnail} alt={displayTitle} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
              Global Lab
            </span>
            <span className="text-xs text-bdo-text-muted">
              {new Date(note.publishedAt).toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <a
              href={`https://blackdesert.pearlabyss.com/GlobalLab/en-US/News/Notice/Detail?_boardNo=${note.boardNo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-bdo-text-muted hover:text-bdo-gold transition-colors ml-auto"
            >
              Orjinal ↗
            </a>
          </div>

          <h1 className="text-lg font-bold text-bdo-text-primary leading-snug mb-2">{displayTitle}</h1>

          {summary && (
            <p className="text-sm text-bdo-text-muted leading-relaxed mb-4 border-l-2 border-bdo-gold/40 pl-3">
              {summary}
            </p>
          )}

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Language */}
            <div className="flex items-center gap-1.5 bg-bdo-bg rounded-lg p-0.5">
              <button
                onClick={() => setLang("tr")}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors ${
                  lang === "tr" ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-muted hover:text-bdo-text-primary"
                }`}
              >
                🇹🇷 Türkçe
              </button>
              <button
                onClick={() => setLang("en")}
                className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors ${
                  lang === "en" ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-muted hover:text-bdo-text-primary"
                }`}
              >
                🇬🇧 English
              </button>
            </div>

            {/* View mode (only if structured data exists) */}
            {structured && (
              <div className="flex items-center gap-1.5 bg-bdo-bg rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("structured")}
                  className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors ${
                    viewMode === "structured" ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-muted hover:text-bdo-text-primary"
                  }`}
                >
                  📋 Yapılandırılmış
                </button>
                <button
                  onClick={() => setViewMode("raw")}
                  className={`text-xs px-3 py-1 rounded-md font-semibold transition-colors ${
                    viewMode === "raw" ? "bg-bdo-gold text-bdo-bg" : "text-bdo-text-muted hover:text-bdo-text-primary"
                  }`}
                >
                  📄 Tam Metin
                </button>
              </div>
            )}

            {/* Change type legend */}
            {structured && viewMode === "structured" && (
              <div className="flex flex-wrap gap-1 ml-auto">
                {(["BUFF", "NERF", "FIX", "NEW", "CHANGE"] as const).map((t) => {
                  const meta = TYPE_META[t];
                  const count = structured.sections.flatMap((s) => s.changes).filter((c) => c.type === t).length;
                  if (!count) return null;
                  return (
                    <span key={t} className={`text-[10px] font-bold px-2 py-0.5 rounded border ${meta.className}`}>
                      {meta.icon} {lang === "tr" ? meta.labelTr : meta.label} ({count})
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
        <StructuredView data={structured} lang={lang} />
      ) : (
        <div className="bg-bdo-surface border border-bdo-border rounded-xl p-6">
          <p className="text-xs text-bdo-text-muted mb-4 flex items-center gap-1.5">
            <span>🇬🇧</span> Orijinal İngilizce içerik
          </p>
          <div
            className="patch-note-content text-sm text-bdo-text-primary leading-relaxed"
            dangerouslySetInnerHTML={{ __html: note.content }}
          />
        </div>
      )}
    </div>
  );
}
