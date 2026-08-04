"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Globe2, Play, Trophy, MapPin, Target, ListChecks } from "lucide-react";
import { PageHeader, Card, CardHeader, Empty, Button, Avatar } from "@/components/ui";

interface LeaderboardEntry {
  id: number;
  totalScore: number;
  createdAt: string;
  user: { familyName: string; avatarUrl: string; class: string } | null;
}

const RULES = [
  "BDO dünyasından bir ekran görüntüsü gösterilir",
  "Haritada o konuma tıkla",
  "Ne kadar yakın tıklarsan o kadar çok puan (maks. 5.000 / tur)",
  "5 tur sonunda toplam puanın hesaplanır",
  "Skor tablosuna girmek için giriş yapman yeterli",
];

export default function GeoPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/geo/leaderboard")
      .then((r) => r.json())
      .then(setLeaderboard)
      .catch(() => {});
  }, []);

  async function startGame() {
    setStarting(true);
    setError("");
    try {
      const res = await fetch("/api/geo/game", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Oyun başlatılamadı"); return; }
      router.push(`/geo/${data.id}`);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="BDO GeoGuessr"
        desc="Ekran görüntüsündeki konumu haritada bul. 5 tur, tur başına 5.000 puan."
        icon={Globe2}
        action={
          <Button variant="primary" size="md" icon={Play} onClick={startGame} disabled={starting}>
            {starting ? "Başlatılıyor..." : "Oyuna Başla"}
          </Button>
        }
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-lg text-[13px] mb-3">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {/* Leaderboard */}
        <Card className="md:col-span-2">
          <CardHeader title="Skor Tablosu" icon={Trophy} meta={`${leaderboard.length} kayıt`} />
          {leaderboard.length === 0 ? (
            <Empty
              icon={MapPin}
              text="Henüz oynanmış oyun yok."
              action={<Button variant="primary" icon={Play} onClick={startGame}>İlk oyunu sen oyna</Button>}
            />
          ) : (
            leaderboard.map((entry, i) => (
              <div key={entry.id} className="card-row gap-3">
                <span className={`w-5 text-center text-[11px] font-bold font-mono flex-shrink-0 ${
                  i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-bdo-text-secondary"
                }`}>{i + 1}</span>

                <Avatar src={entry.user?.avatarUrl} size={26} />

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-bdo-text-primary truncate leading-tight">
                    {entry.user?.familyName ?? "Misafir"}
                  </p>
                  <p className="text-[10px] text-bdo-text-secondary leading-tight">
                    {new Date(entry.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-[13px] font-bold font-mono text-bdo-gold leading-tight">
                    {entry.totalScore.toLocaleString("tr-TR")}
                  </p>
                  <p className="text-[10px] text-bdo-text-secondary leading-tight">/ 25.000</p>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Rules */}
        <Card className="h-fit">
          <CardHeader title="Nasıl Oynanır?" icon={ListChecks} />
          <div className="p-4 space-y-2.5">
            {RULES.map((rule, i) => (
              <div key={rule} className="flex gap-2.5">
                <span className="w-4 h-4 rounded bg-bdo-surface-2 border border-bdo-border flex items-center justify-center text-[9px] font-bold text-bdo-text-secondary flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-[12px] text-bdo-text-muted leading-relaxed">{rule}</p>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bdo-gold/5 border border-bdo-gold/15">
              <Target className="w-3.5 h-3.5 text-bdo-gold flex-shrink-0" strokeWidth={1.75} />
              <p className="text-[11px] text-bdo-text-muted">Maksimum skor <span className="font-mono font-semibold text-bdo-gold">25.000</span></p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
