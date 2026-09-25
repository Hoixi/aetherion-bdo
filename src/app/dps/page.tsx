"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Crown, Search, ListOrdered, LayoutGrid, Table2, LineChart as LineIcon, ExternalLink,
  Info, Flame, Timer, Zap, ArrowUpDown, ChevronUp, ChevronDown, FileSpreadsheet, Lock,
} from "lucide-react";
import { TestShell, Card } from "@/components/app-shell";
import {
  OZET, RANKED, MAX_DPS, PREV_TAB, portrait, classIcon, trName, specMeta, aoeInfo, changeVs, ranksAt, totalChange,
  fmtInt, fmtK, fmtSec, type DpsSpec, type ClassStats, type SpecKind,
} from "@/lib/dps";
import {
  Face, SpecPill, ClassIcon, Delta, AoeMeter, DpsBar, Sparkline, LineChart, PALETTE, specStyle,
} from "./parcalar";
import "./dps.css";

/**
 * PvE DPS sıralaması.
 *
 * Netherax'ın topluluk tablosu (skill modifier bazlı, AP/-DP hariç) ve
 * class stat tablosu tek ekranda. Dört görünüm var çünkü aynı veriye dört
 * farklı soru soruluyor: "kim önde" (sıralama), "hangi class'ı oynasam"
 * (galeri), "neden önde" (statlar), "nereye gidiyor" (trend).
 */

type View = "sira" | "galeri" | "stat" | "trend";
type SpecFilter = "hepsi" | "awakening" | "succession" | "tek";
type SortKey = "dps" | "degisim" | "sure" | "aoe" | "hiz";

const MEDALS = ["#e8b451", "#cfd6e4", "#d08a55"];

function matchSpec(s: { spec: SpecKind }, f: SpecFilter) {
  if (f === "hepsi") return true;
  if (f === "tek") return s.spec === null;
  return s.spec === f;
}

export default function DpsPage() {
  const [view, setViewState] = useState<View>("sira");
  // Görünüm adreste dursun: "?v=stat" linki doğrudan tabloyu açsın
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("v");
    if (v === "galeri" || v === "stat" || v === "trend") setViewState(v);
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    const u = new URL(window.location.href);
    if (v === "sira") u.searchParams.delete("v"); else u.searchParams.set("v", v);
    window.history.replaceState(null, "", u.toString());
  };
  const [q, setQ] = useState("");
  const [spec, setSpec] = useState<SpecFilter>("hepsi");
  const [aoe, setAoe] = useState<string>("hepsi");
  const [sort, setSort] = useState<SortKey>("dps");
  // Değişim ve ▲/▼ hangi yama sekmesine göre — varsayılan tablonun kendi kıyası
  const [base, setBase] = useState<number>(PREV_TAB);
  const baseRanks = useMemo(() => ranksAt(base), [base]);
  const baseLabel = OZET.history.tabs[base]?.label ?? "";

  const shown = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    let out = RANKED.filter((s) => matchSpec(s, spec));
    if (aoe !== "hepsi") out = out.filter((s) => aoeInfo(s.aoe)?.bucket === aoe);
    if (needle) {
      out = out.filter((s) =>
        s.label.toLowerCase().includes(needle) || trName(s).toLocaleLowerCase("tr").includes(needle) ||
        (s.author ?? "").toLowerCase().includes(needle));
    }
    const key = (s: DpsSpec) =>
      sort === "degisim" ? changeVs(s.id, base)?.pct ?? -999
        : sort === "sure" ? -(s.time ?? 99)
          : sort === "aoe" ? aoeInfo(s.aoe)?.score ?? 0
            : sort === "hiz" ? s.atkSpeedBuff ?? 0
              : s.dps ?? 0;
    return [...out].sort((a, b) => key(b) - key(a) || (b.dps ?? 0) - (a.dps ?? 0));
  }, [q, spec, aoe, sort, base]);

  const missing = OZET.specs.filter((s) => s.dps === null);
  const movers = RANKED.map((s) => ({ s, c: changeVs(s.id, base) })).filter((x) => x.c && Math.abs(x.c.pct) >= 0.05);
  const topUp = [...movers].sort((a, b) => b.c!.pct - a.c!.pct)[0];
  const topDown = [...movers].sort((a, b) => a.c!.pct - b.c!.pct)[0];
  const median = RANKED[Math.floor(RANKED.length / 2)]?.dps ?? 0;
  const spread = ((RANKED[0].dps! - RANKED[RANKED.length - 1].dps!) / RANKED[RANKED.length - 1].dps!) * 100;

  return (
    <TestShell
      title="DPS Sıralaması"
      subtitle={<>PvE kombo DPS&apos;i, spec spec · <b style={{ color: "var(--t-text)" }}>{OZET.meta.tab}</b> yaması · {RANKED.length} sıralı spec</>}
      aside={
        <a href={OZET.sources.dps} target="_blank" rel="noreferrer" className="t-tab hidden md:flex">
          <FileSpreadsheet className="w-3.5 h-3.5" /> Kaynak
        </a>
      }
    >
      {/* Tablonun kendi manşeti — yamanın özeti tek cümlede */}
      {OZET.meta.banner && (
        <div className="flex items-center gap-2.5 text-[12.5px] px-4 py-2.5 rounded-xl"
             style={{ background: "var(--t-gold-soft)", border: "1px solid rgba(232,180,81,.25)" }}>
          <Flame className="w-4 h-4 flex-shrink-0" style={{ color: "var(--t-gold)" }} />
          <span style={{ color: "var(--t-text)" }}>{OZET.meta.banner}</span>
          <span className="ml-auto text-[11px] hidden sm:inline" style={{ color: "var(--t-faint)" }}>
            {OZET.meta.comparingTo && <>kıyas: {OZET.meta.comparingTo} · </>}{OZET.meta.maintainer?.replace("Maintained by", "hazırlayan:")}
          </span>
        </div>
      )}

      <Podium base={base} />

      {/* Hızlı bakış */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Fact icon={Crown} label="Zirve" value={fmtK(RANKED[0].dps)} sub={RANKED[0].label} />
        <Fact icon={ArrowUpDown} label="Medyan" value={fmtK(median)} sub={`uç farkı %${spread.toFixed(0)}`} />
        <Fact icon={ChevronUp} label={`Yükselen · kıyas ${baseLabel}`} tone="good"
              value={topUp ? `+${topUp.c!.pct.toFixed(2)}%` : "—"} sub={topUp ? topUp.s.label : "değişim yok"} />
        <Fact icon={ChevronDown} label={`Düşen · kıyas ${baseLabel}`} tone="bad"
              value={topDown && topDown.c!.pct < 0 ? `${topDown.c!.pct.toFixed(2)}%` : "—"} sub={topDown && topDown.c!.pct < 0 ? topDown.s.label : "düşüş yok"} />
        <Fact icon={FileSpreadsheet} label="Kapsam" value={`${RANKED.length}/${OZET.specs.length}`}
              sub={`${OZET.specs.filter((s) => s.detail).length} detaylı tablo`} />
      </div>

      {/* Görünüm + filtre */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
          {([
            ["sira", "Sıralama", ListOrdered], ["galeri", "Galeri", LayoutGrid],
            ["stat", "Class Statları", Table2], ["trend", "Yama Trendi", LineIcon],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} className="t-tab" data-on={view === k} onClick={() => setView(k)}>
              <Icon className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {(view === "sira" || view === "galeri") && (
          <>
            <div className="relative ml-auto">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--t-faint)" }} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Class, spec, yazar ara"
                     className="pl-9 pr-3 h-[34px] rounded-full text-[12px] w-[210px] outline-none"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
            </div>
            <Select value={spec} onChange={(v) => setSpec(v as SpecFilter)}
                    options={[["hepsi", "Tüm specler"], ["awakening", "Awakening"], ["succession", "Succession"], ["tek", "Tek spec"]]} />
            <Select value={aoe} onChange={setAoe}
                    options={[["hepsi", "Tüm AoE"], ["small", "Küçük AoE"], ["medium", "Orta AoE"], ["big", "Büyük AoE"]]} />
            <Select value={sort} onChange={(v) => setSort(v as SortKey)}
                    options={[["dps", "Sırala: DPS"], ["degisim", "Sırala: Değişim"], ["sure", "Sırala: Kısa kombo"], ["aoe", "Sırala: AoE"], ["hiz", "Sırala: Hız buff'ı"]]} />
            {view === "sira" && (
              <Select value={String(base)} onChange={(v) => setBase(+v)}
                      options={OZET.history.tabs.slice(0, -1).map((t, i) => [String(i), `Kıyas: ${t.label}`] as [string, string]).reverse()} />
            )}
          </>
        )}
      </div>

      {view === "sira" && <RankingList list={shown} base={base} baseRanks={baseRanks} />}
      {view === "galeri" && <Gallery list={shown} missing={spec === "hepsi" && !q && aoe === "hepsi" ? missing : []} />}
      {view === "stat" && <StatsTable />}
      {view === "trend" && <Trend />}

      {view === "sira" && missing.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-3.5 h-3.5" style={{ color: "var(--t-faint)" }} />
            <h3 className="text-[12.5px] font-semibold">Tabloda DPS değeri olmayan specler</h3>
            <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>· kimse kaliteli bir tablo göndermemiş ya da tablo dönüştürülmemiş</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {missing.map((s) => (
              <Link key={s.id} href={`/dps/${s.id}`}
                    className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors hover:bg-white/[.04]"
                    style={{ border: "1px solid var(--t-line)" }}>
                <div style={{ filter: "grayscale(.8)", opacity: 0.8 }}><Face s={s} size={26} round={99} /></div>
                <span className="text-[12px]" style={{ color: "var(--t-dim)" }}>{s.label}</span>
                {s.link && <FileSpreadsheet className="w-3 h-3" style={{ color: "var(--t-gold)" }} />}
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Notes />
      <div className="pb-6" />
    </TestShell>
  );
}

// ── Parçalar ─────────────────────────────────────────────────────────────

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
            className="h-[34px] rounded-full text-[12px] px-3 outline-none cursor-pointer"
            style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Fact({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: string; sub: string; tone?: "good" | "bad";
}) {
  const color = tone === "good" ? "var(--t-good)" : tone === "bad" ? "var(--t-bad)" : "var(--t-text)";
  return (
    <Card className="px-4 py-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>
        <Icon className="w-3 h-3" strokeWidth={2.2} /> {label}
      </div>
      <div className="text-[22px] font-bold t-num mt-1 leading-none" style={{ color }}>{value}</div>
      <div className="text-[11px] mt-1.5 truncate" style={{ color: "var(--t-dim)" }}>{sub}</div>
    </Card>
  );
}

/** İlk üç — ortada birinci, yüksek */
function Podium({ base }: { base: number }) {
  const top = RANKED.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  return (
    <div className="dps-podium">
      {order.map((s, k) => {
        const place = s === top[0] ? 0 : s === top[1] ? 1 : 2;
        const h = place === 0 ? 400 : place === 1 ? 340 : 310;
        const ch = changeVs(s.id, base);
        return (
          <Link key={s.id} href={`/dps/${s.id}`} className="dps-pod"
                style={{ height: h, ["--medal" as string]: MEDALS[place] }}>
            <div className="dps-pod-img">
              <Image src={portrait(s)} alt={s.label} fill priority sizes="(max-width: 768px) 100vw, 480px" />
            </div>
            <div className="dps-pod-rank">{place + 1}</div>
            {place === 0 && <div className="dps-pod-crown"><Crown className="w-4 h-4" strokeWidth={2.4} /></div>}
            <div className="absolute inset-x-0 bottom-0 p-5">
              <div className="flex items-center gap-2">
                <ClassIcon src={classIcon(s)} size={22} className="opacity-90" />
                <SpecPill spec={s.spec} />
                {ch && <span className="ml-auto"><Delta pct={ch.pct} hideFlat title={`${ch.from} yamasına göre`} /></span>}
              </div>
              <div className={`${place === 0 ? "text-[26px]" : "text-[21px]"} font-bold tracking-tight mt-2 leading-tight`}>{s.label}</div>
              <div className="text-[11.5px] mt-0.5 truncate" style={{ color: "var(--t-dim)" }}>{s.sequence}</div>
              <div className="flex items-end gap-2 mt-3">
                <span className={`${place === 0 ? "text-[40px]" : "text-[32px]"} font-black t-num leading-none`}
                      style={{ color: MEDALS[place], textShadow: `0 0 28px ${MEDALS[place]}55` }}>
                  {fmtInt(s.dps)}
                </span>
                <span className="text-[11px] mb-1 font-semibold tracking-wider" style={{ color: "var(--t-faint)" }}>DPS</span>
              </div>
              <div className="flex items-center gap-3 mt-2.5 text-[11px]" style={{ color: "var(--t-dim)" }}>
                <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{fmtSec(s.time)}</span>
                <AoeMeter aoe={s.aoe} />
                {s.atkSpeedBuff ? <span className="flex items-center gap-1"><Zap className="w-3 h-3" />%{Math.round(s.atkSpeedBuff * 100)} hız</span> : null}
              </div>
            </div>
            <span className="sr-only">{k}</span>
          </Link>
        );
      })}
    </div>
  );
}

function RankingList({ list, base, baseRanks }: { list: DpsSpec[]; base: number; baseRanks: Record<string, number> }) {
  if (!list.length) return <Card className="p-10 text-center text-[13px]" ><span style={{ color: "var(--t-dim)" }}>Filtreye uyan spec yok.</span></Card>;
  const baseLabel = OZET.history.tabs[base]?.label;
  return (
    <Card className="overflow-hidden">
      <div className="dps-row !py-2.5 text-[10px] uppercase tracking-[0.08em] font-semibold hidden md:grid"
           style={{ color: "var(--t-faint)", background: "rgba(255,255,255,.015)" }}>
        <span>#</span><span /><span>Spec</span><span>DPS (en yükseğe göre)</span><span className="text-right">kıyas: {baseLabel}</span>
      </div>
      {list.map((s, i) => {
        const m = specMeta(s.spec);
        const ch = changeVs(s.id, base);
        const prev = baseRanks[s.id];
        const move = prev && s.rank ? prev - s.rank : 0;
        const pct = ((s.dps ?? 0) / MAX_DPS) * 100;
        const beforePct = s.dpsBefore && s.dpsBefore !== s.dps ? (s.dpsBefore / MAX_DPS) * 100 : undefined;
        return (
          <Link key={s.id} href={`/dps/${s.id}`} className="dps-row" style={specStyle(s.spec)}>
            <div className="text-center">
              <div className="text-[15px] font-bold t-num" style={{ color: (s.rank ?? 99) <= 3 ? MEDALS[(s.rank ?? 1) - 1] : "var(--t-text)" }}>
                {s.rank}
              </div>
              {move !== 0 && (
                <div className="text-[9.5px] font-bold t-num" style={{ color: move > 0 ? "var(--t-good)" : "var(--t-bad)" }}>
                  {move > 0 ? "▲" : "▼"}{Math.abs(move)}
                </div>
              )}
            </div>
            <Face s={s} size={46} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <ClassIcon src={classIcon(s)} size={15} className="opacity-70" />
                <span className="text-[13.5px] font-semibold truncate">{s.label}</span>
                <SpecPill spec={s.spec} />
              </div>
              <div className="flex items-center gap-2 mt-1 text-[11px] min-w-0" style={{ color: "var(--t-faint)" }}>
                <span className="truncate" title={s.sequence ?? ""}>{s.sequence}</span>
              </div>
            </div>
            <div className="dps-row-bar min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0"><DpsBar pct={pct} spec={s.spec} ghostPct={beforePct} delay={Math.min(i, 20) * 25} /></div>
                <span className="text-[14px] font-bold t-num w-[74px] text-right" style={{ color: m.color }}>{fmtInt(s.dps)}</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10.5px] flex-wrap" style={{ color: "var(--t-faint)" }}>
                <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{fmtSec(s.time)}</span>
                <AoeMeter aoe={s.aoe} />
                <span className="flex items-center gap-1"><Zap className="w-3 h-3" />%{Math.round((s.atkSpeedBuff ?? 0) * 100)}</span>
                {s.comment && <span className="truncate max-w-[220px] italic" title={s.notes.comment ?? s.comment}>“{s.comment}”</span>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              {ch ? <Delta pct={ch.pct} hideFlat title={`${ch.from} yamasına göre`} />
                : <span className="text-[10.5px]" style={{ color: "var(--t-faint)" }} title="Kıyas sekmesinde bu satır yok">yeni</span>}
              <Sparkline values={OZET.history.values[s.id] ?? []} color={m.color} width={84} height={22} />
            </div>
          </Link>
        );
      })}
    </Card>
  );
}

function Gallery({ list, missing }: { list: DpsSpec[]; missing: DpsSpec[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {[...list, ...missing].map((s) => {
        const m = specMeta(s.spec);
        const has = s.dps !== null;
        return (
          <Link key={s.id} href={`/dps/${s.id}`} className={`dps-tile ${has ? "" : "muted"}`} style={specStyle(s.spec)}>
            <Image src={portrait(s)} alt={s.label} fill sizes="(max-width: 640px) 50vw, 240px" className="dps-tile-img" />
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between">
              <span className="text-[12px] font-black t-num px-2 py-0.5 rounded-md"
                    style={{ background: "rgba(0,0,0,.55)", color: has && (s.rank ?? 9) <= 3 ? MEDALS[(s.rank ?? 1) - 1] : "var(--t-text)", backdropFilter: "blur(6px)" }}>
                {has ? `#${s.rank}` : "—"}
              </span>
              <ClassIcon src={classIcon(s)} size={20} className="opacity-85 drop-shadow" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-3">
              <SpecPill spec={s.spec} />
              <div className="text-[13.5px] font-bold leading-tight mt-1.5">{s.label}</div>
              {has ? (
                <>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-[20px] font-black t-num" style={{ color: m.color }}>{fmtK(s.dps)}</span>
                    <span className="text-[9.5px] font-semibold" style={{ color: "var(--t-faint)" }}>DPS</span>
                  </div>
                  <div className="mt-1.5"><DpsBar pct={((s.dps ?? 0) / MAX_DPS) * 100} spec={s.spec} thin /></div>
                </>
              ) : (
                <div className="text-[11px] mt-1" style={{ color: "var(--t-faint)" }}>Veri yok</div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Class statları ───────────────────────────────────────────────────────

type StatRow = { id: string; label: string; classId: string | null; spec: SpecKind; stats: ClassStats; dps: number | null; href: string };

const STAT_COLS: { key: string; label: string; title: string; get: (s: ClassStats) => number | null; heat?: boolean; pct?: boolean }[] = [
  { key: "base", label: "Temel", title: "Seviye 63 temel AP", get: (s) => s.baseAp },
  { key: "passive", label: "Pasif", title: "Pasif AP", get: (s) => s.passive },
  { key: "self", label: "Selfbuff", title: "Kendi buff'ı (AP)", get: (s) => s.selfbuff },
  { key: "total", label: "Toplam", title: "Her zaman açık toplam AP", get: (s) => s.total, heat: true },
  { key: "e", label: "E Buff", title: "E buff'ı (AP)", get: (s) => s.eBuff },
  { key: "totalE", label: "Top. (E)", title: "E buff'ı ile toplam AP", get: (s) => s.totalE, heat: true },
  { key: "dp", label: "-DP", title: "Rakip DP düşürme", get: (s) => s.dp },
  { key: "totalDp", label: "Top. -DP", title: "Her zaman açık toplam + -DP", get: (s) => s.totalDp, heat: true },
  { key: "totalEDp", label: "Top. E+DP", title: "E buff'ı ve -DP ile toplam", get: (s) => s.totalEDp, heat: true },
  { key: "as", label: "Hız", title: "Saldırı/büyü hızı (pasif + selfbuff + E)", get: (s) => s.atkSpeed.reduce((a, b) => a + b, 0), pct: true },
  { key: "cd", label: "Krit Hasar", title: "Kritik hasar (pasif + selfbuff + E)", get: (s) => s.critDmg.reduce((a, b) => a + b, 0), pct: true },
  { key: "cr", label: "Krit Oranı", title: "Kritik oranı (en yüksek kaynak)", get: (s) => Math.max(...s.critRate), pct: true },
];

function StatsTable() {
  const [sortKey, setSortKey] = useState("totalEDp");
  const [dir, setDir] = useState<1 | -1>(-1);
  const [spec, setSpec] = useState<SpecFilter>("hepsi");

  const rows: StatRow[] = useMemo(() => {
    const seen = new Set<string>();
    const out: StatRow[] = [];
    for (const s of OZET.specs) {
      if (!s.stats || seen.has(s.label)) continue;
      seen.add(s.label);
      out.push({ id: s.id, label: s.label, classId: s.classId, spec: s.spec, stats: s.stats, dps: s.dps, href: `/dps/${s.id}` });
    }
    for (const s of OZET.statsOnly) out.push({ id: s.slug, label: s.label, classId: s.classId, spec: s.spec, stats: s.stats, dps: null, href: "#" });
    return out;
  }, []);

  const ranges = useMemo(() => Object.fromEntries(STAT_COLS.map((c) => {
    const vals = rows.map((r) => c.get(r.stats)).filter((v): v is number => v !== null);
    return [c.key, [Math.min(...vals), Math.max(...vals)]];
  })), [rows]);

  const sorted = useMemo(() => {
    const col = STAT_COLS.find((c) => c.key === sortKey);
    const get = (r: StatRow) => sortKey === "dps" ? r.dps ?? -1 : sortKey === "label" ? 0 : col?.get(r.stats) ?? -1;
    return rows.filter((r) => matchSpec(r, spec)).sort((a, b) =>
      sortKey === "label" ? dir * -a.label.localeCompare(b.label) : dir * (get(a) - get(b)) || a.label.localeCompare(b.label));
  }, [rows, sortKey, dir, spec]);

  const clickSort = (k: string) => { if (k === sortKey) setDir((d) => (d === 1 ? -1 : 1)); else { setSortKey(k); setDir(-1); } };

  const Th = ({ k, children, title, left }: { k: string; children: React.ReactNode; title?: string; left?: boolean }) => (
    <th title={title} onClick={() => clickSort(k)}
        className={`px-2.5 py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap ${left ? "text-left" : "text-right"}`}
        style={{ color: sortKey === k ? "var(--t-gold)" : "var(--t-faint)" }}>
      {children}{sortKey === k && (dir === -1 ? " ↓" : " ↑")}
    </th>
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <Table2 className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
        <h2 className="text-[14px] font-semibold">Class Stat & Buff Tablosu</h2>
        <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>AP değerleri seviye 63 · yüzdeler pasif + selfbuff + E toplamı · başlığa tıkla, sırala</span>
        <div className="ml-auto flex gap-1">
          {(["hepsi", "awakening", "succession", "tek"] as const).map((f) => (
            <button key={f} className="t-tab" data-on={spec === f} onClick={() => setSpec(f)}>
              {f === "hepsi" ? "Hepsi" : f === "tek" ? "Tek" : specMeta(f).short}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto dps-scroll">
        <table className="w-full text-[12px] t-num">
          <thead className="text-[10px] uppercase tracking-[0.06em]" style={{ background: "rgba(255,255,255,.015)" }}>
            <tr>
              <Th k="label" left>Spec</Th>
              <Th k="dps" title="Özet tablosundaki kombo DPS'i">DPS</Th>
              {STAT_COLS.map((c) => <Th key={c.key} k={c.key} title={c.title}>{c.label}</Th>)}
              <th className="px-2.5 py-2.5 text-left font-semibold" style={{ color: "var(--t-faint)" }}>Ek</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className="t-row">
                <td className="px-2.5 py-1.5">
                  <Link href={r.href} className="flex items-center gap-2 min-w-[190px] hover:text-[var(--t-gold)]">
                    <Face s={r} size={28} round={8} />
                    <span className="font-medium truncate">{r.label}</span>
                    <SpecPill spec={r.spec} />
                  </Link>
                </td>
                <td className="px-2.5 text-right font-semibold" style={{ color: r.dps ? specMeta(r.spec).color : "var(--t-faint)" }}>
                  {r.dps ? fmtK(r.dps) : "—"}
                </td>
                {STAT_COLS.map((c) => {
                  const v = c.get(r.stats);
                  const [lo, hi] = ranges[c.key];
                  const t = v === null || hi === lo ? 0 : (v - lo) / (hi - lo);
                  const heat = c.heat || c.pct;
                  return (
                    <td key={c.key} className="px-2.5 text-right"
                        style={{
                          color: v ? (heat ? `color-mix(in srgb, var(--t-gold) ${Math.round(t * 100)}%, var(--t-dim))` : "var(--t-text)") : "var(--t-faint)",
                          background: heat && v ? `rgba(232,180,81,${(t * 0.13).toFixed(3)})` : undefined,
                          fontWeight: c.heat ? 700 : 500,
                        }}>
                      {v === null ? "—" : c.pct ? (v ? `%${Math.round(v)}` : "—") : v}
                    </td>
                  );
                })}
                <td className="px-2.5 text-[11px] max-w-[260px] truncate" style={{ color: "var(--t-dim)" }} title={r.stats.extra ?? ""}>
                  {r.stats.extra ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 text-[11px] flex items-center gap-2" style={{ borderTop: "1px solid var(--t-line)", color: "var(--t-faint)" }}>
        <Info className="w-3 h-3" /> Kaynak: <a href={OZET.sources.stats} target="_blank" rel="noreferrer" className="underline hover:text-[var(--t-gold)]">Class Stats/Buffs</a>
      </div>
    </Card>
  );
}

// ── Trend ────────────────────────────────────────────────────────────────

function Trend() {
  const [picked, setPicked] = useState<string[]>(() => RANKED.slice(0, 5).map((s) => s.id));
  const labels = OZET.history.tabs.map((t) => t.label);
  const series = picked.map((id, i) => {
    const s = OZET.specs.find((x) => x.id === id)!;
    return { id, label: s.label + (s.id.endsWith("-2") ? " (AoE)" : ""), color: PALETTE[i % PALETTE.length], values: OZET.history.values[id] ?? [] };
  });
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 10 ? p : [...p, id]));

  const longMovers = RANKED.map((s) => ({ s, c: totalChange(s.id) })).filter((x) => x.c).sort((a, b) => b.c!.pct - a.c!.pct);
  const presets: [string, string[]][] = [
    ["İlk 5", RANKED.slice(0, 5).map((s) => s.id)],
    ["En çok değişen", [...longMovers].sort((a, b) => Math.abs(b.c!.pct) - Math.abs(a.c!.pct)).slice(0, 6).map((x) => x.s.id)],
    ["Awakening ilk 5", RANKED.filter((s) => s.spec === "awakening").slice(0, 5).map((s) => s.id)],
    ["Succession ilk 5", RANKED.filter((s) => s.spec === "succession").slice(0, 5).map((s) => s.id)],
    ["Son 5", RANKED.slice(-5).map((s) => s.id)],
  ];
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));

  return (
    <div className="grid xl:grid-cols-[1fr_340px] gap-4">
      <Card className="p-4 min-w-0">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <LineIcon className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
          <h2 className="text-[14px] font-semibold">Yama yama DPS</h2>
          <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>en fazla 10 spec · noktanın üstüne gel</span>
          <div className="ml-auto flex items-center gap-1 flex-wrap">
            {presets.map(([label, ids]) => (
              <button key={label} className="t-tab" data-on={same(picked, ids)} onClick={() => setPicked(ids)}>{label}</button>
            ))}
            <button className="t-tab" onClick={() => setPicked([])}>Temizle</button>
          </div>
        </div>
        {series.length ? <LineChart series={series} labels={labels} height={340} />
          : <div className="h-[340px] grid place-items-center text-[12px]" style={{ color: "var(--t-faint)" }}>Aşağıdan spec seç.</div>}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {RANKED.map((s) => {
            const on = picked.indexOf(s.id);
            const color = on >= 0 ? PALETTE[on % PALETTE.length] : undefined;
            return (
              <button key={s.id} onClick={() => toggle(s.id)}
                      className="flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 rounded-full text-[11px] transition-colors"
                      style={{
                        border: `1px solid ${color ?? "var(--t-line)"}`,
                        background: color ? color + "1c" : "transparent",
                        color: color ? "var(--t-text)" : "var(--t-dim)",
                      }}>
                <Face s={s} size={20} round={99} />
                {s.label}{s.id.endsWith("-2") ? " (AoE)" : ""}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
          <ArrowUpDown className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
          <h2 className="text-[14px] font-semibold">Uzun vadede</h2>
          <span className="text-[11px] ml-auto" style={{ color: "var(--t-faint)" }}>ilk kayıttan bugüne</span>
        </div>
        <div className="max-h-[560px] overflow-y-auto dps-scroll">
          {longMovers.map(({ s, c }) => (
            <Link key={s.id} href={`/dps/${s.id}`} className="t-row flex items-center gap-2.5 px-4 py-2">
              <Face s={s} size={30} round={9} />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium truncate">{s.label}</div>
                <div className="text-[10.5px]" style={{ color: "var(--t-faint)" }}>{c!.from} → {OZET.meta.tab}</div>
              </div>
              <Sparkline values={OZET.history.values[s.id]} color={c!.pct >= 0 ? "#38d07f" : "#ef5f5f"} width={60} height={20} />
              <span className="w-[62px] text-right"><Delta pct={c!.pct} /></span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── Notlar ───────────────────────────────────────────────────────────────

function Notes() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4" style={{ color: "var(--t-gold)" }} />
        <h3 className="text-[13.5px] font-semibold">Bu sayıları nasıl okumalı?</h3>
      </div>
      <ul className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-[12px]" style={{ color: "var(--t-dim)" }}>
        <li>• DPS, becerilerin <b style={{ color: "var(--t-text)" }}>skill modifier</b> hasarından hesaplanıyor; AP ve -DP dahil değil.</li>
        <li>• Kombolar 7–10 sn civarı, gerçekçi ve tekrar edilebilir seçilmeye çalışılıyor; uzun süreli DPS&apos;i tam yansıtmaz.</li>
        <li>• <b style={{ color: "var(--t-text)" }}>AoE</b> gerçek grind DPS&apos;inde çok belirleyici; küçük alanlı specler kalabalıkta hasar kaybeder.</li>
        <li>• Kara Tapınak (BSR) buff&apos;ı hesaba katılmıyor; saldırı hızı buff&apos;ı olmayan classlar orada daha çok kazanır.</li>
        <li>• Taralı çubuk: tablodaki &quot;önceki DPS&quot; değeri (yama öncesi). Satırdaki eğri: tüm yama sekmeleri.</li>
        <li>• Kısaca: yol gösterici bir kıyas, kesin sıralama değil.</li>
      </ul>
      <div className="mt-4 space-y-1.5">
        {OZET.meta.notes.filter((n) => n.note).map((n, i) => (
          <div key={i} className="rounded-[10px]" style={{ border: "1px solid var(--t-line)" }}>
            <button className="w-full text-left px-3 py-2 text-[11.5px] flex items-center gap-2" onClick={() => setOpen(open === i ? null : i)}
                    style={{ color: "var(--t-dim)" }}>
              <ChevronDown className="w-3 h-3 transition-transform" style={{ transform: open === i ? "rotate(180deg)" : undefined }} />
              <span className="italic">{n.title}</span>
              <span className="ml-auto text-[10px]" style={{ color: "var(--t-faint)" }}>orijinal not</span>
            </button>
            {open === i && <p className="px-3 pb-3 text-[11.5px] whitespace-pre-line" style={{ color: "var(--t-faint)" }}>{n.note}</p>}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 flex-wrap mt-4 pt-3 text-[11px]" style={{ borderTop: "1px solid var(--t-line)", color: "var(--t-faint)" }}>
        <a href={OZET.sources.dps} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[var(--t-gold)]">
          <ExternalLink className="w-3 h-3" /> DPS Summary
        </a>
        <a href={OZET.sources.stats} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[var(--t-gold)]">
          <ExternalLink className="w-3 h-3" /> Class Stats/Buffs
        </a>
        {OZET.meta.maintainer && <span>{OZET.meta.maintainer.replace("Maintained by", "Tabloyu hazırlayan:")}</span>}
        <span className="ml-auto">Veri çekildi: {new Date(OZET.generatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
      </div>
    </Card>
  );
}
