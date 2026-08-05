"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BDO_CLASSES, getClassByID, getClassIconUrl, getPortraitUrl } from "@/lib/classes";
import { UserPlus, Search, Check, ArrowLeft, Send, AlertTriangle } from "lucide-react";

interface PublicGuild { id: number; name: string; tag: string; color: string; isPrimary: boolean }

const inputCls =
  "w-full bg-bdo-bg border border-bdo-border rounded-lg px-3 py-2.5 text-[13px] text-bdo-text-primary " +
  "placeholder-bdo-text-secondary focus:border-bdo-gold/40 focus:outline-none transition-colors";
const labelCls = "block text-[10px] uppercase text-bdo-text-secondary tracking-wider mb-1.5";

export default function BasvuruPage() {
  const [guilds, setGuilds] = useState<PublicGuild[]>([]);
  const [guildId, setGuildId] = useState<number | "">("");
  const [familyName, setFamilyName] = useState("");
  const [discordUsername, setDiscordUsername] = useState("");
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

  useEffect(() => {
    fetch("/api/guilds/public")
      .then((r) => (r.ok ? r.json() : []))
      .then((g: PublicGuild[]) => {
        setGuilds(g);
        if (g.length === 1) setGuildId(g[0].id);
        else setGuildId(g.find((x) => x.isPrimary)?.id ?? "");
      });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!familyName.trim() || !discordUsername.trim()) {
      setError("Aile adı ve Discord kullanıcı adı zorunlu.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyName, discordUsername, guildId: guildId || null,
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
  const filteredClasses = classSearch
    ? BDO_CLASSES.filter((c) => c.name.toLowerCase().includes(classSearch.toLowerCase()))
    : BDO_CLASSES;

  if (done) {
    return (
      <div className="fixed inset-0 overflow-y-auto bg-bdo-bg flex items-center justify-center px-4 py-10 z-20">
        <div className="card card-accent max-w-md w-full p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Check className="w-6 h-6 text-emerald-400" strokeWidth={2} />
          </div>
          <h1 className="text-lg font-bold text-bdo-text-primary mb-2">Başvurun alındı</h1>
          <p className="text-[13px] text-bdo-text-muted leading-relaxed mb-6">
            Subaylar başvurunu inceleyecek. Kabul edilirse Discord&apos;da rolün otomatik verilecek —
            sunucuya katılmadıysan şimdi katıl ki rol atanabilsin.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 text-[13px] text-bdo-text-secondary hover:text-bdo-gold transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
            Ana sayfaya dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-y-auto bg-bdo-bg px-4 py-8 z-20">
      <div className="max-w-2xl mx-auto">
        {/* Başlık */}
        <div className="flex items-start gap-3 mb-6">
          <div className="icon-tile w-10 h-10 mt-0.5">
            <UserPlus className="w-4.5 h-4.5 text-bdo-gold" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="section-title">Klana Başvur</h1>
            <p className="section-desc">
              Formu doldur, subaylar değerlendirsin. Kabul edilirsen Discord rolün otomatik verilir.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-3 py-2.5 rounded-lg text-[13px] mb-4">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          {/* Klan seçimi */}
          {guilds.length > 1 && (
            <div className="card p-4">
              <label className={labelCls}>Hangi klana başvuruyorsun?</label>
              <div className="grid grid-cols-2 gap-2">
                {guilds.map((g) => {
                  const active = guildId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGuildId(g.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border transition-colors ${
                        active ? "bg-bdo-gold/5" : "border-bdo-border bg-bdo-bg hover:border-bdo-border-2"
                      }`}
                      style={active ? { borderColor: `${g.color}60` } : undefined}
                    >
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0"
                        style={{ color: g.color, borderColor: `${g.color}38`, backgroundColor: `${g.color}14` }}
                      >
                        {g.tag}
                      </span>
                      <span className="text-[13px] text-bdo-text-primary truncate">{g.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kimlik */}
          <div className="card p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Aile Adı</label>
                <input value={familyName} onChange={(e) => setFamilyName(e.target.value)}
                  maxLength={60} required placeholder="Oyundaki aile adın" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Discord Kullanıcı Adı</label>
                <input value={discordUsername} onChange={(e) => setDiscordUsername(e.target.value)}
                  maxLength={60} required placeholder="ornek_kullanici" className={inputCls} />
                <p className="text-[10px] text-bdo-text-secondary mt-1">
                  Rol atayabilmemiz için sunucuda seni bulmamız gerek.
                </p>
              </div>
            </div>
          </div>

          {/* Karakter */}
          <div className="card p-4 space-y-3">
            <div className="flex items-start gap-4">
              {/* Önizleme */}
              <div className="hidden sm:block w-24 flex-shrink-0">
                <div className="rounded-lg overflow-hidden bg-bdo-surface-2 ring-1 ring-bdo-border" style={{ height: "128px" }}>
                  {portrait ? (
                    <img src={portrait} alt="" className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserPlus className="w-6 h-6 text-bdo-text-secondary/30" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-center text-bdo-text-muted mt-1.5 truncate">
                  {cls?.name ?? "Class seç"}
                </p>
                {gs > 0 && (
                  <p className="text-[13px] text-center font-mono font-bold text-bdo-gold">{gs} GS</p>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>AP</label>
                    <input type="number" value={ap} onChange={(e) => setAp(e.target.value)}
                      min={0} max={5000} placeholder="0" className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label className={labelCls}>DP</label>
                    <input type="number" value={dp} onChange={(e) => setDp(e.target.value)}
                      min={0} max={5000} placeholder="0" className={`${inputCls} font-mono`} />
                  </div>
                </div>

                {bdoClass && (
                  <div>
                    <label className={labelCls}>Spec</label>
                    <div className="flex gap-2">
                      {(["awakening", "succession"] as const).map((s) => {
                        const disabled = s === "succession" && !cls?.hasSuccession;
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => !disabled && setSpec(s)}
                            disabled={disabled}
                            className={`flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                              spec === s
                                ? "bg-bdo-gold text-bdo-bg"
                                : "bg-bdo-bg border border-bdo-border text-bdo-text-muted hover:border-bdo-border-2"
                            }`}
                          >
                            {s === "succession" ? "Succession" : "Awakening"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Class seçimi */}
            <div>
              <label className={labelCls}>Class</label>
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 text-bdo-text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                <input value={classSearch} onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Class ara..." className={`${inputCls} pl-9 py-2`} />
              </div>
              <div className="overflow-y-auto rounded-lg" style={{ maxHeight: "180px" }}>
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-1.5 p-0.5">
                  {filteredClasses.map((c) => {
                    const icon = getClassIconUrl(c.id);
                    const active = bdoClass === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setBdoClass(c.id);
                          if (!c.hasSuccession) setSpec("awakening");
                        }}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all ${
                          active ? "border-bdo-gold/50 bg-bdo-gold/10" : "border-bdo-border bg-bdo-bg hover:border-bdo-border-2"
                        }`}
                      >
                        {icon
                          ? <img src={icon} alt="" className={`w-6 h-6 ${active ? "" : "opacity-60"}`} />
                          : <div className="w-6 h-6 rounded bg-bdo-surface-2" />}
                        <span className={`text-[8px] text-center leading-tight ${active ? "text-bdo-gold" : "text-bdo-text-secondary"}`}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tecrübe */}
          <div className="card p-4 space-y-3">
            <div>
              <label className={labelCls}>PvP Tecrüben</label>
              <textarea value={experience} onChange={(e) => setExperience(e.target.value)}
                rows={3} maxLength={2000}
                placeholder="Daha önce hangi klanlardaydın, node war / siege tecrüben nedir?"
                className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>Eklemek istediğin <span className="normal-case opacity-60">(opsiyonel)</span></label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                rows={2} maxLength={1000}
                placeholder="Oyun saatlerin, beklentilerin..."
                className={`${inputCls} resize-none`} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gradient-to-b from-[#e0b040] to-[#c29328] text-bdo-bg font-semibold px-5 py-2.5 rounded-lg text-[13px] hover:from-[#e8bb4d] hover:to-[#cc9c2c] transition-colors disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" strokeWidth={2} />
              {saving ? "Gönderiliyor..." : "Başvuruyu Gönder"}
            </button>
            <Link href="/" className="text-[12px] text-bdo-text-secondary hover:text-bdo-gold transition-colors">
              Vazgeç
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
