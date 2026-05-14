"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
interface CalendarWar {
  id: number;
  title: string;
  type: string;
  date: string;
  result: string | null;
}

const DAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

export function MiniCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [wars, setWars] = useState<CalendarWar[]>([]);

  useEffect(() => {
    fetch(`/api/calendar?year=${year}&month=${month}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setWars);
  }, [year, month]);

  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // Monday = 0
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  function warDays(): Map<number, CalendarWar[]> {
    const map = new Map<number, CalendarWar[]>();
    wars.forEach((w) => {
      const d = new Date(w.date).getDate();
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(w);
    });
    return map;
  }

  const warMap = warDays();

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const typeColor: Record<string, string> = {
    NODE_WAR: "bg-bdo-gold",
    SIEGE: "bg-red-500",
    KARA_TAPINAK: "bg-purple-500",
    OTHER: "bg-blue-400",
  };

  return (
    <div className="bg-bdo-surface border border-bdo-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="text-bdo-text-muted hover:text-bdo-gold transition-colors px-2">‹</button>
        <Link href="/calendar" className="text-sm font-semibold text-bdo-text-primary hover:text-bdo-gold transition-colors">
          {MONTHS_TR[month - 1]} {year}
        </Link>
        <button onClick={nextMonth} className="text-bdo-text-muted hover:text-bdo-gold transition-colors px-2">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DAYS_TR.map((d) => (
          <div key={d} className="text-[9px] text-bdo-text-muted uppercase">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayWars = warMap.get(day);
          const isToday = isCurrentMonth && today.getDate() === day;

          return (
            <div
              key={day}
              className={`relative text-xs py-1.5 rounded-lg transition-colors ${
                isToday ? "bg-bdo-gold/20 text-bdo-gold font-bold" :
                dayWars ? "text-bdo-text-primary" : "text-bdo-text-muted/60"
              }`}
            >
              {day}
              {dayWars && (
                <div className="flex justify-center gap-0.5 mt-0.5">
                  {dayWars.slice(0, 3).map((w) => (
                    <div key={w.id} className={`w-1 h-1 rounded-full ${typeColor[w.type] || "bg-bdo-gold"}`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Today's wars */}
      {wars.filter((w) => {
        const d = new Date(w.date);
        return isCurrentMonth && d.getDate() === today.getDate();
      }).length > 0 && (
        <div className="mt-3 pt-3 border-t border-bdo-border space-y-1">
          <div className="text-[9px] uppercase text-bdo-text-muted">Bugün</div>
          {wars.filter((w) => {
            const d = new Date(w.date);
            return isCurrentMonth && d.getDate() === today.getDate();
          }).map((w) => (
            <Link key={w.id} href={`/wars/${w.id}`} className="flex items-center gap-2 text-xs hover:text-bdo-gold transition-colors">
              <div className={`w-1.5 h-1.5 rounded-full ${typeColor[w.type] || "bg-bdo-gold"}`} />
              <span className="text-bdo-text-primary">{w.title}</span>
              <span className="text-bdo-text-muted ml-auto">
                {new Date(w.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
