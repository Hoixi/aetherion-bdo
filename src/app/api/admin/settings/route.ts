export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  SETTING_KEYS, SLOGAN_MAX, MANIFESTO_MAX, BLUR_MIN, BLUR_MAX,
  getSettings, setSetting, validDiscordInvite,
} from "@/lib/settings";

/** string[]: `as const` anahtarlari daraltiyor, gelen govde ise duz string. */
const OKUNABILIR: string[] = [
  SETTING_KEYS.discordInvite, SETTING_KEYS.slogan, SETTING_KEYS.manifesto,
  SETTING_KEYS.wallpaperBlur,
];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin && !session?.user.isGuildAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getSettings(OKUNABILIR));
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  // Davet bağlantısı site geneli: klan yöneticisi değil, site admini değiştirir
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { key?: string; value?: string };
  if (!body.key || typeof body.value !== "string") {
    return NextResponse.json({ error: "key ve value gerekli." }, { status: 400 });
  }
  if (!OKUNABILIR.includes(body.key)) {
    return NextResponse.json({ error: "Bilinmeyen ayar." }, { status: 400 });
  }

  if (body.key === SETTING_KEYS.discordInvite) {
    const temiz = validDiscordInvite(body.value);
    if (temiz === null) {
      return NextResponse.json(
        { error: "Yalnızca https://discord.gg/... veya https://discord.com/invite/... kabul ediliyor." },
        { status: 400 },
      );
    }
    await setSetting(body.key, temiz);
    return NextResponse.json({ ok: true, value: temiz });
  }

  if (body.key === SETTING_KEYS.wallpaperBlur) {
    const n = Number(body.value);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < BLUR_MIN || n > BLUR_MAX) {
      return NextResponse.json(
        { error: `Bulanıklık ${BLUR_MIN}-${BLUR_MAX} arası tam sayı olmalı.` }, { status: 400 });
    }
    await setSetting(body.key, String(n));
    return NextResponse.json({ ok: true, value: String(n) });
  }

  if (body.key === SETTING_KEYS.manifesto) {
    const temiz = body.value.replace(/[ 	]+/g, " ").trim();
    if (temiz.length > MANIFESTO_MAX) {
      return NextResponse.json(
        { error: `Metin en fazla ${MANIFESTO_MAX} karakter olabilir.` }, { status: 400 });
    }
    await setSetting(body.key, temiz);
    return NextResponse.json({ ok: true, value: temiz });
  }

  if (body.key === SETTING_KEYS.slogan) {
    const temiz = body.value.replace(/\s+/g, " ").trim();
    if (temiz.length > SLOGAN_MAX) {
      return NextResponse.json(
        { error: `Slogan en fazla ${SLOGAN_MAX} karakter olabilir.` }, { status: 400 });
    }
    await setSetting(body.key, temiz);
    return NextResponse.json({ ok: true, value: temiz });
  }

  await setSetting(body.key, body.value);
  return NextResponse.json({ ok: true, value: body.value });
}
