"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ChevronLeft, Check, Trophy, Gamepad2, MapPin, ArrowRight } from "lucide-react";
import type { MapMarker } from "@/components/bdo-leaflet-map";
import "@/app/theme.css";

/**
 * GeoGuessr turu.
 *
 * Oyun ekranı bilerek tam ekran: solda ekran görüntüsü, sağda harita.
 * Kabuğun menüsü burada yok — tahmin ederken dikkat dağıtıyor, çıkış
 * için sol üstte bağlantı var.
 */

// Leaflet sunucuda çalışmıyor
const BdoLeafletMap = dynamic(
  () => import("@/components/bdo-leaflet-map").then((m) => ({ default: m.BdoLeafletMap })),
  { ssr: false, loading: () => <div className="w-full h-full animate-pulse" style={{ background: "var(--t-raised)" }} /> },
);

type RoundImage = { id: number; imageUrl: string; mapX: number | null; mapY: number | null; hint: string | null };
type Round = {
  id: number; roundNum: number;
  guessX: number | null; guessY: number | null;
  score: number; distance: number; completed: boolean;
  image: RoundImage;
};
type Game = { id: number; totalScore: number; completed: boolean; rounds: Round[] };
type GuessResult = { score: number; distance: number; totalScore: number; gameCompleted: boolean };

const PER_ROUND = 5000;

export default function GeoOyunPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [round, setRound] = useState(1);
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<GuessResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/geo/game/${gameId}`);
    if (!res.ok) { router.push("/geo"); return; }
    const data: Game = await res.json();
    setGame(data);
    // Yarıda bırakılmış oyunda kaldığı turdan devam etsin
    const next = data.rounds.find((r) => !r.completed);
    if (next) setRound(next.roundNum);
    setLoading(false);
  }, [gameId, router]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!guess || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/geo/game/${gameId}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundNum: round, guessX: guess.x, guessY: guess.y }),
      });
      const data: GuessResult = await res.json();
      setResult(data);
      setGame((g) => (g ? { ...g, totalScore: data.totalScore, completed: data.gameCompleted } : g));
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!result) return;
    if (result.gameCompleted) { load(); setResult(null); return; }
    setResult(null);
    setGuess(null);
    setRound((r) => r + 1);
  }

  async function playAgain() {
    const res = await fetch("/api/geo/game", { method: "POST" });
    const data = await res.json();
    if (res.ok) router.push(`/geo/${data.id}`);
  }

  if (loading || !game) return <FullScreen>Yükleniyor…</FullScreen>;

  // ── Bitiş ekranı ─────────────────────────────────────────────────────
  if (game.completed && !result) {
    const max = game.rounds.length * PER_ROUND;
    const pct = Math.round((game.totalScore / max) * 100);
    const Icon = pct >= 80 ? Trophy : pct >= 50 ? MapPin : Gamepad2;

    return (
      <div className="t-root fixed inset-0 z-[100] flex items-center justify-center px-4"
           style={{ background: "var(--t-canvas)", color: "var(--t-text)" }}>
        <div className="max-w-lg w-full text-center">
          <Icon className="w-12 h-12 mx-auto mb-4" strokeWidth={1.4} style={{ color: "var(--t-gold)" }} />
          <h1 className="text-[28px] font-bold mb-1" style={{ color: "var(--t-gold)" }}>Oyun bitti</h1>
          <p className="text-[13px] mb-6" style={{ color: "var(--t-dim)" }}>
            {game.rounds.length} tur oynadın
          </p>

          <div className="rounded-[var(--t-r)] p-6 mb-6"
               style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
            <div className="t-num text-[44px] font-bold leading-none mb-1.5" style={{ color: "var(--t-gold)" }}>
              {game.totalScore.toLocaleString("tr-TR")}
            </div>
            <div className="text-[12px]" style={{ color: "var(--t-faint)" }}>
              / {max.toLocaleString("tr-TR")} puan
            </div>

            <div className="mt-4 space-y-1.5">
              {game.rounds.map((r) => (
                <div key={r.id} className="flex justify-between text-[13px]">
                  <span style={{ color: "var(--t-dim)" }}>Tur {r.roundNum}</span>
                  <span className="t-num font-semibold" style={{ color: "var(--t-gold)" }}>
                    {r.score.toLocaleString("tr-TR")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/geo")}
                    className="px-5 h-[42px] rounded-[var(--t-r-sm)] text-[13px] font-semibold inline-flex items-center gap-2"
                    style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
              <Trophy className="w-4 h-4" strokeWidth={2} /> Skor tablosu
            </button>
            <button onClick={playAgain}
                    className="px-5 h-[42px] rounded-[var(--t-r-sm)] text-[13px] font-bold inline-flex items-center gap-2"
                    style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
              <Gamepad2 className="w-4 h-4" strokeWidth={2} /> Tekrar oyna
            </button>
          </div>
        </div>
      </div>
    );
  }

  const current = game.rounds.find((r) => r.roundNum === round);
  if (!current) return <FullScreen>Tur bulunamadı.</FullScreen>;

  const markers: MapMarker[] = guess ? [{ x: guess.x, y: guess.y, color: "blue", label: result ? "Sen" : undefined }] : [];

  return (
    <div className="t-root fixed inset-0 z-[100] flex flex-col"
         style={{ background: "var(--t-canvas)", color: "var(--t-text)" }}>
      {/* Üst şerit */}
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0"
           style={{ background: "var(--t-surface)", borderBottom: "1px solid var(--t-line)" }}>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push("/geo")}
                  className="text-[13px] inline-flex items-center gap-1 transition-colors hover:opacity-80"
                  style={{ color: "var(--t-faint)" }}>
            <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.2} /> Çık
          </button>
          <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>
            Tur <span className="t-num font-bold" style={{ color: "var(--t-text)" }}>{round}</span> / {game.rounds.length}
          </span>
        </div>
        <div className="text-[13px]" style={{ color: "var(--t-dim)" }}>
          Toplam:{" "}
          <span className="t-num font-bold" style={{ color: "var(--t-gold)" }}>
            {game.totalScore.toLocaleString("tr-TR")}
          </span>
        </div>
      </div>

      <div className="h-1 flex-shrink-0" style={{ background: "var(--t-raised)" }}>
        <div className="h-full transition-all"
             style={{ width: `${((round - 1) / game.rounds.length) * 100}%`, background: "var(--t-gold)" }} />
      </div>

      {/* Ekran görüntüsü | harita */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden" style={{ minHeight: 0 }}>
        <div className="lg:w-1/2 flex items-center justify-center relative overflow-hidden"
             style={{ minHeight: "45vh", background: "#000" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={current.image.imageUrl} alt="BDO konumu" className="w-full h-full object-contain" />
          {result && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl px-5 py-3 text-center pointer-events-none"
                 style={{ background: "rgba(0,0,0,.85)", backdropFilter: "blur(4px)" }}>
              <div className="t-num text-[28px] font-bold" style={{ color: "var(--t-gold)" }}>
                +{result.score.toLocaleString("tr-TR")}
              </div>
            </div>
          )}
        </div>

        <div className="lg:w-1/2 flex flex-col" style={{ minHeight: "45vh" }}>
          <div className="px-4 py-1.5 text-[11.5px] flex items-center justify-between flex-shrink-0"
               style={{ background: "var(--t-shell)", borderBottom: "1px solid var(--t-line)",
                        color: "var(--t-faint)" }}>
            <span>{result ? "Mavi işaret = senin tahminin" : "Haritada konuma tıkla"}</span>
            {guess && !result && (
              <span className="inline-flex items-center gap-1" style={{ color: "var(--t-gold)" }}>
                <MapPin className="w-3 h-3" strokeWidth={2} /> Konum seçildi
              </span>
            )}
          </div>

          <BdoLeafletMap className="flex-1 w-full" markers={markers}
                         onPick={result ? undefined : (x, y) => setGuess({ x, y })} />

          <div className="px-4 py-3 flex items-center justify-between gap-3 flex-shrink-0"
               style={{ background: "var(--t-shell)", borderTop: "1px solid var(--t-line)" }}>
            {!result ? (
              <>
                <span className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                  {guess ? "Onayla ya da başka yere tıkla" : "Konumu bulmaya çalış"}
                </span>
                <button onClick={submit} disabled={!guess || submitting}
                        className="px-5 h-[36px] rounded-[var(--t-r-sm)] text-[13px] font-bold inline-flex items-center gap-2 disabled:opacity-40"
                        style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
                  <Check className="w-4 h-4" strokeWidth={2.4} />
                  {submitting ? "Gönderiliyor…" : "Tahmin et"}
                </button>
              </>
            ) : (
              <>
                <div>
                  <span className="t-num text-[19px] font-bold" style={{ color: "var(--t-gold)" }}>
                    +{result.score.toLocaleString("tr-TR")}
                  </span>
                  <span className="text-[11.5px] ml-2" style={{ color: "var(--t-faint)" }}>puan</span>
                </div>
                <button onClick={next}
                        className="px-5 h-[36px] rounded-[var(--t-r-sm)] text-[13px] font-bold inline-flex items-center gap-2"
                        style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
                  {result.gameCompleted ? "Sonuçlar" : "Sonraki tur"}
                  <ArrowRight className="w-4 h-4" strokeWidth={2.4} />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="t-root fixed inset-0 z-[100] grid place-items-center text-[13px]"
         style={{ background: "var(--t-canvas)", color: "var(--t-dim)" }}>
      {children}
    </div>
  );
}
