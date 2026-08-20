"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart3, Sparkles, Check, Shield, Users, Swords, Skull, Castle,
  TrendingDown, TrendingUp, Loader2, AlertTriangle, Target, Lightbulb,
} from "lucide-react";
import { getClassByID, getClassIconUrl } from "@/lib/classes";
import { METRIC_WEIGHTS, METRIC_KEYS, type PlayerAnalysis } from "@/lib/war-analysis";
import { TestShell, Card, Head, Empty, fmt } from "@/components/test-shell";

/**
 * Savaş analizi.
 *
 * Sayılar mutlak değil, savaş içi yüzdelik dilim: 50 o savaşın medyanı.
 * Böylece kalabalık bir savaşla küçük bir savaş aynı ölçekte kıyaslanıyor.
 * AI kısmı sadece bu dilimleri yorumluyor, kendi hesabını yapmıyor.
 */

type WarRow = { id: number; title: string; type: string; date: string; result: string | null };

type AiReport = {
  headline: string;
  teamStrengths: string[];
  teamWeaknesses: string[];
  standouts: { name: string; reason: string }[];
  concerns: {
    name: string; role?: string; issue: string; suggestion: string;
    severity: "high" | "medium" | "low"; lowSample: boolean;
  }[];
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

/** 50 nötr; aşağısı kırmızıya, yukarısı yeşile gidiyor */
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
      {label && (
        <span className="text-[10px] w-[74px] flex-shrink-0" style={{ color: "var(--t-faint)" }}>{label}</span>
      )}
      <div className="flex-1 h-1.5 rounded-full overflow-hidden min-w-[40px]"
           style={{ background: "var(--t-raised)" }}>
        <div className="h-full rounded-full transition-all"
             style={{ width: Math.max(2, pct) + "%", background: color }} />
      </div>
      <span className="t-num text-[10px] font-semibold w-7 text-right flex-shrink-0" style={{ color }}>
        {Math.round(pct)}
      </span>
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
        // Son 5 savaş varsayılan; tek savaşta dilimler oynak oluyor
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

  /** AI bir isimden bahsedince listedeki oyuncuya bağlanabilsin */
  function focusPlayer(name: string) {
    const p = data?.players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (p) setSelected(p.userId != null ? "u" + p.userId : "n" + p.name);
  }

  const sel = useMemo(
    () => data?.players.find((p) => (p.userId != null ? "u" + p.userId : "n" + p.name) === selected) ?? null,
    [data, selected],
  );

  if (status === "loading" || loading) {
    return <TestShell title="Savaş Analizi" subtitle="Yükleniyor…"><Empty>Savaşlar geliyor…</Empty></TestShell>;
  }
  if (!session?.user.canManageWars) {
    return (
      <TestShell title="Savaş Analizi" subtitle="Yetki gerekiyor">
        <Empty>Bu ekran yalnızca savaş yöneticileri içindir.</Empty>
      </TestShell>
    );
  }

  return (
    <TestShell
      title="Savaş Analizi"
      subtitle="Seçtiğin savaşları iki klan için birlikte inceler. Sayılar savaş içi yüzdelik dilimdir — 50 o savaşın medyanı."
      aside={data ? <span className="t-chip hidden sm:inline">{data.players.length} oyuncu</span> : null}
    >
      {/* ── Savaş seçimi ───────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
            Savaş seç ({picked.size})
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Ghost onClick={() => setPicked(new Set(wars.slice(0, 5).map((w) => w.id)))}>Son 5</Ghost>
            <Ghost onClick={() => setPicked(new Set(wars.map((w) => w.id)))}>Hepsi</Ghost>
            <Ghost onClick={() => setExcludeDefense((v) => !v)} icon={Shield}>
              {excludeDefense ? "Savunma hariç" : "Savunma dahil"}
            </Ghost>
            <button onClick={run} disabled={running || picked.size === 0}
                    className="text-[12px] font-semibold px-3 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-45"
                    style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                             border: "1px solid rgba(232,180,81,.3)" }}>
              <BarChart3 className="w-3.5 h-3.5" strokeWidth={2} />
              {running ? "Analiz ediliyor…" : "Analiz et"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
          {wars.map((w) => {
            const on = picked.has(w.id);
            return (
              <button key={w.id}
                      onClick={() => setPicked((prev) => {
                        const next = new Set(prev);
                        if (next.has(w.id)) next.delete(w.id); else next.add(w.id);
                        return next;
                      })}
                      className="text-[11px] px-2 py-1 rounded-[var(--t-r-sm)] transition-colors"
                      style={on
                        ? { color: "var(--t-text)", background: "var(--t-gold-soft)", border: "1px solid rgba(232,180,81,.4)" }
                        : { color: "var(--t-faint)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                {w.title}
                <span className="ml-1.5" style={{ color: "var(--t-faint)" }}>
                  {new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {error && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{error}</p></Card>}

      {data && (
        <>
          {/* ── Toplamlar ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { icon: Swords, label: "Toplam Hasar", value: fmt(data.totals.damageDealt), color: "#e8b451" },
              { icon: Castle, label: "Kale Hasarı", value: fmt(data.totals.castleDamage), color: "#f0994c" },
              { icon: Check, label: "Kill", value: String(data.totals.kills), color: "var(--t-text)" },
              { icon: Skull, label: "Ölüm", value: String(data.totals.deaths), color: "#ef5f5f" },
              { icon: Users, label: "Oyuncu", value: String(data.players.length), color: "#6b93ff" },
            ].map((s) => (
              <Card key={s.label} className="p-3.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <s.icon className="w-3 h-3" strokeWidth={2} style={{ color: s.color }} />
                  <span className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
                    {s.label}
                  </span>
                </div>
                <div className="t-num text-[20px] font-bold leading-none" style={{ color: s.color }}>
                  {s.value}
                </div>
              </Card>
            ))}
          </div>

          {data.excludedCount > 0 && (
            <p className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
              {data.excludedCount} savunma kaydı analiz dışında tutuldu — savunmadakiler farklı iş
              yapıyor, hasarları saldırıyla kıyaslanamaz.
            </p>
          )}

          <div className="grid lg:grid-cols-[1fr_340px] gap-4">
            {/* ── Oyuncu listesi ───────────────────────────────────── */}
            <Card className="overflow-hidden">
              <Head icon={Users} title="Oyuncular" meta={`${data.players.length} KİŞİ`} />
              <div className="max-h-[560px] overflow-y-auto">
                {data.players.map((p, i) => {
                  const key = p.userId != null ? "u" + p.userId : "n" + p.name;
                  const cls = getClassByID(p.class);
                  const icon = getClassIconUrl(p.class);
                  const active = selected === key;
                  return (
                    <button key={key} onClick={() => setSelected(active ? null : key)}
                            className="t-row w-full px-5 py-2.5 flex items-center gap-2.5 text-left"
                            style={active ? { background: "var(--t-gold-soft)" } : undefined}>
                      <span className="t-num text-[11px] w-5 flex-shrink-0" style={{ color: "var(--t-faint)" }}>
                        {i + 1}
                      </span>
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={icon} alt="" className="w-5 h-5 opacity-70 flex-shrink-0" />
                      ) : <span className="w-5 flex-shrink-0" />}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] truncate">{p.name}</span>
                          {p.guildTag && (
                            <span className="text-[9px] flex-shrink-0" style={{ color: "var(--t-faint)" }}>
                              {p.guildTag}
                            </span>
                          )}
                          {p.wars <= 2 && (
                            <span className="text-[9px] flex-shrink-0" style={{ color: "#e09832" }}
                                  title="Az savaş — örneklem küçük">
                              {p.wars} savaş
                            </span>
                          )}
                        </div>
                        <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                          {cls?.name ?? "—"}
                          {p.classRank ? ` · sınıfında ${p.classRank.rank}/${p.classRank.of}` : ""}
                        </span>
                      </div>

                      <div className="w-24 flex-shrink-0 hidden sm:block">
                        <PctBar pct={p.rating} />
                      </div>

                      {p.weaknesses.length > 0 && (
                        <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2}
                                      style={{ color: "#ef5f5f" }} aria-label="Zayıf yön var" />
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* ── Seçilen oyuncu + class ortalaması ────────────────── */}
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
                        <h3 className="text-[15px] font-bold truncate">{sel.name}</h3>
                        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                          {getClassByID(sel.class)?.name ?? "—"}
                          {sel.spec ? ` · ${sel.spec === "succession" ? "Succ" : "Awak"}` : ""}
                          {sel.guildTag ? ` · ${sel.guildTag}` : ""}
                        </p>
                      </div>
                      <div className="ml-auto text-right">
                        <div className="t-num text-[22px] font-bold leading-none"
                             style={{ color: pctColor(sel.rating) }}>
                          {sel.rating}
                        </div>
                        <div className="text-[9px] mt-1" style={{ color: "var(--t-faint)" }}>PUAN</div>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1">
                      {METRIC_KEYS.map((k) => (
                        <div key={k}>
                          <PctBar pct={sel.metrics[k].pct} label={METRIC_WEIGHTS[k].label} />
                          <div className="text-[9px] pl-[82px] -mt-0.5" style={{ color: "var(--t-faint)" }}>
                            savaş başı {fmt(sel.metrics[k].avg)} · girdiği savaşların ortası{" "}
                            {fmt(sel.metrics[k].baseline)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-[11px] pt-2" style={{ color: "var(--t-faint)", borderTop: "1px solid var(--t-line)" }}>
                      {sel.wars} savaş
                      {sel.classRank && ` · ${getClassByID(sel.class)?.name} içinde ${sel.classRank.rank}/${sel.classRank.of}`}
                    </div>

                    {sel.strengths.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" strokeWidth={2}
                                    style={{ color: "var(--t-good)" }} />
                        <span className="text-[11px]" style={{ color: "var(--t-dim)" }}>
                          Güçlü: {sel.strengths.map((k) => METRIC_WEIGHTS[k].label).join(", ")}
                        </span>
                      </div>
                    )}
                    {sel.weaknesses.length > 0 && (
                      <div className="flex items-start gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" strokeWidth={2}
                                      style={{ color: "var(--t-bad)" }} />
                        <span className="text-[11px]" style={{ color: "var(--t-dim)" }}>
                          Zayıf: {sel.weaknesses.map((k) => METRIC_WEIGHTS[k].label).join(", ")}
                        </span>
                      </div>
                    )}
                    {sel.wars <= 2 && (
                      <p className="text-[10px]" style={{ color: "#e09832" }}>
                        Yalnızca {sel.wars} savaş — bu sayılardan kesin sonuç çıkarma.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--t-dim)" }}>
                    Listeden bir oyuncu seç. Her metrikte o savaşların medyanına göre nerede
                    durduğunu görürsün.
                  </p>
                )}
              </Card>

              <Card className="overflow-hidden">
                <Head icon={Swords} title="Class Ortalaması" />
                <div className="max-h-56 overflow-y-auto">
                  {data.classAvg.map((c) => (
                    <div key={c.class} className="t-row px-5 py-2 flex items-center gap-2">
                      {getClassIconUrl(c.class) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getClassIconUrl(c.class)} alt="" className="w-4 h-4 opacity-60" />
                      )}
                      <span className="text-[12px] flex-1 truncate">
                        {getClassByID(c.class)?.name ?? c.class}
                      </span>
                      <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>{c.count}</span>
                      <span className="t-num text-[12px] font-semibold w-8 text-right"
                            style={{ color: pctColor(c.rating) }}>
                        {c.rating}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {/* ── AI yorumu ──────────────────────────────────────────── */}
          <Card hi className="p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Sparkles className="w-4 h-4" strokeWidth={1.8} style={{ color: "var(--t-gold)" }} />
              <span className="text-[13.5px] font-bold">AI Yorumu</span>
              <span className="text-[11.5px] flex-1 min-w-[160px]" style={{ color: "var(--t-faint)" }}>
                Hesaplanmış dilimleri yorumlar — sayıları yeniden hesaplamaz.
              </span>
              <input value={focus} onChange={(e) => setFocus(e.target.value)}
                     placeholder="Özel soru (isteğe bağlı)"
                     className="h-[32px] px-3 rounded-[var(--t-r-sm)] text-[12px] outline-none min-w-[180px]"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
              <button onClick={askAi} disabled={aiBusy}
                      className="text-[12px] font-semibold px-3 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5 disabled:opacity-50"
                      style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                               border: "1px solid rgba(232,180,81,.3)" }}>
                {aiBusy
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                  : <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />}
                {aiBusy ? "Düşünüyor…" : "Analiz ettir"}
              </button>
            </div>

            {aiErr && <p className="text-[12px]" style={{ color: "var(--t-bad)" }}>{aiErr}</p>}

            {ai && (
              <div className="space-y-3">
                <Box>
                  <p className="text-[14px] leading-snug">{ai.headline}</p>
                </Box>

                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { title: "Güçlü Yönler", items: ai.teamStrengths, color: "#2bca6e", Icon: TrendingUp },
                    { title: "Zayıf Yönler", items: ai.teamWeaknesses, color: "#e05252", Icon: TrendingDown },
                  ].map((box) => (
                    <Box key={box.title}>
                      <Label icon={box.Icon} color={box.color}>{box.title}</Label>
                      <ul className="space-y-1">
                        {box.items.map((t, i) => (
                          <li key={i} className="flex gap-1.5 text-[12px] leading-snug"
                              style={{ color: "var(--t-dim)" }}>
                            <span style={{ color: box.color }}>•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  ))}
                </div>

                {ai.standouts.length > 0 && (
                  <div>
                    <Label icon={TrendingUp} color="#2bca6e">Öne Çıkanlar</Label>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {ai.standouts.map((s, i) => (
                        <button key={i} onClick={() => focusPlayer(s.name)}
                                className="text-left p-2.5 rounded-[var(--t-r-sm)] transition-colors"
                                style={{ background: "var(--t-raised)", border: "1px solid rgba(43,202,110,.22)" }}>
                          <div className="text-[13px] font-semibold mb-0.5" style={{ color: "#2bca6e" }}>
                            {s.name}
                          </div>
                          <div className="text-[11px] leading-snug" style={{ color: "var(--t-dim)" }}>
                            {s.reason}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {ai.concerns.length > 0 && (
                  <div>
                    <Label icon={AlertTriangle} color="#e09832">Dikkat Gerektirenler</Label>
                    <div className="space-y-2">
                      {ai.concerns.map((c, i) => {
                        const tone = c.severity === "high" ? "#e05252"
                          : c.severity === "medium" ? "#e09832" : "#7a8ba3";
                        return (
                          <button key={i} onClick={() => focusPlayer(c.name)}
                                  className="w-full text-left p-2.5 rounded-[var(--t-r-sm)] transition-colors"
                                  style={{ background: "var(--t-raised)", border: `1px solid ${tone}33` }}>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: tone }} />
                              <span className="text-[13px] font-semibold">{c.name}</span>
                              {c.role && (
                                <span className="t-chip">{c.role}</span>
                              )}
                              {c.lowSample && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded"
                                      style={{ color: "#e09832", background: "rgba(224,152,50,.12)" }}
                                      title="Örneklem küçük, kesin yargı için yeterli değil">
                                  az savaş
                                </span>
                              )}
                              <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>{c.issue}</span>
                            </div>
                            <div className="flex gap-1.5 text-[11px] leading-snug pl-3.5"
                                 style={{ color: "var(--t-dim)" }}>
                              <Lightbulb className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2}
                                         style={{ color: "var(--t-gold)" }} />
                              <span>{c.suggestion}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {ai.classNotes.length > 0 && (
                  <div>
                    <Label icon={Swords} color="var(--t-dim)">Class Değerlendirmesi</Label>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {ai.classNotes.map((c, i) => (
                        <Box key={i}>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[12px] font-semibold">{c.className}</span>
                            {c.roleExpected && (
                              <span className="t-chip"
                                    title="Düşük puan class'ın rolünden kaynaklanıyor, oyuncudan değil">
                                rol gereği
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] leading-snug" style={{ color: "var(--t-dim)" }}>
                            {c.verdict}
                          </div>
                        </Box>
                      ))}
                    </div>
                  </div>
                )}

                {ai.actions.length > 0 && (
                  <div>
                    <Label icon={Target} color="var(--t-gold)">Somut Adımlar</Label>
                    <div className="space-y-1.5">
                      {ai.actions.map((a, i) => (
                        <div key={i} className="flex gap-2.5 p-2.5 rounded-[var(--t-r-sm)]"
                             style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                          <span className="w-5 h-5 rounded-full text-[11px] font-bold grid place-items-center flex-shrink-0"
                                style={{ background: "var(--t-gold-soft)", color: "var(--t-gold)" }}>
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[12px] font-semibold">{a.title}</div>
                            <div className="text-[11px] leading-snug" style={{ color: "var(--t-dim)" }}>
                              {a.detail}
                            </div>
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

      {!data && !running && !error && <Empty>Savaş seç ve &quot;Analiz et&quot;e bas.</Empty>}

      <div className="pb-6" />
    </TestShell>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function Ghost({ onClick, icon: Icon, children }: {
  onClick: () => void; icon?: React.ElementType; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
            className="text-[12px] font-semibold px-2.5 h-[32px] rounded-[var(--t-r-sm)] inline-flex items-center gap-1.5"
            style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={2} />}
      {children}
    </button>
  );
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-3 rounded-[var(--t-r-sm)]"
         style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      {children}
    </div>
  );
}

function Label({ icon: Icon, color, children }: {
  icon: React.ElementType; color: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className="w-3.5 h-3.5" strokeWidth={2} style={{ color }} />
      <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>
        {children}
      </span>
    </div>
  );
}
