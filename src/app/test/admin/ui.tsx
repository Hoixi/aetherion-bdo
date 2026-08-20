"use client";

import type { ReactNode } from "react";

/**
 * Admin sekmelerinin ortak parçaları.
 *
 * Sekmeler ayrı dosyalarda ama form dili tek olmalı; her sekmenin kendi
 * input stilini yazması kaçınılmaz olarak birbirinden ayrışıyordu.
 */

export function Field({ label, hint, children }: {
  label: ReactNode; hint?: ReactNode; children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--t-faint)" }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-[10.5px] mt-1 leading-relaxed" style={{ color: "var(--t-faint)" }}>{hint}</p>}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--t-raised)",
  border: "1px solid var(--t-line)",
  color: "var(--t-text)",
};

export function Input({
  value, onChange, placeholder, type = "text", required, maxLength,
  min, max, step, mono, className = "",
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; maxLength?: number;
  min?: number; max?: number; step?: number; mono?: boolean; className?: string;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
           type={type} required={required} maxLength={maxLength} min={min} max={max} step={step}
           className={`h-[36px] px-3 rounded-[var(--t-r-sm)] text-[13px] outline-none ${mono ? "t-num" : ""} ${className || "w-full"}`}
           style={INPUT_STYLE} />
  );
}

export function Area({ value, onChange, placeholder, rows = 3, required }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; required?: boolean;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
              rows={rows} required={required}
              className="w-full px-3 py-2.5 rounded-[var(--t-r-sm)] text-[13px] outline-none resize-none"
              style={INPUT_STYLE} />
  );
}

export function Select({ value, onChange, children, disabled, className = "" }: {
  value: string | number; onChange: (v: string) => void;
  children: ReactNode; disabled?: boolean; className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
            className={`h-[36px] px-3 rounded-[var(--t-r-sm)] text-[13px] outline-none disabled:opacity-50 ${className || "w-full"}`}
            style={INPUT_STYLE}>
      {children}
    </select>
  );
}

export type BtnTone = "gold" | "ghost" | "danger" | "good";

const TONES: Record<BtnTone, React.CSSProperties> = {
  gold:   { color: "var(--t-gold)", background: "var(--t-gold-soft)", border: "1px solid rgba(232,180,81,.3)" },
  ghost:  { color: "var(--t-dim)",  background: "var(--t-raised)",    border: "1px solid var(--t-line)" },
  danger: { color: "var(--t-bad)",  background: "rgba(239,95,95,.10)", border: "1px solid rgba(239,95,95,.25)" },
  good:   { color: "var(--t-good)", background: "rgba(56,208,127,.12)", border: "1px solid rgba(56,208,127,.3)" },
};

export function Btn({
  children, onClick, tone = "ghost", icon: Icon, disabled, type = "button",
  small, title, className = "",
}: {
  children?: ReactNode;
  onClick?: () => void;
  tone?: BtnTone;
  icon?: React.ElementType;
  disabled?: boolean;
  type?: "button" | "submit";
  small?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
            className={`rounded-[var(--t-r-sm)] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-45 whitespace-nowrap ${
              small ? "text-[11.5px] px-2.5 h-[28px]" : "text-[12.5px] px-3.5 h-[34px]"
            } ${children ? "" : small ? "!px-2" : "!px-2.5"} ${className}`}
            style={TONES[tone]}>
      {Icon && <Icon className={small ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={2} />}
      {children}
    </button>
  );
}

/** Sekme içindeki bölüm başlığı — açıklama ve sağ uçta eylem taşır */
export function SectionHead({ icon: Icon, title, desc, action }: {
  icon: React.ElementType; title: string; desc?: string; action?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
      <div className="min-w-0 flex-1">
        <h2 className="text-[14px] font-semibold leading-tight">{title}</h2>
        {desc && (
          <p className="text-[11px] mt-0.5 leading-tight" style={{ color: "var(--t-faint)" }}>{desc}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Sayısal özet kutucuğu */
export function Metric({ label, value, tone = "var(--t-text)" }: {
  label: string; value: number | string; tone?: string;
}) {
  return (
    <div className="px-3 py-2 rounded-[var(--t-r-sm)]"
         style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      <p className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--t-faint)" }}>{label}</p>
      <p className="t-num text-[16px] font-bold leading-tight mt-0.5" style={{ color: tone }}>{value}</p>
    </div>
  );
}

export function Tag({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 leading-none"
          style={{ color, borderColor: color + "38", background: color + "14" }}>
      {children}
    </span>
  );
}

export function Ava({ src, size = 26 }: { src?: string | null; size?: number }) {
  const style = { width: size, height: size, border: "1px solid var(--t-line)" };
  if (!src) return <div className="rounded-full flex-shrink-0" style={{ ...style, background: "var(--t-raised)" }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="rounded-full flex-shrink-0 object-cover" style={style} />;
}

/** Sekmelerin ortak yazısı: boş liste */
export function Blank({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-faint)" }}>{children}</p>
  );
}
