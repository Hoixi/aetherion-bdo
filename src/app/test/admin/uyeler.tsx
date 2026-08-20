"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users, Shield, Trash2, Search, ExternalLink } from "lucide-react";
import { Card, Head } from "@/components/test-shell";
import { Ava, Blank, Btn, Select, Tag } from "./ui";

/**
 * Üye yönetimi.
 *
 * Site admini klan taşıyabilir, admin yetkisi verebilir ve üye silebilir;
 * klan yöneticisi yalnızca listeyi görür. Liste 100+ kişiye çıktığı için
 * arama ve klan süzgeci var — eskiden hepsi tek blokta akıyordu.
 */

type Member = {
  id: number;
  familyName: string;
  class: string;
  isAdmin: boolean;
  avatarUrl: string;
  siteRole: { name: string; color: string } | null;
  guild: { id: number; name: string; tag: string; color: string } | null;
};

type GuildRow = { id: number; name: string; tag: string; color: string };

export default function UyelerTab({ isSiteAdmin, flash }: {
  isSiteAdmin: boolean;
  flash: (msg: string) => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [guilds, setGuilds] = useState<GuildRow[]>([]);
  const [q, setQ] = useState("");
  const [guildFilter, setGuildFilter] = useState<string>("");

  const load = useCallback(async () => {
    const [m, g] = await Promise.all([fetch("/api/members"), fetch("/api/guilds")]);
    if (m.ok) setMembers(await m.json());
    if (g.ok) setGuilds(await g.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setGuild(id: number, guildId: string) {
    await fetch(`/api/members/${id}/guild`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guildId: guildId || null }),
    });
    load();
  }

  async function toggleAdmin(id: number, isAdmin: boolean) {
    await fetch(`/api/members/${id}/admin`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin }),
    });
    setMembers((prev) => prev?.map((m) => (m.id === id ? { ...m, isAdmin } : m)) ?? null);
    flash(isAdmin ? "Admin yetkisi verildi." : "Admin yetkisi kaldırıldı.");
  }

  async function remove(id: number, name: string) {
    if (!confirm(`"${name}" kullanıcısını silmek istediğine emin misin? Bu işlem geri alınamaz.`)) return;
    const res = await fetch(`/api/members/${id}`, { method: "DELETE" });
    if (res.ok) {
      setMembers((prev) => prev?.filter((m) => m.id !== id) ?? null);
      flash("Üye silindi.");
    } else {
      flash((await res.json().catch(() => ({}))).error ?? "Silinemedi.");
    }
  }

  const visible = useMemo(() => {
    let list = members ?? [];
    if (guildFilter) list = list.filter((m) => String(m.guild?.id ?? "") === guildFilter);
    const needle = q.trim().toLocaleLowerCase("tr");
    if (needle) list = list.filter((m) => (m.familyName ?? "").toLocaleLowerCase("tr").includes(needle));
    return list;
  }, [members, q, guildFilter]);

  return (
    <Card className="overflow-hidden">
      <Head icon={Users} title="Üyeler" meta={members ? `${visible.length} / ${members.length}` : undefined} />

      <div className="flex items-center gap-2 px-5 py-3 flex-wrap" style={{ borderBottom: "1px solid var(--t-line)" }}>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                  strokeWidth={1.8} style={{ color: "var(--t-faint)" }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Aile adı ara"
                 className="w-full h-[32px] pl-9 pr-3 rounded-[var(--t-r-sm)] text-[12.5px] outline-none"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)", color: "var(--t-text)" }} />
        </div>
        {guilds.length > 1 && (
          <Select value={guildFilter} onChange={setGuildFilter} className="w-auto min-w-[140px]">
            <option value="">Tüm klanlar</option>
            {guilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        )}
      </div>

      {!members && <Blank>Üyeler geliyor…</Blank>}
      {members && visible.length === 0 && <Blank>Bu süzgece uyan üye yok.</Blank>}

      <div className="max-h-[640px] overflow-y-auto">
        {visible.map((m) => (
          <div key={m.id} className="t-row px-5 py-2.5 flex items-center gap-3 flex-wrap">
            <Link href={`/test/uyeler/${m.id}`}
                  className="flex items-center gap-2.5 flex-1 min-w-[170px] transition-opacity hover:opacity-80">
              <Ava src={m.avatarUrl} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[13px] truncate">{m.familyName || "İsimsiz"}</span>
                  {m.guild && <Tag color={m.guild.color}>{m.guild.tag}</Tag>}
                  {m.siteRole && <Tag color={m.siteRole.color}>{m.siteRole.name}</Tag>}
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isSiteAdmin ? (
                <>
                  <Select value={m.guild?.id ?? ""} onChange={(v) => setGuild(m.id, v)}
                          className="w-auto min-w-[110px] !h-[30px] !text-[11.5px]">
                    <option value="">Klansız</option>
                    {guilds.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </Select>
                  <Btn small icon={Shield} tone={m.isAdmin ? "gold" : "ghost"}
                       onClick={() => toggleAdmin(m.id, !m.isAdmin)}>
                    {m.isAdmin ? "Admin" : "Admin yap"}
                  </Btn>
                  <Btn small icon={Trash2} tone="danger" title="Üyeyi sil"
                       onClick={() => remove(m.id, m.familyName || "İsimsiz")} />
                </>
              ) : (
                <Link href={`/test/uyeler/${m.id}`}>
                  <Btn small icon={ExternalLink}>Profil</Btn>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
