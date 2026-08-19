"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ChevronLeft, Search, Check, Save, Shield, Swords, AlertTriangle, Sparkles,
} from "lucide-react";
import {
  BDO_CLASSES, getClassByID, getClassBannerUrl, getClassIconUrl, getPortraitUrl,
  hasClassVariants,
} from "@/lib/classes";
import { TestShell, Card, Head, Empty, GuildTag, loadJson, type Guild } from "@/components/test-shell";

/**
 * Profil düzenleme.
 *
 * Eski ekran bir formdu; burada seçim görsel: class'ı adından değil
 * ikonundan seçiyorsun, seçtiğin anda üstteki önizleme kartı savaşta
 * nasıl görüneceğini gösteriyor. AP/DP değişikliği gear geçmişine
 * yazıldığı için kaydetmeden önce farkı da söylüyoruz.
 */

type Profile = {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  avatarUrl: string | null;
  guild: (Guild & { id: number; name: string }) | null;
  siteRole: { name: string; color: string } | null;
  participations: { id: number; war: { id: number; title: string; date: string } }[];
};

export default function ProfilDuzenlePage() {
  const { data: session } = useSession();
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [familyName, setFamilyName] = useState("");
  const [cls, setCls] = useState("");
  const [spec, setSpec] = useState("awakening");
  const [ap, setAp] = useState("");
  const [dp, setDp] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    loadJson<Profile>("/api/user/profile")
      .then((u) => {
        setP(u);
        setFamilyName(u.familyName ?? "");
        setCls(u.class ?? "");
        setSpec(u.spec || "awakening");
        setAp(String(u.ap ?? 0));
        setDp(String(u.dp ?? 0));
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 3000);
    return () => clearTimeout(t);
  }, [msg]);

  const classes = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr");
    if (!needle) return BDO_CLASSES;
    return BDO_CLASSES.filter((c) => c.name.toLocaleLowerCase("tr").includes(needle));
  }, [q]);

  const picked = getClassByID(cls);
  const canSwapSpec = cls ? hasClassVariants(cls) : false;
  const banner = picked ? getClassBannerUrl(picked.classType) : "";
  const portrait = cls ? getPortraitUrl(cls, spec) : "";

  const apNum = Number(ap) || 0;
  const dpNum = Number(dp) || 0;
  const gs = apNum + dpNum;
  const gsDiff = p ? gs - (p.ap + p.dp) : 0;

  const dirty = Boolean(p && (
    familyName !== (p.familyName ?? "") ||
    cls !== (p.class ?? "") ||
    spec !== (p.spec || "awakening") ||
    apNum !== p.ap || dpNum !== p.dp
  ));

  // Varyantı olmayan class'ta succession seçili kalmasın
  useEffect(() => {
    if (cls && !hasClassVariants(cls) && spec !== "awakening") setSpec("awakening");
  }, [cls, spec]);

  async function save() {
    if (!dirty) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familyName, class: cls, spec, ap: apNum, dp: dpNum }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b.error ?? "Kaydedilemedi.");
        return;
      }
      const fresh = await loadJson<Profile>("/api/user/profile");
      setP(fresh);
      setMsg(gsDiff !== 0 ? `Kaydedildi · GS ${gsDiff > 0 ? "+" : ""}${gsDiff}` : "Kaydedildi.");
    } catch {
      setErr("Sunucuya ulaşılamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <TestShell
      title="Profili Düzenle"
      subtitle="Aile adın, class'ın ve gear'ın — savaş raporları ve sıralamalar bunları kullanıyor"
      aside={
        <>
          {msg && <span className="t-chip" style={{ color: "var(--t-good)" }}>{msg}</span>}
          <Link href="/test/profil" className="t-tab">
            <ChevronLeft className="w-3.5 h-3.5" /> Karakterim
          </Link>
        </>
      }
    >
      {err && <Card className="p-4"><p className="text-[13px]" style={{ color: "var(--t-bad)" }}>{err}</p></Card>}
      {!p && !err && <Empty>Profil geliyor…</Empty>}

      {p && (
        <>
          {/* Önizleme — seçtiğin şey nasıl görünecek */}
          <Card hi className="overflow-hidden relative">
            {banner && (
              <div className="absolute inset-0 pointer-events-none" aria-hidden>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={banner} alt="" className="w-full h-full object-cover select-none"
                     style={{ objectPosition: "center 26%" }} />
                <div className="absolute inset-0"
                     style={{ background: "linear-gradient(95deg, var(--t-surface) 30%, rgba(11,11,12,.72) 58%, rgba(11,11,12,.15) 100%)" }} />
              </div>
            )}
            <div className="relative flex items-center gap-4 p-5 flex-wrap">
              {portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={portrait} alt="" className="w-[76px] h-[76px] rounded-2xl object-cover object-top"
                     style={{ background: "var(--t-raised)", outline: "1px solid rgba(255,255,255,.14)",
                              boxShadow: "0 6px 20px rgba(0,0,0,.6)" }} />
              ) : (
                <div className="w-[76px] h-[76px] rounded-2xl grid place-items-center"
                     style={{ background: "var(--t-raised)", border: "1px dashed var(--t-line-strong)" }}>
                  <Sparkles className="w-5 h-5" style={{ color: "var(--t-faint)" }} />
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[19px] font-bold tracking-tight truncate"
                        style={{ textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
                    {familyName || "Aile adı yok"}
                  </span>
                  <GuildTag g={p.guild} />
                </div>
                <div className="text-[12px] mt-1"
                     style={{ color: "var(--t-dim)", textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>
                  {picked?.name ?? "Class seçilmedi"}
                  {canSwapSpec ? ` · ${spec === "succession" ? "Succession" : "Awakening"}` : ""}
                </div>
                {p.siteRole && (
                  <span className="t-chip inline-block mt-2 backdrop-blur-sm"
                        style={{ color: p.siteRole.color, borderColor: p.siteRole.color + "50",
                                 background: p.siteRole.color + "14" }}>
                    {p.siteRole.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-5 ml-auto">
                {[["AP", apNum], ["DP", dpNum], ["GS", gs]].map(([l, v]) => (
                  <div key={l as string}>
                    <div className="text-[10px] uppercase tracking-[0.08em]"
                         style={{ color: "var(--t-faint)", textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>{l}</div>
                    <div className="t-num text-[24px] font-bold leading-tight"
                         style={{ color: l === "GS" ? "var(--t-gold)" : undefined,
                                  textShadow: "0 1px 6px rgba(0,0,0,.9)" }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
            {/* Class seçimi */}
            <Card className="overflow-hidden">
              <Head icon={Swords} title="Class"
                    meta={picked ? picked.name : `${BDO_CLASSES.length} seçenek`} />
              <div className="p-4">
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--t-faint)" }} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Class ara"
                         className="pl-9 pr-3 h-[34px] w-full rounded-full text-[12px] outline-none"
                         style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                  color: "var(--t-text)" }} />
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-6 gap-2">
                  {classes.map((c) => {
                    const on = cls === c.id;
                    const icon = getClassIconUrl(c.id);
                    return (
                      <button key={c.id} onClick={() => setCls(c.id)}
                              className="flex flex-col items-center gap-1.5 px-2 py-2.5 rounded-[var(--t-r-sm)]
                                         transition-colors"
                              style={{
                                background: on ? "var(--t-gold-soft)" : "var(--t-raised)",
                                border: `1px solid ${on ? "rgba(232,180,81,.45)" : "transparent"}`,
                              }}>
                        {icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={icon} alt="" className="w-6 h-6"
                               style={{ opacity: on ? 1 : 0.6 }} />
                        ) : <span className="w-6 h-6" />}
                        <span className="text-[10.5px] text-center leading-tight truncate w-full"
                              style={{ color: on ? "var(--t-gold)" : "var(--t-dim)" }}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {classes.length === 0 && (
                  <p className="text-[12px] text-center py-6" style={{ color: "var(--t-faint)" }}>
                    Aramaya uyan class yok.
                  </p>
                )}

                {/* Spec — yalnızca ayrımı olan class'larda */}
                {cls && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--t-line)" }}>
                    <div className="text-[10px] uppercase tracking-[0.08em] mb-2"
                         style={{ color: "var(--t-faint)" }}>Spec</div>
                    {canSwapSpec ? (
                      <div className="flex rounded-md overflow-hidden"
                           style={{ border: "1px solid var(--t-line)" }}>
                        {(["awakening", "succession"] as const).map((s) => (
                          <button key={s} onClick={() => setSpec(s)}
                                  className="flex-1 text-[12px] py-2 font-medium transition-colors"
                                  style={spec === s
                                    ? { background: "var(--t-gold-soft)", color: "var(--t-gold)" }
                                    : { color: "var(--t-faint)" }}>
                            {s === "awakening" ? "Awakening" : "Succession"}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>
                        {picked?.name} için ayrı spec yok.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Kimlik + gear */}
            <div className="space-y-5">
              <Card className="overflow-hidden">
                <Head icon={Shield} title="Kimlik" />
                <div className="p-4 space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-[0.08em] block mb-1.5"
                           style={{ color: "var(--t-faint)" }}>Aile adı</label>
                    <input value={familyName} onChange={(e) => setFamilyName(e.target.value)}
                           placeholder="Oyundaki aile adın"
                           className="w-full px-3 h-[38px] rounded-lg text-[13px] outline-none"
                           style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                    color: "var(--t-text)" }} />
                    <p className="text-[10.5px] mt-1.5" style={{ color: "var(--t-faint)" }}>
                      Savaş raporları bu adla eşleşiyor — oyundakiyle birebir aynı olmalı.
                    </p>
                  </div>

                  {session?.user.image && (
                    <div className="flex items-center gap-2.5 pt-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={session.user.image} alt="" className="w-8 h-8 rounded-full"
                           style={{ outline: "1px solid var(--t-line)" }} />
                      <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                        Avatar Discord&apos;dan geliyor, burada değiştirilemiyor.
                      </span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="overflow-hidden">
                <Head icon={Swords} title="Gear"
                      meta={gsDiff !== 0 ? `${gsDiff > 0 ? "+" : ""}${gsDiff} GS` : undefined} />
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {([["AP", ap, setAp], ["DP", dp, setDp]] as const).map(([label, val, set]) => (
                      <div key={label}>
                        <label className="text-[10px] uppercase tracking-[0.08em] block mb-1.5"
                               style={{ color: "var(--t-faint)" }}>{label}</label>
                        <input value={val} onChange={(e) => set(e.target.value.replace(/[^\d]/g, ""))}
                               inputMode="numeric"
                               className="w-full px-3 h-[38px] rounded-lg text-[15px] font-mono outline-none"
                               style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                                        color: "var(--t-text)" }} />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-baseline justify-between px-1">
                    <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>Gear puanı</span>
                    <span className="t-num text-[20px] font-bold" style={{ color: "var(--t-gold)" }}>{gs}</span>
                  </div>

                  {gsDiff !== 0 && (
                    <p className="flex items-start gap-1.5 text-[11px]" style={{ color: "var(--t-dim)" }}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px"
                                     style={{ color: "var(--t-gold)" }} />
                      Kaydedince gear geçmişine yeni bir kayıt düşecek
                      ({p.ap + p.dp} → {gs}).
                    </p>
                  )}
                </div>
              </Card>

              <button onClick={save} disabled={!dirty || busy}
                      className="t-tab w-full !justify-center !py-2.5" data-on={dirty}
                      style={!dirty ? { opacity: 0.5, cursor: "default" } : undefined}>
                {busy ? "Kaydediliyor…" : dirty
                  ? <><Save className="w-3.5 h-3.5" /> Değişiklikleri kaydet</>
                  : <><Check className="w-3.5 h-3.5" /> Kayıtlı</>}
              </button>
            </div>
          </div>
        </>
      )}

      <div className="pb-6" />
    </TestShell>
  );
}
