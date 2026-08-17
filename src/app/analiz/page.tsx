"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3, Sparkles, Check, Shield, Users, Swords, Skull,
  Castle, TrendingDown, TrendingUp, Loader2, AlertTriangle, Target, Lightbulb,
} from "lucide-react";
import { PageHeader, Card, CardHeader, Empty, Loading, Button } from "@/components/ui";
import { getClassByID, getClassIconUrl } from "@/lib/classes";
import { METRIC_WEIGHTS, METRIC_KEYS, type PlayerAnalysis } from "@/lib/war-analysis";

type WarRow = { id: number; title: string; type: string; date: string; result: string | null };

type AiReport = {
  headline: string;
  teamStrengths: string[];
  teamWeaknesses: string[];
  standouts: { name: string; reason: string }[];
  concerns: { name: string; role?: string; issue: string; suggestion: string; severity: "high" | "medium" | "low"; lowSample: boolean }[];
  classNotes: { className: string; verdict: string; roleExpected: boolean }[];
  actions: { title: string; detail: string }[];
};

type AnalysisData = {
  wars: WarRow[];
  players: PlayerAnalysis[];
  classAvg: { class: string; rating: number; count: number }[];
  totals: { damageDealt: number; castleDamage: number; kills: number; deaths: number };
  excludedCount: number;
};

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

/** Dilim değerine göre renk — 50 nötr, aşağısı kırmızı, yukarısı yeşil */
function pctColor(pct: number): string {
  if (pct >= 75) return "#2bca6e";
  if (pct >= 55) return "#a3d977";
  if (pct >= 45) return "#e0b040";
  if (pct >= 25) return "#e09832";
  return "#e05252";
}

function PctBar({ pct, label }: { pct: number; label?: string }) {
  const color = pctColor(pct);
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[10px] text-bdo-text-secondary w-[74px] flex-shrink-0">{label}</span>}
      <div className="flex-1 h-1.5 rounded-full bg-bdo-surface-2 overflow-hidden min-w-[40px]">
        <div className="h-full rounded-full transition-all"
             style={{ width: Math.max(2, pct) + "%", backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-mono font-semibold w-7 text-right flex-shrink-0"
            style={{ color }}>{Math.round(pct)}</span>
    </div>
  );
}

export default function AnalizPage() {
  const { data: session, status } = useSession();

  const [wars, setWars] = useState<WarRow[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [excludeDefense, setExcludeDefense] = useState(true);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [ai, setAi] = useState<AiReport | null>(null);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [focus, setFocus] = useState("");

  useEffect(() => {
    fetch("/api/wars")
      .then((r) => (r.ok ? r.json() : []))
      .then((w: WarRow[]) => {
        setWars(w);
        // Varsayılan olarak son 5 savaş seçili gelsin
        setPicked(new Set(w.slice(0, 5).map((x) => x.id)));
      })
      .finally(() => setLoading(false));
  }, []);

  async function run() {
    if (picked.size === 0) return;
    setRunning(true);
    setError(null);
    setAi(null);
    setAiErr(null);
    const qs = new URLSearchParams({ wars: Array.from(picked).join(",") });
    if (!excludeDefense) qs.set("defense", "include");
    const res = await fetch("/api/analiz?" + qs);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Analiz alınamadı."); setData(null); }
    else { setData(json); setSelected(null); }
    setRunning(false);
  }

  async function askAi() {
    if (!data) return;
    setAiBusy(true);
    setAi(null);
    setAiErr(null);
    const res = await fetch("/api/analiz/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: data.players, wars: data.wars, focus: focus.trim() || undefined }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) setAi(json as AiReport);
    else setAiErr(json.error ?? "AI analizi başarısız.");
    setAiBusy(false);
  }

  /** AI bir isimden bahsedince listedeki oyuncuya bağla */
  function focusPlayer(name: string) {
    const p = data?.players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (p) setSelected(p.userId != null ? "u" + p.userId : "n" + p.name);
  }

  const sel = useMemo(
    () => data?.players.find((p) => (p.userId != null ? "u" + p.userId : "n" + p.name) === selected) ?? null,
    [data, selected],
  );

  if (status === "loading" || loading) return <Loading />;
  if (!session?.user.canManageWars) {
    return <Empty text="Bu sayfa yalnızca savaş yöneticileri içindir." />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={BarChart3}
        title="Savaş Analizi"
        desc="Seçtiğin savaşları her iki klan için birlikte inceler. Sayılar savaş içi yüzdelik dilimdir — 50 o savaşın medyanı."
      />

      {/* Savaş seçimi */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-bdo-text-secondary">
            Savaş Seç ({picked.size})
          </span>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm"
                    onClick={() => setPicked(new Set(wars.slice(0, 5).map((w) => w.id)))}>
              Son 5
            </Button>
            <Button variant="ghost" size="sm"
                    onClick={() => setPicked(new Set(wars.map((w) => w.id)))}>
              Hepsi
            </Button>
            <Button variant="ghost" size="sm" icon={Shield}
                    onClick={() => setExcludeDefense((v) => !v)}>
              {excludeDefense ? "Savunma hariç" : "Savunma dahil"}
            </Button>
            <Button variant="primary" size="sm" icon={BarChart3}
                    onClick={run} disabled={running || picked.size === 0}>
              {running ? "Analiz ediliyor..." : "Analiz Et"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {wars.map((w) => {
            const on = picked.has(w.id);
            return (
              <button
                key={w.id}
                onClick={() => setPicked((prev) => {
                  const next = new Set(prev);
                  if (next.has(w.id)) next.delete(w.id); else next.add(w.id);
                  return next;
                })}
                className={`text-[11px] px-2 py-1 rounded-lg border transition-colors ${
                  on
                    ? "border-bdo-gold/40 bg-bdo-gold/10 text-bdo-text-primary"
                    : "border-bdo-border bg-bdo-bg text-bdo-text-secondary hover:border-bdo-border-2"
                }`}
              >
                {w.title}
                <span className="ml-1.5 text-bdo-text-secondary">
                  {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {error && (
        <Card className="p-3">
          <p className="text-[13px] text-red-400">{error}</p>
        </Card>
      )}

      {data && (
        <>
          {/* Toplamlar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: Swords, label: "Toplam Hasar", value: fmt(data.totals.damageDealt), color: "#e0b040" },
              { icon: Castle, label: "Kale Hasarı", value: fmt(data.totals.castleDamage), color: "#e09832" },
              { icon: Check, label: "Kill", value: String(data.totals.kills), color: "#dce4f2" },
              { icon: Skull, label: "Ölüm", value: String(data.totals.deaths), color: "#e05252" },
              { icon: Users, label: "Oyuncu", value: String(data.players.length), color: "#6b93ff" },
            ].map((s) => (
              <Card key={s.label} className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className="w-3 h-3" strokeWidth={2} style={{ color: s.color }} />
                  <span className="text-[10px] uppercase tracking-wider text-bdo-text-secondary">{s.label}</span>
                </div>
                <div className="text-[19px] font-bold" style={{ color: s.color }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {data.excludedCount > 0 && (
            <p className="text-[11px] text-bdo-text-secondary">
              {data.excludedCount} savunma kaydı analiz dışında tutuldu — savunmadakiler farklı iş yapar,
              hasarları saldırıyla kıyaslanamaz.
            </p>
          )}

          <div className="grid lg:grid-cols-[1fr_320px] gap-4">
            {/* Oyuncu tablosu */}
            <Card>
              <CardHeader title="Oyuncular" icon={Users} meta={`${data.players.length} kişi`} />
              <div className="max-h-[560px] overflow-y-auto">
                {data.players.map((p, i) => {
                  const key = p.userId != null ? "u" + p.userId : "n" + p.name;
                  const cls = getClassByID(p.class);
                  const icon = getClassIconUrl(p.class);
                  const active = selected === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(active ? null : key)}
                      className={`w-full card-row gap-2.5 text-left ${active ? "card-row-active" : ""}`}
                    >
                      <span className="text-[11px] font-mono text-bdo-text-secondary w-5 flex-shrink-0">
                        {i + 1}
                      </span>
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={icon} alt="" className="w-5 h-5 opacity-70 flex-shrink-0" />
                      ) : <span className="w-5 flex-shrink-0" />}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] text-bdo-text-primary truncate">{p.name}</span>
                          {p.guildTag && (
                            <span className="text-[9px] text-bdo-text-secondary flex-shrink-0">{p.guildTag}</span>
                          )}
                          {p.wars <= 2 && (
                            <span className="text-[9px] text-orange-400/70 flex-shrink-0"
                                  title="Az savaş — örneklem küçük">{p.wars} savaş</span>
                          )}
                        </div>
                        <span className="text-[10px] text-bdo-text-secondary">
                          {cls?.name ?? "—"}
                          {p.classRank ? ` · sınıfında ${p.classRank.rank}/${p.classRank.of}` : ""}
                        </span>
                      </div>

                      <div className="w-24 flex-shrink-0 hidden sm:block">
                        <PctBar pct={p.rating} />
                      </div>

                      {p.weaknesses.length > 0 && (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400/70 flex-shrink-0"
                                      strokeWidth={2} aria-label="Zayıf yön var" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Detay */}
            <div className="space-y-4">
              <Card className="p-4 lg:sticky lg:top-4">
                {sel ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {getClassIconUrl(sel.class) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getClassIconUrl(sel.class)} alt="" className="w-7 h-7 opacity-80" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-bold text-bdo-text-primary truncate">{sel.name}</h3>
                        <p className="text-[11px] text-bdo-text-secondary">
                          {getClassByID(sel.class)?.name ?? "—"}
                          {sel.spec ? ` · ${sel.spec === "succession" ? "Succ" : "Awak"}` : ""}
                          {sel.guildTag ? ` · ${sel.guildTag}` : ""}
                        </p>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="text-[20px] font-bold" style={{ color: pctColor(sel.rating) }}>
                          {sel.rating}
                        </div>
                        <div className="text-[9px] text-bdo-text-secondary">PUAN</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {METRIC_KEYS.map((k) => (
                        <div key={k}>
                          <PctBar pct={sel.metrics[k].pct} label={METRIC_WEIGHTS[k].label} />
                          <div className="text-[9px] text-bdo-text-secondary pl-[82px] -mt-0.5">
                            savaş başı {fmt(sel.metrics[k].avg)}
                            <span className="text-bdo-text-secondary/70">
                              {" · "}girdiği savaşların ortası {fmt(sel.metrics[k].baseline)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] text-bdo-text-secondary pt-1 border-t border-bdo-border">
                      {sel.wars} savaş
                      {sel.classRank && ` · ${getClassByID(sel.class)?.name} içinde ${sel.classRank.rank}/${sel.classRank.of}`}
                    </div>

                    {sel.strengths.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                        <span className="text-[11px] text-bdo-text-muted">
                          Güçlü: {sel.strengths.map((k) => METRIC_WEIGHTS[k].label).join(", ")}
                        </span>
                      </div>
                    )}
                    {sel.weaknesses.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" strokeWidth={2} />
                        <span className="text-[11px] text-bdo-text-muted">
                          Zayıf: {sel.weaknesses.map((k) => METRIC_WEIGHTS[k].label).join(", ")}
                        </span>
                      </div>
                    )}
                    {sel.wars <= 2 && (
                      <p className="text-[10px] text-orange-400/80">
                        Yalnızca {sel.wars} savaş — bu sayılardan kesin sonuç çıkarma.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[12px] text-bdo-text-muted leading-relaxed">
                    Listeden bir oyuncu seç. Her metrikte o savaşların medyanına göre nerede
                    durduğunu görürsün.
                  </p>
                )}
              </Card>

              {/* Class ortalamaları */}
              <Card>
                <CardHeader title="Class Ortalaması" icon={Swords} />
                <div className="max-h-56 overflow-y-auto">
                  {data.classAvg.map((c) => (
                    <div key={c.class} className="card-row gap-2">
                      {getClassIconUrl(c.class) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getClassIconUrl(c.class)} alt="" className="w-4 h-4 opacity-60" />
                      )}
                      <span className="text-[12px] text-bdo-text-primary flex-1 truncate">
                        {getClassByID(c.class)?.name ?? c.class}
                      </span>
                      <span className="text-[10px] text-bdo-text-secondary">{c.count}</span>
                      <span className="text-[12px] font-mono font-semibold w-8 text-right"
                            style={{ color: pctColor(c.rating) }}>{c.rating}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* AI yorumu */}
          <Card className="card-accent p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Sparkles className="w-4 h-4 text-bdo-gold" strokeWidth={1.75} />
              <span className="text-[13px] font-bold text-bdo-text-primary">AI Yorumu</span>
              <span className="text-[11px] text-bdo-text-secondary flex-1 min-w-[160px]">
                Hesaplanmış dilimleri yorumlar — sayıları yeniden hesaplamaz.
              </span>
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                placeholder="Özel soru (isteğe bağlı)"
                className="bg-bdo-bg border border-bdo-border rounded-lg px-3 py-1.5 text-[12px] text-bdo-text-primary placeholder-bdo-text-secondary focus:outline-none focus:border-bdo-gold/40 min-w-[180px]"
              />
              <Button variant="primary" size="sm" icon={aiBusy ? Loader2 : Sparkles}
                      onClick={askAi} disabled={aiBusy}>
                {aiBusy ? "Düşünüyor..." : "Analiz Ettir"}
              </Button>
            </div>

            {aiErr && <p className="text-[12px] text-red-400">{aiErr}</p>}

            {ai && (
              <div className="space-y-3">
                {/* Manşet */}
                <div className="bg-bdo-bg rounded-lg p-3 border border-bdo-border">
                  <p className="text-[14px] text-bdo-text-primary leading-snug">{ai.headline}</p>
                </div>

                {/* Güçlü / zayıf yönler */}
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { title: "Güçlü Yönler", items: ai.teamStrengths, color: "#2bca6e", Icon: TrendingUp },
                    { title: "Zayıf Yönler", items: ai.teamWeaknesses, color: "#e05252", Icon: TrendingDown },
                  ].map((box) => (
                    <div key={box.title} className="bg-bdo-bg rounded-lg p-3 border border-bdo-border">
                      <div className="flex items-center gap-1.5 mb-2">
                        <box.Icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color: box.color }} />
                        <span className="text-[11px] uppercase tracking-wider text-bdo-text-secondary">
                          {box.title}
                        </span>
                      </div>
                      <ul className="space-y-1">
                        {box.items.map((t, i) => (
                          <li key={i} className="flex gap-1.5 text-[12px] text-bdo-text-muted leading-snug">
                            <span style={{ color: box.color }}>•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Öne çıkanlar */}
                {ai.standouts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                      <span className="text-[11px] uppercase tracking-wider text-bdo-text-secondary">
                        Öne Çıkanlar
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {ai.standouts.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => focusPlayer(s.name)}
                          className="text-left bg-bdo-bg rounded-lg p-2.5 border border-emerald-500/20
                                     hover:border-emerald-500/45 transition-colors"
                        >
                          <div className="text-[13px] font-semibold text-emerald-400 mb-0.5">{s.name}</div>
                          <div className="text-[11px] text-bdo-text-muted leading-snug">{s.reason}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dikkat gerektirenler */}
                {ai.concerns.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-400" strokeWidth={2} />
                      <span className="text-[11px] uppercase tracking-wider text-bdo-text-secondary">
                        Dikkat Gerektirenler
                      </span>
                    </div>
                    <div className="space-y-2">
                      {ai.concerns.map((c, i) => {
                        const tone = c.severity === "high" ? "#e05252"
                          : c.severity === "medium" ? "#e09832" : "#7a8ba3";
                        return (
                          <button
                            key={i}
                            onClick={() => focusPlayer(c.name)}
                            className="w-full text-left bg-bdo-bg rounded-lg p-2.5 border transition-colors
                                       hover:border-bdo-border-2"
                            style={{ borderColor: tone + "33" }}
                          >
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tone }} />
                              <span className="text-[13px] font-semibold text-bdo-text-primary">{c.name}</span>
                              {c.role && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-bdo-surface-2 text-bdo-text-secondary">
                                  {c.role}
                                </span>
                              )}
                              {c.lowSample && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-400/10 text-orange-400/90"
                                      title="Örneklem küçük, kesin yargı için yeterli değil">
                                  az savaş
                                </span>
                              )}
                              <span className="text-[11px] text-bdo-text-secondary">{c.issue}</span>
                            </div>
                            <div className="flex gap-1.5 text-[11px] text-bdo-text-muted leading-snug pl-3.5">
                              <Lightbulb className="w-3 h-3 text-bdo-gold/70 flex-shrink-0 mt-0.5" strokeWidth={2} />
                              <span>{c.suggestion}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Class notları */}
                {ai.classNotes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Swords className="w-3.5 h-3.5 text-bdo-text-secondary" strokeWidth={2} />
                      <span className="text-[11px] uppercase tracking-wider text-bdo-text-secondary">
                        Class Değerlendirmesi
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {ai.classNotes.map((c, i) => (
                        <div key={i} className="bg-bdo-bg rounded-lg p-2.5 border border-bdo-border">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[12px] font-semibold text-bdo-text-primary">
                              {c.className}
                            </span>
                            {c.roleExpected && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-bdo-surface-2 text-bdo-text-secondary"
                                    title="Düşük puan class'ın rolünden kaynaklanıyor, oyuncudan değil">
                                rol gereği
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-bdo-text-muted leading-snug">{c.verdict}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Adımlar */}
                {ai.actions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Target className="w-3.5 h-3.5 text-bdo-gold" strokeWidth={2} />
                      <span className="text-[11px] uppercase tracking-wider text-bdo-text-secondary">
                        Somut Adımlar
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {ai.actions.map((a, i) => (
                        <div key={i} className="flex gap-2.5 bg-bdo-bg rounded-lg p-2.5 border border-bdo-border">
                          <span className="w-5 h-5 rounded-full bg-bdo-gold/12 text-bdo-gold text-[11px]
                                           font-bold grid place-items-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold text-bdo-text-primary">{a.title}</div>
                            <div className="text-[11px] text-bdo-text-muted leading-snug">{a.detail}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      {!data && !running && !error && (
        <Empty text="Savaş seç ve Analiz Et'e bas." />
      )}
    </div>
  );
}
