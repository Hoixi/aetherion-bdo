export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Başvuru formu için klan listesi — giriş gerektirmez.
 * Sadece görünen ad, tag ve renk döner; üye sayısı veya Discord
 * yapılandırması gibi iç bilgiler paylaşılmaz.
 */
export async function GET() {
  const guilds = await prisma.guild.findMany({
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    select: { id: true, name: true, tag: true, color: true, isPrimary: true },
  });
  return NextResponse.json(guilds);
}
