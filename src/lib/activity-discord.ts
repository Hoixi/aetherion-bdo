const ACTIVITY_CHANNEL_ID = "1366043560608137277";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GOLD = 0xd4a853;

const TYPE_LABELS: Record<string, string> = {
  KARA_TAPINAK: "🏰 Kara Tapınak",
  KAN_ALTARI: "🩸 Kan Altarı",
  PARTI_SLOTLARI: "⚔️ Parti Slotları",
};

const TYPE_COLORS: Record<string, number> = {
  KARA_TAPINAK: 0x9b59b6,
  KAN_ALTARI: 0xe74c3c,
  PARTI_SLOTLARI: GOLD,
};

export type ActivityEmbedInput = {
  id: number;
  type: string;
  maxSize: number;
  expiresAt: Date;
  creator: { familyName: string };
  members: { user: { familyName: string; ap: number; dp: number } }[];
};

export function buildActivityEmbed(activity: ActivityEmbedInput, active = true) {
  const slots = Array.from({ length: activity.maxSize }, (_, i) => {
    const m = activity.members[i];
    return m
      ? `\`${i + 1}.\` **${m.user.familyName || "?"}** — ${m.user.ap + m.user.dp > 0 ? `${m.user.ap + m.user.dp} GS` : "GS yok"}`
      : `\`${i + 1}.\` ———`;
  });

  const isFull = activity.members.length >= activity.maxSize;
  const color = !active ? 0x95a5a6 : isFull ? 0x57f287 : TYPE_COLORS[activity.type] ?? GOLD;
  const desc = !active
    ? "❌ Bu etkinlik sona erdi veya iptal edildi."
    : isFull
    ? "✅ **Etkinlik dolu!** Katılımcılar birbirini bulabilir."
    : `🟡 **${activity.maxSize - activity.members.length}** kişilik yer var — katılmak için butona bas!`;

  const expires = new Date(activity.expiresAt);
  const diffMs = expires.getTime() - Date.now();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  const expiresText = diffMin > 60 ? `${Math.floor(diffMin / 60)}sa ${diffMin % 60}dk` : `${diffMin}dk`;

  return {
    embed: {
      title: TYPE_LABELS[activity.type] ?? activity.type,
      description: desc,
      color,
      fields: [
        {
          name: `👥 Katılımcılar (${activity.members.length}/${activity.maxSize})`,
          value: slots.join("\n"),
        },
      ],
      footer: { text: `Kurucu: ${activity.creator.familyName} • ${diffMin > 0 ? `${expiresText} sonra sona erer` : "Süresi doldu"} • Aetherion` },
    },
    components: active
      ? [
          {
            type: 1,
            components: [
              { type: 2, style: 3, label: "✅ Katıl", custom_id: `act_katil_${activity.id}` },
              { type: 2, style: 2, label: "🚪 Ayrıl", custom_id: `act_ayril_${activity.id}` },
              { type: 2, style: 4, label: "❌ İptal", custom_id: `act_iptal_${activity.id}` },
            ],
          },
        ]
      : [],
  };
}

export async function sendActivityToDiscord(activity: ActivityEmbedInput) {
  const { embed, components } = buildActivityEmbed(activity);
  const res = await fetch(`https://discord.com/api/v10/channels/${ACTIVITY_CHANNEL_ID}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify({ embeds: [embed], components }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.id as string;
}

export async function updateActivityMessage(messageId: string, activity: ActivityEmbedInput, active = true) {
  const { embed, components } = buildActivityEmbed(activity, active);
  await fetch(`https://discord.com/api/v10/channels/${ACTIVITY_CHANNEL_ID}/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${BOT_TOKEN}` },
    body: JSON.stringify({ embeds: [embed], components }),
  });
}
