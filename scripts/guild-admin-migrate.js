/**
 * Klan yoneticisi yetkisi + savas duyuru kanali kolonlarini ekler.
 *   site_roles.isGuildAdmin
 *   users.isGuildAdmin
 *   guilds.warChannelId
 *   wars.discordMessages
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const STATEMENTS = [
  ['site_roles.isGuildAdmin',
   `ALTER TABLE "site_roles" ADD COLUMN IF NOT EXISTS "isGuildAdmin" BOOLEAN NOT NULL DEFAULT false;`],
  ['users.isGuildAdmin',
   `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isGuildAdmin" BOOLEAN NOT NULL DEFAULT false;`],
  ['guilds.warChannelId',
   `ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "warChannelId" TEXT;`],
  ['wars.discordMessages',
   `ALTER TABLE "wars" ADD COLUMN IF NOT EXISTS "discordMessages" TEXT NOT NULL DEFAULT '[]';`],
];

async function main() {
  for (const [label, sql] of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("OK  " + label);
  }

  // Mevcut savas duyurularini yeni formata tasi
  const migrated = await prisma.$executeRawUnsafe(`
    UPDATE "wars"
    SET "discordMessages" = json_build_array(
      json_build_object('channelId', $CH$${process.env.DISCORD_CHANNEL_ID || ""}$CH$, 'messageId', "discordMessageId")
    )::text
    WHERE "discordMessageId" IS NOT NULL AND "discordMessages" = '[]';
  `);
  console.log(migrated + " savas duyurusu cok-kanal formatina tasindi");

  const roles = await prisma.$queryRawUnsafe(
    `SELECT "name","isAdmin","isGuildAdmin" FROM "site_roles" ORDER BY "priority" DESC;`
  );
  console.log("\nRoller:");
  for (const r of roles) {
    const lvl = r.isAdmin ? "SITE ADMIN" : r.isGuildAdmin ? "klan yoneticisi" : "-";
    console.log(`  ${r.name}: ${lvl}`);
  }
}

main()
  .catch((e) => { console.error("HATA:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
