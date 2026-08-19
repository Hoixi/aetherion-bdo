"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Swords, ChevronRight, Trophy, Users, Clock, CheckCircle2, XCircle,
  CircleDashed, Search,
} from "lucide-react";
import { getTypeName } from "@/lib/classes";
import { TestShell, Card, Head, Empty, loadJson } from "@/components/test-shell";

/**
 * Savaş listesi.
 *
 * Yaklaşanlar ve geçmiş ayrı: yaklaşan savaşta insanın bakacağı şey kendi
 * katılım durumu, geçmişte ise sonuç ve rapor girilip girilmediği.
 */

type War = {
  id: number;
  title: string;
  type: string;
  date: string;
  deadline: string | null;
  result: "WIN" | "LOSS" | null;
  isAllyWar: boolean;
  maxParticipants: number | null;
  _count: { participants: number };
  /** Yalnızca kendi kaydımız gelir — boşsa cevap vermemişiz */
  participants: { status: "ATTENDING" | "DECLINED" }[];
};

const TYPES = ["Hepsi", "NODE_WAR", "SIEGE", "KARA_TAPINAK", "OTHER"];

export default function SavaslarPage() {
  const [wars, setWars] = useState<War[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [type, setType] = useState("Hepsi");
  const [q, setQ] = useState("");

  useEffect(() => {
    loadJson<War[]>("/api/wars")
      .then(setWars)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const filtered = useMemo(() => {
    let list = wars ?? [];
    if (type !== "Hepsi") list = list.filter((w) => w.type === type);
    const needle = q.trim().toLocaleLowerCase("tr");
    if (needle) list = list.filter((w) => w.title.toLocaleLowerCase("tr").includes(needle));
    return list;
  }, [wars, type, q]);

  // Sunucu tarihe göre azalan veriyor; yaklaşanları öne alıp kendi içinde
  // yakından uzağa sıralıyoruz
  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up: War[] = [];
    const old: War[] = [];
    for (const w of filtered) (new Date(w.date).getTime() >= now ? up : old).push(w);
    up.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    return { upcoming: up, past: old };
  }, [filtered]);

  const stats = useMemo(() => {
    const done = (wars ?? []).filter((w) => w.result);
    return {
      wins: done.filter((w) => w.result === "WIN").length,
      losses: done.filter((w) => w.result === "LOSS").length,
      mine: (wars ?? []).filter((w) => w.participants[0]?.status === "ATTENDING").length,
    };
  }, [wars]);

  return (
    <TestShell
      title="Savaşlar"
      subtitle={
        wars
          ? `${wars.length} kayıt · ${stats.wins}G ${stats.losses}M · ${stats.mine} tanesine katıldın`
          : "Yükleniyor…"
      }
      aside={
        wars ? (
          <span className="t-chip hidden sm:inline">
            {upcoming.length} yaklaşan
          </span>
        ) : null
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--t-faint)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Savaş adı ara"
                 className="pl-9 pr-3 h-[34px] rounded-full text-[12px] w-[220px] outline-none"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                          color: "var(--t-text)" }} />
        </div>
        {TYPES.map((t) => (
          <button key={t} className="t-tab" data-on={type === t} onClick={() => setType(t)}>
            {t === "Hepsi" ? "Hepsi" : getTypeName(t)}
          </button>
        ))}
      </div>

      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
      {!wars && !err && <Empty>Savaşlar geliyor…</Empty>}
      {wars && filtered.length === 0 && <Empty>Bu filtreye uyan savaş yok.</Empty>}

      {upcoming.length > 0 && (
        <Card hi className="overflow-hidden">
          <Head icon={Clock} title="Yaklaşan" meta={`${upcoming.length} SAVAŞ`} />
          {upcoming.map((w) => <WarRow key={w.id} w={w} upcoming />)}
        </Card>
      )}

      {past.length > 0 && (
        <Card className="overflow-hidden">
          <Head icon={Swords} title="Geçmiş" meta={`${past.length} SAVAŞ`} />
          {past.map((w) => <WarRow key={w.id} w={w} />)}
        </Card>
      )}

      <div className="pb-6" />
    </TestShell>
  );
}

function WarRow({ w, upcoming = false }: { w: War; upcoming?: boolean }) {
  const win = w.result === "WIN";
  const loss = w.result === "LOSS";
  const mine = w.participants[0]?.status ?? null;
  const date = new Date(w.date);
  const full = w.maxParticipants ? w._count.participants >= w.maxParticipants : false;

  return (
    <Link href={`/test/savaslar/${w.id}`} className="t-row px-5 py-3.5 flex items-center gap-4 flex-wrap">
      <div className="w-1 h-10 rounded-full flex-shrink-0"
           style={{
             background: upcoming ? "var(--t-gold)"
               : win ? "var(--t-good)" : loss ? "var(--t-bad)" : "var(--t-faint)",
           }} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium truncate">{w.title}</span>
          {!w.isAllyWar && <span className="t-chip flex-shrink-0">KLAN İÇİ</span>}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
          {getTypeName(w.type)} ·{" "}
          {date.toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" })}
          {" · "}
          {date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Kendi durumumuz — yaklaşan savaşta bakılacak ilk şey */}
      <StatusChip status={mine} upcoming={upcoming} />

      {w.result && (
        <span className="text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1"
              style={{
                color: win ? "var(--t-good)" : "var(--t-bad)",
                background: win ? "rgba(56,208,127,.10)" : "rgba(239,95,95,.10)",
              }}>
          <Trophy className="w-3 h-3" />
          {win ? "GALİBİYET" : "MAĞLUBİYET"}
        </span>
      )}

      <div className="text-right w-[86px]">
        <div className="t-num text-[13px] flex items-center justify-end gap-1">
          <Users className="w-3 h-3" style={{ color: "var(--t-faint)" }} />
          {w._count.participants}
          {w.maxParticipants && (
            <span className="text-[11px]" style={{ color: full ? "var(--t-bad)" : "var(--t-faint)" }}>
              /{w.maxParticipants}
            </span>
          )}
        </div>
        <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>katılım</div>
      </div>

      <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "var(--t-faint)" }} />
    </Link>
  );
}

function StatusChip({ status, upcoming }: { status: string | null; upcoming: boolean }) {
  if (status === "ATTENDING") {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1"
            style={{ color: "var(--t-good)", background: "rgba(56,208,127,.10)" }}>
        <CheckCircle2 className="w-3 h-3" /> KATILDIN
      </span>
    );
  }
  if (status === "DECLINED") {
    return (
      <span className="text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1"
            style={{ color: "var(--t-bad)", background: "rgba(239,95,95,.10)" }}>
        <XCircle className="w-3 h-3" /> KATILMADIN
      </span>
    );
  }
  // Geçmiş savaşta cevapsızlık ayrı bir bilgi değil, sadece yaklaşanlarda uyarı
  if (!upcoming) return null;
  return (
    <span className="text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1"
          style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)" }}>
      <CircleDashed className="w-3 h-3" /> CEVAP VER
    </span>
  );
}
