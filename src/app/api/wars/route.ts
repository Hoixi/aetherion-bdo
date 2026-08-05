export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyAllMembers } from "@/lib/notifications";
import { getGuildScope } from "@/lib/guild-scope";

export async function GET() {
  const scope = await getGuildScope();
  if (!scope) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Klan içi savaşları sadece ana klan üyeleri görür
  const primary = await prisma.guild.findFirst({ where: { isPrimary: true }, select: { id: true } });
  const isPrimaryMember = scope.guildId === primary?.id;

  const wars = await prisma.war.findMany({
    where: isPrimaryMember ? {} : { isAllyWar: true },
    orderBy: { date: "desc" },
    include: {
      _count: { select: { participants: { where: { status: "ATTENDING" } } } },
      participants: {
        where: { userId: scope.userId },
        select: { status: true },
      },
    },
  });

  return NextResponse.json(wars);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, type, date, notes, deadline, maxParticipants, isAllyWar } = body;

  const war = await prisma.war.create({
    data: {
      title,
      type,
      date: new Date(date),
      notes: notes || null,
      deadline: deadline ? new Date(deadline) : null,
      maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
      isAllyWar: isAllyWar !== false,
      createdBy: session.user.id,
    },
  });

  // Tüm üyelere bildirim gönder
  await notifyAllMembers(
    "NEW_WAR",
    "Yeni Etkinlik",
    `"${war.title}" etkinliği oluşturuldu. Katılım durumunu bildir!`,
    `/wars/${war.id}`,
    !war.isAllyWar
  );

  return NextResponse.json(war, { status: 201 });
}
