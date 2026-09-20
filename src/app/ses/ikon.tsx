"use client";

/**
 * Ses simgeleri — mikrofon / kulaklık, açık (yeşil) ve kapalı (kırmızı, çizgili).
 * Tek dosyada dursun: her yerde aynı görünsün (parti sayfası, ses çubuğu, overlay).
 */
export function MikIkon({ acik, size = 16 }: { acik: boolean; size?: number }) {
  const renk = acik ? "var(--t-good)" : "var(--t-bad)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={renk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8" />
      {!acik && <path d="M3 3l18 18" strokeWidth="2.4" />}
    </svg>
  );
}

export function KulaklikIkon({ acik, size = 16 }: { acik: boolean; size?: number }) {
  const renk = acik ? "var(--t-good)" : "var(--t-bad)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={renk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 14v-3a8 8 0 0116 0v3" />
      <rect x="3" y="13" width="4" height="7" rx="1.5" />
      <rect x="17" y="13" width="4" height="7" rx="1.5" />
      {!acik && <path d="M3 3l18 18" strokeWidth="2.4" />}
    </svg>
  );
}

/** Başkasının sesi: kapalıysa hoparlör çizgili */
export function HoparlorIkon({ acik, size = 14 }: { acik: boolean; size?: number }) {
  const renk = acik ? "var(--t-dim)" : "var(--t-bad)";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={renk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5L6 9H3v6h3l5 4z" />
      {acik ? <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /> : <path d="M3 3l18 18" strokeWidth="2.4" />}
    </svg>
  );
}
