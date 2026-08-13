export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getGuildScope } from "@/lib/guild-scope";
import { getWarChannels } from "@/lib/discord-bot";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const SITE_URL = process.env.NEXTAUTH_URL || "https://aetheri.online";

/**
 * Savaşın hasar raporunu görsel olarak Discord'a gönderir.
 *
 * Görsel /api/war-report-card/[warId] tarafından üretilip dosya olarak
 * yüklenir — böylece Discord'un embed görsel önbelleği devreye girmez ve
 * rapor güncellense bile yeni gönderim taze görselle gider.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await getGuildScope();
  if (!scope?.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const warId = Number(params.id);
  const { sort, limit, guild } = await req.json().catch(() => ({}));

  const war = await prisma.war.findUnique({
    where: { id: warId },
    select: { id: true, title: true, isAllyWar: true },
  });
  if (!war) return NextResponse.json({ error: "Savaş bulunamadı." }, { status: 404 });

  const perfCount = await prisma.warPerformance.count({ where: { warId } });
  if (perfCount === 0) {
    return NextResponse.json({ error: "Bu savaşta hasar raporu yok." }, { status: 400 });
  }

  // Görseli kendi endpoint'imizden çek
  const qs = new URLSearchParams();
  if (sort) qs.set("sort", String(sort));
  if (limit) qs.set("limit", String(limit));
  if (guild) qs.set("guild", String(guild));

  const imgRes = await fetch(
    `${SITE_URL}/api/war-report-card/${warId}${qs.toString() ? `?${qs}` : ""}`,
    { cache: "no-store" },
  ).catch(() => null);

  if (!imgRes?.ok) {
    return NextResponse.json({ error: "Rapor görseli üretilemedi." }, { status: 502 });
  }
  const imageBuffer = Buffer.from(await imgRes.arrayBuffer());

  const channels = await getWarChannels(war.isAllyWar);
  if (channels.length === 0) {
    return NextResponse.json({ error: "Gönderilecek kanal ayarlı değil." }, { status: 400 });
  }

  let sent = 0;
  const failed: string[] = [];

  for (const channelId of channels) {
    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        content: `**${war.title}** — hasar raporu`,
        attachments: [{ id: 0, filename: "hasar-raporu.png" }],
      }),
    );
    form.append(
      "files[0]",
      new Blob([imageBuffer], { type: "image/png" }),
      "hasar-raporu.png",
    );

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
      body: form,
    }).catch(() => null);

    if (res?.ok) sent++;
    else failed.push(`${channelId} (${res?.status ?? "bağlanamadı"})`);
  }

  if (sent === 0) {
    return NextResponse.json({ error: `Gönderilemedi: ${failed.join(", ")}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sent, failed });
}
