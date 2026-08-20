"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Flag, RefreshCw, X, Search, Check, Handshake, Lock, Pencil, Trash2, Star,
} from "lucide-react";
import { Card, Head } from "@/components/test-shell";
import { Blank, Btn, Field, Input, Select } from "./ui";

/**
 * Klan yönetimi ve Discord eşleştirmesi.
 *
 * Bir klanın Discord rolleri, girişte kimin hangi klana düşeceğini
 * belirliyor; bu yüzden bir rol yalnızca tek klana bağlanabiliyor —
 * başka klanda kullanılan roller listede kilitli görünür.
 */

type GuildRow = {
  id: number; name: string; tag: string; color: string; isPrimary: boolean;
  discordServerId: string | null; discordRoleIds: string;
  warChannelId: string | null; allyWarChannelId: string | null;
  _count: { members: number };
};

type DiscordRole = { id: string; name: string; color: string };
type DiscordServer = { id: string; name: string; icon: string | null; roles: DiscordRole[] };
type DiscordChannel = { id: string; name: string; category: string | null; isAnnouncement: boolean };

/** discordRoleIds sütunu JSON dizisi tutuyor; bozuk kayıt listeyi düşürmesin */
function parseIds(raw: string): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export default function KlanlarTab({ flash }: { flash: (msg: string) => void }) {
  const [guilds, setGuilds] = useState<GuildRow[] | null>(null);
  const [servers, setServers] = useState<DiscordServer[]>([]);
  const [channels, setChannels] = useState<DiscordChannel[]>([]);
  const [dcLoading, setDcLoading] = useState(false);
  const [dcError, setDcError] = useState<string | null>(null);
  const [chLoading, setChLoading] = useState(false);

  const [editing, setEditing] = useState<GuildRow | null>(null);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [color, setColor] = useState("#4a7cf5");
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [serverId, setServerId] = useState("");
  const [warChannel, setWarChannel] = useState("");
  const [allyChannel, setAllyChannel] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const loadGuilds = useCallback(async () => {
    const res = await fetch("/api/guilds");
    if (res.ok) setGuilds(await res.json());
  }, []);

  const loadRoles = useCallback(async () => {
    setDcLoading(true);
    setDcError(null);
    const res = await fetch("/api/discord/roles");
    const data = await res.json();
    if (res.ok) {
      setServers(data);
      // Tek sunucu varsa seçtirmeye gerek yok
      if (data.length === 1) setServerId(data[0].id);
    } else {
      setDcError(data.error ?? "Roller çekilemedi.");
    }
    setDcLoading(false);
  }, []);

  useEffect(() => { loadGuilds(); loadRoles(); }, [loadGuilds, loadRoles]);

  const loadChannels = useCallback(async (sid: string) => {
    if (!sid) { setChannels([]); return; }
    setChLoading(true);
    const res = await fetch(`/api/discord/channels?serverId=${sid}`);
    setChannels(res.ok ? await res.json() : []);
    setChLoading(false);
  }, []);

  function findRole(id: string) {
    for (const s of servers) {
      const r = s.roles.find((x) => x.id === id);
      if (r) return { role: r, server: s };
    }
    return null;
  }

  /** Bir rol başka klana bağlıysa o klanı döner — çift atama olmasın */
  function roleOwner(id: string): GuildRow | null {
    for (const g of guilds ?? []) {
      if (editing && g.id === editing.id) continue;
      if (parseIds(g.discordRoleIds).includes(id)) return g;
    }
    return null;
  }

  function reset() {
    setEditing(null);
    setName(""); setTag(""); setColor("#4a7cf5"); setRoleIds([]);
    setRoleSearch("");
    setServerId(servers.length === 1 ? servers[0].id : "");
    setWarChannel(""); setAllyChannel("");
  }

  function startEdit(g: GuildRow) {
    setEditing(g);
    setName(g.name); setTag(g.tag); setColor(g.color);
    setRoleSearch("");
    setServerId(g.discordServerId ?? "");
    setWarChannel(g.warChannelId ?? "");
    setAllyChannel(g.allyWarChannelId ?? "");
    setRoleIds(parseIds(g.discordRoleIds));
    if (g.discordServerId) loadChannels(g.discordServerId);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name, tag, color,
      discordRoleIds: roleIds.join(","),
      discordServerId: serverId || null,
      warChannelId: warChannel || null,
      allyWarChannelId: allyChannel || null,
    };
    const res = await fetch("/api/guilds", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing ? { ...payload, id: editing.id } : payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      const wasEditing = !!editing;
      reset();
      await loadGuilds();
      flash(wasEditing ? "Klan güncellendi." : "Klan oluşturuldu.");
    } else {
      flash(data.error ?? "Kaydedilemedi.");
    }
    setSaving(false);
  }

  async function remove(g: GuildRow) {
    if (!confirm(`"${g.name}" klanını silmek istediğine emin misin? ${g._count.members} üye klansız kalacak.`)) return;
    const res = await fetch("/api/guilds", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: g.id }),
    });
    const data = await res.json().catch(() => ({}));
    flash(res.ok ? "Klan silindi." : (data.error ?? "Silinemedi."));
    await loadGuilds();
  }

  const server = servers.find((s) => s.id === serverId);
  const visibleRoles = (server?.roles ?? []).filter((r) =>
    r.name.toLocaleLowerCase("tr").includes(roleSearch.toLocaleLowerCase("tr")));

  return (
    <div className="space-y-4">
      {/* ── Form ───────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5" style={{ borderBottom: "1px solid var(--t-line)" }}>
          <Flag className="w-4 h-4" strokeWidth={2} style={{ color: "var(--t-gold)" }} />
          <h2 className="text-[14px] font-semibold">{editing ? "Klanı Düzenle" : "Yeni Klan"}</h2>
          {editing && (
            <button onClick={reset} aria-label="Vazgeç" className="ml-auto p-1" style={{ color: "var(--t-faint)" }}>
              <X className="w-3.5 h-3.5" strokeWidth={2.2} />
            </button>
          )}
        </div>

        <form onSubmit={save} className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_92px] gap-3">
            <Field label="Klan adı">
              <Input value={name} onChange={setName} required maxLength={40} placeholder="Örn. Nexus" />
            </Field>
            <Field label="Tag">
              <Input value={tag} onChange={(v) => setTag(v.toUpperCase())} required maxLength={5}
                     placeholder="NEX" mono />
            </Field>
            <Field label="Renk">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                     className="w-full h-[36px] rounded-[var(--t-r-sm)] px-1 cursor-pointer bg-transparent"
                     style={{ border: "1px solid var(--t-line)" }} />
            </Field>
          </div>

          {/* Discord rolleri */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
              <label className="text-[10px] uppercase tracking-[0.08em]" style={{ color: "var(--t-faint)" }}>
                Discord rolleri
                <span className="normal-case opacity-70"> — bu rollere sahip olanlar girişte bu klana atanır</span>
              </label>
              <Btn small icon={RefreshCw} onClick={loadRoles} disabled={dcLoading}>
                {dcLoading ? "Çekiliyor…" : servers.length ? "Yenile" : "Rolleri çek"}
              </Btn>
            </div>

            {dcError && <p className="text-[11.5px] mb-2" style={{ color: "var(--t-bad)" }}>{dcError}</p>}

            {roleIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {roleIds.map((rid) => {
                  const found = findRole(rid);
                  const c = found?.role.color ?? "#7a8ba3";
                  return (
                    <span key={rid}
                          className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border"
                          style={{ color: c, borderColor: c + "40", background: c + "15" }}>
                      {found ? found.role.name : rid}
                      <button type="button" onClick={() => setRoleIds((p) => p.filter((x) => x !== rid))}
                              className="transition-opacity hover:opacity-60" aria-label="Rolü çıkar">
                        <X className="w-3 h-3" strokeWidth={2.5} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {servers.length === 0 ? (
              <div className="rounded-[var(--t-r-sm)] px-3 py-4 text-center"
                   style={{ background: "var(--t-raised)", border: "1px dashed var(--t-line-strong)" }}>
                <p className="text-[12px]" style={{ color: "var(--t-faint)" }}>
                  {dcLoading ? "Discord sunucuları yükleniyor…" : "Rolleri listelemek için “Rolleri çek”e bas."}
                </p>
              </div>
            ) : (
              <div className="rounded-[var(--t-r-sm)] overflow-hidden"
                   style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                <div className="p-2.5 space-y-2" style={{ borderBottom: "1px solid var(--t-line)" }}>
                  <Select value={serverId} onChange={(next) => {
                    setRoleSearch("");
                    if (next !== serverId) {
                      // Sunucu değişince başka sunucunun rolleri seçili kalmasın
                      const valid = new Set((servers.find((s) => s.id === next)?.roles ?? []).map((r) => r.id));
                      setRoleIds((prev) => prev.filter((id) => valid.has(id)));
                    }
                    setServerId(next);
                    setWarChannel(""); setAllyChannel("");
                    loadChannels(next);
                  }} className="w-full !h-[32px] !text-[12px]">
                    <option value="">Sunucu seç ({servers.length} sunucu)</option>
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} — {s.roles.length} rol</option>
                    ))}
                  </Select>

                  {serverId && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                              strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
                      <input value={roleSearch} onChange={(e) => setRoleSearch(e.target.value)}
                             placeholder="Rol ara…"
                             className="w-full h-[32px] pl-8 pr-2 rounded-[var(--t-r-sm)] text-[12px] outline-none"
                             style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)",
                                      color: "var(--t-text)" }} />
                    </div>
                  )}
                </div>

                {!serverId ? (
                  <p className="px-3 py-6 text-center text-[12px]" style={{ color: "var(--t-faint)" }}>
                    Rolleri görmek için yukarıdan bir sunucu seç.
                  </p>
                ) : visibleRoles.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[12px]" style={{ color: "var(--t-faint)" }}>
                    {roleSearch ? "Eşleşen rol yok." : "Bu sunucuda atanabilir rol yok."}
                  </p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    {visibleRoles.map((role) => {
                      const on = roleIds.includes(role.id);
                      const owner = roleOwner(role.id);
                      return (
                        <button key={role.id} type="button" disabled={!!owner}
                                onClick={() => setRoleIds((p) =>
                                  p.includes(role.id) ? p.filter((x) => x !== role.id) : [...p, role.id])}
                                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed"
                                style={{
                                  borderBottom: "1px solid var(--t-line)",
                                  opacity: owner ? 0.4 : 1,
                                  background: on ? "var(--t-gold-soft)" : "transparent",
                                }}>
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: role.color }} />
                          <span className="text-[12px] flex-1 truncate"
                                style={{ color: on ? "var(--t-text)" : "var(--t-dim)", fontWeight: on ? 500 : 400 }}>
                            {role.name}
                          </span>
                          {owner && (
                            <span className="text-[10px] flex-shrink-0" style={{ color: "var(--t-faint)" }}>
                              {owner.tag}&apos;a bağlı
                            </span>
                          )}
                          {on && !owner && (
                            <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2.5} style={{ color: "var(--t-gold)" }} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Duyuru kanalları */}
          <div>
            <label className="block text-[10px] uppercase tracking-[0.08em] mb-1.5" style={{ color: "var(--t-faint)" }}>
              Savaş duyuru kanalları
            </label>

            {!serverId ? (
              <div className="rounded-[var(--t-r-sm)] px-3 py-3 text-center"
                   style={{ background: "var(--t-raised)", border: "1px dashed var(--t-line-strong)" }}>
                <p className="text-[12px]" style={{ color: "var(--t-faint)" }}>Önce yukarıdan sunucu seç.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {([
                  { key: "ally", label: "Ortak (ally) savaşlar", icon: Handshake,
                    hint: "Müttefiklerin de katıldığı savaşlar buraya duyurulur",
                    value: allyChannel, set: setAllyChannel,
                    empty: "Ayarlanmadı — klan içi kanal kullanılır" },
                  { key: "own", label: "Klan içi savaşlar", icon: Lock,
                    hint: "Sadece bu klanın katıldığı savaşlar",
                    value: warChannel, set: setWarChannel,
                    empty: "Ayarlanmadı — varsayılan kanal kullanılır" },
                ] as const).map((row) => (
                  <div key={row.key} className="rounded-[var(--t-r-sm)] p-2.5"
                       style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div>
                        <p className="text-[12px] font-medium">{row.label}</p>
                        <p className="text-[10px] leading-tight" style={{ color: "var(--t-faint)" }}>{row.hint}</p>
                      </div>
                      <row.icon className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
                    </div>
                    <Select value={row.value} onChange={row.set} disabled={chLoading} className="w-full !h-[32px] !text-[12px]">
                      <option value="">{chLoading ? "Yükleniyor…" : row.empty}</option>
                      {channels.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category ? `${c.category} / ` : ""}#{c.name}{c.isAnnouncement ? " (duyuru)" : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}

                <Btn small icon={RefreshCw} onClick={() => loadChannels(serverId)} disabled={chLoading}>
                  Kanalları yenile
                </Btn>
              </div>
            )}

            <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--t-faint)" }}>
              Ortak savaş duyurusu bütün klanların ally kanallarına gider ve katılım sayıları hepsinde
              birlikte güncellenir. Klan içi savaş sadece ana klanın kanalına gider.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Btn type="submit" tone="gold" disabled={saving}>
              {saving ? "Kaydediliyor…" : editing ? "Güncelle" : "Klan oluştur"}
            </Btn>
            {editing && <Btn onClick={reset}>İptal</Btn>}
          </div>
        </form>
      </Card>

      {/* ── Liste ──────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <Head icon={Flag} title="Klanlar" meta={guilds ? `${guilds.length} KLAN` : undefined} />
        {!guilds && <Blank>Klanlar geliyor…</Blank>}
        {guilds && guilds.length === 0 && <Blank>Henüz klan yok.</Blank>}

        {(guilds ?? []).map((g) => {
          const ids = parseIds(g.discordRoleIds);
          return (
            <div key={g.id} className="t-row px-5 py-3 flex items-start gap-3 flex-wrap"
                 style={g.isPrimary ? { boxShadow: "inset 2px 0 0 var(--t-gold)" } : undefined}>
              <span className="t-num text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded border flex-shrink-0"
                    style={{ color: g.color, borderColor: g.color + "40", background: g.color + "15" }}>
                {g.tag}
              </span>

              <div className="flex-1 min-w-[170px]">
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-medium truncate">{g.name}</p>
                  {g.isPrimary && (
                    <Star className="w-3 h-3 flex-shrink-0" strokeWidth={2} fill="currentColor"
                          style={{ color: "var(--t-gold)" }} />
                  )}
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                  {g._count.members} üye
                  {g.isPrimary && " · ana klan (eşleşmeyenler buraya düşer)"}
                </p>

                {ids.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ids.map((rid) => {
                      const found = findRole(rid);
                      const c = found?.role.color ?? "var(--t-faint)";
                      return (
                        <span key={rid} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border"
                              style={found
                                ? { color: c, borderColor: c + "30", background: c + "12" }
                                : { color: "var(--t-faint)", borderColor: "var(--t-line)" }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: found?.role.color ?? "var(--t-faint)" }} />
                          {found ? found.role.name : `ID: ${rid}`}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Btn small icon={Pencil} title="Düzenle" onClick={() => startEdit(g)} />
                {!g.isPrimary && (
                  <Btn small icon={Trash2} tone="danger" title="Klanı sil" onClick={() => remove(g)} />
                )}
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
