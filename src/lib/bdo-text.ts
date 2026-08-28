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

// ── Aciklama bloklari ───────────────────────────────────────────────────────

/**
 * Oyun aciklamalari duz metin degil, satir bazli bir yapi tasiyor:
 *
 *   - Kullanim: Esya kullanilarak etki elde edilir     -> etiketli satir
 *   - Etki                                            -> baslik
 *      Tum AP +10                                     -> onun altindaki liste
 *   ※ Tur: Parfum                                     -> not
 *
 * Hepsini tek paragrafta basmak oyun ici tooltip'te ayri duran seyleri
 * birbirine yapistiriyor; burada bloklara ayiriyoruz.
 */
export interface TextBlock {
  kind: "text" | "section" | "note";
  label?: TextSegment[];
  body?: TextSegment[];
  items?: TextSegment[][];
}

/** Etiket icinde olmayan ilk iki nokta ( {TextBind:...} ve <PAColor...> haric ). */
function topLevelColon(raw: string): number {
  let angle = 0, brace = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "<") angle++;
    else if (c === ">") angle = Math.max(0, angle - 1);
    else if (c === "{") brace++;
    else if (c === "}") brace = Math.max(0, brace - 1);
    else if (c === ":" && angle === 0 && brace === 0) return i;
  }
  return -1;
}

/** Bastaki/sondaki bosluk renk etiketinin ICINDE kalabiliyor; segment duzeyinde kirp. */
function trimSegments(segs: TextSegment[]): TextSegment[] {
  const out = segs.map((s) => ({ ...s }));
  while (out.length && out[0].text.trimStart() === "") out.shift();
  if (out.length) out[0].text = out[0].text.trimStart();
  while (out.length && out[out.length - 1].text.trimEnd() === "") out.pop();
  if (out.length) out[out.length - 1].text = out[out.length - 1].text.trimEnd();
  return out;
}

export function parseBdoBlocks(raw: string | null | undefined): TextBlock[] {
  if (!raw || raw === "<null>") return [];

  const blocks: TextBlock[] = [];
  let open: TextBlock | null = null;   // liste toplayan acik baslik

  for (const line of raw.split("\n")) {
    const plain = stripBdoText(line);
    if (plain === "") { open = null; continue; }

    if (plain.startsWith("※")) {
      blocks.push({ kind: "note", body: trimSegments(parseBdoText(line.replace(/※\s*/, ""))) });
      open = null;
      continue;
    }

    if (/^-\s/.test(plain)) {
      const rest = line.replace(/^\s*-\s*/, "");
      const colon = topLevelColon(rest);
      if (colon >= 0) {
        blocks.push({
          kind: "section",
          label: trimSegments(parseBdoText(rest.slice(0, colon))),
          body: trimSegments(parseBdoText(rest.slice(colon + 1))),
        });
        open = null;
      } else {
        // Iki nokta yoksa altindaki satirlar bu basligin listesi olur.
        open = { kind: "section", label: trimSegments(parseBdoText(rest)), items: [] };
        blocks.push(open);
      }
      continue;
    }

    const segments = trimSegments(parseBdoText(line));
    if (open) open.items!.push(segments);
    else blocks.push({ kind: "text", body: segments });
  }

  return blocks.filter((b) => b.kind !== "section" || b.label?.length || b.items?.length);
}
