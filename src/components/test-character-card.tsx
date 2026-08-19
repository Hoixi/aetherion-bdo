"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Crown, Flame, Skull, Castle, CalendarCheck } from "lucide-react";
import { getClassByID, getClassBannerUrl, getPortraitUrl } from "@/lib/classes";
import { Card, GuildTag, fmt, type Guild } from "@/components/test-shell";

/**
 * Oturum sahibinin kendi karakter kartı.
 *
 * Düzen üç bölüm: kimlik, gear, son savaşlardaki performans. Yan yana
 * duruyorlar çünkü hepsi tek bakışta okunmak isteniyor — alt alta yayılınca
 * kart uzuyor ve göz gezdirmek yerine kaydırmak gerekiyor.
 *
 * Banner eski dashboard hero'sundaki gibi: görsel tam opak, okunurluk
 * soldan sağa açılan gradyanla sağlanıyor. Soldurmak karakteri kaybediyor.
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

const SHADOW = "0 1px 6px rgba(0,0,0,.9)";

export function CharacterCard({ me, warsCounted }: { me: Me; warsCounted: number }) {
  const [bannerFailed, setBannerFailed] = useState(false);

  const cls = getClassByID(me.class);
  const banner = cls && !bannerFailed ? getClassBannerUrl(cls.classType) : null;
  const portrait = getPortraitUrl(me.class, me.spec);
  const specName = me.spec === "succession" ? "Succession" : "Awakening";

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

  return (
    <Card hi className="overflow-hidden relative">
      {banner && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={banner} alt="" onError={() => setBannerFailed(true)}
               className="w-full h-full object-cover select-none"
               style={{ objectPosition: "center 26%" }} />
          {/* Yazının olduğu sol taraf kapalı, karakter tarafı açık */}
          <div className="absolute inset-0"
               style={{ background: "linear-gradient(95deg, var(--t-surface) 30%, rgba(11,11,12,.72) 58%, rgba(11,11,12,.15) 100%)" }} />
        </div>
      )}

      <div className="relative flex flex-col lg:flex-row lg:items-stretch gap-5 p-5">
        {/* Kimlik */}
        <div className="flex items-center gap-4 min-w-0 lg:w-[290px] flex-shrink-0">
          {portrait ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portrait} alt={cls?.name ?? ""}
                 className="w-[76px] h-[76px] rounded-2xl object-cover object-top flex-shrink-0"
                 style={{ background: "var(--t-raised)", outline: "1px solid rgba(255,255,255,.14)",
                          boxShadow: "0 6px 20px rgba(0,0,0,.6)" }} />
          ) : (
            <div className="w-[76px] h-[76px] rounded-2xl flex-shrink-0"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }} />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[19px] font-bold tracking-tight truncate"
                    style={{ textShadow: SHADOW }}>{me.name}</span>
              <GuildTag g={me.guild} />
            </div>
            <div className="text-[12px] mt-1" style={{ color: "var(--t-dim)", textShadow: SHADOW }}>
              {cls?.name ?? "Class seçilmemiş"} · {specName}
            </div>
            {me.role && (
              <span className="t-chip inline-block mt-2 backdrop-blur-sm"
                    style={{ color: me.role.color, borderColor: me.role.color + "50",
                             background: me.role.color + "14" }}>
                {me.role.name}
              </span>
            )}
          </div>
        </div>

        {/* Gear */}
        <div className="flex items-center gap-5 lg:px-5 lg:border-l lg:border-r"
             style={{ borderColor: "var(--t-line)" }}>
          {[["AP", String(me.ap)], ["DP", String(me.dp)], ["GS", String(me.gs)]].map(([label, v]) => (
            <div key={label}>
              <div className="text-[10px] uppercase tracking-[0.08em]"
                   style={{ color: "var(--t-faint)", textShadow: SHADOW }}>{label}</div>
              <div className="t-num text-[24px] font-bold leading-tight"
                   style={{ color: label === "GS" ? "var(--t-gold)" : undefined, textShadow: SHADOW }}>
                {v}
              </div>
            </div>
          ))}
          {me.gsRank && (
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-[0.08em]"
                   style={{ color: "var(--t-faint)", textShadow: SHADOW }}>Sıra</div>
              <div className="t-num text-[24px] font-bold leading-tight" style={{ textShadow: SHADOW }}>
                {me.gsRank}
                <span className="text-[12px] font-normal" style={{ color: "var(--t-faint)" }}>
                  /{me.gearedCount}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Son savaşlardaki performans */}
        <div className="flex-1 min-w-0">
          {me.stats ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2}
                       style={{ color: "var(--t-gold)" }} />
                <span className="text-[11px]" style={{ color: "var(--t-dim)", textShadow: SHADOW }}>
                  Son {warsCounted} savaşta hasar sıralaması{" "}
                  <strong style={{ color: "var(--t-text)" }}>
                    {me.stats.rank}. / {me.stats.of}
                  </strong>{" "}
                  · {me.stats.wars} savaş oynadın
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Flame, label: "Hasar", value: fmt(me.stats.damage),
                    hint: `maç başı ${fmt(me.stats.avgDamage)}` },
                  { icon: Castle, label: "Kale Hasarı", value: fmt(me.stats.castle),
                    hint: `${me.stats.cc} CC` },
                  { icon: Skull, label: "K / Ö", value: `${me.stats.kills}/${me.stats.deaths}`,
                    hint: `oran ${me.stats.kd}` },
                  { icon: CalendarCheck, label: "Katılım", value: String(me.attended),
                    hint: me.absences > 0 ? `${me.absences} devamsızlık` : "devamsızlık yok" },
                ].map((s) => (
                  <div key={s.label} className="rounded-[var(--t-r-sm)] px-3 py-2.5 backdrop-blur-sm"
                       style={{ background: "rgba(20,20,22,.72)",
                                border: "1px solid rgba(255,255,255,.07)" }}>
                    <div className="flex items-center gap-1.5">
                      <s.icon className="w-3 h-3" strokeWidth={2} style={{ color: "var(--t-faint)" }} />
                      <span className="text-[10px] uppercase tracking-[0.08em]"
                            style={{ color: "var(--t-faint)" }}>{s.label}</span>
                    </div>
                    <div className="t-num text-[17px] font-bold mt-1 leading-none">{s.value}</div>
                    <div className="text-[10px] mt-1 truncate"
                         style={{ color: "var(--t-faint)" }}>{s.hint}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col justify-center gap-2">
              <p className="text-[13px]" style={{ color: "var(--t-dim)", textShadow: SHADOW }}>
                Sayılan son {warsCounted} savaşta performans kaydın yok.
              </p>
              <p className="text-[11px]" style={{ color: "var(--t-faint)", textShadow: SHADOW }}>
                Katıldığın savaş varsa raporu henüz girilmemiş olabilir.
              </p>
            </div>
          )}
        </div>

        <Link href="/test/profil"
              className="lg:self-center flex items-center gap-1 text-[12px] flex-shrink-0 hover:opacity-80"
              style={{ color: "var(--t-gold)", textShadow: SHADOW }}>
          Detay <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </Card>
  );
}
