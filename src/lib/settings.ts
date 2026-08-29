import { prisma } from "@/lib/prisma";

/**
 * Site geneli ayarlar.
 *
 * Şimdilik tek kayıt var ama anahtar/değer tablosu seçildi: sıradaki
 * küçük ayar için yeni bir kolon ya da göç gerekmesin.
 */

export const SETTING_KEYS = {
  discordInvite: "discord_invite",
  slogan: "slogan",
  manifesto: "manifesto",
  wallpaperBlur: "wallpaper_blur",
} as const;

/** Karsilama ekranindaki metinler icin ust sinir */
export const SLOGAN_MAX = 120;
export const MANIFESTO_MAX = 500;

/** Arka plan bulanikligi (px). 0 = hic bulanik degil. */
export const BLUR_MIN = 0;
export const BLUR_MAX = 40;
export const BLUR_DEFAULT = 6;

/** Tablo boşsa karşılama ekranı bağlantısız kalmasın diye */
export const DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.discordInvite]: "",
  [SETTING_KEYS.slogan]: "En iyi bildiğin yol en iyi bildiğin yoldur",
  [SETTING_KEYS.wallpaperBlur]: String(BLUR_DEFAULT),
  [SETTING_KEYS.manifesto]:
    "Aetherion bir PvP klanıdır. Her gün node war atmaya çalışırız; girdiğimiz her savaşın raporunu tutar, herkesin katkısını tek tek ölçeriz. Burada kim ne yaptıysa görünür.",
};

/**
 * Bos kaydedilmis deger varsayilani ezmesin.
 *
 * Panelde "bos birakirsan varsayilan gorunur" yaziyor; bos bir satir
 * kalirsa yazi dogru ama kutu bos kaliyor ve neyin yayinda oldugu
 * anlasilmiyor.
 */
function degerOrVarsayilan(key: string, deger: string | undefined): string {
  const v = deger ?? "";
  return v.trim() === "" ? (DEFAULTS[key] ?? "") : v;
}

export async function getSetting(key: string): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return degerOrVarsayilan(key, row?.value);
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const bulunan = new Map(rows.map((r) => [r.key, r.value]));
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = degerOrVarsayilan(k, bulunan.get(k));
  return out;
}

export async function setSetting(key: string, value: string): Promise<void> {
  // Bosaltmak "varsayilana don" demek; satiri birakmak yerine siliyoruz.
  if (value.trim() === "" && (DEFAULTS[key] ?? "") !== "") {
    await prisma.setting.deleteMany({ where: { key } });
    return;
  }
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/**
 * Davet bağlantısı doğrulaması.
 *
 * Panelden girilen değer karşılama ekranında herkese `href` olarak
 * basılıyor; `javascript:` gibi bir şema girilirse tıklayan herkeste
 * çalışır. Bu yüzden yalnızca Discord davet adresleri kabul ediliyor.
 */
export function validDiscordInvite(raw: string): string | null {
  const s = raw.trim();
  if (s === "") return "";               // temizlemek serbest
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase();
  const ok = ["discord.gg", "discord.com", "www.discord.com", "discordapp.com"];
  if (!ok.includes(host)) return null;
  if (host.endsWith("discord.com") && !u.pathname.startsWith("/invite/")) return null;
  return u.toString();
}
