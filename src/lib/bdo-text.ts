/**
 * BDO metin isaretlemesi.
 *
 * Oyun ici aciklamalar kendi etiketlerini tasiyor:
 *   <PAColor0xffe9bd23>+%42<PAOldColor>   renkli parca (0xAARRGGBB)
 *   {TextBind:USE_CLICK_RMB}              tus atamasi yer tutucusu
 *
 * Ham haliyle basilirsa aciklamalar okunmaz hale geliyor; burada segmentlere
 * ayirip renkleri koruyoruz.
 */

export interface TextSegment {
  text: string;
  color?: string;   // "#e9bd23"
  bind?: boolean;   // tus atamasi rozeti olarak gosterilir
}

const COLOR_OPEN = /<PAColor0x([0-9a-fA-F]{8})>/;
const COLOR_CLOSE = "<PAOldColor>";
const BIND = /\{TextBind:([A-Z0-9_]+)\}/g;

const BIND_LABELS: Record<string, string> = {
  USE_CLICK_RMB: "Sağ tık",
  USE_CLICK_LMB: "Sol tık",
};

/** 0xAARRGGBB -> #RRGGBB (alfa yok sayilir; koyu zeminde zaten opak basiyoruz) */
function toHex(argb: string): string {
  return `#${argb.slice(2)}`;
}

/** Tus atamalarini segmentlere ayirir. */
function splitBinds(text: string, color?: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  // Array.from: proje ES5 hedefliyor, iterator dogrudan gezilemiyor.
  for (const m of Array.from(text.matchAll(BIND))) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), color });
    out.push({ text: BIND_LABELS[m[1]] ?? m[1], color, bind: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), color });
  return out;
}

export function parseBdoText(raw: string | null | undefined): TextSegment[] {
  if (!raw || raw === "<null>") return [];

  const segments: TextSegment[] = [];
  let rest = raw;
  let color: string | undefined;

  while (rest.length > 0) {
    const open = rest.match(COLOR_OPEN);
    const closeAt = rest.indexOf(COLOR_CLOSE);

    // Siradaki etiket hangisiyse ona kadar olan duz metni al.
    const openAt = open?.index ?? -1;
    const next = [openAt, closeAt].filter((i) => i >= 0).sort((a, b) => a - b)[0];

    if (next === undefined) {
      segments.push(...splitBinds(rest, color));
      break;
    }
    if (next > 0) segments.push(...splitBinds(rest.slice(0, next), color));

    if (next === openAt && open) {
      color = toHex(open[1]);
      rest = rest.slice(openAt + open[0].length);
    } else {
      color = undefined;
      rest = rest.slice(closeAt + COLOR_CLOSE.length);
    }
  }

  return segments.filter((s) => s.text.length > 0);
}

/** Etiketleri tamamen atip duz metin dondurur (arama, meta etiketi vb.). */
export const stripBdoText = (raw: string | null | undefined): string =>
  parseBdoText(raw).map((s) => s.text).join("").replace(/\s+/g, " ").trim();

// ── Kalite kademeleri ───────────────────────────────────────────────────────

export interface Grade {
  label: string;
  color: string;
}

/**
 * Oyun ici kalite renkleri. Kademe sayisi surumle degisebiliyor, bu yuzden
 * bilinmeyen degerler icin notr bir varsayilan donuyor.
 */
const GRADES: Record<number, Grade> = {
  0: { label: "Beyaz", color: "#d4d4d8" },
  1: { label: "Yeşil", color: "#3ecf8e" },
  2: { label: "Mavi", color: "#4a90d9" },
  3: { label: "Sarı", color: "#e8b451" },
  4: { label: "Turuncu", color: "#f07a3c" },
  5: { label: "Kırmızı", color: "#ef5f5f" },
};

export const gradeOf = (g: number | null | undefined): Grade =>
  GRADES[g ?? 0] ?? { label: `Kademe ${g}`, color: "#9a9aa2" };
