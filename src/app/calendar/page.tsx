"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTypeName } from "@/lib/classes";

interface CalendarWar {
  id: number;
  title: string;
  type: string;
  date: string;
  result: string | null;
  _count: { participants: number };
}

const DAYS_TR = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [wars, setWars] = useState<CalendarWar[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setWars);
  }, [status, year, month]);

  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-[60vh]"><p className="text-bdo-text-muted">Yükleniyor...</p></div>;
  }
  if (!session) return null;

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  const warMap = new Map<number, CalendarWar[]>();
  wars.forEach((w) => {
    const d = new Date(w.date).getDate();
    if (!warMap.has(d)) warMap.set(d, []);
    warMap.get(d)!.push(w);
  });

  const selectedWars = selectedDay ? warMap.get(selectedDay) || [] : [];

  function prevMonth() {
    setSelectedDay(null);
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  }
  function nextMonth() {
    setSelectedDay(null);
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  }

  const typeColor: Record<string, string> = {
    NODE_WAR: "bg-bdo-gold",
    SIEGE: "bg-red-500",
    KARA_TAPINAK: "bg-purple-500",
    OTHER: "bg-blue-400",
  };

  const resultEmoji: Record<string, string> = {
    WIN: "🏆",
    LOSS: "💀",
    DRAW: "🤝",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-bdo-gold">Takvim</h1>

      <div className="bg-bdo-surface border border-bdo-border rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="text-bdo-text-muted hover:text-bdo-gold transition-colors text-lg px-3">‹</button>
          <h2 className="text-lg font-semibold text-bdo-text-primary">{MONTHS_TR[month - 1]} {year}</h2>
          <button onClick={nextMonth} className="text-bdo-text-muted hover:text-bdo-gold transition-colors text-lg px-3">›</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DAYS_TR.map((d) => (
            <div key={d} className="text-xs text-bdo-text-muted text-center uppercase">{d.slice(0, 3)}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dayWars = warMap.get(day);
            const isToday = isCurrentMonth && today.getDate() === day;
            const isSelected = selectedDay === day;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 text-sm transition-all border ${
                  isSelected
                    ? "border-bdo-gold bg-bdo-gold/10 text-bdo-gold font-bold"
                    : isToday
                    ? "border-bdo-gold/40 bg-bdo-gold/5 text-bdo-gold font-bold"
                    : dayWars
                    ? "border-bdo-border/50 hover:border-bdo-gold/30 text-bdo-text-primary hover:bg-bdo-gold/5"
                    : "border-transparent text-bdo-text-muted/50"
                }`}
              >
                {day}
                {dayWars && (
                  <div className="flex gap-0.5">
                    {dayWars.slice(0, 3).map((w) => (
                      <div key={w.id} className={`w-1.5 h-1.5 rounded-full ${typeColor[w.type] || "bg-bdo-gold"}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap">
        {Object.entries(typeColor).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-bdo-text-muted">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            {getTypeName(type)}
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-bdo-text-primary">
            {selectedDay} {MONTHS_TR[month - 1]} {year}
          </h3>
          {selectedWars.length === 0 ? (
            <p className="text-sm text-bdo-text-muted">Bu gün için etkinlik yok.</p>
          ) : (
            <div className="space-y-2">
              {selectedWars.map((war) => (
                <Link
                  key={war.id}
                  href={`/wars/${war.id}`}
                  className="flex items-center justify-between bg-bdo-surface border border-bdo-border rounded-lg p-4 hover:border-bdo-gold/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 rounded-full ${typeColor[war.type] || "bg-bdo-gold"}`} />
                    <div>
                      <div className="text-sm font-semibold text-bdo-text-primary">{war.title}</div>
                      <div className="text-xs text-bdo-text-muted">
                        {new Date(war.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{getTypeName(war.type)}
                        {" · "}{war._count.participants} katılımcı
                      </div>
                    </div>
                  </div>
                  {war.result && (
                    <span className="text-lg">{resultEmoji[war.result] || ""}</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
