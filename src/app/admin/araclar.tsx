"use client";

import { useEffect, useState } from "react";
import {
  RefreshCw, Bot, UserCog, Database, AlertTriangle, Send, CheckCircle2, Link2, Quote,
} from "lucide-react";
import { Card } from "@/components/app-shell";
import { Area, Ava, Btn, Field, Input, Metric, SectionHead, Tag } from "./ui";

/**
 * Bakım araçları.
 *
 * Hepsi tek seferlik, elle tetiklenen işler. Geri alınamayan ikisi
 * (devamsızlık yeniden hesabı ve class rolleri) onay soruyor; geri kalanı
 * yalnızca okuyup düzeltiyor.
 */

type SyncResult = {
  softDeleted: number; restored: number; created: number; guildUpdated: number;
  totalWithRole: number; serversRead: number; serverErrors: string[];
  perGuild: { tag: string; name: string; count: number }[];
  incomplete: {
    id: number; discordId: string; familyName: string; avatarUrl: string;
    ap: number; dp: number; class: string; discordUsername: string;
    guild?: { tag: string; color: string } | null;
  }[];
};

type ClassRolesResult = {
  created: string[]; existing: string[]; assigned: number; removed: number; errors: number;
};

type RecalcResult = { warsProcessed: number; totalAbsences: number; affectedUsers: number };

export default function AraclarTab({ flash }: { flash: (msg: string) => void }) {
  const [syncing, setSyncing] = useState(false);
  const [sync, setSync] = useState<SyncResult | null>(null);
  const [dmOne, setDmOne] = useState<number | null>(null);
  const [dmAll, setDmAll] = useState(false);
  const [dmAllResult, setDmAllResult] = useState<{ sent: number; failed: number } | null>(null);

  const [cmdBusy, setCmdBusy] = useState(false);
  const [cmdResult, setCmdResult] = useState<string | null>(null);

  const [davet, setDavet] = useState("");
  const [davetBusy, setDavetBusy] = useState(false);
  const [slogan, setSlogan] = useState("");
  const [sloganBusy, setSloganBusy] = useState(false);
  const [manifesto, setManifesto] = useState("");
  const [manifestoBusy, setManifestoBusy] = useState(false);

  const [classBusy, setClassBusy] = useState(false);
  const [classResult, setClassResult] = useState<ClassRolesResult | null>(null);

  const [dbBusy, setDbBusy] = useState(false);
  const [dbResult, setDbResult] = useState<string | null>(null);

  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recalc, setRecalc] = useState<RecalcResult | null>(null);

  async function syncMembers() {
    setSyncing(true);
    setSync(null);
    const res = await fetch("/api/admin/sync", { method: "POST" });
    const data = await res.json();
    if (res.ok) setSync(data);
    else flash(data.error ?? "Sync hatası.");
    setSyncing(false);
  }

  async function sendDm(userId: number) {
    setDmOne(userId);
    const res = await fetch(`/api/admin/dm/${userId}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    flash(res.ok ? "DM gönderildi." : (data.error ?? "DM gönderilemedi."));
    setDmOne(null);
  }

  async function sendDmAll() {
    if (!sync || sync.incomplete.length === 0) return;
    if (!confirm(`${sync.incomplete.length} kişiye toplu DM gönderilecek. Devam edilsin mi?`)) return;
    setDmAll(true);
    setDmAllResult(null);
    let sent = 0, failed = 0;
    // Discord toplu DM'i kabul etmiyor; tek tek gitmek zorunda
    for (const u of sync.incomplete) {
      const res = await fetch(`/api/admin/dm/${u.id}`, { method: "POST" });
      if (res.ok) sent++; else failed++;
    }
    setDmAll(false);
    setDmAllResult({ sent, failed });
    flash(`Toplu DM: ${sent} gönderildi${failed > 0 ? `, ${failed} başarısız` : ""}.`);
  }

  async function registerCommands() {
    setCmdBusy(true);
    setCmdResult(null);
    const res = await fetch("/api/discord/register-commands", { method: "POST" });
    const data = await res.json();
    setCmdResult(res.ok ? `${data.registered} komut kaydedildi.` : `Hata: ${JSON.stringify(data.error)}`);
    setCmdBusy(false);
  }

  async function syncClassRoles() {
    if (!confirm("Bütün sınıf rolleri Discord'da kontrol edilecek, eksikler oluşturulup üyelere atanacak. Devam edilsin mi?")) return;
    setClassBusy(true);
    setClassResult(null);
    const res = await fetch("/api/admin/class-roles", { method: "POST" });
    const data = await res.json();
    if (res.ok) setClassResult(data);
    else flash(`Hata: ${data.error}`);
    setClassBusy(false);
  }

  async function fixLongText() {
    setDbBusy(true);
    setDbResult(null);
    const res = await fetch("/api/admin/fix-longtext", { method: "POST" });
    const data = await res.json();
    setDbResult(data.message ?? data.error ?? (res.ok ? "Tamam." : "Hata."));
    setDbBusy(false);
  }

  async function recalcAbsences() {
    if (!confirm("Bütün kullanıcıların devamsızlık sayacı sıfırlanıp geçmiş savaşlardan yeniden hesaplanacak. Devam edilsin mi?")) return;
    setRecalcBusy(true);
    setRecalc(null);
    const res = await fetch("/api/admin/recalc-absences", { method: "POST" });
    const data = await res.json();
    if (res.ok) setRecalc(data);
    else flash(`Hata: ${data.error}`);
    setRecalcBusy(false);
  }

  // Karşılama ekranındaki Discord daveti
  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setDavet(j.discord_invite ?? "");
        setSlogan(j.slogan ?? "");
        setManifesto(j.manifesto ?? "");
      })
      .catch(() => {});
  }, []);

  async function ayarKaydet(
    key: string, value: string,
    setBusy: (v: boolean) => void, setValue: (v: string) => void, basarili: string,
  ) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const j = await r.json();
      if (!r.ok) { flash(j.error ?? "Kaydedilemedi."); return; }
      setValue(j.value);
      flash(basarili);
    } catch {
      flash("Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Discord üye senkronizasyonu ─────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={RefreshCw} title="Discord Üye Senkronizasyonu"
                     desc="Guild rolü olanları çeker, rolü kalmayanları gizler."
                     action={<Btn small icon={RefreshCw} tone="gold" onClick={syncMembers} disabled={syncing}>
                       {syncing ? "Sync ediliyor…" : "Sync"}
                     </Btn>} />

        {syncing && (
          <p className="px-5 py-3 text-[12px] animate-pulse" style={{ color: "var(--t-dim)" }}>
            Discord sunucuları taranıyor…
          </p>
        )}

        {sync && !syncing && (
          <div className="p-4 space-y-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Metric label="Yeni üye" value={sync.created} tone="var(--t-good)" />
              <Metric label="Geri döndü" value={sync.restored} tone="#6b93ff" />
              <Metric label="Gizlendi" value={sync.softDeleted} tone="var(--t-bad)" />
              <Metric label="Toplam üye" value={sync.totalWithRole} tone="var(--t-gold)" />
            </div>

            {sync.perGuild?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                  {sync.serversRead} sunucu tarandı:
                </span>
                {sync.perGuild.map((g) => (
                  <span key={g.tag} title={g.name}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-md"
                        style={{ color: "var(--t-dim)", background: "var(--t-raised)",
                                 border: "1px solid var(--t-line)" }}>
                    {g.tag} <span className="t-num" style={{ color: "var(--t-text)" }}>{g.count}</span>
                  </span>
                ))}
                {sync.guildUpdated > 0 && (
                  <span className="text-[11px]" style={{ color: "#6b93ff" }}>
                    {sync.guildUpdated} üyenin klanı güncellendi
                  </span>
                )}
              </div>
            )}

            {sync.serverErrors?.length > 0 && (
              <div className="rounded-[var(--t-r-sm)] px-3 py-2"
                   style={{ background: "rgba(239,95,95,.08)", border: "1px solid rgba(239,95,95,.2)" }}>
                {sync.serverErrors.map((err, i) => (
                  <p key={i} className="text-[11px] flex items-start gap-1.5" style={{ color: "var(--t-bad)" }}>
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" strokeWidth={2} />
                    {err}
                  </p>
                ))}
              </div>
            )}

            {sync.incomplete.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: "var(--t-gold)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                    {sync.incomplete.length} üye profilini doldurmamış
                  </p>
                  <Btn small icon={Send} onClick={sendDmAll} disabled={dmAll}>
                    {dmAll ? "Gönderiliyor…" : "Tümüne DM"}
                  </Btn>
                </div>

                {dmAllResult && (
                  <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                    {dmAllResult.sent} gönderildi
                    {dmAllResult.failed > 0 && ` · ${dmAllResult.failed} başarısız`}
                  </p>
                )}

                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {sync.incomplete.map((u) => (
                    <div key={u.id} className="flex items-center gap-2.5 rounded-[var(--t-r-sm)] px-3 py-2"
                         style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                      <Ava src={u.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13px] truncate">{u.familyName || u.discordUsername}</span>
                          {u.guild && <Tag color={u.guild.color}>{u.guild.tag}</Tag>}
                          <span className="t-num text-[10px]" style={{ color: "var(--t-faint)" }}>{u.discordId}</span>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
                          {[!u.familyName && "Aile adı yok", !u.class && "Class yok",
                            !u.ap && !u.dp && "GS yok"].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Btn small icon={Send} disabled={dmOne === u.id} onClick={() => sendDm(u.id)}>
                        {dmOne === u.id ? "…" : "DM"}
                      </Btn>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[12px] flex items-center gap-1.5" style={{ color: "var(--t-good)" }}>
                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                Bütün üyeler profillerini doldurmuş.
              </p>
            )}
          </div>
        )}
      </Card>

      {/* ── Slash komutları ────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={Bot} title="Discord Slash Komutları"
                     desc="Yeni komutları Discord'a kaydeder."
                     action={<Btn small onClick={registerCommands} disabled={cmdBusy}>
                       {cmdBusy ? "Kaydediliyor…" : "Komutları kaydet"}
                     </Btn>} />
        {cmdResult && (
          <p className="px-5 py-2.5 text-[11.5px]" style={{ color: "var(--t-dim)" }}>{cmdResult}</p>
        )}
      </Card>

      {/* ── Class rolleri ──────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={UserCog} title="Karakter Rolleri"
                     desc="Eksik class rollerini oluşturur ve üyelere atar."
                     action={<Btn small onClick={syncClassRoles} disabled={classBusy}>
                       {classBusy ? "Çalışıyor…" : "Sync et"}
                     </Btn>} />

        {classBusy && (
          <p className="px-5 py-2.5 text-[11.5px] animate-pulse" style={{ color: "var(--t-dim)" }}>
            Roller oluşturuluyor ve atanıyor, 1-2 dakika sürebilir…
          </p>
        )}

        {classResult && !classBusy && (
          <div className="p-4 grid sm:grid-cols-2 gap-2">
            {classResult.created.length > 0 && (
              <div className="rounded-[var(--t-r-sm)] p-2.5"
                   style={{ background: "rgba(56,208,127,.08)", border: "1px solid rgba(56,208,127,.2)" }}>
                <p className="text-[12px] font-semibold" style={{ color: "var(--t-good)" }}>
                  {classResult.created.length} rol oluşturuldu
                </p>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--t-faint)" }}>
                  {classResult.created.join(", ")}
                </p>
              </div>
            )}
            <div className="rounded-[var(--t-r-sm)] p-2.5 space-y-1"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
              {[
                { l: "Mevcut", v: classResult.existing.length, c: "var(--t-gold)" },
                { l: "Atandı", v: classResult.assigned, c: "var(--t-good)" },
                { l: "Kaldırıldı", v: classResult.removed, c: "#f0994c" },
                ...(classResult.errors > 0 ? [{ l: "Hata", v: classResult.errors, c: "var(--t-bad)" }] : []),
              ].map((r) => (
                <div key={r.l} className="flex justify-between text-[11.5px]">
                  <span style={{ color: "var(--t-faint)" }}>{r.l}</span>
                  <span className="t-num font-semibold" style={{ color: r.c }}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Forum DB ───────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={Database} title="Forum DB Düzelt"
                     desc="forum_posts.content sütununu LONGTEXT'e çevirir (resim yüklemek için)."
                     action={<Btn small onClick={fixLongText} disabled={dbBusy}>
                       {dbBusy ? "Çalışıyor…" : "Fix uygula"}
                     </Btn>} />
        {dbResult && (
          <p className="px-5 py-2.5 text-[11.5px]" style={{ color: "var(--t-dim)" }}>{dbResult}</p>
        )}
      </Card>

      {/* ── Devamsızlık ────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={AlertTriangle} title="Geçmiş Devamsızlığı Yeniden Hesapla"
                     desc="Bütün eski savaşlara bakıp devamsızlık sayaçlarını sıfırdan kurar."
                     action={<Btn small tone="danger" onClick={recalcAbsences} disabled={recalcBusy}>
                       {recalcBusy ? "Hesaplanıyor…" : "Yeniden hesapla"}
                     </Btn>} />

        {recalc && !recalcBusy && (
          <div className="p-4 grid grid-cols-3 gap-2">
            <Metric label="İşlenen savaş" value={recalc.warsProcessed} tone="var(--t-gold)" />
            <Metric label="Toplam devamsızlık" value={recalc.totalAbsences} tone="var(--t-bad)" />
            <Metric label="Etkilenen üye" value={recalc.affectedUsers} tone="#f0994c" />
          </div>
        )}
      </Card>

      {/* ── Slogan ─────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={Quote} title="Karşılama Sloganı"
                     desc="Giriş ekranında Aetherion başlığının hemen altında duruyor."
                     action={<Btn small tone="gold" disabled={sloganBusy}
                       onClick={() => ayarKaydet("slogan", slogan, setSloganBusy, setSlogan,
                                                 "Slogan güncellendi.")}>
                       {sloganBusy ? "Kaydediliyor…" : "Kaydet"}
                     </Btn>} />
        <div className="p-4">
          <Field label="Slogan" hint="En fazla 120 karakter. Boş bırakılırsa varsayılan yazı görünür.">
            <Input value={slogan} onChange={setSlogan} maxLength={120}
                   placeholder="En iyi bildiğin yol en iyi bildiğin yoldur" />
          </Field>
        </div>
      </Card>

      {/* ── Tanıtım metni ──────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={Quote} title="Karşılama Metni"
                     desc="Sloganın altındaki tanıtım paragrafı."
                     action={<Btn small tone="gold" disabled={manifestoBusy}
                       onClick={() => ayarKaydet("manifesto", manifesto, setManifestoBusy,
                                                 setManifesto, "Karşılama metni güncellendi.")}>
                       {manifestoBusy ? "Kaydediliyor…" : "Kaydet"}
                     </Btn>} />
        <div className="p-4">
          <Field label="Metin" hint="En fazla 500 karakter. Boş bırakılırsa varsayılan metin görünür.">
            <Area value={manifesto} onChange={setManifesto} rows={4}
                  placeholder="Aetherion bir PvP klanıdır…" />
          </Field>
        </div>
      </Card>

      {/* ── Discord daveti ─────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <SectionHead icon={Link2} title="Discord Davet Bağlantısı"
                     desc="Karşılama ekranında ve başvuru sonrasında gösteriliyor. Davetler süreli olduğu için buradan güncellenir."
                     action={<Btn small tone="gold" disabled={davetBusy}
                          onClick={() => ayarKaydet("discord_invite", davet, setDavetBusy, setDavet,
                                                    davet.trim() ? "Davet bağlantısı güncellendi." : "Davet bağlantısı kaldırıldı.")}>
                       {davetBusy ? "Kaydediliyor…" : "Kaydet"}
                     </Btn>} />
        <div className="p-4">
          <Field label="Bağlantı"
                 hint="https://discord.gg/... veya https://discord.com/invite/... — boş bırakılırsa bölüm gizlenir.">
            <Input value={davet} onChange={setDavet}
                   placeholder="https://discord.gg/ornek" />
          </Field>
        </div>
      </Card>
    </div>
  );
}
