"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Card } from "@/components/app-shell";
import { Btn, Input, SectionHead } from "./ui";

/**
 * Grind spotları — uygulamanın oturum açarken seçtiği liste.
 * Yalnızca Edania 2; spot silinince oturumlar kalır, spotu boşa düşer.
 */

interface Spot { id: number; name: string; region: string; order: number; active: boolean }

export function GrindSpotlari({ mesaj }: { mesaj: (m: string) => void }) {
  const [spotlar, setSpotlar] = useState<Spot[]>([]);
  const [yeni, setYeni] = useState("");
  const [busy, setBusy] = useState(false);

  const yukle = useCallback(async () => {
    const r = await fetch("/api/admin/grind-spots");
    if (r.ok) setSpotlar(await r.json());
  }, []);
  useEffect(() => { void yukle(); }, [yukle]);

  async function istek(method: string, body?: unknown, query = "") {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/grind-spots${query}`, {
        method, headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { mesaj(j.error ?? "İşlem başarısız."); return false; }
      await yukle();
      return true;
    } finally { setBusy(false); }
  }

  async function ekle() {
    const ad = yeni.trim();
    if (!ad) return;
    if (await istek("POST", { name: ad })) { setYeni(""); mesaj(`"${ad}" eklendi.`); }
  }

  return (
    <Card className="overflow-hidden">
      <SectionHead icon={MapPin} title="Grind Spotları"
                   desc="Uygulama oturum açarken bu listeden seçtirir; /grind sayfası bunlara göre sekmelenir. Yalnızca Edania 2." />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Input value={yeni} onChange={setYeni} placeholder="Spot adı (ör. Aphrodon Tapınağı)" maxLength={60} />
          <Btn tone="gold" icon={Plus} disabled={busy || !yeni.trim()} onClick={ekle}>Ekle</Btn>
        </div>
        {spotlar.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: "var(--t-dim)" }}>Henüz spot yok.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--t-line)" }}>
            {spotlar.map((s) => (
              <li key={s.id} className="flex items-center gap-2 py-2">
                <span className="text-[13px] flex-1" style={{ color: s.active ? "var(--t-text)" : "var(--t-faint)" }}>
                  {s.name} <span className="text-[11px]" style={{ color: "var(--t-faint)" }}>· {s.region}</span>
                </span>
                <Btn small tone="ghost" icon={s.active ? EyeOff : Eye} disabled={busy}
                     title={s.active ? "Listeden gizle" : "Listeye al"}
                     onClick={() => istek("PUT", { id: s.id, active: !s.active })}>
                  {s.active ? "Gizle" : "Göster"}
                </Btn>
                <Btn small tone="danger" icon={Trash2} disabled={busy} title="Sil"
                     onClick={() => { if (confirm(`"${s.name}" silinsin mi? Oturumlar kalır.`)) void istek("DELETE", undefined, `?id=${s.id}`); }} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
