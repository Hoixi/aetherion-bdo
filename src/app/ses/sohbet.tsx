"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sesApi, type Mesaj } from "@/lib/ses-api";
import { getClassByID } from "@/lib/classes";

/**
 * Genel sohbet — tek kanal, 5 sn'de bir yeni mesaj sorgusu (sayfa açıkken).
 * "@" ile etiketleme: çevrimiçi ve son yazanlardan öneri; kendi adım geçen
 * mesaj vurgulanır.
 */
export function Sohbet({ benId, benAd, online }: {
  benId: number; benAd: string;
  online: Array<{ id: number; familyName: string }>;
}) {
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [metin, setMetin] = useState("");
  const [oneri, setOneri] = useState<string[]>([]);
  const sonId = useRef(0);
  const kutu = useRef<HTMLDivElement>(null);
  const altta = useRef(true);

  const cek = useCallback(async () => {
    try {
      const yeni = await sesApi.chat(sonId.current || undefined);
      if (!yeni.length) return;
      sonId.current = yeni[yeni.length - 1].id;
      setMesajlar((m) => [...m, ...yeni].slice(-300));
    } catch { /* sonraki tur */ }
  }, []);
  useEffect(() => { void cek(); const t = setInterval(cek, 5000); return () => clearInterval(t); }, [cek]);
  useEffect(() => { if (altta.current && kutu.current) kutu.current.scrollTop = kutu.current.scrollHeight; }, [mesajlar]);

  async function gonder() {
    const t = metin.trim(); if (!t) return;
    setMetin(""); setOneri([]);
    try { await sesApi.chatSend(t); await cek(); } catch { /* sessiz */ }
  }

  function yaz(v: string) {
    setMetin(v);
    const m = /@([^\s@]*)$/.exec(v);
    if (!m) { setOneri([]); return; }
    const q = m[1].toLocaleLowerCase("tr");
    const adaylar = Array.from(new Set([...online.map((o) => o.familyName), ...mesajlar.map((x) => x.user.familyName)]))
      .filter((a) => a !== benAd && a.toLocaleLowerCase("tr").startsWith(q)).slice(0, 6);
    setOneri(adaylar);
  }
  const tamamla = (ad: string) => { setMetin(metin.replace(/@([^\s@]*)$/, `@${ad} `)); setOneri([]); };

  const parcala = (t: string) => t.split(/(@[^\s@]+)/g).map((p, i) =>
    p.startsWith("@") ? <span key={i} className={`etiket ${p.slice(1) === benAd ? "ben" : ""}`}>{p}</span> : <span key={i}>{p}</span>);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", height: "100%" }}>
      <div className="head" style={{ padding: "10px 14px" }}># genel <span className="faint small" style={{ fontWeight: 400 }}>· klan sohbeti</span></div>
      <div ref={kutu} style={{ flex: 1, overflow: "auto", padding: "8px 14px" }}
           onScroll={(e) => { const el = e.currentTarget; altta.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {mesajlar.length === 0 && <div className="faint small" style={{ padding: 8 }}>Henüz mesaj yok. İlk sen yaz.</div>}
        {mesajlar.map((m, i) => {
          const oncekiAyni = i > 0 && mesajlar[i - 1].user.id === m.user.id && Date.parse(m.createdAt) - Date.parse(mesajlar[i - 1].createdAt) < 5 * 60_000;
          const bana = m.user.id !== benId && benAd && m.text.includes(`@${benAd}`);
          return (
            <div key={m.id} className={`mesaj ${bana ? "bana" : ""}`} style={{ marginTop: oncekiAyni ? 1 : 10 }}>
              {!oncekiAyni && (
                <div className="mesaj-baslik">
                  <span style={{ fontWeight: 600, color: m.user.id === benId ? "var(--t-gold)" : "var(--t-text)" }}>{m.user.familyName}</span>
                  {m.user.class && <span className="faint small">{getClassByID(m.user.class)?.name ?? m.user.class}</span>}
                  <span className="faint small">{new Date(m.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              )}
              <div className="mesaj-metin">{parcala(m.text)}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "relative", padding: 10, borderTop: "1px solid var(--t-line)" }}>
        {oneri.length > 0 && (
          <div className="oneri">
            {oneri.map((a) => <button key={a} className="oneri-satir" onMouseDown={(e) => { e.preventDefault(); tamamla(a); }}>@{a}</button>)}
          </div>
        )}
        <input className="input" placeholder="#genel kanalına yaz… (@ ile etiketle)" value={metin} maxLength={1000}
               onChange={(e) => yaz(e.target.value)}
               onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (oneri.length && /@[^\s@]*$/.test(metin)) tamamla(oneri[0]); else void gonder(); } if (e.key === "Escape") setOneri([]); }} />
      </div>
    </div>
  );
}
