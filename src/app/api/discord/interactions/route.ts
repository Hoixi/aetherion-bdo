export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateWarEmbed, sendWarToDiscord } from "@/lib/discord-bot";
import { getClassByID } from "@/lib/classes";
import { buildActivityEmbed, updateActivityMessage } from "@/lib/activity-discord";
import { createMobileLoginLink } from "@/lib/mobile-login-token";
import nacl from "tweetnacl";

const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY!;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID!;
const SITE_URL = process.env.NEXTAUTH_URL || "https://aetherion-bdo.vercel.app";
const GOLD = 0xd4a853;
const PARTY_SIZE = 5;

function verifySignature(body: string, signature: string, timestamp: string): boolean {
  try {
    return nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, "hex"),
      Buffer.from(PUBLIC_KEY, "hex")
    );
  } catch {
    return false;
  }
}

function ephemeral(content: string) {
  return NextResponse.json({ type: 4, data: { content, flags: 64 } });
}

function embedResponse(embeds: unknown[], flags = 64, components?: unknown[]) {
  return NextResponse.json({ type: 4, data: { embeds, flags, components } });
}

function publicEmbed(embeds: unknown[], components?: unknown[]) {
  return NextResponse.json({ type: 4, data: { embeds, flags: 0, components } });
}

function getOption(options: { name: string; value: unknown }[] | undefined, name: string) {
  return options?.find((o) => o.name === name)?.value;
}

// ─── BUTTON HANDLERS ────────────────────────────────────────

async function handleWarButton(customId: string, discordUserId: string) {
  const attendMatch = customId.match(/^war_attend_(\d+)$/);
  const declineMatch = customId.match(/^war_decline_(\d+)$/);
  if (!attendMatch && !declineMatch) return null;

  const warId = parseInt(attendMatch?.[1] || declineMatch?.[1] || "0");
  const status = attendMatch ? "ATTENDING" : "DECLINED";

  const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
  if (!user) return ephemeral("❌ Hesabın sitede bulunamadı. Önce siteye giriş yap veya `/gs-güncelle` ile kayıt ol.");

  const war = await prisma.war.findUnique({ where: { id: warId } });
  if (!war) return ephemeral("❌ Bu savaş bulunamadı.");
  if (war.deadline && new Date() > war.deadline) return ephemeral("⏰ Katılım süresi dolmuş.");

  await prisma.warParticipant.upsert({
    where: { warId_userId: { warId, userId: user.id } },
    update: { status, respondedAt: new Date() },
    create: { warId, userId: user.id, status },
  });

  if (status === "DECLINED") {
    await prisma.partyMember.deleteMany({ where: { userId: user.id, party: { warId } } });
  }

  // Update embed with new counts
  if (war.discordMessageId) {
    const counts = await prisma.warParticipant.groupBy({
      by: ["status"],
      where: { warId },
      _count: true,
    });
    const attendCount = counts.find((c) => c.status === "ATTENDING")?._count ?? 0;
    const declineCount = counts.find((c) => c.status === "DECLINED")?._count ?? 0;
    await updateWarEmbed(war.discordMessageId, war, attendCount, declineCount);
  }

  const emoji = status === "ATTENDING" ? "✅" : "❌";
  const text = status === "ATTENDING" ? "Katılıyorum" : "Katılmıyorum";
  return ephemeral(`${emoji} **${user.familyName || "Üye"}** — ${text} olarak kaydedildi!`);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handleBossPartyButton(customId: string, discordUserId: string, interactionId: string, interactionToken: string) {
  const katilMatch = customId.match(/^bp_katil_(\d+)$/);
  const ayrilMatch = customId.match(/^bp_ayril_(\d+)$/);
  const iptalMatch = customId.match(/^bp_iptal_(\d+)$/);
  if (!katilMatch && !ayrilMatch && !iptalMatch) return null;

  const partyId = parseInt(katilMatch?.[1] || ayrilMatch?.[1] || iptalMatch?.[1] || "0");

  const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
  if (!user) return ephemeral("❌ Hesabın sitede bulunamadı.");

  const party = await prisma.bossParty.findUnique({
    where: { id: partyId },
    include: { members: { include: { user: true } }, creator: true },
  });
  if (!party) return ephemeral("❌ Bu parti bulunamadı.");
  if (!party.active) return ephemeral("❌ Bu parti artık aktif değil.");

  if (katilMatch) {
    if (party.members.length >= party.maxSize) return ephemeral("❌ Parti dolu!");
    if (party.members.some((m) => m.userId === user.id)) return ephemeral("❌ Zaten bu partidesin!");

    await prisma.bossPartyMember.create({ data: { partyId, userId: user.id } });

    const updatedParty = await prisma.bossParty.findUnique({
      where: { id: partyId },
      include: { members: { include: { user: true } }, creator: true },
    });

    // Check if full
    if (updatedParty && updatedParty.members.length >= updatedParty.maxSize) {
      await prisma.bossParty.update({ where: { id: partyId }, data: { active: false } });
      await updateBossPartyMessage(updatedParty as BossPartyFull, false);

      // Send completion ping
      const pings = updatedParty.members.map((m) => `<@${m.user.discordId}>`).join(" ");
      const memberList = updatedParty.members.map((m) => `• **${m.user.familyName || "?"}**`).join("\n");
      await sendChannelMessage(updatedParty.channelId || CHANNEL_ID, pings, [{
        title: "🎉 Parti Hazır!",
        description: `**${updatedParty.bossName}** partisi tamamlandı!\nBirbirinizi bulup boss kesebilirsiniz! ⚔️`,
        color: 0x57f287,
        fields: [{ name: `👥 Parti Üyeleri (${updatedParty.members.length}/${updatedParty.maxSize})`, value: memberList }],
      }]);

      return ephemeral(`✅ **${party.bossName}** partisine katıldın! Parti doldu, boss kesmeye gidin! 🎉`);
    } else if (updatedParty) {
      await updateBossPartyMessage(updatedParty as BossPartyFull, true);
    }
    return ephemeral(`✅ **${party.bossName}** partisine katıldın!`);
  }

  if (ayrilMatch) {
    if (!party.members.some((m) => m.userId === user.id)) return ephemeral("❌ Bu partide değilsin.");
    if (party.creatorId === user.id) return ephemeral("❌ Kurucu olarak ayrılamazsın. İptal butonunu kullan.");

    await prisma.bossPartyMember.deleteMany({ where: { partyId, userId: user.id } });

    const updatedParty = await prisma.bossParty.findUnique({
      where: { id: partyId },
      include: { members: { include: { user: true } }, creator: true },
    });
    if (updatedParty) await updateBossPartyMessage(updatedParty as BossPartyFull, true);

    return ephemeral(`🚪 **${party.bossName}** partisinden ayrıldın.`);
  }

  if (iptalMatch) {
    if (party.creatorId !== user.id) return ephemeral("❌ Sadece partiyi kuran kişi iptal edebilir.");

    await prisma.bossParty.update({ where: { id: partyId }, data: { active: false } });

    const updatedParty = await prisma.bossParty.findUnique({
      where: { id: partyId },
      include: { members: { include: { user: true } }, creator: true },
    });
    if (updatedParty) await updateBossPartyMessage(updatedParty as BossPartyFull, false);

    return ephemeral(`❌ **${party.bossName}** partisi iptal edildi.`);
  }

  return null;
}

type BossPartyFull = {
  id: number;
  bossName: string;
  maxSize: number;
  active: boolean;
  discordMessageId: string | null;
  channelId: string | null;
  creator: { familyName: string };
  members: { user: { familyName: string; ap: number; dp: number; discordId: string } }[];
};

async function updateBossPartyMessage(party: BossPartyFull, active: boolean) {
  if (!party.discordMessageId || !party.channelId) return;

  const memberLines = [];
  for (let i = 0; i < party.maxSize; i++) {
    if (i < party.members.length) {
      const m = party.members[i];
      const gs = m.user.ap + m.user.dp;
      memberLines.push(`\`${i + 1}.\` **${m.user.familyName || "?"}** — ${gs > 0 ? `${gs} GS` : "GS yok"}`);
    } else {
      memberLines.push(`\`${i + 1}.\` ———`);
    }
  }

  const avgAp = party.members.length > 0 ? Math.round(party.members.reduce((s, m) => s + m.user.ap, 0) / party.members.length) : 0;
  const avgDp = party.members.length > 0 ? Math.round(party.members.reduce((s, m) => s + m.user.dp, 0) / party.members.length) : 0;

  const isFull = party.members.length >= party.maxSize;
  const color = !active ? 0x95a5a6 : isFull ? 0x57f287 : 0xe67e22;
  const desc = !active
    ? (isFull ? "✅ **Parti doldu!** Birbirinizi bulup boss kesin!" : "❌ **Bu parti iptal edildi.**")
    : `🟡 ${party.maxSize - party.members.length} kişilik yer var — katılmak için **Katıl** butonuna bas!`;

  const embed = {
    title: `⚔️ Parti Boss — ${party.bossName}`,
    description: desc,
    color,
    fields: [
      { name: `👥 Üyeler (${party.members.length}/${party.maxSize})`, value: memberLines.join("\n"), inline: true },
      { name: "📊 Ortalama", value: `AP: **${avgAp}**\nDP: **${avgDp}**\nGS: **${avgAp + avgDp}**`, inline: true },
    ],
    footer: { text: `Kurucu: ${party.creator.familyName}` },
  };

  const components = active ? [{
    type: 1,
    components: [
      { type: 2, style: 3, label: "✅ Katıl", custom_id: `bp_katil_${party.id}` },
      { type: 2, style: 2, label: "🚪 Ayrıl", custom_id: `bp_ayril_${party.id}` },
      { type: 2, style: 4, label: "❌ İptal", custom_id: `bp_iptal_${party.id}` },
    ],
  }] : [];

  await fetch(`https://discord.com/api/v10/channels/${party.channelId}/messages/${party.discordMessageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify({ embeds: [embed], components }),
  });
}

// ─── ACTIVITY BUTTON HANDLER ────────────────────────────────

async function handleActivityButton(customId: string, discordUserId: string) {
  const katilMatch = customId.match(/^act_katil_(\d+)$/);
  const ayrilMatch = customId.match(/^act_ayril_(\d+)$/);
  const iptalMatch = customId.match(/^act_iptal_(\d+)$/);
  if (!katilMatch && !ayrilMatch && !iptalMatch) return null;

  const activityId = parseInt(katilMatch?.[1] || ayrilMatch?.[1] || iptalMatch?.[1] || "0");

  const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
  if (!user) return ephemeral("❌ Hesabın sitede bulunamadı. Önce siteye giriş yap.");

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      creator: { select: { id: true, familyName: true, avatarUrl: true } },
      members: { include: { user: { select: { id: true, familyName: true, avatarUrl: true, ap: true, dp: true } } } },
    },
  });

  if (!activity) return ephemeral("❌ Bu etkinlik bulunamadı veya sona erdi.");
  if (new Date() > activity.expiresAt) return ephemeral("⏰ Bu etkinliğin süresi dolmuş.");

  // ── Katıl ──
  if (katilMatch) {
    if (activity.members.length >= activity.maxSize) return ephemeral("❌ Etkinlik dolu!");
    if (activity.members.some((m) => m.user.id === user.id)) return ephemeral("❌ Zaten bu etkinliktesin!");

    await prisma.activityMember.create({ data: { activityId, userId: user.id } });

    const updated = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        creator: { select: { id: true, familyName: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, familyName: true, avatarUrl: true, ap: true, dp: true } } } },
      },
    });

    if (updated?.discordMessageId) {
      await updateActivityMessage(updated.discordMessageId, {
        ...updated,
        members: updated.members.map((m) => ({ user: m.user })),
      });
    }

    return ephemeral(`✅ **${user.familyName || "Üye"}** etkinliğe katıldı!`);
  }

  // ── Ayrıl ──
  if (ayrilMatch) {
    if (!activity.members.some((m) => m.user.id === user.id)) return ephemeral("❌ Bu etkinlikte değilsin.");
    if (activity.creator.id === user.id) return ephemeral("❌ Kurucu olarak ayrılamazsın. İptal butonunu kullan.");

    await prisma.activityMember.deleteMany({ where: { activityId, userId: user.id } });

    const updated = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        creator: { select: { id: true, familyName: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, familyName: true, avatarUrl: true, ap: true, dp: true } } } },
      },
    });

    if (updated?.discordMessageId) {
      await updateActivityMessage(updated.discordMessageId, {
        ...updated,
        members: updated.members.map((m) => ({ user: m.user })),
      });
    }

    return ephemeral(`🚪 **${user.familyName || "Üye"}** etkinlikten ayrıldı.`);
  }

  // ── İptal ──
  if (iptalMatch) {
    const isAdmin = user.isAdmin;
    if (activity.creator.id !== user.id && !isAdmin) return ephemeral("❌ Sadece etkinliği oluşturan kişi iptal edebilir.");

    if (activity.discordMessageId) {
      const { embed, components } = buildActivityEmbed({
        ...activity,
        members: activity.members.map((m) => ({ user: m.user })),
      }, false);
      await fetch(`https://discord.com/api/v10/channels/${process.env.ACTIVITY_CHANNEL_ID || "1366043560608137277"}/messages/${activity.discordMessageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
        body: JSON.stringify({ embeds: [embed], components }),
      });
      // Delete the message after a moment for cleanup
      await fetch(`https://discord.com/api/v10/channels/${process.env.ACTIVITY_CHANNEL_ID || "1366043560608137277"}/messages/${activity.discordMessageId}`, {
        method: "DELETE",
        headers: { Authorization: `Bot ${BOT_TOKEN}` },
      });
    }

    await prisma.activity.delete({ where: { id: activityId } });
    return ephemeral(`❌ Etkinlik iptal edildi.`);
  }

  return null;
}

async function sendChannelMessage(channelId: string, content: string | null, embeds: unknown[]) {
  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify({ content, embeds }),
  });
}

async function sendDirectMessage(discordUserId: string, payload: { content?: string; embeds?: unknown[] }) {
  const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });

  if (!dmRes.ok) return false;
  const dmChannel = await dmRes.json();

  const msgRes = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify(payload),
  });

  return msgRes.ok;
}

// ─── SLASH COMMAND HANDLERS ─────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function handleCommand(
  name: string,
  options: { name: string; value: unknown }[] | undefined,
  discordUserId: string,
  channelId: string,
  _interactionId: string,
  _interactionToken: string,
  fromGuild: boolean
) {
  // ─── /gs-güncelle ───
  if (name === "gs-güncelle") {
    const family = getOption(options, "aile") as string;
    const ap = getOption(options, "ap") as number;
    const dp = getOption(options, "dp") as number;
    const cls = getOption(options, "class") as string;

    if (ap < 0 || ap > 5000) return ephemeral("❌ AP değeri 0-5000 arasında olmalı.");
    if (dp < 0 || dp > 5000) return ephemeral("❌ DP değeri 0-5000 arasında olmalı.");

    const user = await prisma.user.upsert({
      where: { discordId: discordUserId },
      update: { familyName: family, ap, dp, class: cls },
      create: { discordId: discordUserId, familyName: family, ap, dp, class: cls },
    });

    // Save GS history
    await prisma.gsHistory.create({ data: { userId: user.id, ap, dp } });

    const classData = getClassByID(cls);
    return embedResponse([{
      title: "✅ GS Kaydedildi",
      color: 0x57f287,
      fields: [
        { name: "Aile", value: family, inline: true },
        { name: "Class", value: classData?.name || cls, inline: true },
        { name: "AP", value: `${ap}`, inline: true },
        { name: "DP", value: `${dp}`, inline: true },
        { name: "GS", value: `**${ap + dp}**`, inline: true },
      ],
      url: `${SITE_URL}/members/${user.id}`,
      footer: { text: "Aetherion" },
    }]);
  }

  // --- /login ---
  if (name === "login") {
    if (!fromGuild) {
      return ephemeral("Bu komut sadece Aetherion Discord sunucusunda kullanilabilir.");
    }

    const user = await prisma.user.upsert({
      where: { discordId: discordUserId },
      update: {},
      create: { discordId: discordUserId },
    });

    const { loginUrl, expiresAt } = await createMobileLoginLink(user.id);
    const sent = await sendDirectMessage(discordUserId, {
      embeds: [{
        title: "Aetherion Site Girisi",
        description: [
          "Siteye giris yapmak icin asagidaki tek kullanimlik linki ac.",
          "",
          loginUrl,
          "",
          "Bu link 5 dakika gecerlidir ve sadece bir kez kullanilabilir.",
        ].join("\n"),
        color: GOLD,
        footer: {
          text: `Sure sonu: ${expiresAt.toLocaleTimeString("tr-TR", {
            timeZone: "Europe/Istanbul",
            hour: "2-digit",
            minute: "2-digit",
          })} - Aetherion`,
        },
      }],
    });

    if (!sent) {
      return ephemeral("DM gonderemedim. Discord gizlilik ayarlarinda sunucu uyelerinden DM almaya izin verip tekrar `/login` dene.");
    }

    return ephemeral("Giris linkini DM olarak gonderdim. Link 5 dakika gecerli.");
  }

  // ─── /profil ───
  if (name === "profil") {
    const targetUser = getOption(options, "üye") as string | undefined;
    const familySearch = getOption(options, "aile") as string | undefined;
    let targetDiscordId = targetUser || discordUserId;

    if (familySearch) {
      const matches = await prisma.user.findMany({
        where: { familyName: { contains: familySearch } },
        take: 5,
      });
      if (matches.length === 0) return ephemeral(`❌ **${familySearch}** ile eşleşen üye bulunamadı.`);
      if (matches.length > 1) {
        const list = matches.map((m) => `• **${m.familyName}** (GS: ${m.ap + m.dp})`).join("\n");
        return ephemeral(`🔍 **${familySearch}** için ${matches.length} sonuç:\n${list}\n\nDaha spesifik bir isim gir.`);
      }
      targetDiscordId = matches[0].discordId;
    }

    const user = await prisma.user.findUnique({
      where: { discordId: targetDiscordId },
      include: { siteRole: true },
    });
    if (!user) return ephemeral("❌ Bu kullanıcı sitede bulunamadı.");

    const attended = await prisma.warParticipant.count({ where: { userId: user.id, status: "ATTENDING" } });
    const totalWars = await prisma.war.count();
    const rate = totalWars > 0 ? Math.round((attended / totalWars) * 100) : 0;
    const classData = getClassByID(user.class);

    return publicEmbed([{
      title: `👤 ${user.familyName || "İsimsiz"} Profili`,
      color: GOLD,
      fields: [
        { name: "Class", value: classData?.name || user.class || "?", inline: true },
        { name: "AP", value: `${user.ap}`, inline: true },
        { name: "DP", value: `${user.dp}`, inline: true },
        { name: "GS", value: `**${user.ap + user.dp}**`, inline: true },
        { name: "Katılım", value: `${attended} savaş (%${rate})`, inline: true },
        { name: "Rol", value: user.siteRole?.name || "Üye", inline: true },
      ],
      url: `${SITE_URL}/members/${user.id}`,
      footer: { text: "Aetherion" },
    }]);
  }

  // ─── /gs ───
  if (name === "gs") {
    const targetUser = getOption(options, "üye") as string | undefined;
    const targetDiscordId = targetUser || discordUserId;

    const user = await prisma.user.findUnique({ where: { discordId: targetDiscordId } });
    if (!user) return ephemeral("❌ Bu kullanıcı sitede bulunamadı.");

    const classData = getClassByID(user.class);
    return publicEmbed([{
      title: `🎮 ${user.familyName || "İsimsiz"}`,
      color: GOLD,
      fields: [
        { name: "AP", value: `${user.ap}`, inline: true },
        { name: "DP", value: `${user.dp}`, inline: true },
        { name: "GS", value: `**${user.ap + user.dp}**`, inline: true },
        { name: "Class", value: classData?.name || user.class || "?", inline: true },
      ],
      url: `${SITE_URL}/members/${user.id}`,
      footer: { text: "Aetherion" },
    }]);
  }

  // ─── /sıralama ───
  if (name === "sıralama") {
    const users = await prisma.user.findMany({
      where: { familyName: { not: "" } },
      orderBy: [{ ap: "desc" }, { dp: "desc" }],
      take: 20,
    });

    const lines = users.map((u, i) => {
      const gs = u.ap + u.dp;
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `\`${i + 1}.\``;
      return `${medal} **${u.familyName}** — ${gs} GS`;
    });

    return publicEmbed([{
      title: "🏆 GS Sıralaması (Top 20)",
      description: lines.join("\n"),
      color: GOLD,
      footer: { text: `Toplam ${users.length} oyuncu • Aetherion` },
    }]);
  }

  // ─── /savaş ───
  if (name === "savaş") {
    const wars = await prisma.war.findMany({
      where: { date: { gte: new Date() } },
      orderBy: { date: "asc" },
      take: 5,
      include: { participants: { select: { status: true } } },
    });

    if (wars.length === 0) return ephemeral("📭 Yaklaşan savaş yok.");

    const lines = wars.map((w) => {
      const date = new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
      const attend = w.participants.filter((p) => p.status === "ATTENDING").length;
      const emoji = { NODE_WAR: "⚔️", SIEGE: "🏰", KARA_TAPINAK: "🕳️", OTHER: "📌" }[w.type] || "📌";
      return `${emoji} **${w.title}** — ${date} (✅ ${attend} kişi)`;
    });

    return publicEmbed([{
      title: "📋 Yaklaşan Savaşlar",
      description: lines.join("\n"),
      color: GOLD,
      footer: { text: "Aetherion" },
    }]);
  }

  // ─── /katılım ───
  if (name === "katılım") {
    const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
    if (!user) return ephemeral("❌ Hesabın sitede bulunamadı.");

    const totalWars = await prisma.war.count({ where: { date: { lte: new Date() } } });
    const attended = await prisma.warParticipant.count({ where: { userId: user.id, status: "ATTENDING" } });
    const rate = totalWars > 0 ? Math.round((attended / totalWars) * 100) : 0;

    return publicEmbed([{
      title: `📊 ${user.familyName || "İsimsiz"} — Katılım`,
      color: GOLD,
      fields: [
        { name: "Katıldığı Savaş", value: `${attended}`, inline: true },
        { name: "Toplam Savaş", value: `${totalWars}`, inline: true },
        { name: "Katılım Oranı", value: `%${rate}`, inline: true },
      ],
      footer: { text: "Aetherion" },
    }]);
  }

  // ─── /katılım-liste ───
  if (name === "katılım-liste") {
    const searchName = getOption(options, "savaş") as string | undefined;
    let war;

    if (searchName) {
      war = await prisma.war.findFirst({
        where: { title: { contains: searchName } },
        orderBy: { date: "desc" },
        include: { participants: { include: { user: true } } },
      });
      if (!war) return ephemeral(`❌ **${searchName}** ile eşleşen savaş bulunamadı.`);
    } else {
      war = await prisma.war.findFirst({
        orderBy: { date: "desc" },
        include: { participants: { include: { user: true } } },
      });
      if (!war) return ephemeral("❌ Henüz savaş kaydı yok.");
    }

    const attending = war.participants.filter((p) => p.status === "ATTENDING");
    const declined = war.participants.filter((p) => p.status === "DECLINED");

    const attendLines = attending.length > 0
      ? attending.map((p, i) => {
          const gs = p.user.ap + p.user.dp;
          return `\`${i + 1}.\` **${p.user.familyName || "?"}** — ${gs} GS`;
        }).join("\n")
      : "Henüz katılan yok.";

    const avgAp = attending.length > 0 ? Math.round(attending.reduce((s, p) => s + p.user.ap, 0) / attending.length) : 0;
    const avgDp = attending.length > 0 ? Math.round(attending.reduce((s, p) => s + p.user.dp, 0) / attending.length) : 0;

    return publicEmbed([{
      title: `⚔️ ${war.title} — Katılım Listesi`,
      color: GOLD,
      fields: [
        { name: `✅ Katılanlar (${attending.length})`, value: attendLines.slice(0, 1024) },
        { name: "❌ Katılmayanlar", value: `${declined.length} kişi`, inline: true },
        { name: "📊 Ortalama", value: `AP: **${avgAp}** | DP: **${avgDp}** | GS: **${avgAp + avgDp}**`, inline: true },
      ],
      footer: { text: `Tarih: ${new Date(war.date).toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })} • Aetherion` },
    }]);
  }

  // ─── /savaşlar ───
  if (name === "savaşlar") {
    const wars = await prisma.war.findMany({
      orderBy: { date: "desc" },
      take: 15,
      include: { _count: { select: { participants: true } }, participants: { where: { status: "ATTENDING" } } },
    });

    if (wars.length === 0) return ephemeral("📭 Henüz savaş kaydı yok.");

    const lines = wars.map((w) => {
      const date = new Date(w.date).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });
      const isPast = new Date(w.date) < new Date();
      const emoji = isPast ? "🔒" : "🟢";
      const resultEmoji = w.result === "WIN" ? " 🏆" : w.result === "LOSS" ? " 💀" : w.result === "DRAW" ? " 🤝" : "";
      return `${emoji} **${w.title}** — ${date} | ✅ ${w.participants.length}${resultEmoji}`;
    });

    return publicEmbed([{
      title: "📜 Savaş Geçmişi",
      description: lines.join("\n"),
      color: GOLD,
      footer: { text: `Toplam ${wars.length} savaş • Aetherion` },
    }]);
  }

  // ─── /klan ───
  if (name === "klan") {
    const users = await prisma.user.findMany({ where: { familyName: { not: "" } } });
    const totalWars = await prisma.war.count();

    if (users.length === 0) return ephemeral("📭 Henüz kayıtlı oyuncu yok.");

    const avgAp = Math.round(users.reduce((s, u) => s + u.ap, 0) / users.length);
    const avgDp = Math.round(users.reduce((s, u) => s + u.dp, 0) / users.length);

    // Top 5 katılımcı
    const topAttendance = await prisma.warParticipant.groupBy({
      by: ["userId"],
      where: { status: "ATTENDING" },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    });

    const topUsers = await prisma.user.findMany({
      where: { id: { in: topAttendance.map((t) => t.userId) } },
    });

    const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
    const topLines = topAttendance.map((t, i) => {
      const u = topUsers.find((u) => u.id === t.userId);
      return `${medals[i]} **${u?.familyName || "?"}** — ${t._count} savaş`;
    });

    return publicEmbed([{
      title: "🛡️ Aetherion Klan İstatistikleri",
      color: GOLD,
      fields: [
        { name: "👥 Kayıtlı Oyuncu", value: `${users.length}`, inline: true },
        { name: "📜 Toplam Savaş", value: `${totalWars}`, inline: true },
        { name: "​", value: "​", inline: true },
        { name: "⚔️ Ort. AP", value: `${avgAp}`, inline: true },
        { name: "🛡️ Ort. DP", value: `${avgDp}`, inline: true },
        { name: "📊 Ort. GS", value: `**${avgAp + avgDp}**`, inline: true },
        { name: "🏆 En Çok Savaşa Katılan (Top 5)", value: topLines.length > 0 ? topLines.join("\n") : "Veri yok." },
      ],
      footer: { text: "Aetherion" },
    }]);
  }

  // ─── /partiboss ───
  if (name === "partiboss") {
    const bossName = (getOption(options, "boss") as string) || "Parti Boss";

    const user = await prisma.user.upsert({
      where: { discordId: discordUserId },
      update: {},
      create: { discordId: discordUserId },
    });

    const party = await prisma.bossParty.create({
      data: {
        bossName,
        creatorId: user.id,
        channelId: channelId,
        members: { create: { userId: user.id } },
      },
      include: { members: { include: { user: true } }, creator: true },
    });

    // Respond with deferred, then send actual message and save ID
    // Since we need the message ID, use a follow-up approach
    // First respond ephemerally, then send the party embed as a regular message

    const memberLines = [`\`1.\` **${user.familyName || "?"}** — ${user.ap + user.dp > 0 ? `${user.ap + user.dp} GS` : "GS yok"}`];
    for (let i = 1; i < PARTY_SIZE; i++) memberLines.push(`\`${i + 1}.\` ———`);

    const embed = {
      title: `⚔️ Parti Boss — ${bossName}`,
      description: `🟡 ${PARTY_SIZE - 1} kişilik yer var — katılmak için **Katıl** butonuna bas!`,
      color: 0xe67e22,
      fields: [
        { name: `👥 Üyeler (1/${PARTY_SIZE})`, value: memberLines.join("\n"), inline: true },
        { name: "📊 Ortalama", value: `AP: **${user.ap}**\nDP: **${user.dp}**\nGS: **${user.ap + user.dp}**`, inline: true },
      ],
      footer: { text: `Kurucu: ${user.familyName || "?"}` },
    };

    const components = [{
      type: 1,
      components: [
        { type: 2, style: 3, label: "✅ Katıl", custom_id: `bp_katil_${party.id}` },
        { type: 2, style: 2, label: "🚪 Ayrıl", custom_id: `bp_ayril_${party.id}` },
        { type: 2, style: 4, label: "❌ İptal", custom_id: `bp_iptal_${party.id}` },
      ],
    }];

    // Send as a channel message (not interaction response) so we get message ID
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
      body: JSON.stringify({ embeds: [embed], components }),
    });

    if (msgRes.ok) {
      const msgData = await msgRes.json();
      await prisma.bossParty.update({
        where: { id: party.id },
        data: { discordMessageId: msgData.id },
      });
    }

    return ephemeral(`✅ **${bossName}** partisi oluşturuldu!`);
  }

  // ─── /savaş-aç ─── (Admin only)
  if (name === "savaş-aç") {
    const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
    if (!user?.isAdmin) return ephemeral("❌ Bu komutu kullanmak için admin olmalısın.");

    const warName = (getOption(options, "başlık") || getOption(options, "isim")) as string;
    const dateTimeStr = (getOption(options, "tarih") as string) || "";
    const warType = (getOption(options, "tür") || getOption(options, "tip") as string) || "NODE_WAR";
    const maxPart = getOption(options, "max") as number | undefined;

    // Parse date "GG.AA.YYYY SS:DD" or "GG.AA.YYYY SS.DD"
    const parts = dateTimeStr.trim().split(" ");
    const datePart = parts[0] || "";
    const timePart = parts[1] || "21:00";
    const [day, month, year] = datePart.split(".");
    const [hour, minute] = timePart.split(/[.:]/);
    const warDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour) || 21, parseInt(minute) || 0);

    if (isNaN(warDate.getTime())) return ephemeral("❌ Geçersiz tarih. Format: GG.AA.YYYY SS:DD");

    const war = await prisma.war.create({
      data: {
        title: warName,
        type: warType as "NODE_WAR" | "SIEGE" | "KARA_TAPINAK" | "OTHER",
        date: warDate,
        maxParticipants: maxPart || null,
        createdBy: user.id,
      },
    });

    // Send war announcement with buttons
    const messageId = await sendWarToDiscord(war);
    if (messageId) {
      await prisma.war.update({ where: { id: war.id }, data: { discordMessageId: messageId } });
    }

    const maxText = maxPart ? ` (Maks: ${maxPart} kişi)` : "";
    return ephemeral(`✅ **${warName}** savaşı oluşturuldu ve duyuru gönderildi!${maxText}`);
  }

  // ─── /gear-eksik ─── (Admin only)
  if (name === "gear-eksik") {
    const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
    if (!user?.isAdmin) return ephemeral("❌ Bu komutu kullanmak için admin olmalısın.");

    const shouldDm = getOption(options, "dm") as boolean | undefined;

    // Find users with no gear (ap=0 and dp=0)
    const noGearUsers = await prisma.user.findMany({
      where: { ap: 0, dp: 0, familyName: { not: "" } },
      orderBy: { familyName: "asc" },
    });

    // Also find users with empty family name (registered via button but no /gs-güncelle)
    const noNameUsers = await prisma.user.findMany({
      where: { familyName: "" },
    });

    const allMissing = [...noGearUsers, ...noNameUsers];

    if (allMissing.length === 0) return ephemeral("✅ Tüm üyeler GS bilgilerini girmiş!");

    const lines = noGearUsers.map((u, i) => `\`${i + 1}.\` <@${u.discordId}> — **${u.familyName}**`);
    const noNameLines = noNameUsers.map((u) => `• <@${u.discordId}> (kayıtsız)`);

    let dmCount = 0;
    if (shouldDm) {
      // Send DMs in background (respond first, then DM)
      for (const u of allMissing) {
        try {
          // Open DM channel
          const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
            body: JSON.stringify({ recipient_id: u.discordId }),
          });
          if (!dmRes.ok) continue;
          const dmChannel = await dmRes.json();

          // Send message
          await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
            body: JSON.stringify({
              embeds: [{
                title: "⚠️ GS Bilgisi Eksik!",
                description: `Merhaba! **Aetherion** klanında GS bilgilerin eksik görünüyor.\n\nLütfen Discord'da şu komutu kullan:\n\`/gs-güncelle aile:<AileAdın> ap:<AP> dp:<DP> class:<Sınıfın>\`\n\nVeya sitemizden güncelleyebilirsin:\n${SITE_URL}/profile`,
                color: 0xe67e22,
                footer: { text: "Aetherion" },
              }],
            }),
          });
          dmCount++;
        } catch { /* skip failed DMs */ }
      }
    }

    const embed = {
      title: "⚠️ GS Eksik Üyeler",
      color: 0xe67e22,
      fields: [] as { name: string; value: string }[],
      footer: { text: shouldDm ? `${dmCount} kişiye DM gönderildi • Aetherion` : "Aetherion" },
    };

    if (noGearUsers.length > 0) {
      embed.fields.push({ name: `🎮 GS Girmeyenler (${noGearUsers.length})`, value: lines.slice(0, 20).join("\n").slice(0, 1024) });
    }
    if (noNameUsers.length > 0) {
      embed.fields.push({ name: `❓ Kayıtsız Üyeler (${noNameUsers.length})`, value: noNameLines.slice(0, 10).join("\n").slice(0, 1024) });
    }

    return embedResponse([embed]);
  }

  // ─── /etkinlikler ───
  if (name === "etkinlikler") {
    const now = new Date();
    const activities = await prisma.activity.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { familyName: true } },
        members: { include: { user: { select: { familyName: true } } } },
      },
    });

    if (activities.length === 0) return ephemeral("📭 Şu anda aktif etkinlik yok.");

    const TYPE_LABELS: Record<string, string> = {
      KARA_TAPINAK: "🏰 Kara Tapınak",
      KAN_ALTARI: "🩸 Kan Altarı",
      PARTI_SLOTLARI: "⚔️ Parti Slotları",
    };

    const fields = activities.map((a) => {
      const diffMs = a.expiresAt.getTime() - now.getTime();
      const diffMin = Math.max(0, Math.floor(diffMs / 60000));
      const timeLeft = diffMin > 60 ? `${Math.floor(diffMin / 60)}sa ${diffMin % 60}dk` : `${diffMin}dk`;
      const slots = `${a.members.length}/${a.maxSize}`;
      const isFull = a.members.length >= a.maxSize;
      const status = isFull ? "✅ Dolu" : `🟡 ${a.maxSize - a.members.length} yer var`;
      const memberList = a.members.map((m) => m.user.familyName || "?").join(", ") || "—";
      return {
        name: `${TYPE_LABELS[a.type] ?? a.type} (${slots}) — ${status}`,
        value: `Kurucu: **${a.creator.familyName || "?"}** • ⏱ ${timeLeft} kaldı\nKatılımcılar: ${memberList}`,
      };
    });

    return publicEmbed([{
      title: "🗓️ Aktif Etkinlikler",
      color: GOLD,
      fields,
      footer: { text: `${activities.length} etkinlik • ${SITE_URL}/etkinlikler` },
    }]);
  }

  // ─── /etkinlik-olustur ───
  if (name === "etkinlik-olustur") {
    const TYPE_LABELS: Record<string, string> = {
      KARA_TAPINAK: "🏰 Kara Tapınak",
      KAN_ALTARI: "🩸 Kan Altarı",
      PARTI_SLOTLARI: "⚔️ Parti Slotları",
    };

    const user = await prisma.user.findUnique({ where: { discordId: discordUserId } });
    if (!user) return ephemeral("❌ Hesabın sitede bulunamadı. Önce siteye giriş yap.");

    const type = (getOption(options, "tip") as string | undefined)?.toUpperCase();
    const validTypes = ["KARA_TAPINAK", "KAN_ALTARI", "PARTI_SLOTLARI"];
    if (!type || !validTypes.includes(type)) {
      return ephemeral("❌ Geçersiz etkinlik tipi. Seçenekler: `kara_tapinak`, `kan_altari`, `parti_slotlari`");
    }

    const rawSize = getOption(options, "boyut") as number | undefined;
    const size =
      type === "KARA_TAPINAK" ? 5 :
      type === "KAN_ALTARI" ? 3 :
      [3, 5].includes(rawSize ?? 0) ? rawSize! : 5;

    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const activity = await prisma.activity.create({
      data: {
        type: type as "KARA_TAPINAK" | "KAN_ALTARI" | "PARTI_SLOTLARI",
        maxSize: size,
        creatorId: user.id,
        expiresAt,
        members: { create: { userId: user.id } },
      },
      include: {
        creator: { select: { id: true, familyName: true, avatarUrl: true } },
        members: { include: { user: { select: { id: true, familyName: true, avatarUrl: true, ap: true, dp: true } } } },
      },
    });

    // Send to activity channel
    const ACTIVITY_CHANNEL_ID = "1366043560608137277";
    const { embed, components } = buildActivityEmbed({
      ...activity,
      members: activity.members.map((m) => ({ user: m.user })),
    });

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${ACTIVITY_CHANNEL_ID}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
      body: JSON.stringify({ embeds: [embed], components }),
    });

    if (msgRes.ok) {
      const msgData = await msgRes.json();
      await prisma.activity.update({ where: { id: activity.id }, data: { discordMessageId: msgData.id } });
    }

    return ephemeral(`✅ **${TYPE_LABELS[type]}** etkinliği oluşturuldu! 2 saat sonra otomatik silinir.`);
  }

  // ─── /yardım ───
  if (name === "yardım") {
    return publicEmbed([
      {
        title: "📖 Aetherion Bot — Komutlar",
        color: GOLD,
        fields: [
          {
            name: "👤 Profil & GS",
            value: [
              "`/gs-güncelle` — GS bilgilerini kaydet/güncelle",
              "`/gs` — Kendi veya birinin GS'ini göster",
              "`/profil` — Detaylı profil görüntüle",
              "`/login` — Site giris linkini DM olarak al",
              "`/sıralama` — GS sıralaması (Top 20)",
              "`/klan` — Klan genel istatistikleri",
            ].join("\n"),
          },
          {
            name: "⚔️ Savaş & Katılım",
            value: [
              "Savaş duyurusundaki **butonları** kullan",
              "`/savaş` — Yaklaşan savaşları listele",
              "`/savaşlar` — Tüm savaş geçmişi",
              "`/katılım` — Kendi katılım istatistiklerin",
              "`/katılım-liste` — Bir savaşın katılım listesi",
            ].join("\n"),
          },
          {
            name: "🗓️ Etkinlikler",
            value: [
              "`/etkinlikler` — Aktif etkinlikleri listele",
              "`/etkinlik-olustur tip:<tip>` — Etkinlik oluştur (kara_tapinak / kan_altari / parti_slotlari)",
              "Etkinlik mesajındaki **butonları** kullan (Katıl / Ayrıl / İptal)",
            ].join("\n"),
          },
          {
            name: "🎮 Parti Boss",
            value: "`/partiboss` — Boss partisi oluştur (butonlarla katıl/ayrıl)",
          },
          {
            name: "🔐 Admin",
            value: [
              "`/savaş-aç` — Yeni savaş oluştur ve duyur",
              "`/gear-eksik` — GS girmeyenleri listele / DM at",
            ].join("\n"),
          },
        ],
        footer: { text: `Aetherion • ${SITE_URL}` },
      },
    ]);
  }

  return ephemeral("❌ Bilinmeyen komut.");
}

// ─── MAIN HANDLER ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-signature-ed25519") || "";
  const timestamp = req.headers.get("x-signature-timestamp") || "";

  if (!verifySignature(body, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const interaction = JSON.parse(body);

  // PING
  if (interaction.type === 1) return NextResponse.json({ type: 1 });

  const discordUserId: string = interaction.member?.user?.id || interaction.user?.id;
  const channelId: string = interaction.channel_id || CHANNEL_ID;

  // SLASH COMMAND
  if (interaction.type === 2) {
    return handleCommand(
      interaction.data.name,
      interaction.data.options,
      discordUserId,
      channelId,
      interaction.id,
      interaction.token,
      Boolean(interaction.member)
    );
  }

  // MESSAGE_COMPONENT (button)
  if (interaction.type === 3) {
    const customId = interaction.data.custom_id;

    // War buttons
    const warResult = await handleWarButton(customId, discordUserId);
    if (warResult) return warResult;

    // Boss party buttons
    const bpResult = await handleBossPartyButton(customId, discordUserId, interaction.id, interaction.token);
    if (bpResult) return bpResult;

    // Activity buttons
    const actResult = await handleActivityButton(customId, discordUserId);
    if (actResult) return actResult;

    return ephemeral("❌ Bilinmeyen işlem.");
  }

  return NextResponse.json({ type: 1 });
}
