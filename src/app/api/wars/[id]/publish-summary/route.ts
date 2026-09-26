export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";
import { getWarChannels } from "@/lib/discord-bot";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const SITE_URL = process.env.NEXTAUTH_URL || "https://aetheri.online";

/**
 * Savaş özetini görsel olarak Discord'a gönderir.
 *
 * Hasar raporu kartının kardeşi (`publish-report`): o resmî rapordan, bu
 * kill akışı kaydından üretiliyor. Görsel dosya olarak yükleniyor ki
 * Discord'un embed önbelleği eski kartı göstermesin.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getGuildScope();
  if (!scope?.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const warId = Number(params.id);
  const war = await prisma.war.findUnique({
    where: { id: warId },
    select: { id: true, title: true, isAllyWar: true },
  });
  if (!war) return NextResponse.json({ error: "Savaş bulunamadı." }, { status: 404 });

  const kayit = await prisma.combatSession.count({ where: { warId } });
  if (kayit === 0) return NextResponse.json({ error: "Bu savaşın kill akışı kaydı yok." }, { status: 400 });

  const imgRes = await fetch(`${SITE_URL}/api/savas-ozet-karti/${warId}`, { cache: "no-store" })
    .catch(() => null);
  if (!imgRes?.ok) {
    return NextResponse.json(
      { error: `Özet görseli üretilemedi${imgRes ? ` (${imgRes.status})` : ""}.` }, { status: 502 });
  }
  const gorsel = Buffer.from(await imgRes.arrayBuffer());

  const channels = await getWarChannels(war.isAllyWar);
  if (channels.length === 0) {
    return NextResponse.json({ error: "Gönderilecek kanal ayarlı değil." }, { status: 400 });
  }

  let sent = 0;
  const failed: string[] = [];
  for (const channelId of channels) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify({
      content: `**${war.title}** — savaş özeti`,
      attachments: [{ id: 0, filename: "savas-ozeti.png" }],
    }));
    form.append("files[0]", new Blob([gorsel], { type: "image/png" }), "savas-ozeti.png");

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
      body: form,
    }).catch(() => null);

    if (res?.ok) sent++;
    else failed.push(`${channelId} (${res?.status ?? "bağlanamadı"})`);
  }

  if (sent === 0) return NextResponse.json({ error: `Gönderilemedi: ${failed.join(", ")}` }, { status: 502 });
  return NextResponse.json({ ok: true, sent, failed });
}

/** Bu savaşta kaç kayıt var — arayüz düğmeyi buna göre gösteriyor */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kayit = await prisma.combatSession.count({ where: { warId: Number(params.id) } });
  return NextResponse.json({ kayit });
}
