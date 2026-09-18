"use client";

/**
 * Katılım güvenilirliği rozeti — "seçildi → geldi" yüzdesi tek sayı.
 *
 * Üstüne gelince kırılım: kaç savaşa katıl dedi, kaç kez seçildi, geldi,
 * gelmedi, habersiz geldi. Yalnızca yöneticilerin gördüğü yerlerde kullanılır
 * (parti kurma, aktivite listesi); üyelere gösterilmez.
 */

export interface GuvenOzet {
  savas: number; dedi: number; secildi: number; geldi: number; gelmedi: number; habersiz: number;
  yuzde: number | null; sonGeldi: string | null;
}

/** 2'den az seçilme = tek gecenin gürültüsü; sayı gösterilir ama soluk */
export const AZ_VERI = 2;

export function guvenRengi(g: GuvenOzet | null | undefined): string {
  if (!g || g.yuzde === null) return "var(--t-faint)";
  if (g.yuzde >= 80) return "var(--t-good)";
  if (g.yuzde >= 50) return "#e09832";
  return "var(--t-bad)";
}

export function guvenAciklama(g: GuvenOzet | null | undefined): string {
  if (!g) return "Raporlu son savaşlarda hiç görünmedi";
  const p = [`Son ${g.savas} raporlu savaş:`, `${g.dedi} kez katıl dedi`, `${g.secildi} kez seçildi`, `${g.geldi} geldi`];
  if (g.gelmedi) p.push(`${g.gelmedi} GELMEDİ`);
  if (g.habersiz) p.push(`${g.habersiz} kez habersiz geldi`);
  return p.join(" · ");
}

export function GuvenRozeti({ g, small }: { g: GuvenOzet | null | undefined; small?: boolean }) {
  const renk = guvenRengi(g);
  const azVeri = !g || g.secildi < AZ_VERI;
  const metin = g && g.yuzde !== null ? `%${g.yuzde}` : g && g.dedi > 0 ? "seçilmedi" : "—";
  return (
    <span title={guvenAciklama(g)}
          className={`inline-flex items-center gap-1 rounded-md t-num font-bold ${small ? "text-[10px] px-1" : "text-[11px] px-1.5 py-0.5"}`}
          style={{ color: renk, background: azVeri ? "transparent" : renk.startsWith("var") ? "rgba(255,255,255,.05)" : renk + "18", opacity: azVeri ? 0.55 : 1 }}>
      {metin}
      {g && !small && <span className="font-normal" style={{ color: "var(--t-faint)" }}>{g.geldi}/{g.secildi}</span>}
      {g && g.gelmedi > 0 && !small && <span className="font-normal" style={{ color: "var(--t-bad)" }}>✕{g.gelmedi}</span>}
    </span>
  );
}
