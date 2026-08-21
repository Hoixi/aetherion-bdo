"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BDO_CLASSES, getClassIconUrl } from "@/lib/classes";
import { useState, useRef, useEffect } from "react";
import type { AttendanceStatus, WarAttendanceSummary } from "@/app/api/wars/attendance-history/route";
import { displayOf, DISPLAY_META } from "@/lib/attendance";
import { RECENT_WAR_WINDOW } from "@/lib/perf-window";

/**
 * Parti kurarken sürüklenen üye kartı.
 *
 * Kart üstünde yalnızca sürekli lazım olan üç şey duruyor: kim, hangi
 * class, ne kadar gear. Puan sağda ince bir çubuk, bu savaştaki durumu
 * sol kenardaki renk şeridi anlatıyor — hepsi ayrı rozet olunca kart
 * okunmaz hâle geliyordu. Geri kalan her şey üstüne gelince açılıyor.
 */

export interface UserPerfStats {
  wars: number;
  avgKills: number;
  avgDeaths: number;
  avgKillStreak: number;
  avgDamage: number;
  avgDamageTaken: number;
  avgCc: number;
  avgHeal: number;
  avgAllyHeal: number;
  maxKills: number;
  maxKillStreak: number;
  maxDamage: number;
  kdr: number;
  score: number;
}

/** Beş durum üç gösterime indirgenir; hiç katılmayan işaretsiz kalır */
function markOf(status: AttendanceStatus) {
  const d = displayOf(status);
  return d ? DISPLAY_META[d] : null;
}

/**
 * Bu kadar veya daha az savaş oynamışın puanı tek gecenin gürültüsü —
 * üretimde tek savaşlık örneklemler ±40 puan oynatıyordu. Sayı gizlenmiyor
 * ama "buna dayanma" diye soluk gösteriliyor.
 */
export const LOW_SAMPLE = 2;

export function scoreColor(score: number): string {
  if (score >= 20) return "#38d07f";
  if (score >= 8) return "#e8b451";
  if (score >= 0) return "#f0a03c";
  return "#ef5f5f";
}

function fmtDmg(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

function AttendanceDots({ userId, history }: { userId: number; history: WarAttendanceSummary[] }) {
  if (history.length === 0) return null;
  return (
    <div className="flex gap-0.5">
      {history.map((war) => {
        const status = war.statuses[userId];
        const cfg = status ? markOf(status) : null;
        const when = new Date(war.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
        if (!cfg) {
          return (
            <span key={war.warId} title={`${when} — Katılmadı`}
                  className="w-1.5 h-1.5 rounded-full bg-bdo-border" />
          );
        }
        return (
          <span key={war.warId} title={`${when} — ${cfg.label}`}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: cfg.color }} />
        );
      })}
    </div>
  );
}

interface MemberChipProps {
  id: string;
  user: {
    id: number; familyName: string; class: string; ap: number; dp: number; avatarUrl: string;
    guild?: { tag: string; color: string } | null;
  };
  isDragOverlay?: boolean;
  perf?: UserPerfStats;
  attendanceHistory?: WarAttendanceSummary[];
  /** Bu savaştaki durumu — geçmiş işaretlerinden ayrı */
  currentStatus?: AttendanceStatus;
  /** O savaşa geldiği class, profilindekinden farklıysa */
  asClass?: string | null;
  /** Havuzdaki kartlar dar; parti içindekiler tam genişlik */
  compact?: boolean;
}

export function MemberChip({
  id, user, isDragOverlay, perf, attendanceHistory,
  currentStatus, asClass, compact,
}: MemberChipProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const shownClass = asClass || user.class;
  const className = BDO_CLASSES.find((c) => c.id === shownClass)?.name ?? shownClass;
  const icon = getClassIconUrl(shownClass);
  const swapped = Boolean(asClass && asClass !== user.class);
  const status = currentStatus ? markOf(currentStatus) : null;

  function handleEnter() {
    if (!chipRef.current || !perf) return;
    const r = chipRef.current.getBoundingClientRect();
    setTip({ top: r.top - 8, left: Math.min(r.left, window.innerWidth - 250) });
  }

  useEffect(() => { if (isDragging) setTip(null); }, [isDragging]);

  return (
    <div ref={setNodeRef} style={isDragOverlay ? undefined : style} className="relative">
      {perf && tip && !isDragging && (
        <div className="fixed z-[9999] w-60 bg-bdo-surface border border-bdo-border-2 rounded-xl p-3
                        shadow-2xl pointer-events-none"
             style={{ top: tip.top, left: tip.left, transform: "translateY(-100%)" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-bdo-text-primary">{user.familyName}</span>
            <span className="text-[10px] text-bdo-text-muted"
                  title={`Son ${RECENT_WAR_WINDOW} savaşın ${perf.wars} tanesinde oynadı`}>
              son {RECENT_WAR_WINDOW}&apos;te {perf.wars} savaş
            </span>
          </div>

          <div className="h-1 rounded-full bg-bdo-border overflow-hidden">
            <div className="h-full rounded-full"
                 style={{
                   width: Math.round(((Math.max(-15, Math.min(40, perf.score)) + 15) / 55) * 100) + "%",
                   backgroundColor: scoreColor(perf.score),
                 }} />
          </div>
          <div className="text-[10px] text-bdo-text-muted mt-1 mb-2">
            Puan <span className="font-mono font-bold" style={{ color: scoreColor(perf.score) }}>
              {perf.score}
            </span>
            <span className="text-bdo-text-secondary"> · son {RECENT_WAR_WINDOW} savaşın ortalaması</span>
          </div>

          {perf.wars <= LOW_SAMPLE && (
            <div className="text-[10px] mb-2 px-2 py-1 rounded-md"
                 style={{ color: "#e09832", background: "rgba(224,152,50,.12)" }}>
              Yalnızca {perf.wars} savaş — tek gecenin sayıları, kadro kurarken tek başına yeterli değil.
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {([
              ["Ort. öldürme", String(perf.avgKills)],
              ["Ort. ölüm", String(perf.avgDeaths)],
              ["Öldürme/ölüm", perf.kdr.toFixed(2)],
              ["Ort. seri", String(perf.avgKillStreak)],
              ["Ort. hasar", fmtDmg(perf.avgDamage)],
              ["Ort. CC", perf.avgCc > 0 ? String(perf.avgCc) : "—"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-bdo-text-secondary truncate">{k}</span>
                <span className="font-mono text-bdo-text-primary">{v}</span>
              </div>
            ))}
          </div>

          <div className="mt-2 pt-2 border-t border-bdo-border flex gap-3 text-[10px] text-bdo-text-secondary">
            <span>En çok öldürme <span className="text-bdo-text-primary font-mono">{perf.maxKills}</span></span>
            <span>En çok hasar <span className="text-bdo-text-primary font-mono">{fmtDmg(perf.maxDamage)}</span></span>
          </div>
        </div>
      )}

      <div
        ref={chipRef}
        {...attributes}
        {...listeners}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setTip(null)}
        className={`relative overflow-hidden bg-bdo-surface-2 border border-bdo-border rounded-lg
                    cursor-grab active:cursor-grabbing select-none transition-colors
                    ${compact ? "pl-3 pr-2 py-1.5" : "pl-3 pr-2.5 py-2"}
                    ${isDragOverlay ? "border-bdo-gold/50 shadow-lg" : "hover:border-bdo-gold/30"}`}
      >
        {/* Bu savaştaki durum: rozet yerine sol kenar şeridi */}
        {status && (
          <span className="absolute left-0 inset-y-0 w-[3px]"
                style={{ backgroundColor: status.color }} title={status.label} />
        )}

        <div className="flex items-center gap-2">
          {icon
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={icon} alt="" className="w-4 h-4 opacity-75 shrink-0" title={className} />
            : <span className="w-4 shrink-0" />}

          <span className="text-xs font-semibold text-bdo-text-primary truncate flex-1">
            {user.familyName}
          </span>

          {swapped && (
            <span className="text-[9px] font-bold px-1 rounded shrink-0
                             bg-bdo-gold/15 text-bdo-gold"
                  title={`Bu savaşa ${className} ile geliyor`}>⇄</span>
          )}

          <span className="text-[10px] font-mono text-bdo-text-muted shrink-0">
            {user.ap}/{user.dp}
          </span>

          {perf && (
            <span className="text-[10px] font-mono font-bold shrink-0 w-7 text-right"
                  style={{ color: scoreColor(perf.score), opacity: perf.wars <= LOW_SAMPLE ? 0.45 : 1 }}
                  title={perf.wars <= LOW_SAMPLE
                    ? `Form puanı ${perf.score} — ama son ${RECENT_WAR_WINDOW} savaşın yalnızca ${perf.wars} tanesinde oynadı, güvenilir değil`
                    : `Form puanı — son ${RECENT_WAR_WINDOW} savaşın ${perf.wars} tanesinden`}>
              {perf.score}
            </span>
          )}
        </div>

        {!isDragOverlay && !compact && attendanceHistory && attendanceHistory.length > 0 && (
          <div className="flex items-center gap-2 mt-1.5 pl-6">
            <AttendanceDots userId={user.id} history={attendanceHistory} />
            {user.guild && (
              <span className="ml-auto text-[9px] font-bold uppercase tracking-wider"
                    style={{ color: user.guild.color }}>{user.guild.tag}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
