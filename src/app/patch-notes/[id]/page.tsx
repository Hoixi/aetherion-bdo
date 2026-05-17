"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface PatchNote {
  id: number;
  boardNo: number;
  title: string;
  titleTr: string;
  content: string;
  contentTr: string;
  thumbnail: string | null;
  publishedAt: string;
}

export default function PatchNoteDetailPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const [note, setNote] = useState<PatchNote | null>(null);
  const [lang, setLang] = useState<"tr" | "en">("tr");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/patch-notes/${params.id}`)
      .then((r) => r.json())
      .then((data) => { setNote(data); setLoading(false); });
  }, [params.id]);

  if (!session) return null;
  if (loading) return <div className="text-center py-20 text-bdo-text-muted">Yükleniyor...</div>;
  if (!note) return <div className="text-center py-20 text-bdo-text-muted">Yama notu bulunamadı.</div>;

  const displayTitle = lang === "tr" ? (note.titleTr || note.title) : note.title;
  const displayContent = lang === "tr" ? (note.contentTr || note.content) : note.content;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-6">
      {/* Back */}
      <Link href="/patch-notes" className="inline-flex items-center gap-1 text-sm text-bdo-text-muted hover:text-bdo-text-primary mb-5 transition-colors">
        ← Tüm Yama Notları
      </Link>

      {/* Header */}
      <div className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden mb-6">
        {note.thumbnail && (
          <div className="aspect-video bg-bdo-bg overflow-hidden">
            <img src={note.thumbnail} alt={displayTitle} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="bg-bdo-gold/10 text-bdo-gold px-2 py-0.5 rounded text-[10px] font-bold uppercase">Global Lab</span>
            <span className="text-xs text-bdo-text-muted">
              {new Date(note.publishedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <a
              href={`https://blackdesert.pearlabyss.com/GlobalLab/en-US/News/Detail?_boardNo=${note.boardNo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-bdo-text-muted hover:text-bdo-gold transition-colors ml-auto"
            >
              Orjinal ↗
            </a>
          </div>

          <h1 className="text-xl font-bold text-bdo-text-primary leading-snug mb-4">{displayTitle}</h1>

          {/* Dil switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-bdo-text-muted">Dil:</span>
            <button
              onClick={() => setLang("tr")}
              className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${lang === "tr" ? "bg-bdo-gold text-bdo-bg" : "bg-bdo-bg text-bdo-text-muted hover:text-bdo-gold"}`}
            >
              🇹🇷 Türkçe
            </button>
            <button
              onClick={() => setLang("en")}
              className={`text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${lang === "en" ? "bg-bdo-gold text-bdo-bg" : "bg-bdo-bg text-bdo-text-muted hover:text-bdo-gold"}`}
            >
              🇬🇧 English
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-bdo-surface border border-bdo-border rounded-xl p-6">
        <div
          className="patch-note-content text-sm text-bdo-text-primary leading-relaxed"
          dangerouslySetInnerHTML={{ __html: displayContent }}
        />
      </div>
    </div>
  );
}
