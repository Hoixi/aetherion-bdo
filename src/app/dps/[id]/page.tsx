"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Timer, Zap, Swords, Flame, Layers, Search,
  LineChart as LineIcon, Shield, MessageSquareQuote, FileSpreadsheet, Lock, Crosshair, Sparkles, User,
} from "lucide-react";
import { TestShell, Card, Empty } from "@/components/app-shell";
import {
  OZET, RANKED, MAX_DPS, portrait, classIcon, classType, trName, specMeta, lastChange,
  fmtInt, fmtK, fmtSec, normName, type DpsDetay, type DpsRow, type DpsSpec, type ClassStats,
} from "@/lib/dps";
import { getClassBannerUrl } from "@/lib/classes";
import { SpecPill, ClassIcon, Delta, AoeMeter, DpsBar, LineChart, Face, specStyle } from "../parcalar";
import "../dps.css";

/**
 * Tek spec'in DPS dökümü: özet tablodaki satır + class'ın kendi DPS
 * tablosundan çekilen kombolar ve beceri beceri hasar/kare/DPS.
 */

export default function DpsDetayPage() {
  const { id } = useParams<{ id: string }>();
  const s = OZET.specs.find((x) => x.id === id);
  const [det, setDet] = useState<DpsDetay | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!s?.detail) return;
    setDet(null);
    fetch(`/veri/dps/${s.id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDet)
      .catch(() => setErr(true));
  }, [s?.id, s?.detail]);

  if (!s) {
    return (
      <TestShell title="DPS">
        <Empty>Bu spec tabloda yok. <Link href="/dps" className="underline">Sıralamaya dön</Link></Empty>
      </TestShell>
    );
  }

  const idx = RANKED.findIndex((x) => x.id === s.id);
  const prev = idx > 0 ? RANKED[idx - 1] : null;
  const next = idx >= 0 && idx < RANKED.length - 1 ? RANKED[idx + 1] : null;

  return (
    <TestShell title={`${s.label} DPS`} bare>
      <div className="space-y-5 pt-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/dps" className="t-tab"><ArrowLeft className="w-3.5 h-3.5" /> Sıralama</Link>
          <div className="ml-auto flex items-center gap-2">
            {prev && <NavLink s={prev} dir="prev" />}
            {next && <NavLink s={next} dir="next" />}
          </div>
        </div>

        <Hero s={s} />

        <div className="grid xl:grid-cols-[minmax(0,1fr)_380px] gap-5">
          <div className="space-y-5 min-w-0">
            {s.detail && !det && !err && <Empty>Class tablosu yükleniyor…</Empty>}
            {err && <Empty>Detay dosyası yüklenemedi.</Empty>}
            {!s.detail && <NoDetail s={s} />}
            {det && <MainCombo s={s} det={det} />}
            {det && det.combos.length > 0 && <Combos s={s} det={det} />}
            {det && det.skills.length > 0 && <Skills s={s} rows={det.skills} />}
          </div>
          <div className="space-y-5">
            {s.dps !== null && <History s={s} />}
            {s.stats && <Stats s={s} st={s.stats} />}
            <Notes s={s} />
          </div>
        </div>
        <div className="pb-6" />
      </div>
    </TestShell>
  );
}

function NavLink({ s, dir }: { s: DpsSpec; dir: "prev" | "next" }) {
  return (
    <Link href={`/dps/${s.id}`} className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-[11.5px] transition-colors hover:bg-white/[.04]"
          style={{ border: "1px solid var(--t-line)", color: "var(--t-dim)" }}>
      {dir === "prev" && <ChevronLeft className="w-3.5 h-3.5" />}
      <Face s={s} size={22} round={99} />
      <span className="hidden sm:inline">#{s.rank} {s.label}</span>
      {dir === "next" && <ChevronRight className="w-3.5 h-3.5" />}
    </Link>
  );
}

// ── Hero ─────────────────────────────────────────────────────────────────

function Hero({ s }: { s: DpsSpec }) {
  const m = specMeta(s.spec);
  const ct = classType(s);
  const ch = lastChange(s.id);
  const pct = s.dps ? (s.dps / MAX_DPS) * 100 : 0;
  const gap = s.dps && s.rank && s.rank > 1 ? MAX_DPS - s.dps : null;
  return (
    <div className="dps-hero" style={specStyle(s.spec)}>
      {ct !== null && (
        <div className="dps-hero-bg">
          <Image src={getClassBannerUrl(ct)} alt="" fill sizes="100vw" />
        </div>
      )}
      <div className="dps-hero-portrait">
        <Image src={portrait(s)} alt={s.label} fill priority sizes="(max-width: 768px) 100vw, 520px" />
      </div>

      <div className="relative p-6 md:p-8 max-w-[680px]">
        <div className="flex items-center gap-2.5">
          <div className="w-11 h-11 rounded-xl grid place-items-center"
               style={{ background: `color-mix(in srgb, ${m.color} 16%, rgba(0,0,0,.5))`, border: `1px solid ${m.color}55` }}>
            <ClassIcon src={classIcon(s)} size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <SpecPill spec={s.spec} />
              {s.completeness && <span className="t-chip">{s.completeness}</span>}
            </div>
            <div className="text-[11px] mt-1" style={{ color: "var(--t-faint)" }}>{trName(s)} · {m.label}</div>
          </div>
        </div>

        <h1 className="text-[34px] md:text-[44px] font-black tracking-tight leading-none mt-5">{s.label}</h1>

        {s.dps !== null ? (
          <>
            <div className="flex items-end gap-4 mt-5 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: "var(--t-faint)" }}>Kombo DPS</div>
                <div className="text-[52px] md:text-[64px] font-black t-num leading-none"
                     style={{ color: m.color, textShadow: `0 0 40px ${m.color}44` }}>{fmtInt(s.dps)}</div>
              </div>
              <div className="pb-2 space-y-1">
                <div className="text-[26px] font-black t-num leading-none">#{s.rank}<span className="text-[13px] font-semibold" style={{ color: "var(--t-faint)" }}> / {RANKED.length}</span></div>
                {ch && <Delta pct={ch.pct} size="md" title={`${ch.from} yamasına göre`} />}
              </div>
            </div>
            <div className="mt-4 max-w-[460px]">
              <DpsBar pct={pct} spec={s.spec} />
              <div className="flex justify-between text-[10.5px] mt-1.5" style={{ color: "var(--t-faint)" }}>
                <span>zirvenin %{pct.toFixed(1)}&apos;i</span>
                {gap ? <span>birinciye {fmtInt(gap)} DPS</span> : <span style={{ color: "var(--t-gold)" }}>zirvede</span>}
              </div>
            </div>
          </>
        ) : (
          <div className="mt-5 flex items-center gap-2 text-[13px]" style={{ color: "var(--t-dim)" }}>
            <Lock className="w-4 h-4" /> Bu spec için özet tabloda DPS değeri yok.
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-6 max-w-[620px]">
          <Mini icon={Timer} label="Kombo süresi" value={fmtSec(s.time)} />
          <Mini icon={Flame} label="Toplam hasar" value={s.damage ? fmtK(s.damage) : "—"} />
          <Mini icon={Zap} label="Hız buff'ı" value={s.atkSpeedBuff !== null ? `%${Math.round(s.atkSpeedBuff * 100)}` : "—"} />
          <div className="rounded-xl px-3 py-2" style={{ background: "rgba(0,0,0,.45)", border: "1px solid var(--t-line)", backdropFilter: "blur(6px)" }}>
            <div className="text-[9.5px] uppercase tracking-[0.1em]" style={{ color: "var(--t-faint)" }}>AoE profili</div>
            <div className="mt-1"><AoeMeter aoe={s.aoe} /></div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-5 text-[11.5px] flex-wrap" style={{ color: "var(--t-dim)" }}>
          {s.author && <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {s.author}</span>}
          {s.frames && <span className="t-num">{fmtInt(s.frames)} kare</span>}
          {s.critDmg && <span className="t-num">krit hasar %{(s.critDmg * 100).toFixed(1)}</span>}
          {s.link && (
            <a href={s.link} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[var(--t-gold)]">
              <FileSpreadsheet className="w-3.5 h-3.5" /> {s.sheet ?? "Tablo"} <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "rgba(0,0,0,.45)", border: "1px solid var(--t-line)", backdropFilter: "blur(6px)" }}>
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-[0.1em]" style={{ color: "var(--t-faint)" }}>
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-[16px] font-bold t-num mt-0.5">{value}</div>
    </div>
  );
}

function SectionHead({ icon: Icon, title, meta, children }: {
  icon: React.ElementType; title: string; meta?: React.ReactNode; children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-3.5 flex-wrap" style={{ borderBottom: "1px solid var(--t-line)" }}>
      <Icon className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
      <h2 className="text-[14px] font-semibold">{title}</h2>
      {meta && <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>{meta}</span>}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

function NoDetail({ s }: { s: DpsSpec }) {
  return (
    <Card className="p-8 text-center">
      <Lock className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--t-faint)" }} />
      <p className="text-[13px]" style={{ color: "var(--t-dim)" }}>
        {s.private ? "Bu class'ın DPS tablosu paylaşıma kapalı; beceri dökümü çekilemedi."
          : s.link ? "Bu class'ın tablosu özet formatına dönüştürülmemiş; beceri dökümü çıkarılamadı."
            : "Bu spec için henüz bir DPS tablosu yok."}
      </p>
      {s.link && (
        <a href={s.link} target="_blank" rel="noreferrer" className="t-tab inline-flex mt-4" data-on>
          <ExternalLink className="w-3.5 h-3.5" /> Tabloyu aç
        </a>
      )}
    </Card>
  );
}

// ── Ana kombo: zaman çizelgesi ───────────────────────────────────────────

type Step = { name: string; skill: DpsRow | null };

function matchSkill(name: string, skills: DpsRow[]): DpsRow | null {
  const n = normName(name).replace(/^(p|prime|preawk|awk|succ)\s+/, "");
  if (!n) return null;
  const pool = skills.map((k) => ({ k, n: normName(k.name).replace(/^(p|prime|preawk|awk|succ)\s+/, "") }));
  return pool.find((p) => p.n === n)?.k
    ?? pool.find((p) => p.n.startsWith(n) || n.startsWith(p.n))?.k
    ?? pool.find((p) => p.n.includes(n) || (p.n.length > 6 && n.includes(p.n)))?.k
    ?? null;
}

function MainCombo({ s, det }: { s: DpsSpec; det: DpsDetay }) {
  const combo = det.combos.find((c) => c.summary) ?? det.combos[0];
  const steps: Step[] = useMemo(() => {
    if (combo?.steps?.length) {
      return combo.steps.map((st) => ({ name: st.name, skill: { ...st, frames: null } }));
    }
    const lines = (s.notes.sequence ?? "").split("\n").map((l) => l.trim().replace(/,$/, ""))
      .filter((l) => l && !/^note:/i.test(l) && l.length < 90);
    return lines.map((l) => ({ name: l, skill: matchSkill(l, det.skills) }));
  }, [combo, s.notes.sequence, det.skills]);

  if (!combo && !steps.length) return null;
  const known = steps.filter((x) => x.skill?.time);
  // Renk yoğunluğu adımlar arasındaki sıraya göre — tek bir uç değer
  // (ör. 0.1 sn'lik iptal) bütün şeridi soluk bırakmasın
  const sortedDps = known.map((x) => x.skill!.dps ?? 0).sort((a, b) => a - b);
  const heatOf = (d: number) => sortedDps.length < 2 ? 0.6 : 0.12 + 0.88 * (sortedDps.filter((v) => v < d).length / (sortedDps.length - 1));
  const totalT = known.reduce((a, x) => a + (x.skill!.time ?? 0), 0);
  const avgT = known.length ? totalT / known.length : 0.5;
  const matched = known.length;

  return (
    <Card hi className="overflow-hidden" >
      <SectionHead icon={Crosshair} title="Özet Kombosu" meta={combo?.name ?? s.sequence} />
      <div className="p-5" style={specStyle(s.spec)}>
        {combo && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <Big label="DPS" value={fmtInt(combo.dps)} color={specMeta(s.spec).color} />
            <Big label="Toplam hasar" value={fmtInt(combo.damage)} />
            <Big label="Süre" value={fmtSec(combo.time)} />
            <Big label="BSR DPS" value={combo.bsrDps ? fmtInt(combo.bsrDps) : "—"} sub={combo.bsrDps && combo.dps ? `+%${(((combo.bsrDps - combo.dps) / combo.dps) * 100).toFixed(1)}` : undefined} />
          </div>
        )}

        {steps.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2 text-[10.5px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>
              <Layers className="w-3 h-3" /> Beceri sırası
              <span className="normal-case tracking-normal">· genişlik = süre, renk yoğunluğu = beceri DPS&apos;i{matched < steps.length ? ` · ${matched}/${steps.length} adım eşleşti` : ""}</span>
            </div>
            <div className="dps-timeline">
              {steps.map((st, i) => {
                const t = st.skill?.time ?? avgT;
                const heat = st.skill?.dps ? heatOf(st.skill.dps) : 0;
                return (
                  <div key={i} style={{ flexGrow: t, flexBasis: 0, ["--heat" as string]: heat, opacity: st.skill ? 1 : 0.45, borderStyle: st.skill ? "solid" : "dashed" }}
                       className="overflow-hidden"
                       title={`${i + 1}. ${st.name}${st.skill ? `\n${fmtInt(st.skill.damage)} hasar · ${fmtSec(st.skill.time)} · ${fmtInt(st.skill.dps)} DPS` : "\n(tabloda eşleşmedi)"}`}>
                    <span className="absolute left-1.5 top-1 text-[9.5px] font-bold t-num" style={{ color: "rgba(255,255,255,.85)" }}>{i + 1}</span>
                    <span className="absolute left-1.5 right-1 bottom-1 text-[9.5px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                          style={{ color: "rgba(255,255,255,.8)" }}>{st.name}</span>
                  </div>
                );
              })}
            </div>
            <ol className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-4">
              {steps.map((st, i) => (
                <li key={i} className="flex items-center gap-2 text-[12px] py-1" style={{ borderBottom: "1px dashed var(--t-line)" }}>
                  <span className="w-5 text-[10px] font-bold t-num text-right" style={{ color: "var(--t-faint)" }}>{i + 1}</span>
                  <span className="truncate flex-1" style={{ color: st.skill ? "var(--t-text)" : "var(--t-dim)" }} title={st.name}>{st.name}</span>
                  {st.skill?.input && <span className="dps-key hidden md:inline-flex">{st.skill.input}</span>}
                  {st.skill?.dps && <span className="text-[11px] t-num w-[52px] text-right" style={{ color: "var(--t-dim)" }}>{fmtK(st.skill.dps)}</span>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </Card>
  );
}

function Big({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="rounded-xl px-3.5 py-2.5" style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      <div className="text-[9.5px] uppercase tracking-[0.1em]" style={{ color: "var(--t-faint)" }}>{label}</div>
      <div className="text-[20px] font-bold t-num mt-0.5 leading-tight" style={{ color }}>{value}</div>
      {sub && <div className="text-[10.5px] t-num" style={{ color: "var(--t-good)" }}>{sub}</div>}
    </div>
  );
}

// ── Kombolar ─────────────────────────────────────────────────────────────

function Combos({ s, det }: { s: DpsSpec; det: DpsDetay }) {
  const [open, setOpen] = useState<string | null>(null);
  const list = [...det.combos].sort((a, b) => (b.dps ?? 0) - (a.dps ?? 0));
  const max = Math.max(...list.map((c) => Math.max(c.dps ?? 0, c.bsrDps ?? 0)));
  const hasBsr = list.some((c) => c.bsrDps);
  return (
    <Card className="overflow-hidden">
      <SectionHead icon={Swords} title="Tablodaki Kombolar" meta={`${list.length} kombo · sekme: ${det.tab}`}>
        {hasBsr && (
          <span className="flex items-center gap-3 text-[10.5px]" style={{ color: "var(--t-faint)" }}>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: specMeta(s.spec).color }} /> Normal</span>
            <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "#c38bff" }} /> BSR</span>
          </span>
        )}
      </SectionHead>
      <div>
        {list.map((c) => {
          const isOpen = open === c.name;
          return (
            <div key={c.name} className="t-row px-5 py-3" style={specStyle(s.spec)}>
              <button className="w-full text-left" onClick={() => c.steps && setOpen(isOpen ? null : c.name)}
                      style={{ cursor: c.steps ? "pointer" : "default" }}>
                <div className="flex items-center gap-2">
                  {c.summary && <span className="t-chip" style={{ color: "var(--t-gold)", borderColor: "rgba(232,180,81,.4)" }}>Özette</span>}
                  <span className="text-[13px] font-medium truncate flex-1">{c.name}</span>
                  <span className="text-[11px] t-num" style={{ color: "var(--t-faint)" }}>{fmtSec(c.time)}</span>
                  <span className="text-[14px] font-bold t-num w-[76px] text-right" style={{ color: specMeta(s.spec).color }}>{fmtInt(c.dps)}</span>
                </div>
                <div className="mt-2 space-y-1">
                  <DpsBar pct={((c.dps ?? 0) / max) * 100} spec={s.spec} thin />
                  {c.bsrDps && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1"><div className="dps-bar thin" style={{ ["--spec" as string]: "#c38bff" }}><i style={{ width: `${(c.bsrDps / max) * 100}%` }} /></div></div>
                      <span className="text-[10.5px] t-num w-[76px] text-right" style={{ color: "#c38bff" }}>{fmtInt(c.bsrDps)}</span>
                    </div>
                  )}
                </div>
                {c.steps && (
                  <div className="text-[10.5px] mt-1.5" style={{ color: "var(--t-faint)" }}>
                    {isOpen ? "▲ adımları gizle" : `▼ ${c.steps.length} adımı göster`}
                  </div>
                )}
              </button>
              {isOpen && c.steps && (
                <div className="mt-2 grid sm:grid-cols-2 gap-x-6">
                  {c.steps.map((st, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11.5px] py-1" style={{ borderBottom: "1px dashed var(--t-line)" }}>
                      <span className="w-4 text-[10px] t-num" style={{ color: "var(--t-faint)" }}>{i + 1}</span>
                      <span className="truncate flex-1">{st.name}</span>
                      <span className="t-num" style={{ color: "var(--t-dim)" }}>{fmtK(st.dps)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Beceriler ────────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  prime: "#e8b451", preawk: "#9a9aa2", awakening: "#ff7a45", succession: "#7aa2ff", mainhand: "#38d07f",
};

function Skills({ s, rows }: { s: DpsSpec; rows: DpsRow[] }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("hepsi");
  const [bsr, setBsr] = useState(false);
  const [all, setAll] = useState(false);
  const [sortBy, setSortBy] = useState<"dps" | "damage" | "time">("dps");
  const types = Array.from(new Set(rows.map((r) => r.type).filter(Boolean))) as string[];
  const hasBsr = rows.some((r) => r.bsrDps);
  const val = (r: DpsRow) => (bsr && r.bsrDps ? r.bsrDps : r.dps) ?? 0;

  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows
      .filter((r) => type === "hepsi" || r.type === type)
      .filter((r) => !n || r.name.toLowerCase().includes(n) || (r.input ?? "").toLowerCase().includes(n))
      .sort((a, b) => sortBy === "damage" ? (b.damage ?? 0) - (a.damage ?? 0) : sortBy === "time" ? (a.time ?? 99) - (b.time ?? 99) : val(b) - val(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, type, bsr, sortBy]);
  const max = Math.max(1, ...rows.map(val));
  const visible = all ? list : list.slice(0, 25);

  return (
    <Card className="overflow-hidden">
      <SectionHead icon={Sparkles} title="Beceri Dökümü" meta={`${rows.length} beceri/zincir`}>
        {hasBsr && (
          <button className="t-tab" data-on={bsr} onClick={() => setBsr((v) => !v)}>
            <Flame className="w-3.5 h-3.5" /> BSR
          </button>
        )}
      </SectionHead>
      <div className="flex items-center gap-2 px-5 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--t-faint)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Beceri veya tuş ara"
                 className="pl-9 pr-3 h-[32px] rounded-full text-[12px] w-[200px] outline-none"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
        </div>
        {types.length > 1 && (
          <>
            <button className="t-tab" data-on={type === "hepsi"} onClick={() => setType("hepsi")}>Hepsi</button>
            {types.map((t) => (
              <button key={t} className="t-tab" data-on={type === t} onClick={() => setType(t)}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLOR[t.toLowerCase()] ?? "#9a9aa2" }} />{t}
              </button>
            ))}
          </>
        )}
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="ml-auto h-[32px] rounded-full text-[12px] px-3 outline-none cursor-pointer"
                style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }}>
          <option value="dps">DPS&apos;e göre</option>
          <option value="damage">Hasara göre</option>
          <option value="time">Süreye göre (kısa)</option>
        </select>
      </div>
      <div className="overflow-x-auto dps-scroll">
        <table className="w-full text-[12px]">
          <thead className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)", background: "rgba(255,255,255,.015)" }}>
            <tr>
              <th className="text-left px-5 py-2 font-semibold">Beceri</th>
              <th className="text-left px-2 py-2 font-semibold">Tuş</th>
              <th className="text-right px-2 py-2 font-semibold">Hasar</th>
              <th className="text-right px-2 py-2 font-semibold">Kare</th>
              <th className="text-right px-2 py-2 font-semibold">Süre</th>
              <th className="text-left px-2 py-2 font-semibold w-[34%]">{bsr ? "BSR DPS" : "DPS"}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => {
              const tc = r.type ? TYPE_COLOR[r.type.toLowerCase()] ?? "#9a9aa2" : null;
              return (
                <tr key={r.name + i} className="t-row">
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-2 min-w-[220px]">
                      {tc && <span className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: tc }} title={r.type} />}
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-[340px]" title={r.name}>{r.name}</div>
                        {r.type && <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>{r.type}{r.crit !== undefined ? ` · krit %${Math.round(r.crit * 100)}` : ""}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-2">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(r.input ?? "").split(/\s*(?:->|>|→)\s*/).filter(Boolean).slice(0, 4).map((k, j) => <span key={j} className="dps-key">{k}</span>)}
                    </div>
                  </td>
                  <td className="px-2 text-right t-num" style={{ color: "var(--t-dim)" }}>{fmtInt(r.damage)}</td>
                  <td className="px-2 text-right t-num" style={{ color: "var(--t-faint)" }}>{r.frames ?? "—"}</td>
                  <td className="px-2 text-right t-num" style={{ color: "var(--t-dim)" }}>{r.time?.toFixed(2) ?? "—"}</td>
                  <td className="px-2 pr-5">
                    <div className="flex items-center gap-2.5" style={specStyle(s.spec, bsr ? { ["--spec" as string]: "#c38bff" } : undefined)}>
                      <div className="flex-1 min-w-[80px]"><DpsBar pct={(val(r) / max) * 100} spec={s.spec} thin delay={Math.min(i, 20) * 20} /></div>
                      <span className="t-num font-semibold w-[64px] text-right" style={{ color: val(r) >= (s.dps ?? Infinity) ? (bsr ? "#c38bff" : specMeta(s.spec).color) : "var(--t-text)" }}>
                        {fmtInt(val(r))}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 px-5 py-2.5 text-[11px]" style={{ borderTop: "1px solid var(--t-line)", color: "var(--t-faint)" }}>
        <span>Renkli DPS: özet kombosundan ({fmtInt(s.dps)}) yüksek olan beceriler</span>
        {list.length > 25 && (
          <button className="ml-auto t-tab" onClick={() => setAll((v) => !v)}>{all ? "Daha az" : `Tümü (${list.length})`}</button>
        )}
      </div>
    </Card>
  );
}

// ── Yan sütun ────────────────────────────────────────────────────────────

function History({ s }: { s: DpsSpec }) {
  const values = OZET.history.values[s.id] ?? [];
  const labels = OZET.history.tabs.map((t) => t.label);
  const ranks = OZET.history.tabs.map((_, i) => {
    const v = values[i];
    if (v === null || v === undefined) return null;
    return OZET.specs.filter((o) => (OZET.history.values[o.id]?.[i] ?? -1) > v).length + 1;
  });
  const color = specMeta(s.spec).color;
  const rows = labels.map((l, i) => ({ l, v: values[i], r: ranks[i], note: OZET.history.tabs[i].note })).filter((x) => x.v !== null).reverse();
  return (
    <Card className="overflow-hidden">
      <SectionHead icon={LineIcon} title="Yama Geçmişi" meta={`${rows.length} kayıt`} />
      <div className="px-3 pt-3">
        <LineChart series={[{ id: s.id, label: s.label, color, values }]} labels={labels} height={220} />
      </div>
      <div className="max-h-[260px] overflow-y-auto dps-scroll">
        {rows.map((x, i) => {
          const older = rows[i + 1];
          const d = older?.v ? ((x.v! - older.v) / older.v) * 100 : null;
          return (
            <div key={x.l} className="t-row flex items-center gap-2 px-5 py-1.5 text-[11.5px]">
              <span className="w-[92px] truncate" style={{ color: "var(--t-dim)" }} title={x.note ?? ""}>{x.l}</span>
              <span className="text-[10.5px] t-num w-[34px]" style={{ color: "var(--t-faint)" }}>#{x.r}</span>
              <span className="flex-1 text-right t-num font-semibold">{fmtInt(x.v)}</span>
              <span className="w-[58px] text-right">{d !== null && <Delta pct={d} />}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Stats({ s, st }: { s: DpsSpec; st: ClassStats }) {
  const segs = [
    { label: "Temel", v: st.baseAp ?? 0, c: "#4a4a52" },
    { label: "Pasif", v: st.passive, c: "#8a7240" },
    { label: `Selfbuff${st.selfbuffType ? ` (${st.selfbuffType})` : ""}`, v: st.selfbuff, c: "#e8b451" },
    { label: `E Buff${st.eBuffType ? ` (${st.eBuffType})` : ""}`, v: st.eBuff, c: "#f07a3c" },
    { label: `-DP${st.dpType ? ` (${st.dpType})` : ""}`, v: st.dp, c: "#ef5f5f" },
  ];
  const all = OZET.specs.map((o) => o.stats?.totalEDp ?? 0).concat(OZET.statsOnly.map((o) => o.stats.totalEDp ?? 0));
  const maxTot = Math.max(...all);
  const total = segs.reduce((a, b) => a + b.v, 0);
  const rankTot = all.filter((v) => v > (st.totalEDp ?? 0)).length + 1;
  /**
   * Hız ve kritik hasar kaynakları üst üste biniyor (toplam). Kritik oranı
   * öyle değil: %100'de tavan, en yüksek kaynak belirleyici — orada toplamak
   * "%140" gibi anlamsız bir sayı çıkarıyordu.
   */
  const trip = (label: string, v: number[], color: string, mode: "sum" | "max" = "sum") => {
    const shown = mode === "sum" ? v.reduce((a, b) => a + b, 0) : Math.max(...v);
    const names = ["Pasif", "Selfbuff", "E Buff"];
    return (
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span style={{ color: "var(--t-dim)" }}>{label}</span>
          <span className="t-num font-semibold">{shown ? `%${Math.round(shown)}` : "—"}</span>
        </div>
        {mode === "sum" ? (
          <div className="flex h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.05)" }}>
            {v.map((x, i) => x > 0 && (
              <div key={i} style={{ width: `${Math.min(100, x)}%`, background: color, opacity: 1 - i * 0.28 }}
                   title={`${names[i]}: %${x}`} />
            ))}
          </div>
        ) : (
          <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.05)" }}>
            {v.map((x, i) => ({ x, i })).filter((o) => o.x > 0).sort((a, b) => b.x - a.x).map(({ x, i }) => (
              <div key={i} className="absolute inset-y-0 left-0 rounded-full"
                   style={{ width: `${Math.min(100, x)}%`, background: color, opacity: 1 - i * 0.28 }} title={`${names[i]}: %${x}`} />
            ))}
          </div>
        )}
        {shown > 0 && (
          <div className="flex gap-3 mt-1 text-[10px] t-num" style={{ color: "var(--t-faint)" }}>
            {v.map((x, i) => x > 0 && <span key={i}>{names[i]} %{x}</span>)}
          </div>
        )}
      </div>
    );
  };
  return (
    <Card className="overflow-hidden">
      <SectionHead icon={Shield} title="Class Statları" meta={`toplam AP sırası #${rankTot}`} />
      <div className="p-5 space-y-4">
        <div>
          <div className="flex items-end justify-between">
            <span className="text-[11px]" style={{ color: "var(--t-dim)" }}>AP + -DP (E buff&apos;lı)</span>
            <span className="text-[24px] font-black t-num leading-none" style={{ color: specMeta(s.spec).color }}>{st.totalEDp ?? total}</span>
          </div>
          <div className="flex h-3.5 rounded-full overflow-hidden mt-2" style={{ background: "rgba(255,255,255,.05)", width: `${(total / maxTot) * 100}%`, minWidth: "40%" }}>
            {segs.map((g) => g.v > 0 && <div key={g.label} style={{ flexGrow: g.v, background: g.c }} title={`${g.label}: ${g.v}`} />)}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3">
            {segs.map((g) => (
              <div key={g.label} className="flex items-center gap-1.5 text-[11px]">
                <span className="w-2 h-2 rounded-sm" style={{ background: g.c }} />
                <span className="truncate" style={{ color: "var(--t-dim)" }}>{g.label}</span>
                <span className="ml-auto t-num font-semibold">{g.v || "—"}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
            <div className="rounded-lg px-2.5 py-1.5" style={{ background: "var(--t-raised)" }}>
              <span style={{ color: "var(--t-faint)" }}>Her zaman</span> <b className="t-num float-right">{st.total}</b>
            </div>
            <div className="rounded-lg px-2.5 py-1.5" style={{ background: "var(--t-raised)" }}>
              <span style={{ color: "var(--t-faint)" }}>E ile</span> <b className="t-num float-right">{st.totalE}</b>
            </div>
          </div>
        </div>
        <div className="space-y-3 pt-1">
          {trip("Saldırı / büyü hızı", st.atkSpeed, "#7aa2ff")}
          {trip("Kritik hasar", st.critDmg, "#ff7a45")}
          {trip("Kritik oranı (en yüksek kaynak)", st.critRate, "#38d07f", "max")}
        </div>
        {st.extra && (
          <div className="text-[11.5px] rounded-lg px-3 py-2" style={{ background: "var(--t-gold-soft)", color: "var(--t-text)" }}>
            {st.extra}
          </div>
        )}
      </div>
    </Card>
  );
}

function Notes({ s }: { s: DpsSpec }) {
  const items = [
    s.notes.comment && { t: "Yazarın yorumu", v: s.notes.comment },
    s.notes.aoe && { t: `AoE (${s.aoe})`, v: s.notes.aoe },
    s.notes.atkSpeed && { t: "Saldırı hızı", v: s.notes.atkSpeed },
    s.notes.sheet && { t: "Tablo hakkında", v: s.notes.sheet },
    s.notes.dps && { t: "DPS", v: s.notes.dps },
  ].filter(Boolean) as { t: string; v: string }[];
  if (!items.length && !s.comment) return null;
  return (
    <Card className="overflow-hidden">
      <SectionHead icon={MessageSquareQuote} title="Notlar" meta="tablodan, orijinal dilinde" />
      <div className="p-5 space-y-3">
        {s.comment && (
          <div className="text-[15px] font-semibold italic" style={{ color: specMeta(s.spec).color }}>“{s.comment}”</div>
        )}
        {items.map((n) => (
          <div key={n.t}>
            <div className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: "var(--t-faint)" }}>{n.t}</div>
            <p className="text-[12px] whitespace-pre-line leading-relaxed" style={{ color: "var(--t-dim)" }}>{n.v}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
