"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { sesApi, type Savas, type OnlineUye } from "@/lib/ses-api";
import { useSesAyarlari } from "@/lib/ses-ayarlar";
import { ses } from "@/lib/ses-web";
import { SesEkrani } from "./ekran";
import { useDialoglar } from "./dialog";

/**
 * Sayfanın tarayıcıda çalışan gövdesi. ses-web.ts'in bağımlılığı
 * (gürültü engelleyici) modül yüklenirken AudioWorkletNode'a bakıyor; sunucu
 * tarafında o yok, bu yüzden page.tsx bunu ssr:false ile yüklüyor.
 */
export default function SesUygulama() {
  const { data: session, status } = useSession();
  const [ayarlar, onAyar, hazir] = useSesAyarlari();
  const [savaslar, setSavaslar] = useState<Savas[]>([]);
  const [online, setOnline] = useState<OnlineUye[]>([]);
  const { toastlar, onay } = useDialoglar();
  const benId = session?.user?.id ?? 0;
  const benAd = session?.user?.familyName ?? "";
  const yonetici = !!session?.user?.canManageWars;

  // Ayarları ses katmanına geçir
  useEffect(() => {
    if (!hazir) return;
    ses.ayarla({ gurultuMod: ayarlar.gurultuMod, kazanc: ayarlar.kazanc, esikDb: ayarlar.esikDb, mikrofon: ayarlar.mikrofon || null, hoparlor: ayarlar.hoparlor || null, cikis: ayarlar.cikis / 100 });
  }, [hazir, ayarlar.gurultuMod, ayarlar.kazanc, ayarlar.esikDb, ayarlar.mikrofon, ayarlar.hoparlor, ayarlar.cikis]);
  useEffect(() => { if (hazir) void ses.pttAyarla(ayarlar.pttKod); }, [hazir, ayarlar.pttKod]);
  useEffect(() => { if (hazir) void ses.anonsAyarla(ayarlar.anonsMod, ayarlar.anonsKod); }, [hazir, ayarlar.anonsMod, ayarlar.anonsKod]);

  // Savaşlar + çevrimiçi + nabız: dakikada bir
  useEffect(() => {
    if (status !== "authenticated") return;
    const tazele = () => {
      sesApi.wars().then(setSavaslar).catch(() => {});
      sesApi.nabiz().then(() => sesApi.online()).then(setOnline).catch(() => {});
    };
    tazele();
    const t = setInterval(tazele, 60_000);
    return () => clearInterval(t);
  }, [status]);

  // Sayfadan çıkınca odadan ayrıl
  useEffect(() => () => { void ses.ayril(); }, []);

  if (status !== "authenticated") return null;

  return (
      <div className="ses-sayfa" style={{ height: "calc(100vh - 210px)", minHeight: 520 }}>
        {hazir && (
          <SesEkrani benId={benId} benAd={benAd} yonetici={yonetici} ayarlar={ayarlar} onAyar={onAyar} savaslar={savaslar} online={online} />
        )}
        <div className="toastlar">
          {toastlar.map((t) => <div key={t.id} className={`toast ${t.tur}`}>{t.metin}</div>)}
        </div>
        {onay && (
          <div className="perde" onClick={() => onay.coz(false)}>
            <div className="onay" onClick={(e) => e.stopPropagation()}>
              <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{onay.metin}</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => onay.coz(false)}>{onay.hayir}</button>
                <button className="btn btn-gold" autoFocus onClick={() => onay.coz(true)}>{onay.evet}</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
