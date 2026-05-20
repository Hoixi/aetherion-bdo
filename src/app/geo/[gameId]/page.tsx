"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";

const BDO_MAP_URL =
  process.env.NEXT_PUBLIC_BDO_MAP_URL ||
  "https://bdocodex.com/maps/bdo_map_bg.jpg";

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
  const mapRef = useRef<HTMLDivElement>(null);

  const loadGame = useCallback(async () => {
    const res = await fetch(`/api/geo/game/${gameId}`);
    if (!res.ok) { router.push("/geo"); return; }
    const data: Game = await res.json();
    setGame(data);

    // Find first incomplete round
    const firstIncomplete = data.rounds.find((r) => !r.completed);
    if (firstIncomplete) setCurrentRound(firstIncomplete.roundNum);
    setLoading(false);
  }, [gameId, router]);

  useEffect(() => { loadGame(); }, [loadGame]);

  function handleMapClick(e: React.MouseEvent<HTMLDivElement>) {
    if (result) return; // already guessed this round
    const rect = mapRef.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setPendingGuess({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
  }

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
      // Update game total score
      setGame((g) =>
        g ? { ...g, totalScore: data.totalScore, completed: data.gameCompleted } : g
      );
    } finally {
      setSubmitting(false);
    }
  }

  function nextRound() {
    if (!result) return;
    if (result.gameCompleted) {
      // Show final screen — reload to get completed state
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

  // Game completed — final screen
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

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Top bar */}
      <div className="bg-[#1a1a1a] border-b border-[#2a2a2a] px-4 py-3 flex items-center justify-between">
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

      {/* Round progress */}
      <div className="h-1 bg-[#2a2a2a]">
        <div
          className="h-full bg-[#d4a853] transition-all"
          style={{ width: `${((currentRound - 1) / game.rounds.length) * 100}%` }}
        />
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Screenshot panel */}
        <div className="lg:w-1/2 bg-black flex items-center justify-center p-2 relative" style={{ minHeight: "40vh" }}>
          <img
            src={round.image.imageUrl}
            alt="BDO Konum"
            className="max-w-full max-h-full object-contain rounded"
            style={{ maxHeight: "calc(100vh - 200px)" }}
          />
          {result && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-[#d4a853]">+{result.score.toLocaleString()}</div>
              {result.hint && <div className="text-gray-300 text-sm mt-1">📍 {result.hint}</div>}
            </div>
          )}
        </div>

        {/* Map panel */}
        <div className="lg:w-1/2 flex flex-col bg-[#111]" style={{ minHeight: "40vh" }}>
          <div className="px-4 py-2 text-xs text-gray-500 border-b border-[#2a2a2a]">
            {result ? "Sonuç" : "Haritaya tıkla → konumu seç"}
          </div>

          {/* The map */}
          <div
            ref={mapRef}
            className="relative flex-1 cursor-crosshair overflow-hidden"
            onClick={handleMapClick}
          >
            <img
              src={BDO_MAP_URL}
              alt="BDO Dünya Haritası"
              className="w-full h-full object-cover"
              draggable={false}
            />

            {/* Pending guess marker */}
            {pendingGuess && !result && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${pendingGuess.x * 100}%`,
                  top: `${pendingGuess.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
              </div>
            )}

            {/* After guess: guess pin + correct pin + line */}
            {result && (
              <>
                {/* Guess marker */}
                {pendingGuess && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${pendingGuess.x * 100}%`,
                      top: `${pendingGuess.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
                    <div className="text-[10px] text-white text-center mt-1 bg-blue-600/80 px-1 rounded">Sen</div>
                  </div>
                )}

                {/* Correct marker */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${result.correctX * 100}%`,
                    top: `${result.correctY * 100}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-white shadow-lg" />
                  <div className="text-[10px] text-white text-center mt-1 bg-green-600/80 px-1 rounded">Doğru</div>
                </div>

                {/* SVG line between the two */}
                {pendingGuess && (
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ overflow: "visible" }}
                  >
                    <line
                      x1={`${pendingGuess.x * 100}%`}
                      y1={`${pendingGuess.y * 100}%`}
                      x2={`${result.correctX * 100}%`}
                      y2={`${result.correctY * 100}%`}
                      stroke="white"
                      strokeWidth="2"
                      strokeDasharray="4 3"
                      strokeOpacity="0.7"
                    />
                  </svg>
                )}
              </>
            )}
          </div>

          {/* Bottom action */}
          <div className="p-3 border-t border-[#2a2a2a] flex items-center justify-between gap-3">
            {!result ? (
              <>
                <span className="text-xs text-gray-500">
                  {pendingGuess ? "Tahminini onayla" : "Konuma tıkla"}
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
                  <span className="text-gray-400">Mesafe: </span>
                  <span className="text-white font-semibold">
                    {(result.distance * 100).toFixed(1)}%
                  </span>
                  <span className="text-gray-600 text-xs ml-3">
                    +{result.score.toLocaleString()} puan
                  </span>
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
