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
}

function timeAgo(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });
}

export default function PatchNotesPage() {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<PatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/patch-notes").then((r) => r.json()).then((data) => {
      setNotes(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  async function fetchLatest() {
    setFetching(true);
    setFetchMsg("Yama notları çekiliyor ve çevriliyor... Bu 30-60 saniye sürebilir.");
    const res = await fetch("/api/admin/fetch-patch-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (data.ok) {
      setFetchMsg(`✅ ${data.message}`);
      // Listeyi yenile
      const r2 = await fetch("/api/patch-notes");
      const d2 = await r2.json();
      setNotes(Array.isArray(d2) ? d2 : []);
    } else {
      setFetchMsg(`❌ Hata: ${data.error}`);
    }
    setFetching(false);
    setTimeout(() => setFetchMsg(null), 8000);
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
          <button
            onClick={fetchLatest}
            disabled={fetching}
            className="flex-shrink-0 bg-bdo-gold/10 text-bdo-gold border border-bdo-gold/30 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-bdo-gold/20 transition-colors disabled:opacity-50"
          >
            {fetching ? "⏳ Çekiliyor..." : "🔄 Son Yamayı Çek"}
          </button>
        )}
      </div>

      {fetchMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${fetchMsg.startsWith("✅") ? "bg-green-500/10 border-green-500/20 text-green-400" : fetchMsg.startsWith("❌") ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-bdo-gold/10 border-bdo-gold/20 text-bdo-gold"}`}>
          {fetchMsg}
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
            <Link key={note.id} href={`/patch-notes/${note.id}`}>
              <div className="bg-bdo-surface border border-bdo-border rounded-xl overflow-hidden hover:border-bdo-gold/40 transition-all group">
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
                  </p>
                  <h2 className="text-sm font-semibold text-bdo-text-primary group-hover:text-bdo-gold transition-colors leading-snug line-clamp-2">
                    {note.titleTr || note.title}
                  </h2>
                  <p className="text-[10px] text-bdo-text-muted mt-2 italic opacity-60">{note.title}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
