"use client";

import { useCallback, useEffect, useState } from "react";
import { Shield, Pencil, Trash2, X, AlertTriangle } from "lucide-react";
import { Card, Head } from "@/components/app-shell";
import { Blank, Btn, Field, Input } from "./ui";

/**
 * Site rolleri.
 *
 * Roller Discord rollerinden türüyor: girişte kullanıcının Discord
 * rollerine bakılıp en yüksek öncelikli eşleşme atanıyor. O yüzden
 * "Üye" gibi herkeste olan roller 0, "Subay" gibi özel olanlar yüksek
 * öncelik almalı.
 */

type SiteRole = {
  id: number;
  name: string;
  isAdmin: boolean;
  isGuildAdmin: boolean;
  color: string;
  discordRoleIds: string;
  priority: number;
  _count: { users: number };
};

function parseIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function RollerTab({ flash }: { flash: (msg: string) => void }) {
  const [roles, setRoles] = useState<SiteRole[] | null>(null);

  const [editing, setEditing] = useState<SiteRole | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#e8b451");
  const [discordIds, setDiscordIds] = useState("");
  const [priority, setPriority] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isGuildAdmin, setIsGuildAdmin] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/roles");
    if (res.ok) setRoles(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  function reset() {
    setEditing(null);
    setName(""); setColor("#e8b451"); setDiscordIds(""); setPriority(0);
    setIsAdmin(false); setIsGuildAdmin(false);
  }

  function startEdit(r: SiteRole) {
    setEditing(r);
    setName(r.name);
    setColor(r.color);
    setPriority(r.priority ?? 0);
    setIsAdmin(r.isAdmin);
    setIsGuildAdmin(r.isGuildAdmin ?? false);
    setDiscordIds(parseIds(r.discordRoleIds).join(", "));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name, isAdmin, isGuildAdmin, color, priority,
      discordRoleIds: discordIds.split(",").map((s) => s.trim()).filter(Boolean),
    };
    await fetch(editing ? `/api/roles/${editing.id}` : "/api/roles", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    flash(editing ? "Rol güncellendi." : "Rol oluşturuldu.");
    reset();
    await load();
    setSaving(false);
  }

  async function remove(r: SiteRole) {
    if (!confirm(`"${r.name}" rolü silinsin mi? ${r._count.users} üye bu rolü kaybeder.`)) return;
    await fetch(`/api/roles/${r.id}`, { method: "DELETE" });
    setRoles((prev) => prev?.filter((x) => x.id !== r.id) ?? null);
    flash("Rol silindi.");
  }

  return (
    <div className="space-y-4">
      {/* ── Form ───────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
          <Shield className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
          <h2 className="text-[14px] font-semibold">{editing ? "Rolü Düzenle" : "Yeni Rol"}</h2>
          {editing && (
            <button onClick={reset} aria-label="Vazgeç" className="ml-auto p-1" style={{ color: "var(--t-faint)" }}>
              <X className="w-3.5 h-3.5" strokeWidth={2.2} />
            </button>
          )}
        </div>

        <form onSubmit={save} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Rol adı">
              <Input value={name} onChange={setName} required placeholder="Örn. Subay" />
            </Field>
            <Field label="Renk">
              <div className="flex items-center gap-2">
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                       className="w-10 h-[36px] rounded-[var(--t-r-sm)] cursor-pointer bg-transparent"
                       style={{ border: "1px solid var(--t-line)" }} />
                <Input value={color} onChange={setColor} mono />
              </div>
            </Field>
          </div>

          <Field label={<>Discord rol ID&apos;leri <span className="normal-case opacity-70">(virgülle ayır)</span></>}
                 hint="Bu Discord rollerine sahip kişiler girişte otomatik bu site rolünü alır. Discord'da Geliştirici Modu'nu açıp role sağ tık › ID Kopyala.">
            <Input value={discordIds} onChange={setDiscordIds} mono
                   placeholder="1327570450070634521, 1327570450070634522" />
          </Field>

          <Field label={<>Öncelik <span className="normal-case opacity-70">(yüksek olan önce kontrol edilir)</span></>}
                 hint="Herkeste olan “Üye” rolü için 0; Subay / Kurmay gibi özel roller için 10, 20, 30…">
            <Input value={priority} onChange={(v) => setPriority(Number(v) || 0)} type="number" mono
                   className="w-32" />
          </Field>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>
              Yetki seviyesi
            </p>

            <PermOption checked={isGuildAdmin}
                        onChange={(v) => { setIsGuildAdmin(v); if (v) setIsAdmin(false); }}
                        title="Klan Yöneticisi"
                        desc="Savaş açabilir, parti kurabilir, hasar raporu girebilir. Yalnızca kendi klanının üyelerini görür." />

            <PermOption checked={isAdmin} danger
                        onChange={(v) => { setIsAdmin(v); if (v) setIsGuildAdmin(false); }}
                        title="Site Admini"
                        desc="Tam yetki — bütün klanların verisini görür ve düzenler, üye silebilir, klan ve rol yönetir. Müttefiklere verme." />
          </div>

          <div className="flex gap-2">
            <Btn type="submit" tone="gold" disabled={saving || !name}>
              {saving ? "Kaydediliyor…" : editing ? "Güncelle" : "Oluştur"}
            </Btn>
            {editing && <Btn onClick={reset}>İptal</Btn>}
          </div>
        </form>
      </Card>

      {/* ── Liste ──────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <Head icon={Shield} title="Roller" meta={roles ? `${roles.length} ROL` : undefined} />
        {!roles && <Blank>Roller geliyor…</Blank>}
        {roles && roles.length === 0 && <Blank>Henüz rol oluşturulmamış.</Blank>}

        {(roles ?? []).map((r) => {
          const ids = parseIds(r.discordRoleIds);
          return (
            <div key={r.id} className="t-row px-5 py-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }} />
                <span className="text-[13.5px] font-semibold">{r.name}</span>

                {r.isAdmin && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                        style={{ color: "var(--t-bad)", background: "rgba(239,95,95,.10)",
                                 border: "1px solid rgba(239,95,95,.22)" }}>
                    Site Admin
                  </span>
                )}
                {r.isGuildAdmin && !r.isAdmin && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
                        style={{ color: "var(--t-gold)", background: "var(--t-gold-soft)",
                                 border: "1px solid rgba(232,180,81,.22)" }}>
                    Klan Yön.
                  </span>
                )}

                <span className="text-[11.5px]" style={{ color: "var(--t-faint)" }}>{r._count.users} üye</span>
                {r.priority > 0 && (
                  <span className="t-chip">öncelik {r.priority}</span>
                )}

                <div className="ml-auto flex gap-1.5">
                  <Btn small icon={Pencil} title="Düzenle" onClick={() => startEdit(r)} />
                  <Btn small icon={Trash2} tone="danger" title="Rolü sil" onClick={() => remove(r)} />
                </div>
              </div>

              {ids.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {ids.map((id) => (
                    <span key={id} className="t-num text-[11px] rounded px-2 py-0.5"
                          style={{ color: "var(--t-faint)", background: "var(--t-raised)",
                                   border: "1px solid var(--t-line)" }}>
                      {id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function PermOption({ checked, onChange, title, desc, danger }: {
  checked: boolean; onChange: (v: boolean) => void;
  title: string; desc: string; danger?: boolean;
}) {
  const tone = danger ? "var(--t-bad)" : "var(--t-gold)";
  return (
    <label className="flex items-start gap-2.5 cursor-pointer p-2.5 rounded-[var(--t-r-sm)] transition-colors"
           style={{
             background: checked ? (danger ? "rgba(239,95,95,.07)" : "var(--t-gold-soft)") : "var(--t-raised)",
             border: `1px solid ${checked ? tone + "50" : "var(--t-line)"}`,
           }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
             className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ accentColor: danger ? "#ef5f5f" : "#e8b451" }} />
      <div>
        <p className="text-[13px] font-medium flex items-center gap-1.5" style={{ color: danger ? tone : "var(--t-text)" }}>
          {danger && <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />}
          {title}
        </p>
        <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--t-faint)" }}>{desc}</p>
      </div>
    </label>
  );
}
