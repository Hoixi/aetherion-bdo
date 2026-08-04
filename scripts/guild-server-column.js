/**
 * guilds.discordServerId kolonunu ekler ve mevcut klanlara
 * ana Discord sunucu ID'sini varsayilan olarak yazar.
 *
 * Container icinde: docker exec <container> node /app/gsc.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "discordServerId" TEXT;`
  );
  console.log("guilds.discordServerId eklendi");

  const mainServer = process.env.DISCORD_GUILD_ID;
  if (!mainServer) {
    console.log("DISCORD_GUILD_ID yok, backfill atlandi");
    return;
  }

  // Rolu olan ama sunucusu bilinmeyen klanlara ana sunucuyu yaz
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "guilds"
     SET "discordServerId" = '${mainServer}'
     WHERE "discordServerId" IS NULL;`
  );
  console.log(updated + " klana ana sunucu ID'si yazildi (" + mainServer + ")");

  const rows = await prisma.$queryRawUnsafe(
    `SELECT "name","tag","discordServerId","discordRoleIds" FROM "guilds" ORDER BY "isPrimary" DESC;`
  );
  for (const r of rows) {
    let n = 0;
    try { n = JSON.parse(r.discordRoleIds || "[]").length; } catch {}
    console.log(`  ${r.tag} (${r.name}) server=${r.discordServerId} roller=${n}`);
  }
}

main()
  .catch((e) => { console.error("HATA:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
