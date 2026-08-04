"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getTypeName } from "@/lib/classes";
import { CalendarDays, ChevronLeft, ChevronRight, Trophy, Skull, Handshake, CalendarOff } from "lucide-react";
import { PageHeader, Loading, Empty, Card, CardHeader } from "@/components/ui";

interface CalendarWar {
  id: number;
  title: string;
  type: string;
  date: string;
  result: string | null;
  _count: { participants: number };
}

const DAYS_TR = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MONTHS_TR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

const TYPE_COLOR: Record<string, string> = {
  NODE_WAR: "#d4a030",
  SIEGE: "#e05252",
  KARA_TAPINAK: "#a855f7",
  OTHER: "#4a7cf5",
};

const RESULT_ICON = { WIN: Trophy, LOSS: Skull, DRAW: Handshake } as const;
const RESULT_TONE = { WIN: "text-emerald-400", LOSS: "text-red-400", DRAW: "text-bdo-text-muted" } as const;

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

  if (status === "loading") return <Loading />;
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

  function shiftMonth(dir: -1 | 1) {
    setSelectedDay(null);
    const m = month + dir;
    if (m < 1) { setMonth(12); setYear(year - 1); }
    else if (m > 12) { setMonth(1); setYear(year + 1); }
    else setMonth(m);
  }

  return (
    <div>
      <PageHeader
        title="Takvim"
        desc="Savaş ve etkinlik takvimi — güne tıklayarak detayları gör."
        icon={CalendarDays}
      />

      <div className="grid md:grid-cols-[1fr_300px] gap-4 items-start">
        {/* Calendar */}
        <Card>
          <div className="card-header">
            <button
              onClick={() => shiftMonth(-1)}
              className="p-1 rounded-md text-bdo-text-secondary hover:text-bdo-text-primary hover:bg-bdo-surface-2 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" strokeWidth={2} />
            </button>
            <span className="card-title">{MONTHS_TR[month - 1]} {year}</span>
            <button
              onClick={() => shiftMonth(1)}
              className="p-1 rounded-md text-bdo-text-secondary hover:text-bdo-text-primary hover:bg-bdo-surface-2 transition-colors"
            >
              <ChevronRight className="w-4 h-4" strokeWidth={2} />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAYS_TR.map((d) => (
                <div key={d} className="text-[10px] text-bdo-text-secondary text-center uppercase tracking-wider py-1 font-medium">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startDay }).map((_, i) => <div key={`e${i}`} className="aspect-square" />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayWars = warMap.get(day);
                const isToday = isCurrentMonth && today.getDate() === day;
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center gap-1 text-[12px] transition-all border ${
                      isSelected
                        ? "border-bdo-gold/50 bg-bdo-gold/10 text-bdo-gold font-bold"
                        : isToday
                        ? "border-bdo-border-2 bg-bdo-surface-2 text-bdo-text-primary font-semibold"
                        : dayWars
                        ? "border-bdo-border text-bdo-text-primary hover:border-bdo-border-2 hover:bg-bdo-surface-2"
                        : "border-transparent text-bdo-text-secondary hover:bg-bdo-surface-2/50"
                    }`}
                  >
                    {day}
                    <div className="flex gap-0.5 h-1">
                      {dayWars?.slice(0, 3).map((w) => (
                        <span
                          key={w.id}
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: TYPE_COLOR[w.type] ?? TYPE_COLOR.OTHER }}
                        />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex gap-3 flex-wrap px-4 py-2.5 border-t border-bdo-border">
            {Object.entries(TYPE_COLOR).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5 text-[10px] text-bdo-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                {getTypeName(type)}
              </div>
            ))}
          </div>
        </Card>

        {/* Day detail */}
        <Card>
          <CardHeader
            title={selectedDay ? `${selectedDay} ${MONTHS_TR[month - 1]}` : "Gün Detayı"}
            meta={selectedDay ? `${selectedWars.length} etkinlik` : undefined}
          />
          {!selectedDay ? (
            <Empty icon={CalendarDays} text="Detayları görmek için bir gün seç." />
          ) : selectedWars.length === 0 ? (
            <Empty icon={CalendarOff} text="Bu gün için etkinlik yok." />
          ) : (
            selectedWars.map((war) => {
              const ResultIcon = war.result ? RESULT_ICON[war.result as keyof typeof RESULT_ICON] : null;
              return (
                <Link key={war.id} href={`/wars/${war.id}`} className="card-row gap-2.5">
                  <span
                    className="w-1 self-stretch rounded-full flex-shrink-0 min-h-[32px]"
                    style={{ backgroundColor: TYPE_COLOR[war.type] ?? TYPE_COLOR.OTHER }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-bdo-text-primary truncate leading-tight">{war.title}</p>
                    <p className="text-[10px] text-bdo-text-secondary leading-tight mt-0.5">
                      {new Date(war.date).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}{getTypeName(war.type)}
                      {" · "}{war._count.participants} kişi
                    </p>
                  </div>
                  {ResultIcon && (
                    <ResultIcon
                      className={`w-3.5 h-3.5 flex-shrink-0 ${RESULT_TONE[war.result as keyof typeof RESULT_TONE]}`}
                      strokeWidth={1.75}
                    />
                  )}
                </Link>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}
