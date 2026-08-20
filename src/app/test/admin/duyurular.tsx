"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Send, Trash2, Eye, Users } from "lucide-react";
import { Card, Head } from "@/components/test-shell";
import { Area, Ava, Blank, Btn, Field, Input, Tag } from "./ui";

/**
 * Duyurular.
 *
 * İki gönderim biçimi var: klan kanalına @everyone ya da seçili kişilere
 * özel mesaj. Yanlış kitleye DM atmak geri alınamadığı için gönderimden
 * önce alıcı listesi zorunlu olarak gösteriliyor.
 */

type AnnouncementTarget = "all" | "no_login" | "no_gear" | "pvp" | `guild:${number}`;

type Announcement = {
  id: number;
  title: string;
  content: string;
  target: AnnouncementTarget;
  createdAt: string;
  creator: { familyName: string; avatarUrl: string };
};

type GuildRow = { id: number; name: string; tag: string; color: string; _count: { members: number } };

type PreviewUser = {
  id: number; discordId: string; familyName: string; class: string;
  ap: number; dp: number; avatarUrl: string;
  guild?: { tag: string; color: string } | null;
};
type Preview = { mode: "channel" | "dm"; count: number | null; users: PreviewUser[] };

const TARGETS: { key: AnnouncementTarget; label: string }[] = [
  { key: "all",      label: "Tüm klan (kanala)" },
  { key: "no_login", label: "Siteye hiç girmemişler (DM)" },
  { key: "no_gear",  label: "GS bilgisi olmayanlar (DM)" },
  { key: "pvp",      label: "PvP'ciler — savaşa girenler (DM)" },
];

const TARGET_LABEL: Record<string, string> = Object.fromEntries(TARGETS.map((t) => [t.key, t.label]));

export default function DuyurularTab({ flash }: { flash: (msg: string) => void }) {
  const [list, setList] = useState<Announcement[] | null>(null);
  const [guilds, setGuilds] = useState<GuildRow[]>([]);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [target, setTarget] = useState<AnnouncementTarget>("all");
  const [formPreview, setFormPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openId, setOpenId] = useState<number | null>(null);
  const [rowPreview, setRowPreview] = useState<Preview | null>(null);
  const [rowLoading, setRowLoading] = useState(false);
  const [publishing, setPublishing] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [a, g] = await Promise.all([fetch("/api/announcements"), fetch("/api/guilds")]);
    if (a.ok) setList(await a.json());
    if (g.ok) setGuilds(await g.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function fetchPreview(t: AnnouncementTarget): Promise<Preview | null> {
    const res = await fetch(`/api/announcements/preview-target?target=${t}`);
    return res.ok ? res.json() : null;
  }

  async function previewNew(e: React.FormEvent) {
    e.preventDefault();
    setPreviewing(true);
    setFormPreview(null);
    setFormPreview(await fetchPreview(target));
    setPreviewing(false);
  }

  async function createAndSend() {
    setSaving(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, target }),
    });
    if (!res.ok) { setSaving(false); flash("Duyuru kaydedilemedi."); return; }
    const ann = await res.json();

    const pub = await fetch("/api/discord/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "announcement", id: ann.id }),
    });
    const data = pub.ok ? await pub.json() : null;

    setTitle(""); setContent(""); setTarget("all"); setFormPreview(null);
    setSaving(false);
    load();

    flash(data?.sent !== undefined
      ? `Duyuru kaydedildi, ${data.sent} kişiye DM gönderildi${data.failed > 0 ? ` (${data.failed} başarısız)` : ""}.`
      : "Duyuru kaydedildi ve Discord'a gönderildi.");
  }

  async function toggleRow(a: Announcement) {
    if (openId === a.id) { setOpenId(null); setRowPreview(null); return; }
    setOpenId(a.id);
    setRowPreview(null);
    setRowLoading(true);
    setRowPreview(await fetchPreview(a.target));
    setRowLoading(false);
  }

  async function publish(id: number) {
    setPublishing(id);
    const res = await fetch("/api/discord/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "announcement", id }),
    });
    const data = res.ok ? await res.json() : null;
    flash(!res.ok ? "Discord'a gönderilemedi."
      : data?.sent !== undefined
        ? `DM gönderildi: ${data.sent} başarılı${data.failed > 0 ? `, ${data.failed} başarısız` : ""}.`
        : "Discord'a gönderildi.");
    setPublishing(null);
    setOpenId(null);
    setRowPreview(null);
  }

  async function remove(id: number) {
    if (!confirm("Bu duyuru silinsin mi?")) return;
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    setList((prev) => prev?.filter((a) => a.id !== id) ?? null);
    flash("Duyuru silindi.");
  }

  const targetName = (t: string) =>
    TARGET_LABEL[t] ??
    (t.startsWith("guild:")
      ? `${guilds.find((g) => String(g.id) === t.slice(6))?.name ?? "Klan"} (DM)`
      : t);

  return (
    <div className="space-y-4">
      {/* ── Yeni duyuru ────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <Head icon={Megaphone} title="Yeni Duyuru" />
        <form onSubmit={previewNew} className="p-4 space-y-3.5">
          <Field label="Başlık">
            <Input value={title} required
                   onChange={(v) => { setTitle(v); setFormPreview(null); }} />
          </Field>

          <Field label="İçerik">
            <Area value={content} required rows={3}
                  onChange={(v) => { setContent(v); setFormPreview(null); }} />
          </Field>

          <Field label="Hedef kitle">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TARGETS.map((t) => (
                <TargetOption key={t.key} on={target === t.key}
                              onClick={() => { setTarget(t.key); setFormPreview(null); }}>
                  {t.label}
                </TargetOption>
              ))}
            </div>

            {guilds.length > 0 && (
              <>
                <p className="text-[10px] uppercase tracking-[0.08em] mt-3 mb-1.5" style={{ color: "var(--t-faint)" }}>
                  Klan bazlı toplu DM
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {guilds.map((g) => {
                    const key = `guild:${g.id}` as AnnouncementTarget;
                    return (
                      <TargetOption key={g.id} on={target === key} color={g.color}
                                    onClick={() => { setTarget(key); setFormPreview(null); }}>
                        <Tag color={g.color}>{g.tag}</Tag>
                        <span className="truncate">
                          {g.name}{" "}
                          <span style={{ color: "var(--t-faint)" }}>({g._count.members})</span>
                        </span>
                      </TargetOption>
                    );
                  })}
                </div>
              </>
            )}
          </Field>

          {previewing && (
            <p className="text-[12px] animate-pulse" style={{ color: "var(--t-dim)" }}>
              Alıcılar kontrol ediliyor…
            </p>
          )}

          {formPreview && !previewing && (
            <div className="rounded-[var(--t-r-sm)] p-3 space-y-2.5"
                 style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
              <PreviewBody data={formPreview} />
              <div className="flex gap-2 pt-1">
                <Btn tone="gold" icon={Send} onClick={createAndSend}
                     disabled={saving || (formPreview.mode === "dm" && formPreview.count === 0)}>
                  {saving ? "Gönderiliyor…"
                    : formPreview.mode === "channel" ? "Onayla ve gönder"
                    : `Onayla — ${formPreview.count} kişiye DM`}
                </Btn>
                <Btn onClick={() => setFormPreview(null)}>İptal</Btn>
              </div>
            </div>
          )}

          {!formPreview && (
            <Btn type="submit" tone="gold" icon={Eye} disabled={previewing}>
              {previewing ? "Kontrol ediliyor…" : "Alıcıları önizle"}
            </Btn>
          )}
        </form>
      </Card>

      {/* ── Geçmiş duyurular ───────────────────────────────────────── */}
      {!list && <Card><Blank>Duyurular geliyor…</Blank></Card>}
      {list && list.length === 0 && <Card><Blank>Henüz duyuru yok.</Blank></Card>}

      {(list ?? []).map((a) => (
        <Card key={a.id} className="overflow-hidden">
          <div className="p-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-semibold" style={{ color: "var(--t-gold)" }}>{a.title}</span>
                <span className="t-chip">{targetName(a.target)}</span>
              </div>
              <p className="text-[13px] mt-1.5 whitespace-pre-wrap" style={{ color: "var(--t-dim)" }}>
                {a.content}
              </p>
              <div className="text-[11px] mt-1.5" style={{ color: "var(--t-faint)" }}>
                {new Date(a.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" })}
                {" — "}{a.creator.familyName}
              </div>
            </div>

            <div className="flex gap-1.5 items-center flex-shrink-0">
              <Btn small icon={Send} tone={openId === a.id ? "gold" : "ghost"}
                   disabled={publishing === a.id} onClick={() => toggleRow(a)}>
                {publishing === a.id ? "Gönderiliyor…" : openId === a.id ? "Kapat" : "Discord'a gönder"}
              </Btn>
              <Btn small icon={Trash2} tone="danger" title="Duyuruyu sil" onClick={() => remove(a.id)} />
            </div>
          </div>

          {openId === a.id && (
            <div className="p-4 space-y-3" style={{ borderTop: "1px solid var(--t-line)", background: "rgba(255,255,255,.015)" }}>
              {rowLoading && (
                <p className="text-[12px] animate-pulse" style={{ color: "var(--t-dim)" }}>Yükleniyor…</p>
              )}
              {!rowLoading && rowPreview && (
                <>
                  <PreviewBody data={rowPreview} />
                  <Btn tone="good" icon={Send} onClick={() => publish(a.id)}
                       disabled={publishing === a.id || (rowPreview.mode === "dm" && rowPreview.count === 0)}>
                    {rowPreview.mode === "channel"
                      ? "Kanala gönder"
                      : `${rowPreview.count} kişiye gönder`}
                  </Btn>
                </>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── Parçalar ───────────────────────────────────────────────────────────

function TargetOption({ on, onClick, color, children }: {
  on: boolean; onClick: () => void; color?: string; children: React.ReactNode;
}) {
  const tone = color ?? "var(--t-gold)";
  return (
    <button type="button" onClick={onClick}
            className="flex items-center gap-2 rounded-[var(--t-r-sm)] px-3 py-2 text-[12.5px] text-left transition-colors"
            style={on
              ? { color: color ? "var(--t-text)" : tone, background: (color ?? "#e8b451") + "18",
                  border: `1px solid ${(color ?? "#e8b451")}60` }
              : { color: "var(--t-dim)", background: "var(--t-raised)", border: "1px solid var(--t-line)" }}>
      <span className="w-3 h-3 rounded-full flex-shrink-0 grid place-items-center"
            style={{ border: `1.5px solid ${on ? tone : "var(--t-line-strong)"}` }}>
        {on && <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone }} />}
      </span>
      {children}
    </button>
  );
}

function PreviewBody({ data }: { data: Preview }) {
  if (data.mode === "channel") {
    return (
      <p className="text-[13px]" style={{ color: "var(--t-dim)" }}>
        <span className="font-semibold" style={{ color: "var(--t-gold)" }}>#klan kanalına</span>{" "}
        <code className="t-num text-[11.5px] px-1 rounded" style={{ background: "var(--t-canvas)" }}>@everyone</code>{" "}
        ile gönderilecek.
      </p>
    );
  }

  return (
    <>
      <p className="text-[13px] flex items-center gap-1.5" style={{ color: "var(--t-dim)" }}>
        <Users className="w-3.5 h-3.5" strokeWidth={1.9} style={{ color: "var(--t-faint)" }} />
        DM ile <span className="font-semibold" style={{ color: "var(--t-gold)" }}>{data.count} kişiye</span> gönderilecek:
      </p>

      {data.count === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--t-faint)" }}>Bu kritere uyan kimse yok.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {data.users.map((u) => (
            <div key={u.id} className="rounded-[var(--t-r-sm)] px-2.5 py-1.5 text-[11.5px] flex items-center gap-2"
                 style={{ background: "var(--t-surface)", border: "1px solid var(--t-line)" }}>
              <Ava src={u.avatarUrl} size={26} />
              <div className="min-w-0">
                <div className="font-semibold truncate flex items-center gap-1.5">
                  {u.familyName || <span className="italic" style={{ color: "var(--t-faint)" }}>Siteye girmemiş</span>}
                  {u.guild && <Tag color={u.guild.color}>{u.guild.tag}</Tag>}
                </div>
                <div className="truncate" style={{ color: "var(--t-faint)" }}>
                  {u.class || <span className="t-num text-[10px]">{u.discordId}</span>}
                </div>
                {(u.ap > 0 || u.dp > 0) && (
                  <div className="t-num" style={{ color: "var(--t-gold)" }}>{u.ap}/{u.dp}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
