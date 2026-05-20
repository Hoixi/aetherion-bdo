"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { MapMarker } from "@/components/bdo-leaflet-map";

// Leaflet cannot run on the server — dynamic import with SSR off
const BdoLeafletMap = dynamic(
  () => import("@/components/bdo-leaflet-map").then((m) => ({ default: m.BdoLeafletMap })),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#1a1a2e] animate-pulse" /> }
);

interface RoundImage {
  id: number;
  imageUrl: string;
  mapX: number | null;
  mapY: number | null;
  hint: string | null;
}

interface Round {
  id: number;
  roundNum: number;
  guessX: number | null;
  guessY: number | null;
  score: number;
  distance: number;
  completed: boolean;
  image: RoundImage;
}

interface Game {
  id: number;
  totalScore: number;
  completed: boolean;
  rounds: Round[];
}

interface GuessResult {
  score: number;
  distance: number;
  correctX: number;
  correctY: number;
  hint: string | null;
  totalScore: number;
  gameCompleted: boolean;
}

export default function GeoGamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [currentRound, setCurrentRound] = useState(1);
  const [pendingGuess, setPendingGuess] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGame = useCallback(async () => {
    const res = await fetch(`/api/geo/game/${gameId}`);
    if (!res.ok) { router.push("/geo"); return; }
    const data: Game = await res.json();
    setGame(data);
    const firstIncomplete = data.rounds.find((r) => !r.completed);
    if (firstIncomplete) setCurrentRound(firstIncomplete.roundNum);
    setLoading(false);
  }, [gameId, router]);

  useEffect(() => { loadGame(); }, [loadGame]);

  async function submitGuess() {
    if (!pendingGuess || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/geo/game/${gameId}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roundNum: currentRound,
          guessX: pendingGuess.x,
          guessY: pendingGuess.y,
        }),
      });
      const data: GuessResult = await res.json();
      setResult(data);
      setGame((g) => g ? { ...g, totalScore: data.totalScore, completed: data.gameCompleted } : g);
    } finally {
      setSubmitting(false);
    }
  }

  function nextRound() {
    if (!result) return;
    if (result.gameCompleted) {
      loadGame();
      setResult(null);
      return;
    }
    setResult(null);
    setPendingGuess(null);
    setCurrentRound((r) => r + 1);
  }

  if (loading || !game) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-gray-400">
        Yükleniyor…
      </div>
    );
  }

  const round = game.rounds.find((r) => r.roundNum === currentRound);

  // ── Final screen ─────────────────────────────────────────────────────────
  if (game.completed && !result) {
    const maxScore = game.rounds.length * 5000;
    const pct = Math.round((game.totalScore / maxScore) * 100);
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center px-4">
        <div className="max-w-lg w-full text-center">
          <div className="text-6xl mb-4">
            {pct >= 80 ? "🏆" : pct >= 50 ? "🎯" : "💀"}
          </div>
          <h1 className="text-3xl font-bold text-[#d4a853] mb-2">Oyun Bitti!</h1>
          <p className="text-gray-400 mb-6">Toplam {game.rounds.length} tur oynadın</p>

          <div className="bg-[#1a1a1a] rounded-xl border border-[#2a2a2a] p-6 mb-6">
            <div className="text-5xl font-bold text-[#d4a853] mb-1">
              {game.totalScore.toLocaleString()}
            </div>
            <div className="text-gray-500 text-sm">/ {maxScore.toLocaleString()} puan</div>

            <div className="mt-4 space-y-2">
              {game.rounds.map((r) => (
                <div key={r.id} className="flex justify-between text-sm">
                  <span className="text-gray-400">Tur {r.roundNum}</span>
                  <span className="text-[#d4a853] font-semibold">
                    {r.score.toLocaleString()} puan
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push("/geo")}
              className="px-6 py-3 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#333] transition font-semibold"
            >
              🏆 Skor Tablosu
            </button>
            <button
              onClick={async () => {
                const res = await fetch("/api/geo/game", { method: "POST" });
                const data = await res.json();
                if (res.ok) router.push(`/geo/${data.id}`);
              }}
              className="px-6 py-3 bg-[#d4a853] text-black rounded-lg hover:bg-[#e8bf6a] transition font-bold"
            >
              🎮 Tekrar Oyna
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!round) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-gray-400">
        Tur bulunamadı
      </div>
    );
  }

  // Markers to show on the map
  const mapMarkers: MapMarker[] = [];
  if (result) {
    if (pendingGuess) {
      mapMarkers.push({ x: pendingGuess.x, y: pendingGuess.y, color: "blue", label: "Sen" });
    }
    mapMarkers.push({ x: result.correctX, y: result.correctY, color: "green", label: "Doğru" });
  } else if (pendingGuess) {
    mapMarkers.push({ x: pendingGuess.x, y: pendingGuess.y, color: "blue" });
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Top bar */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/geo")}
            className="text-gray-500 hover:text-white transition text-sm"
          >
            ← Çık
          </button>
          <span className="text-gray-400 text-sm">
            Tur <span className="text-white font-bold">{currentRound}</span> / {game.rounds.length}
          </span>
        </div>
        <div className="text-right">
          <span className="text-gray-400 text-sm">Toplam: </span>
          <span className="text-[#d4a853] font-bold">{game.totalScore.toLocaleString()}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#2a2a2a] flex-shrink-0">
        <div
          className="h-full bg-[#d4a853] transition-all"
          style={{ width: `${((currentRound - 1) / game.rounds.length) * 100}%` }}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col lg:flex-row" style={{ minHeight: 0 }}>
        {/* Screenshot */}
        <div className="lg:w-1/2 bg-black flex items-center justify-center p-2 relative" style={{ minHeight: "40vh" }}>
          <img
            src={round.image.imageUrl}
            alt="BDO Konum"
            className="max-w-full max-h-full object-contain rounded"
            style={{ maxHeight: "calc(100vh - 160px)" }}
          />
          {result && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 rounded-lg px-4 py-2 text-center pointer-events-none">
              <div className="text-2xl font-bold text-[#d4a853]">+{result.score.toLocaleString()}</div>
              {result.hint && <div className="text-gray-300 text-sm mt-1">📍 {result.hint}</div>}
            </div>
          )}
        </div>

        {/* Leaflet Map */}
        <div className="lg:w-1/2 flex flex-col bg-[#111]" style={{ minHeight: "40vh" }}>
          <div className="px-4 py-2 text-xs text-gray-500 border-b border-[#2a2a2a] flex-shrink-0">
            {result ? "Sonuç — yeşil doğru konum, mavi tahminin" : "Haritada konuma tıkla"}
          </div>

          <BdoLeafletMap
            className="flex-1 w-full"
            onPick={result ? undefined : (x, y) => setPendingGuess({ x, y })}
            markers={mapMarkers}
          />

          {/* Bottom action bar */}
          <div className="p-3 border-t border-[#2a2a2a] flex items-center justify-between gap-3 flex-shrink-0">
            {!result ? (
              <>
                <span className="text-xs text-gray-500">
                  {pendingGuess ? "Konumu seçtin — onayla veya başka yere tıkla" : "Haritaya tıkla"}
                </span>
                <button
                  onClick={submitGuess}
                  disabled={!pendingGuess || submitting}
                  className="px-5 py-2 bg-[#d4a853] text-black font-bold rounded-lg hover:bg-[#e8bf6a] transition disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                >
                  {submitting ? "Gönderiliyor…" : "✅ Tahmin Et"}
                </button>
              </>
            ) : (
              <>
                <div className="text-sm">
                  <span className="text-[#d4a853] font-bold text-lg">+{result.score.toLocaleString()}</span>
                  <span className="text-gray-500 text-xs ml-2">puan</span>
                </div>
                <button
                  onClick={nextRound}
                  className="px-5 py-2 bg-[#d4a853] text-black font-bold rounded-lg hover:bg-[#e8bf6a] transition text-sm"
                >
                  {result.gameCompleted ? "🏆 Sonuçlar" : "Sonraki Tur →"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
