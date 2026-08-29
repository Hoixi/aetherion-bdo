"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Search, Check, X, Trash2, UserPlus, Copy, CheckCheck } from "lucide-react";
import { getClassByID, getClassIconUrl } from "@/lib/classes";
import { Card, Head } from "@/components/app-shell";
import { Blank, Btn, Metric, Tag } from "./ui";

/**
 * Klan başvuruları.
 *
 * Durum sütunları ayrı kartlarda: yeni gelenler üstte, kapananlar altta.
 * Kabul edilince sunucu Discord rolünü de atıyor — o yüzden buradaki
 * "Kabul" düğmesi sadece bir durum değişikliği değil.
 */

type ApplicationRow = {
  id: number;
  familyName: string;
  discordUsername: string;
  discordId: string | null;
  class: string;
  spec: string;
  ap: number;
  dp: number;
  experience: string | null;
  note: string | null;
  status: "NEW" | "REVIEW" | "ACCEPTED" | "REJECTED";
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  guild: { id: number; name: string; tag: string; color: string } | null;
  reviewer: { familyName: string } | null;
};

const COLS = [
  { key: "NEW" as const,      label: "Yeni",     icon: Clock,  color: "#e8b451" },
  { key: "REVIEW" as const,   label: "İnceleme", icon: Search, color: "#6b93ff" },
  { key: "ACCEPTED" as const, label: "Kabul",    icon: Check,  color: "#2bca6e" },
  { key: "REJECTED" as const, label: "Red",      icon: X,      color: "#ef5f5f" },
];

export default function BasvurularTab({ flash }: { flash: (msg: string) => void }) {
  const [apps, setApps] = useState<ApplicationRow[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  /** Paylasilacak form adresi kopyalandi mi */
  const [kopyalandi, setKopyalandi] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/applications");
    if (res.ok) setApps(await res.json());
  }, []);

  useEffect(() => { load(); }, [load]);

  async function setStatus(id: number, status: ApplicationRow["status"]) {
    setBusy(id);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      // Rol atanamadıysa sunucu uyarı döndürüyor; sessizce yutmayalım
      flash(data.roleWarning ?? (status === "ACCEPTED" ? "Başvuru kabul edildi, rol atandı." : "Başvuru güncellendi."));
      await load();
    } else {
      flash(data.error ?? "Güncellenemedi.");
    }
    setBusy(null);
  }

  async function remove(id: number) {
    if (!confirm("Bu başvuruyu silmek istediğine emin misin?")) return;
    setBusy(id);
    await fetch(`/api/applications/${id}`, { method: "DELETE" });
    await load();
    setBusy(null);
  }

  if (!apps) return <Card><Blank>Başvurular geliyor…</Blank></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {COLS.map((c) => (
          <Metric key={c.key} label={c.label} tone={c.color}
                  value={apps.filter((a) => a.status === c.key).length} />
        ))}
      </div>

      {COLS.map((col) => {
        const list = apps.filter((a) => a.status === col.key);
        if (list.length === 0) return null;

        return (
          <Card key={col.key} className="overflow-hidden">
            <Head icon={col.icon} title={col.label} meta={`${list.length} BAŞVURU`} />
            {list.map((a) => {
              const cls = getClassByID(a.class);
              const icon = a.class ? getClassIconUrl(a.class) : "";
              const isOpen = open === a.id;
              const isBusy = busy === a.id;

              return (
                <div key={a.id} style={{ borderBottom: "1px solid var(--t-line)" }}>
                  <div className="px-5 py-2.5 flex items-center gap-3 flex-wrap">
                    <button onClick={() => setOpen(isOpen ? null : a.id)}
                            className="flex items-center gap-2.5 flex-1 min-w-[190px] text-left">
                      {icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={icon} alt="" className="w-7 h-7 opacity-70 flex-shrink-0" />
                      ) : (
                        <span className="w-7 h-7 rounded flex-shrink-0" style={{ background: "var(--t-raised)" }} />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[13px] font-medium truncate">{a.familyName}</span>
                          {a.guild && <Tag color={a.guild.color}>{a.guild.tag}</Tag>}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: "var(--t-faint)" }}>
                          {cls?.name ?? "—"}
                          {cls && ` · ${a.spec === "succession" ? "SUC" : "AWK"}`}
                          {" · "}
                          <span className="t-num" style={{ color: "var(--t-gold)" }}>{a.ap + a.dp} GS</span>
                          {" · @"}{a.discordUsername}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-[10px] mr-1" style={{ color: "var(--t-faint)" }}>
                        {new Date(a.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                      </span>
                      {a.status !== "REVIEW" && a.status !== "ACCEPTED" && (
                        <Btn small icon={Search} disabled={isBusy} onClick={() => setStatus(a.id, "REVIEW")}>
                          İncele
                        </Btn>
                      )}
                      {a.status !== "ACCEPTED" && (
                        <Btn small icon={Check} tone="good" disabled={isBusy} onClick={() => setStatus(a.id, "ACCEPTED")}>
                          Kabul
                        </Btn>
                      )}
                      {a.status !== "REJECTED" && (
                        <Btn small icon={X} tone="danger" title="Reddet" disabled={isBusy}
                             onClick={() => setStatus(a.id, "REJECTED")} />
                      )}
                      <Btn small icon={Trash2} title="Başvuruyu sil" disabled={isBusy} onClick={() => remove(a.id)} />
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-5 pb-3 space-y-2.5" style={{ background: "rgba(255,255,255,.015)" }}>
                      {a.experience && (
                        <Detail label="PvP tecrübesi">{a.experience}</Detail>
                      )}
                      {a.note && <Detail label="Notu">{a.note}</Detail>}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] pt-1" style={{ color: "var(--t-faint)" }}>
                        <span>AP <span className="t-num" style={{ color: "#ef8080" }}>{a.ap}</span></span>
                        <span>DP <span className="t-num" style={{ color: "#6b93ff" }}>{a.dp}</span></span>
                        {a.discordId && <span>Discord ID <span className="t-num">{a.discordId}</span></span>}
                        {a.reviewer && <span>İnceleyen: {a.reviewer.familyName}</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        );
      })}

      {apps.length === 0 && (
        <Card className="p-10 flex flex-col items-center gap-2">
          <UserPlus className="w-6 h-6" strokeWidth={1.5} style={{ color: "var(--t-faint)" }} />
          <span className="text-[13px]" style={{ color: "var(--t-dim)" }}>Henüz başvuru yok.</span>
        </Card>
      )}

      {/* Adres paylasmak icin: tiklayinca panelden cikip forma gitmesin,
          yalnizca panoya alsin. */}
      <Card className="px-4 py-3">
        <div className="text-[11.5px] flex items-center gap-2 flex-wrap"
             style={{ color: "var(--t-faint)" }}>
          <span>Başvuru formu:</span>
          <code className="t-num px-2 py-1 rounded-[var(--t-r-sm)]"
                style={{ background: "var(--t-raised)", border: "1px solid var(--t-line)",
                         color: "var(--t-gold)" }}>
            aetheri.online/basvuru
          </code>
          <Btn small icon={kopyalandi ? CheckCheck : Copy}
               onClick={() => {
                 navigator.clipboard?.writeText("https://aetheri.online/basvuru")
                   .then(() => {
                     setKopyalandi(true);
                     setTimeout(() => setKopyalandi(false), 2000);
                   })
                   .catch(() => {});
               }}>
            {kopyalandi ? "Kopyalandı" : "Kopyala"}
          </Btn>
          <span>— giriş gerektirmez, klana katılmak isteyenlerle paylaşabilirsin.</span>
        </div>
      </Card>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.08em] mb-1" style={{ color: "var(--t-faint)" }}>{label}</p>
      <p className="text-[12px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--t-dim)" }}>
        {children}
      </p>
    </div>
  );
}
