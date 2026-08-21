"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  CalendarDays, ChevronLeft, ChevronRight, Trophy, Skull, Handshake,
  CalendarOff, Users, Clock,
} from "lucide-react";
import { getTypeName } from "@/lib/classes";
import { TestShell, Card, Head, Empty } from "@/components/app-shell";

/**
 * Savaş takvimi.
 *
 * Ay ızgarası ve seçilen günün detayı. Gün hücreleri savaş tipine göre
 * noktalanıyor; geniş ekranda ilk savaşın adı hücreye sığdığı için
 * güne tıklamadan da ne olduğu görünüyor.
 */

type CalendarWar = {
  id: number;
  title: string;
  type: string;
  date: string;
  result: string | null;
  _count: { participants: number };
};

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const TYPE_COLOR: Record<string, string> = {
  NODE_WAR: "#e8b451",
  SIEGE: "#ef5f5f",
  KARA_TAPINAK: "#a855f7",
  OTHER: "#6b93ff",
};

const RESULT_ICON = { WIN: Trophy, LOSS: Skull, DRAW: Handshake } as const;
const RESULT_COLOR = { WIN: "var(--t-good)", LOSS: "var(--t-bad)", DRAW: "var(--t-dim)" } as const;

const color = (type: string) => TYPE_COLOR[type] ?? TYPE_COLOR.OTHER;

export default function TakvimPage() {
  const { status } = useSession();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [wars, setWars] = useState<CalendarWar[]>([]);
  const [day, setDay] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setWars);
  }, [status, year, month]);

  const byDay = useMemo(() => {
    const map = new Map<number, CalendarWar[]>();
    for (const w of wars) {
      const d = new Date(w.date).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(w);
    }
    map.forEach((list) => list.sort((a, b) => +new Date(a.date) - +new Date(b.date)));
    return map;
  }, [wars]);

  function shift(dir: -1 | 1) {
    setDay(null);
    const m = month + dir;
    if (m < 1) { setMonth(12); setYear(year - 1); }
    else if (m > 12) { setMonth(1); setYear(year + 1); }
    else setMonth(m);
  }

  if (status === "loading") {
    return <TestShell title="Takvim" subtitle="Yükleniyor…"><Empty>Takvim geliyor…</Empty></TestShell>;
  }
  if (status === "unauthenticated") {
    return (
      <TestShell title="Takvim" subtitle="Giriş gerekiyor">
        <Empty>Takvimi görmek için giriş yapman gerekiyor.</Empty>
      </TestShell>
    );
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  // Hafta pazartesi başlıyor; getDay() pazarı 0 sayıyor
  let lead = new Date(year, month - 1, 1).getDay() - 1;
  if (lead < 0) lead = 6;

  const today = new Date();
  const thisMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const dayWars = day ? byDay.get(day) ?? [] : [];

  const wins = wars.filter((w) => w.result === "WIN").length;
  const losses = wars.filter((w) => w.result === "LOSS").length;

  return (
    <TestShell
      title="Takvim"
      subtitle={`${MONTHS[month - 1]} ${year} · ${wars.length} savaş${
        wins + losses > 0 ? ` · ${wins}G ${losses}M` : ""}`}
      aside={
        <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); setDay(null); }}
                className="t-chip hidden sm:inline-flex">
          Bu aya dön
        </button>
      }
    >
      <div className="grid lg:grid-cols-[1fr_330px] gap-4 items-start">
        {/* ── Ay ızgarası ────────────────────────────────────────── */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
            <CalendarDays className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
            <h2 className="text-[14px] font-semibold">{MONTHS[month - 1]} {year}</h2>
            <div className="ml-auto flex items-center gap-1">
              <NavBtn onClick={() => shift(-1)} icon={ChevronLeft} label="Önceki ay" />
              <NavBtn onClick={() => shift(1)} icon={ChevronRight} label="Sonraki ay" />
            </div>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="text-[10px] text-center uppercase tracking-[0.08em] py-1 font-medium"
                     style={{ color: "var(--t-faint)" }}>
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: lead }).map((_, i) => (
                <div key={`x${i}`} className="min-h-[62px]" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1;
                const list = byDay.get(d);
                const isToday = thisMonth && today.getDate() === d;
                const on = day === d;

                return (
                  <button key={d} onClick={() => setDay(on ? null : d)}
                          className="min-h-[62px] rounded-[var(--t-r-sm)] p-1.5 flex flex-col items-center gap-1 text-[12px] transition-colors"
                          style={{
                            border: `1px solid ${on ? "rgba(232,180,81,.5)"
                              : isToday ? "var(--t-line-strong)"
                              : list ? "var(--t-line)" : "transparent"}`,
                            background: on ? "var(--t-gold-soft)"
                              : isToday ? "var(--t-raised)" : "transparent",
                            color: on ? "var(--t-gold)"
                              : list || isToday ? "var(--t-text)" : "var(--t-faint)",
                            fontWeight: on || isToday ? 700 : 400,
                          }}>
                    <span>{d}</span>

                    <span className="flex gap-0.5 h-1">
                      {list?.slice(0, 3).map((w) => (
                        <span key={w.id} className="w-1 h-1 rounded-full"
                              style={{ background: color(w.type) }} />
                      ))}
                    </span>

                    {/* Geniş ekranda ilk savaşın adı da sığıyor */}
                    {list && (
                      <span className="hidden xl:block text-[9px] leading-tight w-full truncate px-0.5"
                            style={{ color: "var(--t-dim)" }}>
                        {list[0].title}
                        {list.length > 1 ? ` +${list.length - 1}` : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 flex-wrap px-5 py-2.5" style={{ borderTop: "1px solid var(--t-line)" }}>
            {Object.entries(TYPE_COLOR).map(([type, c]) => (
              <span key={type} className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--t-faint)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                {getTypeName(type)}
              </span>
            ))}
          </div>
        </Card>

        {/* ── Yan sütun ──────────────────────────────────────────── */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <Head icon={CalendarDays}
                  title={day ? `${day} ${MONTHS[month - 1]}` : "Gün Detayı"}
                  meta={day ? `${dayWars.length} KAYIT` : undefined} />
            {!day ? (
              <p className="px-5 py-8 text-center text-[13px]" style={{ color: "var(--t-faint)" }}>
                Detayları görmek için bir gün seç.
              </p>
            ) : dayWars.length === 0 ? (
              <div className="px-5 py-8 flex flex-col items-center gap-2">
                <CalendarOff className="w-5 h-5" strokeWidth={1.6} style={{ color: "var(--t-faint)" }} />
                <span className="text-[13px]" style={{ color: "var(--t-faint)" }}>Bu gün boş.</span>
              </div>
            ) : (
              dayWars.map((w) => <WarRow key={w.id} w={w} />)
            )}
          </Card>

          {wars.length > 0 && (
            <Card className="overflow-hidden">
              <Head icon={Clock} title="Bu Ayın Tümü" meta={`${wars.length} SAVAŞ`} />
              <div className="max-h-[380px] overflow-y-auto">
                {[...wars]
                  .sort((a, b) => +new Date(a.date) - +new Date(b.date))
                  .map((w) => <WarRow key={w.id} w={w} showDate />)}
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="pb-6" />
    </TestShell>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function NavBtn({ onClick, icon: Icon, label }: {
  onClick: () => void; icon: React.ElementType; label: string;
}) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
            className="p-1.5 rounded-[var(--t-r-sm)] transition-colors"
            style={{ color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
    </button>
  );
}

function WarRow({ w, showDate = false }: { w: CalendarWar; showDate?: boolean }) {
  const Icon = w.result ? RESULT_ICON[w.result as keyof typeof RESULT_ICON] : null;
  const d = new Date(w.date);

  return (
    <Link href={`/savaslar/${w.id}`} className="t-row px-5 py-2.5 flex items-center gap-2.5">
      <span className="w-1 self-stretch rounded-full flex-shrink-0 min-h-[32px]"
            style={{ background: color(w.type) }} />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium truncate leading-tight">{w.title}</p>
        <p className="text-[10px] leading-tight mt-1 flex items-center gap-1.5" style={{ color: "var(--t-faint)" }}>
          {showDate && `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} · `}
          {d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          {" · "}{getTypeName(w.type)}
          <span className="flex items-center gap-0.5">
            <Users className="w-2.5 h-2.5" /> {w._count.participants}
          </span>
        </p>
      </div>
      {Icon && (
        <Icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.9}
              style={{ color: RESULT_COLOR[w.result as keyof typeof RESULT_COLOR] }} />
      )}
    </Link>
  );
}
