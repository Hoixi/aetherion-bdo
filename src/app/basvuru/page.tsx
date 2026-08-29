"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserPlus, Search, Check, ArrowLeft, Send, AlertTriangle, ExternalLink } from "lucide-react";
import { BDO_CLASSES, getClassByID, getClassIconUrl, getPortraitUrl } from "@/lib/classes";
import { TestShell, Card } from "@/components/app-shell";

/**
 * Klan başvuru formu.
 *
 * Eski ekran tüm sayfayı kaplayan bir katmandı; menüden açıldığında
 * kabuğu da örtüyordu. Burada normal akışta duruyor. Class seçimi
 * ikonlarla yapılıyor — 30'a yakın class'ı açılır listede bulmak zor.
 */

type PublicGuild = { id: number; name: string; tag: string; color: string; isPrimary: boolean };

export default function BasvuruPage() {
  const [guilds, setGuilds] = useState<PublicGuild[]>([]);
  const [guildId, setGuildId] = useState<number | "">("");
  const [familyName, setFamilyName] = useState("");
  const [discord, setDiscord] = useState("");
  const [bdoClass, setBdoClass] = useState("");
  const [spec, setSpec] = useState("awakening");
  const [ap, setAp] = useState("");
  const [dp, setDp] = useState("");
  const [experience, setExperience] = useState("");
  const [note, setNote] = useState("");
  const [classSearch, setClassSearch] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** Discord daveti panelden yonetiliyor; acik uctan okunuyor. */
  const [davet, setDavet] = useState("");

  useEffect(() => {
    fetch("/api/guilds/public")
      .then((r) => (r.ok ? r.json() : []))
      .then((g: PublicGuild[]) => {
        setGuilds(g);
        setGuildId(g.length === 1 ? g[0].id : (g.find((x) => x.isPrimary)?.id ?? ""));
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!familyName.trim() || !discord.trim()) {
      setError("Aile adı ve Discord kullanıcı adı zorunlu.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyName, discordUsername: discord, guildId: guildId || null,
        class: bdoClass, spec, ap, dp, experience, note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setDone(true);
    else setError(data.error ?? "Başvuru gönderilemedi.");
    setSaving(false);
  }

  const cls = getClassByID(bdoClass);
  const portrait = bdoClass ? getPortraitUrl(bdoClass, spec) : "";
  const gs = (Number(ap) || 0) + (Number(dp) || 0);
  const classes = classSearch
    ? BDO_CLASSES.filter((c) => c.name.toLocaleLowerCase("tr").includes(classSearch.toLocaleLowerCase("tr")))
    : BDO_CLASSES;

  useEffect(() => {
    fetch("/api/landing")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.discordInvite && setDavet(j.discordInvite))
      .catch(() => {});
  }, []);

  if (done) {
    return (
      <TestShell title="Klana Başvur" subtitle="Başvurun bize ulaştı.">
        <Card hi className="max-w-lg p-8 text-center mx-auto">
          <div className="w-14 h-14 rounded-2xl grid place-items-center mx-auto mb-5"
               style={{ background: "rgba(56,208,127,.10)", border: "1px solid rgba(56,208,127,.25)" }}>
            <Check className="w-6 h-6" strokeWidth={2} style={{ color: "var(--t-good)" }} />
          </div>
          <h2 className="text-[17px] font-bold mb-2">Başvurun alındı</h2>
          <p className="text-[13px] leading-relaxed mb-6" style={{ color: "var(--t-dim)" }}>
            Subaylar başvurunu inceleyecek. Kabul edilirse Discord&apos;da rolün otomatik verilecek —
            sunucuya katılmadıysan şimdi katıl ki rol atanabilsin.
          </p>
          {davet && (
            <a href={davet} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13.5px] font-semibold mb-5"
               style={{ background: "#5865F2", color: "#fff" }}>
              Discord sunucusuna katıl
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2.2} />
            </a>
          )}

          <div>
            <Link href="/panel" className="inline-flex items-center gap-2 text-[13px] transition-colors hover:opacity-80"
                  style={{ color: "var(--t-dim)" }}>
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} /> Panele dön
            </Link>
          </div>
        </Card>
      </TestShell>
    );
  }

  return (
    <TestShell
      title="Klana Başvur"
      subtitle="Formu doldur, subaylar değerlendirsin. Kabul edilirsen Discord rolün otomatik verilir."
    >
      {error && (
        <Card className="px-4 py-2.5 flex items-center gap-2 max-w-3xl">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} style={{ color: "var(--t-bad)" }} />
          <span className="text-[13px]" style={{ color: "var(--t-bad)" }}>{error}</span>
        </Card>
      )}

      <form onSubmit={submit} className="space-y-4 max-w-3xl">
        {/* ── Klan ─────────────────────────────────────────────────── */}
        {guilds.length > 1 && (
          <Card className="p-4">
            <Label>Hangi klana başvuruyorsun?</Label>
            <div className="grid grid-cols-2 gap-2">
              {guilds.map((g) => {
                const on = guildId === g.id;
                return (
                  <button key={g.id} type="button" onClick={() => setGuildId(g.id)}
                          className="flex items-center gap-2 p-2.5 rounded-[var(--t-r-sm)] transition-colors"
                          style={{
                            background: on ? g.color + "10" : "var(--t-raised)",
                            border: `1px solid ${on ? g.color + "60" : "var(--t-line)"}`,
                          }}>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0"
                          style={{ color: g.color, borderColor: g.color + "38", background: g.color + "14" }}>
                      {g.tag}
                    </span>
                    <span className="text-[13px] truncate">{g.name}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── Kimlik ───────────────────────────────────────────────── */}
        <Card className="p-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Aile Adı</Label>
              <Input value={familyName} onChange={setFamilyName} maxLength={60} required
                     placeholder="Oyundaki aile adın" />
            </div>
            <div>
              <Label>Discord Kullanıcı Adı</Label>
              <Input value={discord} onChange={setDiscord} maxLength={60} required
                     placeholder="ornek_kullanici" />
              <p className="text-[10px] mt-1" style={{ color: "var(--t-faint)" }}>
                Rol atayabilmemiz için sunucuda seni bulmamız gerek.
              </p>
            </div>
          </div>
        </Card>

        {/* ── Karakter ─────────────────────────────────────────────── */}
        <Card className="p-4 space-y-3.5">
          <div className="flex items-start gap-4">
            <div className="hidden sm:block w-24 flex-shrink-0">
              <div className="rounded-[var(--t-r-sm)] overflow-hidden h-[128px] grid place-items-center"
                   style={{ background: "var(--t-raised)", outline: "1px solid var(--t-line)" }}>
                {portrait ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={portrait} alt="" className="w-full h-full object-cover object-top" />
                ) : (
                  <UserPlus className="w-6 h-6 opacity-30" strokeWidth={1.5} style={{ color: "var(--t-faint)" }} />
                )}
              </div>
              <p className="text-[11px] text-center mt-1.5 truncate" style={{ color: "var(--t-dim)" }}>
                {cls?.name ?? "Class seç"}
              </p>
              {gs > 0 && (
                <p className="t-num text-[13px] text-center font-bold" style={{ color: "var(--t-gold)" }}>
                  {gs} GS
                </p>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>AP</Label>
                  <Input value={ap} onChange={setAp} type="number" placeholder="0" mono />
                </div>
                <div>
                  <Label>DP</Label>
                  <Input value={dp} onChange={setDp} type="number" placeholder="0" mono />
                </div>
              </div>

              {bdoClass && (
                <div>
                  <Label>Spec</Label>
                  <div className="flex gap-2">
                    {(["awakening", "succession"] as const).map((s) => {
                      const off = s === "succession" && !cls?.hasSuccession;
                      return (
                        <button key={s} type="button" disabled={off}
                                onClick={() => !off && setSpec(s)}
                                className="flex-1 h-[34px] rounded-[var(--t-r-sm)] text-[12px] font-semibold transition-colors disabled:opacity-30"
                                style={spec === s
                                  ? { background: "var(--t-gold)", color: "#0b0b0c", border: "1px solid var(--t-gold)" }
                                  : { color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                          {s === "succession" ? "Succession" : "Awakening"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>Class</Label>
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
              <input value={classSearch} onChange={(e) => setClassSearch(e.target.value)}
                     placeholder="Class ara…"
                     className="w-full h-[34px] pl-9 pr-3 rounded-[var(--t-r-sm)] text-[13px] outline-none"
                     style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
            </div>
            <div className="overflow-y-auto rounded-[var(--t-r-sm)]" style={{ maxHeight: 190 }}>
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 p-0.5">
                {classes.map((c) => {
                  const icon = getClassIconUrl(c.id);
                  const on = bdoClass === c.id;
                  return (
                    <button key={c.id} type="button"
                            onClick={() => { setBdoClass(c.id); if (!c.hasSuccession) setSpec("awakening"); }}
                            className="flex flex-col items-center gap-1 p-1.5 rounded-[var(--t-r-sm)] transition-colors"
                            style={{
                              background: on ? "var(--t-gold-soft)" : "var(--t-raised)",
                              border: `1px solid ${on ? "rgba(232,180,81,.5)" : "var(--t-line)"}`,
                            }}>
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={icon} alt="" className={`w-6 h-6 ${on ? "" : "opacity-60"}`} />
                      ) : (
                        <span className="w-6 h-6 rounded" style={{ background: "var(--t-surface)" }} />
                      )}
                      <span className="text-[8px] text-center leading-tight"
                            style={{ color: on ? "var(--t-gold)" : "var(--t-faint)" }}>
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Tecrübe ──────────────────────────────────────────────── */}
        <Card className="p-4 space-y-3">
          <div>
            <Label>PvP Tecrüben</Label>
            <Area value={experience} onChange={setExperience} rows={3} maxLength={2000}
                  placeholder="Daha önce hangi klanlardaydın, node war / siege tecrüben nedir?" />
          </div>
          <div>
            <Label>
              Eklemek istediğin <span className="normal-case opacity-60">(opsiyonel)</span>
            </Label>
            <Area value={note} onChange={setNote} rows={2} maxLength={1000}
                  placeholder="Oyun saatlerin, beklentilerin…" />
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving}
                  className="inline-flex items-center gap-2 font-semibold px-5 h-[38px] rounded-[var(--t-r-sm)] text-[13px] disabled:opacity-40"
                  style={{ background: "var(--t-gold)", color: "#0b0b0c" }}>
            <Send className="w-3.5 h-3.5" strokeWidth={2} />
            {saving ? "Gönderiliyor…" : "Başvuruyu gönder"}
          </button>
          <Link href="/panel" className="text-[12px] transition-colors hover:opacity-80" style={{ color: "var(--t-faint)" }}>
            Vazgeç
          </Link>
        </div>
      </form>

      <div className="pb-6" />
    </TestShell>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--t-faint)" }}>
      {children}
    </label>
  );
}

function Input({ value, onChange, placeholder, maxLength, required, type = "text", mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  maxLength?: number; required?: boolean; type?: string; mono?: boolean;
}) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
           maxLength={maxLength} required={required} type={type}
           min={type === "number" ? 0 : undefined} max={type === "number" ? 5000 : undefined}
           className={`w-full h-[38px] px-3 rounded-[var(--t-r-sm)] text-[13px] outline-none ${mono ? "t-num" : ""}`}
           style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
  );
}

function Area({ value, onChange, placeholder, rows, maxLength }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows: number; maxLength?: number;
}) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
              rows={rows} maxLength={maxLength}
              className="w-full px-3 py-2.5 rounded-[var(--t-r-sm)] text-[13px] outline-none resize-none"
              style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
  );
}
