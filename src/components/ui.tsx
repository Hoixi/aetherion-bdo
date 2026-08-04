"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

/* ── Page header ── */
export function PageHeader({
  title, desc, icon: Icon, action,
}: { title: string; desc?: string; icon?: LucideIcon; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="icon-tile w-9 h-9 mt-0.5">
            <Icon className="w-4 h-4 text-bdo-gold" strokeWidth={1.75} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="section-title">{title}</h1>
          {desc && <p className="section-desc">{desc}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/* ── Card ── */
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({
  title, meta, icon: Icon, href,
}: { title: string; meta?: string; icon?: LucideIcon; href?: string }) {
  return (
    <div className="card-header">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-3.5 h-3.5 text-bdo-text-secondary flex-shrink-0" strokeWidth={1.75} />}
        <span className="card-title truncate">{title}</span>
      </div>
      {href
        ? <Link href={href} className="card-meta hover:text-bdo-gold transition-colors flex-shrink-0">{meta ?? "Tümü →"}</Link>
        : meta && <span className="card-meta flex-shrink-0">{meta}</span>
      }
    </div>
  );
}

/* ── Empty state ── */
export function Empty({ icon: Icon, text, action }: { icon?: LucideIcon; text: string; action?: React.ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      {Icon && <Icon className="w-7 h-7 text-bdo-text-secondary/40 mx-auto mb-2.5" strokeWidth={1.5} />}
      <p className="text-[13px] text-bdo-text-muted">{text}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ── Loading ── */
export function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex gap-1.5 items-center">
        <span className="w-1.5 h-1.5 bg-bdo-gold/40 rounded-full animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-bdo-gold/40 rounded-full animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-bdo-gold/40 rounded-full animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

/* ── Button ── */
type BtnVariant = "primary" | "ghost" | "danger" | "success";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-gradient-to-b from-[#e0b040] to-[#c29328] text-bdo-bg hover:from-[#e8bb4d] hover:to-[#cc9c2c] font-semibold shadow-[0_1px_2px_rgba(0,0,0,.35),inset_0_1px_0_rgba(255,255,255,.18)]",
  ghost: "bg-gradient-to-b from-[#1e2839] to-[#161c26] text-bdo-text-muted border border-bdo-border hover:text-bdo-text-primary hover:border-bdo-border-2",
  danger: "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/[0.17]",
  success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/[0.17]",
};

export function Button({
  children, onClick, variant = "ghost", size = "sm", disabled, type = "button", className = "", icon: Icon,
}: {
  children?: React.ReactNode; onClick?: () => void; variant?: BtnVariant;
  size?: "xs" | "sm" | "md"; disabled?: boolean; type?: "button" | "submit";
  className?: string; icon?: LucideIcon;
}) {
  const sizes = {
    xs: "px-2 py-1 text-[11px] gap-1",
    sm: "px-3 py-1.5 text-[12px] gap-1.5",
    md: "px-4 py-2 text-[13px] gap-2",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${BTN[variant]} ${sizes[size]} ${className}`}
    >
      {Icon && <Icon className={size === "xs" ? "w-3 h-3" : "w-3.5 h-3.5"} strokeWidth={2} />}
      {children}
    </button>
  );
}

/* ── Badge ── */
type BadgeTone = "default" | "gold" | "green" | "red" | "blue" | "yellow";
const TONES: Record<BadgeTone, string> = {
  default: "bg-bdo-surface-2 border-bdo-border text-bdo-text-muted",
  gold: "bg-bdo-gold/10 border-bdo-gold/20 text-bdo-gold",
  green: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
  red: "bg-red-500/10 border-red-500/20 text-red-400",
  blue: "bg-[#4a7cf5]/10 border-[#4a7cf5]/20 text-[#6b93ff]",
  yellow: "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
};

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: BadgeTone }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

/* ── Stat tile ── */
export function StatTile({
  label, value, sub, icon: Icon, tone, accent,
}: { label: string; value: string | number; sub?: string; icon?: LucideIcon; tone?: string; accent?: boolean }) {
  return (
    <div className={`card px-4 py-3 ${accent ? "card-accent" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] text-bdo-text-secondary uppercase tracking-wider">{label}</p>
        {Icon && <Icon className="w-3.5 h-3.5 text-bdo-text-secondary/50" strokeWidth={1.75} />}
      </div>
      <p className={`text-xl font-bold font-mono ${tone ?? "text-bdo-text-primary"}`}>{value}</p>
      {sub && <p className="text-[10px] text-bdo-text-secondary mt-0.5">{sub}</p>}
    </div>
  );
}

/* ── Avatar ── */
export function Avatar({ src, size = 24, ring = true }: { src?: string | null; size?: number; ring?: boolean }) {
  const cls = `rounded-full flex-shrink-0 object-cover ${ring ? "ring-1 ring-bdo-border" : ""}`;
  return src
    ? <img src={src} alt="" className={cls} style={{ width: size, height: size }} />
    : <div className={`bg-bdo-surface-2 ${cls}`} style={{ width: size, height: size }} />;
}

/* ── Guild tag ── */
export type GuildInfo = { id: number; name: string; tag: string; color: string };

export function GuildTag({
  guild, size = "sm",
}: { guild?: GuildInfo | null; size?: "xs" | "sm" }) {
  if (!guild) return null;
  const dims = size === "xs" ? "text-[8px] px-1 py-px" : "text-[9px] px-1 py-0.5";
  return (
    <span
      className={`${dims} font-bold uppercase tracking-wider rounded border flex-shrink-0 leading-none`}
      style={{
        color: guild.color,
        borderColor: `${guild.color}38`,
        backgroundColor: `${guild.color}14`,
      }}
      title={guild.name}
    >
      {guild.tag}
    </span>
  );
}

/* ── Input ── */
export function Input({
  value, onChange, placeholder, type = "text", className = "", icon: Icon,
}: {
  value: string | number; onChange: (v: string) => void; placeholder?: string;
  type?: string; className?: string; icon?: LucideIcon;
}) {
  return (
    <div className={`relative ${className}`}>
      {Icon && <Icon className="w-3.5 h-3.5 text-bdo-text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-bdo-surface border border-bdo-border rounded-lg py-2 text-[13px] text-bdo-text-primary placeholder-bdo-text-secondary focus:outline-none focus:border-bdo-gold/40 transition-colors ${Icon ? "pl-9 pr-3" : "px-3"}`}
      />
    </div>
  );
}

/* ── Tabs ── */
export function Tabs<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string; icon?: LucideIcon; count?: number }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="flex gap-1 border-b border-bdo-border mb-4 overflow-x-auto">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            active === t.id
              ? "border-bdo-gold text-bdo-text-primary"
              : "border-transparent text-bdo-text-secondary hover:text-bdo-text-muted"
          }`}
        >
          {t.icon && <t.icon className="w-3.5 h-3.5" strokeWidth={1.75} />}
          {t.label}
          {t.count !== undefined && (
            <span className="text-[10px] text-bdo-text-secondary font-mono">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
