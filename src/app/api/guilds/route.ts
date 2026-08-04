export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guilds = await prisma.guild.findMany({
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    include: { _count: { select: { members: { where: { deletedAt: null } } } } },
  });

  return NextResponse.json(guilds);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, tag, color, discordRoleIds } = await req.json();
  if (!name?.trim() || !tag?.trim()) {
    return NextResponse.json({ error: "İsim ve tag zorunlu." }, { status: 400 });
  }

  const roleIds = (discordRoleIds ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  try {
    const guild = await prisma.guild.create({
      data: {
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        color: color || "#d4a030",
        isPrimary: false,
        discordRoleIds: JSON.stringify(roleIds),
      },
    });
    return NextResponse.json(guild);
  } catch {
    return NextResponse.json({ error: "Bu isim veya tag zaten kullanılıyor." }, { status: 409 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, name, tag, color, discordRoleIds } = await req.json();
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });

  const roleIds = discordRoleIds !== undefined
    ? JSON.stringify((discordRoleIds ?? "").split(",").map((s: string) => s.trim()).filter(Boolean))
    : undefined;

  try {
    const guild = await prisma.guild.update({
      where: { id: Number(id) },
      data: {
        name: name?.trim() ?? undefined,
        tag: tag?.trim().toUpperCase() ?? undefined,
        color: color ?? undefined,
        discordRoleIds: roleIds,
      },
    });
    return NextResponse.json(guild);
  } catch {
    return NextResponse.json({ error: "Güncellenemedi — isim veya tag çakışıyor olabilir." }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  const guild = await prisma.guild.findUnique({ where: { id: Number(id) } });
  if (!guild) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });
  if (guild.isPrimary) {
    return NextResponse.json({ error: "Ana klan silinemez." }, { status: 400 });
  }

  // Üyelerin guildId'si otomatik NULL olur (onDelete: SetNull)
  await prisma.guild.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
