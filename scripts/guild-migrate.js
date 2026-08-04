/**
 * Guild tablosunu oluşturur, users.guildId kolonunu ekler ve
 * mevcut tüm üyeleri Aetherion guild'ine atar.
 *
 * Container içinde çalıştır:
 *   docker exec <container> node /app/guild-migrate.js
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. guilds tablosu
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "guilds" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "tag" TEXT NOT NULL,
      "color" TEXT NOT NULL DEFAULT '#d4a030',
      "isPrimary" BOOLEAN NOT NULL DEFAULT false,
      "discordRoleIds" TEXT NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "guilds_name_key" ON "guilds"("name");`);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "guilds_tag_key" ON "guilds"("tag");`);
  console.log("guilds tablosu hazir");

  // 2. users.guildId kolonu + FK
  await prisma.$executeRawUnsafe(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "guildId" INTEGER;`);
  const fk = await prisma.$queryRawUnsafe(
    `SELECT 1 AS x FROM pg_constraint WHERE conname = 'users_guildId_fkey' LIMIT 1;`
  );
  if (!fk.length) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "users"
      ADD CONSTRAINT "users_guildId_fkey"
      FOREIGN KEY ("guildId") REFERENCES "guilds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  }
  console.log("users.guildId hazir");

  // 3. Aetherion guild
  const existing = await prisma.$queryRawUnsafe(`SELECT id FROM "guilds" WHERE "name" = 'Aetherion' LIMIT 1;`);
  let guildId;
  if (existing.length) {
    guildId = existing[0].id;
    console.log("Aetherion zaten var, id=" + guildId);
  } else {
    const rows = await prisma.$queryRawUnsafe(`
      INSERT INTO "guilds" ("name","tag","color","isPrimary","updatedAt")
      VALUES ('Aetherion','AET','#d4a030',true,CURRENT_TIMESTAMP)
      RETURNING id;
    `);
    guildId = rows[0].id;
    console.log("Aetherion olusturuldu, id=" + guildId);
  }

  // 4. Mevcut tum uyeleri Aetherion'a ata
  const updated = await prisma.$executeRawUnsafe(
    `UPDATE "users" SET "guildId" = ${guildId} WHERE "guildId" IS NULL;`
  );
  console.log(updated + " uye Aetherion'a atandi");

  const total = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c FROM "users" WHERE "guildId" = ${guildId};`
  );
  console.log("Aetherion toplam uye: " + total[0].c);
}

main()
  .catch((e) => { console.error("HATA:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
