"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface LeaderboardEntry {
  id: number;
  totalScore: number;
  createdAt: string;
  user: {
    familyName: string;
    avatarUrl: string;
    class: string;
  } | null;
}

export default function GeoPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
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
      if (!res.ok) {
        setError(data.error || "Oyun başlatılamadı");
        return;
      }
      router.push(`/geo/${data.id}`);
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-[#d4a853] mb-2">🗺️ BDO GeoGuessr</h1>
          <p className="text-gray-400 text-lg">
            BDO dünya haritasından bir konum gösterilir — haritada nerede olduğunu bul!
          </p>
          <p className="text-gray-500 text-sm mt-1">5 tur • Tur başına maks. 5000 puan</p>
        </div>

        {/* Start Button */}
        <div className="flex justify-center mb-10">
          <button
            onClick={startGame}
            disabled={starting}
            className="px-10 py-4 bg-[#d4a853] text-black font-bold text-lg rounded-lg hover:bg-[#e8bf6a] transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {starting ? "Başlatılıyor…" : "🎮 Oyuna Başla"}
          </button>
        </div>

        {error && (
          <p className="text-center text-red-400 mb-6">{error}</p>
        )}

        {/* Leaderboard */}
        <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#2a2a2a]">
            <h2 className="text-xl font-bold text-[#d4a853]">🏆 Skor Tablosu</h2>
          </div>

          {leaderboard.length === 0 ? (
            <div className="px-6 py-10 text-center text-gray-500">
              Henüz oynanmış oyun yok. İlk sen ol!
            </div>
          ) : (
            <div className="divide-y divide-[#2a2a2a]">
              {leaderboard.map((entry, i) => (
                <div key={entry.id} className="flex items-center gap-4 px-6 py-3">
                  {/* Rank */}
                  <div className="w-8 text-center">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (
                      <span className="text-gray-500 font-mono text-sm">{i + 1}</span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#2a2a2a] flex-shrink-0">
                    {entry.user?.avatarUrl ? (
                      <img
                        src={entry.user.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                        ?
                      </div>
                    )}
                  </div>

                  {/* Name */}
                  <div className="flex-1">
                    <span className="font-semibold">{entry.user?.familyName ?? "Misafir"}</span>
                    {entry.user?.class && (
                      <span className="text-gray-500 text-xs ml-2">{entry.user.class}</span>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <span className="text-[#d4a853] font-bold text-lg">
                      {entry.totalScore.toLocaleString()}
                    </span>
                    <span className="text-gray-600 text-xs ml-1">/ 25 000</span>
                  </div>

                  {/* Date */}
                  <div className="text-gray-600 text-xs hidden sm:block">
                    {new Date(entry.createdAt).toLocaleDateString("tr-TR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rules */}
        <div className="mt-8 bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6">
          <h3 className="font-bold text-[#d4a853] mb-3">📖 Nasıl Oynanır?</h3>
          <ul className="text-gray-400 text-sm space-y-2">
            <li>• BDO dünyasından bir ekran görüntüsü gösterilir</li>
            <li>• Haritada o konuma tıkla</li>
            <li>• Ne kadar yakına tıklarsan o kadar çok puan kazanırsın (maks. 5 000 / tur)</li>
            <li>• 5 tur sonra toplam puanın hesaplanır</li>
            <li>• Giriş yaparak skor tablosuna girebilirsin!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
