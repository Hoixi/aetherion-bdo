/**
 * DPS sayfalarının ortak tipleri ve yardımcıları.
 *
 * Veri `scripts/dps-verisi.cjs` ile Google Sheets'ten üretiliyor:
 *   src/data/dps/ozet.json      → liste (statik)
 *   public/veri/dps/<id>.json   → class detayı (istek anında)
 */
import ozetJson from "@/data/dps/ozet.json";
import { getPortraitUrl, getClassIconUrl, getClassByID } from "@/lib/classes";

export type SpecKind = "awakening" | "succession" | null;

export interface ClassStats {
  baseAp: number | null;
  passive: number;
  selfbuff: number;
  selfbuffType: string | null;
  total: number | null;
  eBuff: number;
  eBuffType: string | null;
  totalE: number | null;
  dp: number;
  dpType: string | null;
  totalDp: number | null;
  totalEDp: number | null;
  /** [pasif, selfbuff, E buff] yüzde */
  atkSpeed: number[];
  critDmg: number[];
  critRate: number[];
  extra: string | null;
}

export interface DpsSpec {
  id: string;
  label: string;
  className: string;
  classId: string | null;
  spec: SpecKind;
  slug: string;
  author: string | null;
  sheet: string | null;
  link: string | null;
  completeness: string | null;
  sequence: string | null;
  damage: number | null;
  frames: number | null;
  time: number | null;
  dps: number | null;
  dpsBefore: number | null;
  change: number | null;
  comment: string | null;
  atkSpeedBuff: number | null;
  aoe: string | null;
  critDmg: number | null;
  notes: Partial<Record<"spec" | "author" | "sheet" | "sequence" | "dps" | "comment" | "atkSpeed" | "aoe", string>>;
  detail: boolean;
  private: boolean;
  comboCount?: number;
  skillCount?: number;
  rank?: number;
  stats: ClassStats | null;
}

export interface DpsOzet {
  generatedAt: string;
  sources: { dps: string; stats: string };
  meta: {
    tab: string;
    banner: string;
    comparingTo: string | null;
    maintainer: string | null;
    discord: string | null;
    notes: { title: string; note: string | null }[];
  };
  history: { tabs: { key: string; label: string; note: string | null }[]; values: Record<string, (number | null)[]> };
  specs: DpsSpec[];
  statsOnly: { label: string; className: string; classId: string | null; spec: SpecKind; slug: string; stats: ClassStats }[];
}

export interface DpsRow {
  name: string;
  damage: number | null;
  frames: number | null;
  time: number | null;
  dps: number | null;
  type?: string;
  input?: string;
  bsrDps?: number;
  crit?: number;
}

export interface DpsCombo extends DpsRow {
  summary?: boolean;
  steps?: { name: string; damage: number | null; time: number | null; dps: number | null }[];
}

export interface DpsDetay {
  tab: string;
  combos: DpsCombo[];
  skills: DpsRow[];
}

export const OZET = ozetJson as unknown as DpsOzet;

/** DPS'i olan satırlar, sıralı */
export const RANKED: DpsSpec[] = OZET.specs
  .filter((s) => s.dps !== null)
  .sort((a, b) => (b.dps ?? 0) - (a.dps ?? 0));

export const MAX_DPS = RANKED[0]?.dps ?? 1;

// ── görsel ───────────────────────────────────────────────────────────────

export const SPEC_META: Record<"awakening" | "succession" | "single", { label: string; short: string; color: string }> = {
  awakening: { label: "Awakening", short: "AWK", color: "#ff7a45" },
  succession: { label: "Succession", short: "SUCC", color: "#7aa2ff" },
  single: { label: "Tek Spec", short: "TEK", color: "#e8b451" },
};

export function specMeta(spec: SpecKind) {
  return SPEC_META[spec ?? "single"];
}

export function portrait(s: { classId: string | null; spec: SpecKind }): string {
  return s.classId ? getPortraitUrl(s.classId, s.spec ?? "awakening") : "";
}

export function classIcon(s: { classId: string | null }): string {
  return s.classId ? getClassIconUrl(s.classId) : "";
}

export function classType(s: { classId: string | null }): number | null {
  const c = s.classId ? getClassByID(s.classId) : null;
  return c ? c.classType : null;
}

/** Tablo İngilizce ad kullanıyor; sitenin geri kalanı Türkçe adları */
export function trName(s: { classId: string | null; className: string }): string {
  const c = s.classId ? getClassByID(s.classId) : null;
  return c?.name ?? s.className;
}

// ── AoE ──────────────────────────────────────────────────────────────────

const AOE_BASE: Record<string, [number, string]> = { small: [1, "Küçük"], medium: [2, "Orta"], big: [3, "Büyük"] };

/** "Medium+" → { score: 2.33, label: "Orta+" } — kıyas ve mini ölçek için */
export function aoeInfo(aoe: string | null): { score: number; label: string; bucket: string } | null {
  if (!aoe) return null;
  const m = /^(small|medium|big)([+-]?)$/i.exec(aoe.trim());
  if (!m) return null;
  const [base, label] = AOE_BASE[m[1].toLowerCase()];
  const mod = m[2] === "+" ? 0.33 : m[2] === "-" ? -0.33 : 0;
  return { score: base + mod, label: label + m[2], bucket: m[1].toLowerCase() };
}

// ── değişim ──────────────────────────────────────────────────────────────

/** Kıyas için varsayılan sekme: canlıdan bir önceki */
export const PREV_TAB = OZET.history.tabs.length - 2;

/** Belirli bir yama sekmesine göre değişim (yüzde) */
export function changeVs(id: string, baseIdx: number): { pct: number; from: string } | null {
  const v = OZET.history.values[id];
  if (!v || v.length < 2 || baseIdx < 0 || baseIdx >= v.length - 1) return null;
  const now = v[v.length - 1];
  const prev = v[baseIdx];
  if (now === null || prev === null || prev === 0) return null;
  return { pct: ((now - prev) / prev) * 100, from: OZET.history.tabs[baseIdx]?.label ?? "" };
}

/** Bir önceki yama sekmesine göre değişim (yüzde) */
export function lastChange(id: string) {
  return changeVs(id, PREV_TAB);
}

/** Bir sekmedeki sıralama: id → sıra */
export function ranksAt(idx: number): Record<string, number> {
  const list = OZET.specs
    .map((s) => ({ id: s.id, v: OZET.history.values[s.id]?.[idx] ?? null }))
    .filter((x): x is { id: string; v: number } => x.v !== null)
    .sort((a, b) => b.v - a.v);
  return Object.fromEntries(list.map((x, i) => [x.id, i + 1]));
}

/** Geçmişte bu satırın bulunduğu ilk ve son değer arasındaki fark */
export function totalChange(id: string): { pct: number; from: string } | null {
  const v = OZET.history.values[id];
  if (!v) return null;
  const firstIdx = v.findIndex((x) => x !== null);
  const now = v[v.length - 1];
  if (firstIdx < 0 || firstIdx === v.length - 1 || now === null) return null;
  const first = v[firstIdx]!;
  return { pct: ((now - first) / first) * 100, from: OZET.history.tabs[firstIdx].label };
}

// ── biçim ────────────────────────────────────────────────────────────────

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? "—" : Math.round(n).toLocaleString("en-US"));
export const fmtK = (n: number | null | undefined) => (n === null || n === undefined ? "—" : (n / 1000).toFixed(1) + "K");
export const fmtSec = (n: number | null | undefined) => (n === null || n === undefined ? "—" : n.toFixed(2) + " sn");
export const fmtPct = (n: number, digits = 1) => (n > 0 ? "+" : "") + n.toFixed(digits) + "%";

/** Beceri adlarını kıyaslamak için: küçük harf, noktalama yok */
export function normName(s: string): string {
  return s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
