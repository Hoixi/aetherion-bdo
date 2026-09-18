"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, RefreshCw, Search, AlertTriangle } from "lucide-react";
import { Card, Head } from "@/components/app-shell";
import { Blank, Btn, Input } from "./ui";
import { getClassByID, getClassIconUrl } from "@/lib/classes";
import { GuvenRozeti, type GuvenOzet } from "@/components/guven-rozeti";

/**
 * Üye aktivitesi — kim ne zamandır ortada yok.
 *
 * Her satırda "son görülme" tek bir tarih: siteye giriş, uygulama, grind,
 * savaş (rapora düştü ya da katıl dedi), forum/sohbet — hangisi en yeniyse.
 * Ayrıntı sütunları hangi yoldan görüldüğünü söylüyor. Eşik varsayılan 14
 * gün; kick kararı için liste, karar değil.
 */

type Satir = {
  id: number; familyName: string; class: string; gs: number;
  guild: { tag: string; color: string } | null;
  siteRole: { name: string; color: string } | null;
  uyelik: string | null;
  site: string | null; uygulama: string | null; grind: string | null; savas: string | null; forum: string | null;
  son: string | null; gun: number | null;
  guven: GuvenOzet | null;
};

const ESIKLER = [7, 14, 30];

function gunOnce(iso: string | null): { metin: string; gun: number | null } {
  if (!iso) return { metin: "—", gun: null };
  const gun = Math.floor((Date.now() - Date.parse(iso)) / 86400_000);
  if (gun <= 0) return { metin: "bugün", gun };
  if (gun === 1) return { metin: "dün", gun };
  if (gun < 60) return { metin: `${gun} gün`, gun };
  return { metin: new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" }), gun };
}

function tonu(gun: number | null, esik: number) {
  if (gun === null) return "var(--t-bad)";
  if (gun >= esik) return "var(--t-bad)";
  if (gun >= Math.ceil(esik / 2)) return "#e09832";
  return "var(--t-good)";
}

export default function AktiviteTab() {
  const [satirlar, setSatirlar] = useState<Satir[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [esik, setEsik] = useState(14);
  const [sadeceKayip, setSadeceKayip] = useState(true);

  const yukle = () => {
    setHata(null);
    fetch("/api/admin/activity").then(async (r) => {
      if (!r.ok) throw new Error("Liste alınamadı.");
      setSatirlar(((await r.json()) as { uyeler: Satir[] }).uyeler);
    }).catch((e: Error) => setHata(e.message));
  };
  useEffect(yukle, []);

  const liste = useMemo(() => {
    if (!satirlar) return [];
    const n = q.trim().toLocaleLowerCase("tr");
    return satirlar
      .filter((s) => !n || s.familyName.toLocaleLowerCase("tr").includes(n))
      .filter((s) => !sadeceKayip || s.gun === null || s.gun >= esik)
      .sort((a, b) => (b.gun ?? 9999) - (a.gun ?? 9999) || a.familyName.localeCompare(b.familyName, "tr"));
  }, [satirlar, q, esik, sadeceKayip]);

  const kayip = satirlar?.filter((s) => s.gun === null || s.gun >= esik).length ?? 0;

  return (
    <Card className="overflow-hidden">
      <Head icon={Activity} title="Aktivite"
            meta={satirlar ? <span className="t-num">{kayip} kişi {esik}+ gündür yok · {satirlar.length} üye</span> : "…"} />
      <div className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--t-faint)" }} />
            <Input value={q} onChange={setQ} placeholder="Üye ara" className="pl-9 w-[200px]" />
          </div>
          <div className="flex items-center gap-1 text-[12px]" style={{ color: "var(--t-dim)" }}>
            Eşik
            {ESIKLER.map((e) => (
              <button key={e} onClick={() => setEsik(e)} className="t-tab" data-on={esik === e}>{e} gün</button>
            ))}
          </div>
          <button className="t-tab" data-on={sadeceKayip} onClick={() => setSadeceKayip((v) => !v)}>
            <AlertTriangle className="w-3.5 h-3.5" /> Sadece görünmeyenler
          </button>
          <Btn onClick={yukle} icon={RefreshCw} className="ml-auto">Yenile</Btn>
        </div>

        {hata && <Blank>{hata}</Blank>}
        {satirlar && liste.length === 0 && <Blank>{sadeceKayip ? `${esik} gündür görünmeyen kimse yok.` : "Üye yok."}</Blank>}

        {liste.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wider" style={{ color: "var(--t-faint)" }}>
                  <th className="text-left font-semibold py-2 pr-3">Üye</th>
                  <th className="text-right font-semibold py-2 px-2">Son görülme</th>
                  <th className="text-right font-semibold py-2 px-2">Site</th>
                  <th className="text-right font-semibold py-2 px-2">Uygulama</th>
                  <th className="text-right font-semibold py-2 px-2">Grind</th>
                  <th className="text-right font-semibold py-2 px-2">Savaş</th>
                  <th className="text-right font-semibold py-2 px-2">Forum</th>
                  <th className="text-right font-semibold py-2 pl-2">Güvenilirlik</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((s) => {
                  const son = gunOnce(s.son);
                  const icon = getClassIconUrl(s.class);
                  return (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--t-line)" }}>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {icon ? <img src={icon} alt="" className="w-4 h-4 opacity-75 shrink-0" title={getClassByID(s.class)?.name} /> : <span className="w-4" />}
                          <span className="font-semibold truncate">{s.familyName}</span>
                          {s.guild && <span className="text-[9px] font-bold tracking-wider" style={{ color: s.guild.color }}>{s.guild.tag}</span>}
                          <span className="t-num text-[11px]" style={{ color: "var(--t-faint)" }}>{s.gs}</span>
                        </div>
                      </td>
                      <td className="text-right py-2 px-2 t-num font-semibold" style={{ color: tonu(son.gun, esik) }}>
                        {s.son ? son.metin : "hiç"}
                      </td>
                      {[s.site, s.uygulama, s.grind, s.savas, s.forum].map((v, i) => {
                        const g = gunOnce(v);
                        return <td key={i} className="text-right py-2 px-2 t-num" style={{ color: v ? "var(--t-dim)" : "var(--t-faint)" }}>{g.metin}</td>;
                      })}
                      <td className="text-right py-2 pl-2"><GuvenRozeti g={s.guven} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px]" style={{ color: "var(--t-faint)" }}>
          Site girişi saatte bir yazılır; bu özellik açılmadan önceki girişler görünmez, o yüzden ilk günlerde &quot;Site&quot; sütunu boş olabilir.
        </p>
      </div>
    </Card>
  );
}
