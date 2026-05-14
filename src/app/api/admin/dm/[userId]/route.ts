export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: parseInt(params.userId) },
    select: { discordId: true },
  });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const botToken = process.env.DISCORD_BOT_TOKEN!;

  // Open DM channel
  const dmRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${botToken}` },
    body: JSON.stringify({ recipient_id: user.discordId }),
  });
  if (!dmRes.ok) return NextResponse.json({ error: "DM kanalı açılamadı" }, { status: 500 });

  const dm = await dmRes.json();

  // Send message
  const msgRes = await fetch(`https://discord.com/api/v10/channels/${dm.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${botToken}` },
    body: JSON.stringify({
      content: `👋 Merhaba! **Aetherion** guild sitesine kayıtlısın ama profilini henüz doldurmadın.\n\nLütfen aşağıdaki adrese giriş yaparak aile adın, class'ın ve GS bilgilerini doldur:\n🔗 https://www.aetheri.online/profile`,
    }),
  });

  if (!msgRes.ok) {
    const err = await msgRes.json();
    return NextResponse.json({ error: err.message ?? "Mesaj gönderilemedi" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
