"use client";

import { useState } from "react";
import Link from "next/link";
import { parseBdoText, gradeOf } from "@/lib/bdo-text";

/**
 * Eşya görselleri — liste ve detay ekranı ortak kullanıyor.
 *
 * Kalite rengi tek taşıyıcı sinyal: çerçeve, ad ve rozet aynı renkten
 * besleniyor, böylece ızgarada göz kaliteyi okuyor, metni okumadan.
 */

export interface ItemLinkLike {
  id: string;
  name: string;
  grade: number;
  icon: string | null;
  count?: number;
  note?: string;
}

/** urn::item:10010 -> 10010 (link hedefi) */
const idOf = (urn: string) => urn.split(":").pop() ?? urn;

export function ItemIcon({ item, size = 44 }: { item: ItemLinkLike; size?: number }) {
  const g = gradeOf(item.grade);
  // 370 eşyanın ikonu client'ta çözülemiyor; kırık görsel yerine kalite
  // renginde yer tutucuya düşülüyor.
  const [broken, setBroken] = useState(false);
  const showImage = !!item.icon && !broken;

  return (
    <span
      className="relative inline-flex items-center justify-center shrink-0 rounded-[7px] overflow-hidden"
      style={{
        width: size,
        height: size,
        // Kalite rengi çerçeveyi ve hafif iç parıltıyı sürüyor.
        border: `1px solid ${g.color}55`,
        background: `radial-gradient(120% 120% at 50% 0%, ${g.color}1f 0%, var(--t-raised) 70%)`,
      }}
    >
      {showImage ? (
        // next/image yerine düz img: 21.660 ikonun hepsi zaten küçük webp,
        // optimizer'a sokmak sunucuya bedava iş çıkarır.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.icon!} alt="" width={size - 8} height={size - 8} loading="lazy"
             onError={() => setBroken(true)}
             className="object-contain" />
      ) : (
        <span className="text-[10px] font-mono" style={{ color: g.color }}>
          {item.grade}
        </span>
      )}
      {item.count !== undefined && item.count > 1 && (
        <span
          className="absolute bottom-0 right-0 px-1 text-[10px] font-mono leading-[14px] rounded-tl-[6px]"
          style={{ background: "rgba(0,0,0,0.78)", color: "var(--t-text)" }}
        >
          {item.count}
        </span>
      )}
    </span>
  );
}

/** Bağlantılı eşya satırı — tıklanınca o eşyaya gider. */
export function ItemChip({ item, size = 38 }: { item: ItemLinkLike; size?: number }) {
  const g = gradeOf(item.grade);
  return (
    <Link
      href={`/esyalar/${idOf(item.id)}`}
      className="flex items-center gap-2.5 px-2 py-1.5 rounded-[9px] transition-colors group"
      style={{ border: "1px solid var(--t-line)" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${g.color}66`)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--t-line)")}
    >
      <ItemIcon item={item} size={size} />
      <span className="min-w-0">
        <span className="block text-[12.5px] leading-tight truncate" style={{ color: g.color }}>
          {item.name}
        </span>
        {item.note && (
          <span className="block text-[10.5px] truncate" style={{ color: "var(--t-faint)" }}>
            {item.note}
          </span>
        )}
      </span>
    </Link>
  );
}

/** Oyun içi renk etiketlerini koruyarak açıklama basar. */
export function BdoText({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const segments = parseBdoText(text);
  if (segments.length === 0) return null;
  return (
    <p className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {segments.map((s, i) =>
        s.bind ? (
          <kbd key={i} className="px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono"
               style={{ background: "var(--t-raised)", border: "1px solid var(--t-line-strong)",
                        color: s.color ?? "var(--t-text)" }}>
            {s.text}
          </kbd>
        ) : (
          <span key={i} style={s.color ? { color: s.color } : undefined}>{s.text}</span>
        ),
      )}
    </p>
  );
}
