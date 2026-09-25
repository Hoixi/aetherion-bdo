"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { aoeInfo, portrait, specMeta, fmtPct, type SpecKind } from "@/lib/dps";

/** Spec rengini alt parçalara değişkenle geçirmek için */
export function specStyle(spec: SpecKind, extra?: CSSProperties): CSSProperties {
  return { ["--spec" as string]: specMeta(spec).color, ...extra };
}

/** Portreden yüze yakın kırpılmış küçük resim */
export function Face({ s, size = 44, round = 12 }: {
  s: { classId: string | null; spec: SpecKind; label?: string }; size?: number; round?: number;
}) {
  const src = portrait(s);
  return (
    <div className="dps-face" style={{ width: size, height: size, borderRadius: round }}>
      {src && <Image src={src} alt={s.label ?? ""} fill sizes={`${size * 2}px`} />}
    </div>
  );
}

export function SpecPill({ spec }: { spec: SpecKind }) {
  const m = specMeta(spec);
  return <span className="dps-pill" style={specStyle(spec)}>{m.short}</span>;
}

export function ClassIcon({ src, size = 16, className = "" }: { src: string; size?: number; className?: string }) {
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} className={`flex-shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

/** Önceki yamaya göre değişim */
export function Delta({ pct, title, size = "sm", hideFlat = false }: {
  pct: number | null | undefined; title?: string; size?: "sm" | "md"; hideFlat?: boolean;
}) {
  if (pct === null || pct === undefined) return null;
  const flat = Math.abs(pct) < 0.05;
  if (flat && hideFlat) return null;
  const up = pct > 0;
  const color = flat ? "var(--t-faint)" : up ? "var(--t-good)" : "var(--t-bad)";
  const Icon = flat ? Minus : up ? TrendingUp : TrendingDown;
  return (
    <span title={title} className={`inline-flex items-center gap-1 t-num font-semibold ${size === "md" ? "text-[12.5px]" : "text-[11px]"}`}
          style={{ color }}>
      <Icon className={size === "md" ? "w-3.5 h-3.5" : "w-3 h-3"} strokeWidth={2.4} />
      {flat ? "0%" : fmtPct(pct, Math.abs(pct) < 1 ? 2 : 1)}
    </span>
  );
}

/** Üç halkalı AoE ölçeği */
export function AoeMeter({ aoe, showLabel = true }: { aoe: string | null; showLabel?: boolean }) {
  const info = aoeInfo(aoe);
  if (!info) return <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>—</span>;
  const radii = [3.2, 6.2, 9.2];
  return (
    <span className="dps-aoe" title={`AoE profili: ${aoe}`}>
      <svg width="22" height="22" viewBox="0 0 22 22">
        {radii.map((r, i) => {
          const fill = Math.max(0, Math.min(1, info.score - i));
          return (
            <circle key={i} cx="11" cy="11" r={r} fill="none" stroke="var(--t-gold)" strokeWidth={i === 0 ? 3 : 1.6}
                    opacity={0.14 + fill * 0.86} />
          );
        })}
      </svg>
      {showLabel && <span className="text-[11px] font-medium" style={{ color: "var(--t-dim)" }}>{info.label}</span>}
    </span>
  );
}

export function DpsBar({ pct, spec, ghostPct, thin = false, delay = 0 }: {
  pct: number; spec: SpecKind; ghostPct?: number; thin?: boolean; delay?: number;
}) {
  return (
    <div className={`dps-bar ${thin ? "thin" : ""}`} style={specStyle(spec)}>
      {ghostPct !== undefined && <b style={{ width: `${Math.max(0, Math.min(100, ghostPct))}%` }} />}
      <i style={{ width: `${Math.max(1.5, Math.min(100, pct))}%`, animationDelay: `${delay}ms` }} />
    </div>
  );
}

/** Küçük eğilim çizgisi — boş değerleri atlar */
export function Sparkline({ values, color, width = 90, height = 26 }: {
  values: (number | null)[]; color: string; width?: number; height?: number;
}) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <span className="text-[10px]" style={{ color: "var(--t-faint)" }}>—</span>;
  const min = Math.min(...pts.map((p) => p.v)), max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * (width - 4) + 2;
  const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
      <circle cx={x(last.i)} cy={y(last.v)} r="2.4" fill={color} />
    </svg>
  );
}

export interface Series { id: string; label: string; color: string; values: (number | null)[] }

/**
 * Çok serili çizgi grafik. Yama sekmeleri eşit aralıklı; boş değerlerde
 * çizgi kopmuyor, bir sonraki dolu noktaya bağlanıyor (tablo o hafta o
 * satırı taşımamış olabilir, DPS sıfırlanmış değil).
 */
export function LineChart({ series, labels, height = 300, format = (v: number) => (v / 1000).toFixed(1) + "K" }: {
  series: Series[]; labels: string[]; height?: number; format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Gerçek piksel genişliği: viewBox'ı esnetince dar sütunda yazılar eziliyordu
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(800);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const H = height, padL = 48, padR = 12, padT = 14, padB = 30;
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const { min, max } = useMemo(() => {
    if (!all.length) return { min: 0, max: 1 };
    const lo = Math.min(...all), hi = Math.max(...all);
    const pad = (hi - lo) * 0.08 || hi * 0.05;
    return { min: lo - pad, max: hi + pad };
  }, [all]);
  const n = labels.length;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB);
  const ticks = 5;
  const tickVals = Array.from({ length: ticks }, (_, i) => min + ((max - min) * i) / (ticks - 1));

  return (
    <div className="relative" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full"
           onMouseLeave={() => setHover(null)}
           onMouseMove={(e) => {
             const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
             const px = ((e.clientX - r.left) / r.width) * W;
             const i = Math.round(((px - padL) / (W - padL - padR)) * (n - 1));
             setHover(Math.max(0, Math.min(n - 1, i)));
           }}>
        {tickVals.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,.05)" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#808089">{format(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => {
          const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(W / 78))));
          return (i % every === 0 || i === n - 1) && (
            <text key={i} x={x(i)} y={H - 10} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize="10.5"
                  fill={hover === i ? "#f4f4f5" : "#808089"}>{l}</text>
          );
        })}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="rgba(232,180,81,.35)" strokeDasharray="3 3" />}
        {series.map((s) => {
          const pts = s.values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
          if (!pts.length) return null;
          const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
                    vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 6px ${s.color}55)` }} />
              {pts.map((p) => (
                <circle key={p.i} className="dps-dot" cx={x(p.i)} cy={y(p.v)} r={hover === p.i ? 4.5 : 2.6} fill={s.color}
                        stroke="#000" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="absolute top-2 pointer-events-none rounded-[10px] px-3 py-2 text-[11.5px] min-w-[170px]"
             style={{
               left: `${(x(hover) / W) * 100}%`,
               transform: hover > n / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)",
               background: "rgba(11,11,12,.94)", border: "1px solid var(--t-line-strong)", backdropFilter: "blur(8px)",
             }}>
          <div className="font-semibold mb-1" style={{ color: "var(--t-gold)" }}>{labels[hover]}</div>
          {series
            .map((s) => ({ s, v: s.values[hover] }))
            .sort((a, b) => (b.v ?? -1) - (a.v ?? -1))
            .map(({ s, v }) => (
              <div key={s.id} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="truncate flex-1" style={{ color: "var(--t-dim)" }}>{s.label}</span>
                <span className="t-num font-semibold">{v === null ? "—" : format(v)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/** Seri renkleri — koyu zeminde birbirinden ayrışan tonlar */
export const PALETTE = ["#e8b451", "#7aa2ff", "#ff7a45", "#38d07f", "#c38bff", "#ff5f8a", "#4fd1c5", "#f6e05e", "#a0aec0", "#fc8181"];
