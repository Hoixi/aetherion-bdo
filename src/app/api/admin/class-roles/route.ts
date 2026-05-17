export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BDO_CLASSES } from "@/lib/classes";

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;
const ROLE_PREFIX = "[ Class ] ";

// Her class için Discord rol rengi
const CLASS_COLORS: Record<string, number> = {
  savasci:     0xe74c3c,
  okcu:        0xe67e22,
  guardian:    0x3498db,
  kara_sovalye:0x2c3e50,
  bilge:       0x9b59b6,
  drakania:    0xc0392b,
  sahire:      0xe91e8c,
  nova:        0x9c59b6,
  corsair:     0x1abc9c,
  lahn:        0xe056d6,
  vahsi:       0x27ae60,
  maegu:       0xf06292,
  avci:        0xf39c12,
  shai:        0xf1c40f,
  musa:        0xe74c3c,
  striker:     0xd35400,
  maehwa:      0xff6b9d,
  mistik:      0x8e44ad,
  valkyrie:    0xecf0f1,
  kunoichi:    0xc0392b,
  ninja:       0x2c3e50,
  buyucu:      0x8e44ad,
  archer:      0x2ecc71,
  cadi:        0x6c3483,
  woosa:       0x5dade2,
  seraph:      0xf4d03f,
  dosa:        0xe74c3c,
  deadeye:     0x7f8c8d,
  sage:        0x1a5276,
  wukong:      0xe67e22,
  hashashin:   0x784212,
};

async function discordFetch(path: string, method = "GET", body?: unknown) {
  const res = await fetch(`https://discord.com/api/v10${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

// Guild'deki tüm rolleri çek
async function getGuildRoles(): Promise<{ id: string; name: string }[]> {
  const res = await discordFetch(`/guilds/${GUILD_ID}/roles`);
  if (!res.ok) return [];
  return res.json();
}

// Guild üyelerini sayfalayarak çek (max 1000/istek)
async function getAllGuildMembers(): Promise<{ user: { id: string }; roles: string[] }[]> {
  const members: { user: { id: string }; roles: string[] }[] = [];
  let lastId = "0";
  while (true) {
    const res = await discordFetch(`/guilds/${GUILD_ID}/members?limit=1000&after=${lastId}`);
    if (!res.ok) break;
    const batch: { user: { id: string }; roles: string[] }[] = await res.json();
    if (batch.length === 0) break;
    members.push(...batch);
    if (batch.length < 1000) break;
    lastId = batch[batch.length - 1].user.id;
  }
  return members;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const roles = await prisma.classDiscordRole.findMany({ orderBy: { className: "asc" } });
  return NextResponse.json({ roles, total: BDO_CLASSES.length, synced: roles.length });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!GUILD_ID) return NextResponse.json({ error: "DISCORD_GUILD_ID env eksik" }, { status: 500 });

  const result = {
    created: [] as string[],
    existing: [] as string[],
    assigned: 0,
    removed: 0,
    errors: 0,
  };

  // 1. DB'deki kayıtlı rolleri al
  const savedRoles = await prisma.classDiscordRole.findMany();
  const savedMap = new Map(savedRoles.map((r) => [r.className, r.roleId]));

  // 2. Discord'daki mevcut guild rollerini al
  const guildRoles = await getGuildRoles();
  const guildRoleIds = new Set(guildRoles.map((r) => r.id));

  // 3. Her class için rol yoksa oluştur
  for (const cls of BDO_CLASSES) {
    const existingRoleId = savedMap.get(cls.id);

    // DB'de var ve Discord'da hâlâ var mı?
    if (existingRoleId && guildRoleIds.has(existingRoleId)) {
      result.existing.push(cls.name);
      continue;
    }

    // Discord'da aynı isimde rol var mı kontrol et
    const existingByName = guildRoles.find((r) => r.name === `${ROLE_PREFIX}${cls.name}`);
    if (existingByName) {
      // DB'ye kaydet
      await prisma.classDiscordRole.upsert({
        where: { className: cls.id },
        update: { roleId: existingByName.id },
        create: { className: cls.id, roleId: existingByName.id },
      });
      savedMap.set(cls.id, existingByName.id);
      result.existing.push(cls.name);
      continue;
    }

    // Oluştur
    const color = CLASS_COLORS[cls.id] ?? 0xd4a853;
    const res = await discordFetch(`/guilds/${GUILD_ID}/roles`, "POST", {
      name: `${ROLE_PREFIX}${cls.name}`,
      color,
      hoist: false,
      mentionable: false,
    });

    if (!res.ok) {
      result.errors++;
      continue;
    }

    const newRole = await res.json();
    await prisma.classDiscordRole.upsert({
      where: { className: cls.id },
      update: { roleId: newRole.id },
      create: { className: cls.id, roleId: newRole.id },
    });
    savedMap.set(cls.id, newRole.id);
    result.created.push(cls.name);

    // Rate limit koruması
    await new Promise((r) => setTimeout(r, 300));
  }

  // 4. Tüm DB kullanıcılarını çek
  const users = await prisma.user.findMany({
    where: { discordId: { not: "" } },
    select: { discordId: true, class: true },
  });
  const userClassMap = new Map(users.map((u) => [u.discordId, u.class]));

  // 5. Tüm guild üyelerini çek
  const members = await getAllGuildMembers();

  // Tüm class rol ID'leri seti (atama/çıkarma için)
  const allClassRoleIds = new Set(savedMap.values());

  // 6. Her üyeye doğru rolü ata
  for (const member of members) {
    const discordId = member.user.id;
    const userClass = userClassMap.get(discordId);
    const targetRoleId = userClass ? savedMap.get(userClass) : undefined;

    // Üyenin mevcut class rolleri
    const currentClassRoles = member.roles.filter((r) => allClassRoleIds.has(r));

    // Doğru rol zaten varsa ve başka class rol yoksa atla
    if (
      targetRoleId &&
      currentClassRoles.length === 1 &&
      currentClassRoles[0] === targetRoleId
    ) continue;

    // Yanlış class rollerini çıkar
    for (const roleId of currentClassRoles) {
      if (roleId === targetRoleId) continue;
      const res = await discordFetch(`/guilds/${GUILD_ID}/members/${discordId}/roles/${roleId}`, "DELETE");
      if (res.ok) result.removed++;
      await new Promise((r) => setTimeout(r, 100));
    }

    // Doğru rolü ata
    if (targetRoleId && !currentClassRoles.includes(targetRoleId)) {
      const res = await discordFetch(`/guilds/${GUILD_ID}/members/${discordId}/roles/${targetRoleId}`, "PUT");
      if (res.ok) result.assigned++;
      else result.errors++;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return NextResponse.json(result);
}

// Tüm class rollerini Discord'dan ve DB'den sil
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const savedRoles = await prisma.classDiscordRole.findMany();
  let deleted = 0;

  for (const role of savedRoles) {
    const res = await discordFetch(`/guilds/${GUILD_ID}/roles/${role.roleId}`, "DELETE");
    if (res.ok) deleted++;
    await new Promise((r) => setTimeout(r, 200));
  }

  await prisma.classDiscordRole.deleteMany();
  return NextResponse.json({ deleted });
}
