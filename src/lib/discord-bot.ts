import { getTypeName } from "./classes";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID!;
const SITE_URL = process.env.NEXTAUTH_URL || "https://aetherion-bdo.vercel.app";
const GOLD = 0xd4a853;

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields?: EmbedField[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

// Send message via bot to configured channel
async function sendMessage(
  content: string | null,
  embeds: DiscordEmbed[],
  components?: unknown[]
): Promise<string | null> {
  if (!BOT_TOKEN || !CHANNEL_ID) return null;

  const res = await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify({ content, embeds, components }),
  });

  if (res.ok) {
    const data = await res.json();
    return data.id; // Return message ID for future updates
  }
  return null;
}

// Edit existing message
export async function editMessage(
  messageId: string,
  embeds: DiscordEmbed[],
  components?: unknown[]
) {
  if (!BOT_TOKEN || !CHANNEL_ID) return;

  await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify({ embeds, components }),
  });
}

// Delete existing message
export async function deleteMessage(messageId: string) {
  if (!BOT_TOKEN || !CHANNEL_ID) return;

  await fetch(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages/${messageId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
    },
  });
}

const TYPE_EMOJI: Record<string, string> = {
  NODE_WAR: "⚔️",
  SIEGE: "🏰",
  KARA_TAPINAK: "🕳️",
  OTHER: "📌",
};

export async function sendWarToDiscord(war: {
  id: number;
  title: string;
  type: string;
  date: Date | string;
  notes?: string | null;
  deadline?: Date | string | null;
}): Promise<string | null> {
  const date = new Date(war.date);
  const dateStr = date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });

  const fields: EmbedField[] = [
    { name: "Tip", value: getTypeName(war.type), inline: true },
    { name: "Tarih", value: dateStr, inline: true },
  ];

  if (war.deadline) {
    const deadlineStr = new Date(war.deadline).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    });
    fields.push({ name: "Son Katılım", value: deadlineStr, inline: true });
  }

  if (war.notes) {
    fields.push({ name: "Not", value: war.notes });
  }

  fields.push({ name: "Katılım", value: "✅ 0 — ❌ 0", inline: false });

  const emoji = TYPE_EMOJI[war.type] || "📌";

  const embeds: DiscordEmbed[] = [
    {
      title: `${emoji} ${war.title}`,
      description: `Yeni bir etkinlik oluşturuldu! Aşağıdaki butonlarla katılım durumunu bildir.`,
      color: GOLD,
      fields,
      url: `${SITE_URL}/wars/${war.id}`,
      footer: { text: "Aetherion • Katılım bildir" },
      timestamp: new Date().toISOString(),
    },
  ];

  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: "Katılıyorum",
          emoji: { name: "✅" },
          custom_id: `war_attend_${war.id}`,
        },
        {
          type: 2,
          style: 4,
          label: "Katılmıyorum",
          emoji: { name: "❌" },
          custom_id: `war_decline_${war.id}`,
        },
        {
          type: 2,
          style: 5,
          label: "Detaylar",
          emoji: { name: "🔗" },
          url: `${SITE_URL}/wars/${war.id}`,
        },
      ],
    },
  ];

  return await sendMessage("@everyone", embeds, components);
}

export async function sendPartiesToDiscord(war: {
  id: number;
  title: string;
  type: string;
  parties: {
    name: string;
    members: { user: { familyName: string; ap: number; dp: number; class: string } }[];
  }[];
}) {
  const emoji = TYPE_EMOJI[war.type] || "📌";

  const fields: EmbedField[] = war.parties.map((party) => {
    const memberLines = party.members.map((m, i) => {
      const gs = m.user.ap + m.user.dp;
      return `\`${String(i + 1).padStart(2, " ")}.\` **${m.user.familyName}** — ${gs} GS`;
    });

    const avgGs = party.members.length > 0
      ? Math.round(party.members.reduce((s, m) => s + m.user.ap + m.user.dp, 0) / party.members.length)
      : 0;

    return {
      name: `🛡️ ${party.name} (${party.members.length} kişi • Ort. ${avgGs} GS)`,
      value: memberLines.length > 0 ? memberLines.join("\n") : "_Boş_",
    };
  });

  await sendMessage("@everyone", [
    {
      title: `${emoji} ${war.title} — Parti Listesi`,
      description: `Toplam ${war.parties.length} parti, ${war.parties.reduce((s, p) => s + p.members.length, 0)} kişi atandı.`,
      color: GOLD,
      fields,
      url: `${SITE_URL}/wars/${war.id}`,
      footer: { text: "Aetherion • Parti Listesi" },
      timestamp: new Date().toISOString(),
    },
  ]);
}

export async function sendAnnouncementToDiscord(announcement: {
  title: string;
  content: string;
  creator: string;
  oldMessageId?: string;
}): Promise<string | null> {
  // Delete previous announcement if exists
  if (announcement.oldMessageId) {
    await deleteMessage(announcement.oldMessageId);
  }

  const messageId = await sendMessage("@everyone", [
    {
      title: `📢 ${announcement.title}`,
      description: announcement.content,
      color: GOLD,
      footer: { text: `Aetherion • ${announcement.creator}` },
      timestamp: new Date().toISOString(),
    },
  ]);

  return messageId;
}

// Open a DM channel with a user and return the channel ID
async function openDmChannel(discordId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null;
  const res = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id as string;
}

// Send a DM embed to a single user — returns true on success
export async function sendAnnouncementDm(
  discordId: string,
  announcement: { title: string; content: string; creator: string }
): Promise<boolean> {
  const channelId = await openDmChannel(discordId);
  if (!channelId) return false;
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify({
      embeds: [
        {
          title: `📢 ${announcement.title}`,
          description: announcement.content,
          color: GOLD,
          footer: { text: `Aetherion • ${announcement.creator}` },
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
  return res.ok;
}

// Update war embed with current participation counts
export async function updateWarEmbed(
  messageId: string,
  war: {
    id: number;
    title: string;
    type: string;
    date: Date | string;
    notes?: string | null;
    deadline?: Date | string | null;
  },
  attendCount: number,
  declineCount: number
) {
  const date = new Date(war.date);
  const dateStr = date.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });

  const fields: EmbedField[] = [
    { name: "Tip", value: getTypeName(war.type), inline: true },
    { name: "Tarih", value: dateStr, inline: true },
  ];

  if (war.deadline) {
    const deadlineStr = new Date(war.deadline).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    });
    fields.push({ name: "Son Katılım", value: deadlineStr, inline: true });
  }

  if (war.notes) {
    fields.push({ name: "Not", value: war.notes });
  }

  fields.push({ name: "Katılım", value: `✅ ${attendCount} — ❌ ${declineCount}`, inline: false });

  const emoji = TYPE_EMOJI[war.type] || "📌";

  const embeds: DiscordEmbed[] = [
    {
      title: `${emoji} ${war.title}`,
      description: `Aşağıdaki butonlarla katılım durumunu bildir.`,
      color: GOLD,
      fields,
      url: `${SITE_URL}/wars/${war.id}`,
      footer: { text: "Aetherion • Katılım bildir" },
      timestamp: new Date().toISOString(),
    },
  ];

  const components = [
    {
      type: 1,
      components: [
        {
          type: 2,
          style: 3,
          label: `Katılıyorum (${attendCount})`,
          emoji: { name: "✅" },
          custom_id: `war_attend_${war.id}`,
        },
        {
          type: 2,
          style: 4,
          label: `Katılmıyorum (${declineCount})`,
          emoji: { name: "❌" },
          custom_id: `war_decline_${war.id}`,
        },
        {
          type: 2,
          style: 5,
          label: "Detaylar",
          emoji: { name: "🔗" },
          url: `${SITE_URL}/wars/${war.id}`,
        },
      ],
    },
  ];

  await editMessage(messageId, embeds, components);
}
