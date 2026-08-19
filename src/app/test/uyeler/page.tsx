"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Shield, CalendarCheck, ArrowUpDown, LayoutGrid, List } from "lucide-react";
import { getClassByID, getClassBannerUrl, getClassIconUrl, getPortraitUrl } from "@/lib/classes";
import { TestShell, Card, GuildTag, Empty, loadJson, type Guild } from "@/components/test-shell";

/**
 * Kadro ekranı.
 *
 * Kadro iki klanı birlikte gösteriyor — oyun içinde zaten görünür bilgi ve
 * müttefiklerle birlikte savaşılıyor. Gizli kalan toplu performans verisi
 * burada değil, analiz ekranlarında.
 */

type Member = {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  absenceCount: number;
  guild: (Guild & { id: number; name: string }) | null;
  siteRole: { name: string; color: string } | null;
  _count: { participations: number };
};

type Sort = "gs" | "name" | "attend";

const SORTS: [Sort, string][] = [
  ["gs", "Gear"],
  ["attend", "Katılım"],
  ["name", "İsim"],
];

export default function UyelerPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [guild, setGuild] = useState<string>("hepsi");
  const [sort, setSort] = useState<Sort>("gs");
  const [grid, setGrid] = useState(true);

  useEffect(() => {
    loadJson<Member[]>("/api/members")
      .then(setMembers)
      .catch((e: Error) => setErr(e.message));
  }, []);

  const guilds = useMemo(() => {
    const seen = new Map<string, { tag: string; color: string; n: number }>();
    for (const m of members ?? []) {
      if (!m.guild) continue;
      const cur = seen.get(m.guild.tag) ?? { tag: m.guild.tag, color: m.guild.color, n: 0 };
      cur.n++;
      seen.set(m.guild.tag, cur);
    }
    return Array.from(seen.values()).sort((a, b) => b.n - a.n);
  }, [members]);

  const shown = useMemo(() => {
    let list = members ?? [];
    if (guild !== "hepsi") list = list.filter((m) => m.guild?.tag === guild);

    const needle = q.trim().toLocaleLowerCase("tr");
    if (needle) {
      list = list.filter((m) => {
        const cls = getClassByID(m.class)?.name ?? "";
        return (
          m.familyName.toLocaleLowerCase("tr").includes(needle) ||
          cls.toLocaleLowerCase("tr").includes(needle) ||
          (m.siteRole?.name ?? "").toLocaleLowerCase("tr").includes(needle)
        );
      });
    }

    return [...list].sort((a, b) => {
      if (sort === "name") return a.familyName.localeCompare(b.familyName, "tr");
      if (sort === "attend") return b._count.participations - a._count.participations;
      return b.ap + b.dp - (a.ap + a.dp);
    });
  }, [members, q, guild, sort]);

  const avgGs = useMemo(() => {
    const geared = shown.filter((m) => m.ap + m.dp > 0);
    if (!geared.length) return 0;
    return Math.round(geared.reduce((s, m) => s + m.ap + m.dp, 0) / geared.length);
  }, [shown]);

  return (
    <TestShell
      title="Üyeler"
      subtitle={
        members
          ? `${shown.length} kişi görünüyor · ortalama GS ${avgGs}`
          : "Yükleniyor…"
      }
      aside={guilds.map((g) => (
        <span key={g.tag} className="t-chip hidden sm:inline"
              style={{ color: g.color, borderColor: g.color + "40" }}>
          {g.tag} {g.n}
        </span>
      ))}
    >
      {/* Filtre çubuğu */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--t-faint)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="İsim, class ya da rol ara"
                 className="pl-9 pr-3 h-[34px] rounded-full text-[12px] w-[240px] outline-none"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                          color: "var(--t-text)" }} />
        </div>

        <button className="t-tab" data-on={guild === "hepsi"} onClick={() => setGuild("hepsi")}>
          Hepsi
        </button>
        {guilds.map((g) => (
          <button key={g.tag} className="t-tab" data-on={guild === g.tag}
                  onClick={() => setGuild(g.tag)}>
            <span style={{ color: g.color }}>{g.tag}</span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.08em]"
                style={{ color: "var(--t-faint)" }}>
            <ArrowUpDown className="w-3 h-3" /> Sırala
          </span>
          {SORTS.map(([k, label]) => (
            <button key={k} className="t-tab" data-on={sort === k} onClick={() => setSort(k)}>
              {label}
            </button>
          ))}
          <button className="t-tab" onClick={() => setGrid((v) => !v)}
                  title={grid ? "Liste görünümü" : "Kart görünümü"}>
            {grid ? <List className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
      {!members && !err && <Empty>Kadro geliyor…</Empty>}
      {members && shown.length === 0 && <Empty>Aramaya uyan kimse yok.</Empty>}

      {shown.length > 0 && (grid ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {shown.map((m) => <MemberCard key={m.id} m={m} />)}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[620px]">
              <div className="px-5 py-2.5 grid grid-cols-[32px_1fr_70px_70px_80px_70px] gap-3
                              text-[10px] uppercase tracking-[0.07em]"
                   style={{ color: "var(--t-faint)", borderBottom: "1px solid var(--t-line)" }}>
                <span>#</span><span>Üye</span><span>AP</span><span>DP</span>
                <span>GS</span><span className="text-right">Katılım</span>
              </div>
              {shown.map((m, i) => (
                <Link key={m.id} href={`/test/uyeler/${m.id}`}
                     className="t-row px-5 py-2.5 grid grid-cols-[32px_1fr_70px_70px_80px_70px] gap-3 items-center">
                  <span className="t-num text-[12px] font-bold"
                        style={{ color: i < 3 && sort === "gs" ? "var(--t-gold)" : "var(--t-faint)" }}>
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex items-center gap-2">
                    <ClassIcon cls={m.class} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12.5px] truncate">{m.familyName}</span>
                        <GuildTag g={m.guild} />
                      </div>
                      <div className="text-[10px]" style={{ color: "var(--t-faint)" }}>
                        {getClassByID(m.class)?.name ?? "—"}
                      </div>
                    </div>
                  </div>
                  <span className="t-num text-[12px]">{m.ap || "—"}</span>
                  <span className="t-num text-[12px]">{m.dp || "—"}</span>
                  <span className="t-num text-[12px] font-bold" style={{ color: "var(--t-gold)" }}>
                    {m.ap + m.dp || "—"}
                  </span>
                  <span className="t-num text-[12px] text-right">{m._count.participations}</span>
                </Link>
              ))}
            </div>
          </div>
        </Card>
      ))}

      <div className="pb-6" />
    </TestShell>
  );
}

function ClassIcon({ cls }: { cls: string }) {
  const icon = getClassIconUrl(cls);
  if (!icon) return <span className="w-5 flex-shrink-0" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={icon} alt="" className="w-5 h-5 opacity-70 flex-shrink-0" />;
}

function MemberCard({ m }: { m: Member }) {
  const portrait = getPortraitUrl(m.class, m.spec);
  const cls = getClassByID(m.class);
  const banner = cls ? getClassBannerUrl(cls.classType) : "";
  const gs = m.ap + m.dp;

  return (
    <Link href={`/test/uyeler/${m.id}`} className="block">
    <Card className="p-4 flex items-center gap-3 overflow-hidden relative h-[104px]
                     transition-colors hover:border-[rgba(232,180,81,.3)]">
      {/* Banner tam opak, okunurluk gradyanla sağlanıyor — soldurulunca
          karakter seçilmiyordu. Yükseklik sabit ki kartlar ızgarada
          birbirini tutsun. */}
      {banner && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" className="w-full h-full object-cover select-none"
               style={{ objectPosition: "center 24%" }} />
          <div className="absolute inset-0"
               style={{ background: "linear-gradient(90deg, var(--t-surface) 0%, rgba(11,11,12,.82) 46%, rgba(11,11,12,.20) 100%)" }} />
        </div>
      )}

      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0"
           style={{ background: "var(--t-raised)", outline: "1px solid rgba(255,255,255,.14)",
                    boxShadow: "0 4px 14px rgba(0,0,0,.6)" }}>
        {portrait && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portrait} alt="" className="w-full h-full object-cover object-top" />
        )}
      </div>

      <div className="relative min-w-0 flex-1"
           style={{ textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
        <div className="flex items-center gap-1.5">
          <span className="text-[13.5px] font-medium truncate">{m.familyName}</span>
          <GuildTag g={m.guild} />
        </div>
        <div className="text-[11px] mt-0.5 truncate" style={{ color: "var(--t-faint)" }}>
          {getClassByID(m.class)?.name ?? "Class yok"}
          {m.spec ? ` · ${m.spec === "succession" ? "Succ" : "Awak"}` : ""}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {m.siteRole && (
            <span className="t-chip" style={{ color: m.siteRole.color, borderColor: m.siteRole.color + "50" }}>
              {m.siteRole.name}
            </span>
          )}
          <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--t-faint)" }}>
            <CalendarCheck className="w-3 h-3" /> {m._count.participations}
          </span>
        </div>
      </div>

      <div className="relative text-right flex-shrink-0"
           style={{ textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
        <div className="flex items-center gap-1 justify-end">
          <Shield className="w-3 h-3" style={{ color: "var(--t-faint)" }} />
          <span className="t-num text-[16px] font-bold"
                style={{ color: gs ? "var(--t-gold)" : "var(--t-faint)" }}>
            {gs || "—"}
          </span>
        </div>
        <div className="text-[10px] mt-0.5" style={{ color: "var(--t-faint)" }}>
          {gs ? `${m.ap} / ${m.dp}` : "gear yok"}
        </div>
      </div>
    </Card>
    </Link>
  );
}
