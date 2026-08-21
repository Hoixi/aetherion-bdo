"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Trophy, MapPin, Target, ListChecks } from "lucide-react";
import { TestShell, Card, Head } from "@/components/app-shell";

/**
 * BDO GeoGuessr giriş ekranı.
 *
 * Oyun sunucuda oluşturuluyor — turların ekran görüntüleri önceden
 * seçiliyor ki oynarken sıra beklemesin.
 */

type LeaderboardEntry = {
  id: number;
  totalScore: number;
  createdAt: string;
  user: { familyName: string; avatarUrl: string; class: string } | null;
};

const RULES = [
  "BDO dünyasından bir ekran görüntüsü gösterilir",
  "Haritada o konuma tıkla",
  "Ne kadar yakın tıklarsan o kadar çok puan (en fazla 5.000 / tur)",
  "5 tur sonunda toplam puanın hesaplanır",
  "Skor tablosuna girmek için giriş yapman yeterli",
];

const MAX_SCORE = 25_000;
const MEDAL = ["#e8b451", "#c8ccd4", "#b87333"];

export default function GeoPage() {
  const router = useRouter();
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/geo/leaderboard").then((r) => r.json()).then(setBoard).catch(() => {});
  }, []);

  async function start() {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/geo/game", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Oyun başlatılamadı."); return; }
      router.push(`/geo/${data.id}`);
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <TestShell
      title="BDO GeoGuessr"
      subtitle="Ekran görüntüsündeki konumu haritada bul. 5 tur, tur başına 5.000 puan."
      aside={
        <button onClick={start} disabled={starting}
                className="t-chip inline-flex items-center gap-1 disabled:opacity-50"
                style={{ color: "var(--t-gold)", borderColor: "rgba(232,180,81,.4)" }}>
          <Play className="w-3 h-3" /> {starting ? "Başlatılıyor…" : "Oyuna başla"}
        </button>
      }
    >
      {error && (
        <Card className="px-4 py-2.5">
          <p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{error}</p>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        <Card className="lg:col-span-2 overflow-hidden">
          <Head icon={Trophy} title="Skor Tablosu" meta={`${board.length} KAYIT`} />

          {board.length === 0 ? (
            <div className="px-5 py-10 flex flex-col items-center gap-3">
              <MapPin className="w-6 h-6" strokeWidth={1.5} style={{ color: "var(--t-faint)" }} />
              <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>Henüz oynanmış oyun yok.</span>
              <button onClick={start} disabled={starting}
                      className="text-[12px] font-semibold px-3 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-50"
                      style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                               border: "1px solid rgba(232,180,81,.3)" }}>
                <Play className="w-3.5 h-3.5" strokeWidth={2} /> İlk oyunu sen oyna
              </button>
            </div>
          ) : (
            board.map((entry, i) => (
              <div key={entry.id} className="t-row px-5 py-2.5 flex items-center gap-3">
                <span className="t-num w-5 text-center text-[11px] font-bold flex-shrink-0"
                      style={{ color: MEDAL[i] ?? "var(--t-faint)" }}>
                  {i + 1}
                </span>

                {entry.user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={entry.user.avatarUrl} alt=""
                       className="w-[26px] h-[26px] rounded-full object-cover flex-shrink-0"
                       style={{ border: "1px solid var(--t-line)" }} />
                ) : (
                  <span className="w-[26px] h-[26px] rounded-full flex-shrink-0" style={{ background: "var(--t-raised)" }} />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate leading-tight">
                    {entry.user?.familyName ?? "Misafir"}
                  </p>
                  <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--t-faint)" }}>
                    {new Date(entry.createdAt).toLocaleDateString("tr-TR", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="t-num text-[13px] font-bold leading-tight" style={{ color: "var(--t-gold)" }}>
                    {entry.totalScore.toLocaleString("tr-TR")}
                  </p>
                  <p className="text-[10px] leading-tight mt-0.5" style={{ color: "var(--t-faint)" }}>
                    / {MAX_SCORE.toLocaleString("tr-TR")}
                  </p>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card className="overflow-hidden">
          <Head icon={ListChecks} title="Nasıl Oynanır?" />
          <div className="p-4 space-y-2.5">
            {RULES.map((rule, i) => (
              <div key={rule} className="flex gap-2.5">
                <span className="w-4 h-4 rounded grid place-items-center text-[9px] font-bold flex-shrink-0 mt-0.5"
                      style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                               color: "var(--t-faint)" }}>
                  {i + 1}
                </span>
                <p className="text-[12px] leading-relaxed" style={{ color: "var(--t-dim)" }}>{rule}</p>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-[var(--t-r-sm)]"
                 style={{ background: "var(--t-gold-soft)", border: "1px solid rgba(232,180,81,.2)" }}>
              <Target className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} style={{ color: "var(--t-gold)" }} />
              <p className="text-[11px]" style={{ color: "var(--t-dim)" }}>
                Maksimum skor{" "}
                <span className="t-num font-semibold" style={{ color: "var(--t-gold)" }}>
                  {MAX_SCORE.toLocaleString("tr-TR")}
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="pb-6" />
    </TestShell>
  );
}
