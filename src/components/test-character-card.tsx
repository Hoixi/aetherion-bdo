"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import { getClassByID, getClassBannerUrl, getClassIconUrl, getPortraitUrl } from "@/lib/classes";
import { Card, GuildTag, fmt, type Guild } from "@/components/test-shell";

/**
 * Oturum sahibinin kendi karakter kartı.
 *
 * Panelin en üstünde duruyor: klan geneline bakmadan önce insanın kendi
 * durumunu görmesi isteniyor.
 *
 * Banner eski dashboard hero'sundaki gibi kuruluyor — görseli soldurmak
 * yerine tam opak bırakıp üstüne yönlü gradyan seriyoruz, böylece karakter
 * sağda net görünürken soldaki yazı okunur kalıyor. Yükseklik sabit;
 * içeriğe bırakılırsa kart uzayıp gidiyor.
 */

export type Me = {
  name: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  gs: number;
  avatarUrl: string | null;
  guild: Guild;
  role: { name: string; color: string } | null;
  attended: number;
  absences: number;
  gsRank: number | null;
  gearedCount: number;
  stats: {
    rank: number; of: number; wars: number;
    kills: number; deaths: number; damage: number; castle: number; cc: number;
    avgDamage: number; kd: number;
  } | null;
};

export function CharacterCard({ me, warsCounted }: { me: Me; warsCounted: number }) {
  const [bannerFailed, setBannerFailed] = useState(false);

  const cls = getClassByID(me.class);
  const banner = cls && !bannerFailed ? getClassBannerUrl(cls.classType) : null;
  const icon = getClassIconUrl(me.class);
  const portrait = getPortraitUrl(me.class, me.spec);
  const specKey = me.spec === "succession" ? "SUC" : "AWK";

  if (!me.name) {
    return (
      <Card className="p-5 flex items-center gap-3 flex-wrap">
        <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>
          Karakterin tanımlı değil — aile adı ve class girersen burada görünür.
        </span>
        <Link href="/test/profil/duzenle" className="t-tab" data-on>
          Profili doldur <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </Card>
    );
  }

  /** Alt şeritteki kutular — sabit yüksekliğe sığacak kadar */
  const boxes: [string, string, string?][] = [
    ["AP", String(me.ap)],
    ["DP", String(me.dp)],
    ["GS", String(me.gs), me.gsRank ? `${me.gsRank}. / ${me.gearedCount}` : undefined],
  ];
  if (me.stats) {
    boxes.push(
      ["HASAR", fmt(me.stats.damage), `maç başı ${fmt(me.stats.avgDamage)}`],
      ["KALE", fmt(me.stats.castle), `${me.stats.cc} CC`],
      ["K / Ö", `${me.stats.kills}/${me.stats.deaths}`, `oran ${me.stats.kd}`],
    );
  }
  boxes.push([
    "KATILIM",
    String(me.attended),
    me.absences > 0 ? `${me.absences} devamsızlık` : "devamsızlık yok",
  ]);

  return (
    <Card hi className="relative overflow-hidden h-[210px] sm:h-[230px]">
      {banner ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" onError={() => setBannerFailed(true)}
               className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
               style={{ objectPosition: "center 26%" }} />
          {/* Soldan sağa: yazının olduğu taraf kapalı, karakter tarafı açık */}
          <div className="absolute inset-0"
               style={{ background: "linear-gradient(90deg, var(--t-surface) 0%, rgba(11,11,12,.78) 42%, rgba(11,11,12,.12) 100%)" }} />
          {/* Alt şerit — stat kutuları buraya oturuyor */}
          <div className="absolute inset-x-0 bottom-0 h-28"
               style={{ background: "linear-gradient(0deg, var(--t-surface) 12%, rgba(11,11,12,.72) 60%, transparent 100%)" }} />
          {/* Üst kenar yumuşatma */}
          <div className="absolute inset-x-0 top-0 h-12"
               style={{ background: "linear-gradient(180deg, rgba(11,11,12,.75), transparent)" }} />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: "var(--t-surface)" }} />
      )}

      <div className="relative h-full flex flex-col justify-between p-4 sm:p-5">
        {/* Kimlik */}
        <div className="flex items-start gap-3">
          {me.avatarUrl || portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatarUrl || portrait} alt=""
                 className="w-11 h-11 rounded-xl object-cover object-top flex-shrink-0"
                 style={{ boxShadow: "0 6px 20px rgba(0,0,0,.65)", outline: "1px solid rgba(255,255,255,.14)" }} />
          ) : null}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[19px] font-bold leading-tight tracking-tight"
                  style={{ textShadow: "0 2px 10px rgba(0,0,0,.9)" }}>
                {me.name}
              </h2>
              <GuildTag g={me.guild} />
              {me.role && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border backdrop-blur-sm"
                      style={{ color: me.role.color, borderColor: me.role.color + "50",
                               background: me.role.color + "1c" }}>
                  {me.role.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon} alt="" className="w-3.5 h-3.5 opacity-75 flex-shrink-0" />
              )}
              <span className="text-[12px]" style={{ color: "rgba(255,255,255,.72)",
                                                     textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
                {cls?.name ?? "Class seçilmemiş"}
              </span>
              {cls && (
                <span className="text-[9px] font-bold uppercase tracking-wider rounded px-1 py-0.5 backdrop-blur-sm"
                      style={{ color: "rgba(255,255,255,.65)", border: "1px solid rgba(255,255,255,.2)",
                               background: "rgba(0,0,0,.32)" }}>
                  {specKey}
                </span>
              )}
            </div>
          </div>

          <Link href="/test/profil"
                className="ml-auto flex items-center gap-1 text-[12px] flex-shrink-0 hover:opacity-80"
                style={{ color: "var(--t-gold)", textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
            Detay <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Sıralama satırı */}
        <div className="flex items-center gap-1.5 text-[11px]"
             style={{ color: "rgba(255,255,255,.72)", textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
          <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--t-gold)" }} />
          {me.stats ? (
            <span>
              Son {warsCounted} savaşta hasar sıralaman{" "}
              <strong style={{ color: "var(--t-text)" }}>
                {me.stats.rank}. / {me.stats.of}
              </strong>{" "}
              · {me.stats.wars} savaş oynadın
            </span>
          ) : (
            <span>Sayılan son {warsCounted} savaşta performans kaydın yok.</span>
          )}
        </div>

        {/* Stat kutuları */}
        <div className="flex items-stretch gap-2 overflow-x-auto">
          {boxes.map(([label, value, hint]) => (
            <div key={label}
                 className="flex-1 min-w-[74px] rounded-[var(--t-r-sm)] px-2.5 py-2 backdrop-blur-sm"
                 style={{ background: "rgba(20,20,22,.72)", border: "1px solid rgba(255,255,255,.08)" }}>
              <div className="text-[9px] uppercase tracking-[0.08em]"
                   style={{ color: "var(--t-faint)" }}>{label}</div>
              <div className="t-num text-[17px] font-bold leading-none mt-1"
                   style={label === "GS" ? { color: "var(--t-gold)" } : undefined}>{value}</div>
              {hint && (
                <div className="text-[9px] mt-1 truncate" style={{ color: "var(--t-faint)" }}>{hint}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
