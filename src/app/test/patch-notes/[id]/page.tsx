"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, ExternalLink, ListTree, FileText } from "lucide-react";
import type { StructuredPatchNote, StructuredChange } from "@/lib/patch-notes-types";
import { BDO_CLASSES, getClassImageUrl } from "@/lib/classes";
import { TestShell, Card, Empty } from "@/components/test-shell";

/**
 * Yama notu detayı.
 *
 * İçerik yapılandırılmışsa bölüm bölüm, değişiklik tipiyle etiketli
 * gösteriliyor; değilse kaynaktaki HTML olduğu gibi basılıyor.
 * Bölüm başlıklarında class adı geçiyorsa arkasına o class'ın görseli
 * konuyor — uzun listede hangi class'ta olduğunu kaydırırken görmek için.
 */

type PatchNote = {
  id: number;
  boardNo: number;
  title: string;
  titleTr: string;
  content: string;
  contentTr: string;
  structured: string | null;
  thumbnail: string | null;
  publishedAt: string;
};

type ChangeType = StructuredChange["type"];

const TYPE_META: Record<ChangeType, { label: string; color: string }> = {
  BUFF: { label: "Güçlendirme", color: "#2bca6e" },
  NERF: { label: "Zayıflatma", color: "#e05252" },
  FIX: { label: "Düzeltme", color: "#5aa9e6" },
  NEW: { label: "Yeni", color: "#a855f7" },
  CHANGE: { label: "Değişiklik", color: "#e8b451" },
};

const TYPES: ChangeType[] = ["BUFF", "NERF", "FIX", "NEW", "CHANGE"];

// ── Class görseli eşlemesi ────────────────────────────────────────────

const CLASS_NAMES: Record<string, number> = Object.fromEntries(
  BDO_CLASSES.flatMap((c) => [
    [c.name.toLowerCase(), c.classType],
    [c.id.toLowerCase(), c.classType],
  ]),
);

/** Yama notlarında geçen İngilizce adlar — site içi adlarla birebir değil */
const ALIASES: Record<string, number> = {
  warrior: 0, hashashin: 1, sage: 2, wukong: 3, ranger: 4, guardian: 5,
  scholar: 6, drakania: 7, sorceress: 8, nova: 9, corsair: 10, lahn: 11,
  berserker: 12, maegu: 15, archer: 16, shai: 17, striker: 19, musa: 20,
  maehwa: 21, mystic: 23, valkyrie: 24, kunoichi: 25, ninja: 26,
  "dark knight": 27, wizard: 28, "dark archer": 29, witch: 31, woosa: 30,
  seraph: 32, dosa: 33, deadeye: 34,
};

function sectionSplash(heading: string): string | null {
  const h = heading.toLowerCase();
  const spec: "awakening" | "succession" = h.includes("succession") ? "succession" : "awakening";
  const cleaned = h.replace(/\b(awakening|succession|uyanış|devam)\b/g, "").trim();

  const classType =
    ALIASES[cleaned] ??
    CLASS_NAMES[cleaned] ??
    Object.entries({ ...ALIASES, ...CLASS_NAMES }).find(([k]) => cleaned.includes(k))?.[1];

  return classType === undefined ? null : getClassImageUrl(classType, spec);
}

/** Aynı skill'in ardışık değişiklikleri tek başlık altında toplanıyor */
function groupBySkill(changes: StructuredChange[]) {
  const groups: {
    skillName?: string; skillNameTr?: string; skillImageUrl?: string;
    changes: StructuredChange[];
  }[] = [];
  for (const c of changes) {
    const last = groups[groups.length - 1];
    if (last && last.skillName === c.skillName) last.changes.push(c);
    else groups.push({
      skillName: c.skillName, skillNameTr: c.skillNameTr,
      skillImageUrl: c.skillImageUrl, changes: [c],
    });
  }
  return groups;
}

export default function PatchNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const [note, setNote] = useState<PatchNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"structured" | "flat">("structured");

  useEffect(() => {
    fetch(`/api/patch-notes/${params?.id}`)
      .then((r) => r.json())
      .then((data) => {
        setNote(data);
        if (!data?.structured) setMode("flat");
      })
      .finally(() => setLoading(false));
  }, [params?.id]);

  const structured: StructuredPatchNote | null = useMemo(() => {
    if (!note?.structured) return null;
    try { return JSON.parse(note.structured); } catch { return null; }
  }, [note?.structured]);

  if (loading) {
    return <TestShell title="Yama Notu" subtitle="Yükleniyor…"><Empty>Yama notu geliyor…</Empty></TestShell>;
  }
  if (!note) {
    return <TestShell title="Yama Notu" subtitle="Bulunamadı"><Empty>Bu yama notu bulunamadı.</Empty></TestShell>;
  }

  const title = structured?.titleTr || note.titleTr || note.title;
  const allChanges = structured?.sections.flatMap((s) => s.changes) ?? [];

  return (
    <TestShell bare>
      <div className="space-y-5 pb-8 max-w-6xl mx-auto">
        <Link href="/test/patch-notes"
              className="inline-flex items-center gap-1 text-[12px] transition-colors hover:opacity-80"
              style={{ color: "var(--t-dim)" }}>
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.2} /> Tüm yama notları
        </Link>

        {/* ── Künye ──────────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          {note.thumbnail && (
            <div className="max-h-64 overflow-hidden" style={{ background: "var(--t-canvas)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={note.thumbnail} alt="" className="w-full h-full object-cover" />
            </div>
          )}

          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)" }}>
                Global Lab
              </span>
              <span className="text-[12px]" style={{ color: "var(--t-faint)" }}>
                {new Date(note.publishedAt).toLocaleDateString("tr-TR", {
                  day: "numeric", month: "long", year: "numeric",
                })}
              </span>
              <a href={`https://blackdesert.pearlabyss.com/GlobalLab/en-US/News/Notice/Detail?_boardNo=${note.boardNo}`}
                 target="_blank" rel="noopener noreferrer"
                 className="ml-auto text-[12px] inline-flex items-center gap-1 transition-colors hover:opacity-80"
                 style={{ color: "var(--t-faint)" }}>
                Orijinal <ExternalLink className="w-3 h-3" strokeWidth={2} />
              </a>
            </div>

            <h1 className="text-[19px] font-bold leading-snug mb-2">{title}</h1>

            {structured?.summary && (
              <p className="text-[13px] leading-relaxed mb-4 pl-3"
                 style={{ color: "var(--t-dim)", borderLeft: "2px solid rgba(232,180,81,.4)" }}>
                {structured.summary}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {structured && (
                <div className="flex items-center gap-0.5 p-0.5 rounded-[var(--t-r-sm)]"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                  {([
                    ["structured", "Değişiklikler", ListTree],
                    ["flat", "Tam Metin", FileText],
                  ] as const).map(([m, label, Icon]) => (
                    <button key={m} onClick={() => setMode(m)}
                            className="text-[12px] px-3 h-[28px] rounded-md font-semibold inline-flex items-center gap-1.5 transition-colors"
                            style={mode === m
                              ? { background: "var(--t-gold)", color: "#0b0b0c" }
                              : { color: "var(--t-faint)" }}>
                      <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {allChanges.length > 0 && (
                <div className="flex flex-wrap gap-1 ml-auto">
                  {TYPES.map((t) => {
                    const n = allChanges.filter((c) => c.type === t).length;
                    if (!n) return null;
                    const meta = TYPE_META[t];
                    return (
                      <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded border"
                            style={{ color: meta.color, borderColor: meta.color + "35", background: meta.color + "12" }}>
                        {meta.label} ({n})
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* ── İçerik ─────────────────────────────────────────────── */}
        {structured ? (
          <Sections data={structured} toc={mode === "structured"} />
        ) : (
          <Card className="p-6">
            <div className="patch-note-content text-[13px] leading-relaxed"
                 dangerouslySetInnerHTML={{ __html: note.content }} />
          </Card>
        )}
      </div>
    </TestShell>
  );
}

// ── Bölümler ───────────────────────────────────────────────────────────

/**
 * İki görünüm de aynı bölümleri çiziyor; tek fark içindekiler şeridi ve
 * bölüm başlığındaki sayaçlar. Ayrı iki bileşen tutmak yerine bayrakla
 * ayrılıyor.
 */
function Sections({ data, toc }: { data: StructuredPatchNote; toc: boolean }) {
  const [active, setActive] = useState(data.sections[0]?.id ?? "");
  const refs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    if (!toc) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [data.sections, toc]);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="flex gap-6 relative">
      {toc && (
        <aside className="hidden lg:block w-52 flex-shrink-0">
          <div className="sticky top-20">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-3" style={{ color: "var(--t-faint)" }}>
              İçerik
            </p>
            <nav className="flex flex-col gap-0.5">
              {data.sections.map((sec) => (
                <button key={sec.id} onClick={() => scrollTo(sec.id)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--t-r-sm)] text-left text-[12px] transition-colors"
                        style={active === sec.id
                          ? { background: "var(--t-gold-soft)", color: "var(--t-gold)", fontWeight: 600 }
                          : { color: "var(--t-faint)" }}>
                  <span className="text-[13px] flex-shrink-0">{sec.emoji}</span>
                  <span className="truncate">{sec.headingTr}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col gap-5">
        {toc && data.sections.length > 1 && (
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {data.sections.map((sec) => (
              <button key={sec.id} onClick={() => scrollTo(sec.id)}
                      className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] transition-colors"
                      style={active === sec.id
                        ? { border: "1px solid var(--t-gold)", background: "var(--t-gold-soft)",
                            color: "var(--t-gold)", fontWeight: 600 }
                        : { border: "1px solid var(--t-line)", color: "var(--t-faint)" }}>
                <span>{sec.emoji}</span>
                <span>{sec.headingTr}</span>
              </button>
            ))}
          </div>
        )}

        {data.sections.map((sec) => {
          const splash = sectionSplash(sec.heading);
          return (
            <Card key={sec.id} className="overflow-hidden scroll-mt-20">
              <section id={sec.id} ref={(el) => { refs.current[sec.id] = el; }}>
                {/* Bölüm başlığı */}
                <div className="relative flex items-end gap-3 px-6 pb-6 pt-8 overflow-hidden min-h-[260px]"
                     style={{ borderBottom: "1px solid var(--t-line)" }}>
                  {splash && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={splash} alt="" aria-hidden
                           className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
                           onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div className="absolute inset-0 pointer-events-none"
                           style={{ background: "linear-gradient(90deg, rgba(11,11,12,.92) 0%, rgba(11,11,12,.62) 45%, rgba(11,11,12,.15) 100%)" }} />
                    </>
                  )}

                  <div className="relative" style={{ textShadow: "0 2px 10px rgba(0,0,0,.9)" }}>
                    <h2 className="text-[22px] font-bold">{sec.headingTr}</h2>
                    {sec.heading !== sec.headingTr && (
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--t-dim)" }}>{sec.heading}</p>
                    )}
                  </div>

                  {toc && (
                    <div className="relative ml-auto flex items-center gap-1 flex-wrap justify-end">
                      {TYPES.map((t) => {
                        const n = sec.changes.filter((c) => c.type === t).length;
                        if (!n) return null;
                        const meta = TYPE_META[t];
                        return (
                          <span key={t} className="t-num text-[10px] font-bold px-1.5 py-0.5 rounded border"
                                style={{ color: meta.color, borderColor: meta.color + "35",
                                         background: meta.color + "18" }}>
                            {meta.label.slice(0, 3)} {n}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Değişiklikler */}
                {groupBySkill(sec.changes).map((group, gi) => (
                  <div key={gi} style={gi > 0 ? { borderTop: "1px solid var(--t-line)" } : undefined}>
                    {group.skillName && (
                      <div className="flex items-center gap-2.5 px-5 py-2"
                           style={{ background: "rgba(255,255,255,.02)" }}>
                        {group.skillImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={group.skillImageUrl} alt="" className="w-8 h-8 object-contain rounded"
                               onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        )}
                        <span className="text-[12px] font-semibold" style={{ color: "var(--t-dim)" }}>
                          {group.skillNameTr || group.skillName}
                        </span>
                      </div>
                    )}
                    <ul>
                      {group.changes.map((c, i) => {
                        const meta = TYPE_META[c.type] ?? TYPE_META.CHANGE;
                        return (
                          <li key={i} className="px-5 py-2.5 flex items-start gap-3"
                              style={{ borderTop: i > 0 ? "1px solid var(--t-line)" : undefined }}>
                            <span className="text-[10px] font-bold px-2 py-1 rounded-md border flex-shrink-0 mt-0.5"
                                  style={{ color: meta.color, borderColor: meta.color + "35",
                                           background: meta.color + "12" }}>
                              {meta.label}
                            </span>
                            <p className="text-[13px] leading-relaxed">{c.tr}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </section>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
