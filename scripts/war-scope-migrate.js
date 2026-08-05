/**
 * Savas kapsami (ally / klan ici) + ayri duyuru kanali kolonlarini ekler.
 *   wars.isAllyWar
 *   guilds.allyWarChannelId
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const STATEMENTS = [
  ['wars.isAllyWar',
   `ALTER TABLE "wars" ADD COLUMN IF NOT EXISTS "isAllyWar" BOOLEAN NOT NULL DEFAULT true;`],
  ['guilds.allyWarChannelId',
   `ALTER TABLE "guilds" ADD COLUMN IF NOT EXISTS "allyWarChannelId" TEXT;`],
];

async function main() {
  for (const [label, sql] of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("OK  " + label);
  }

  const g = await prisma.$queryRawUnsafe(
    `SELECT tag, "warChannelId", "allyWarChannelId" FROM "guilds" ORDER BY "isPrimary" DESC;`
  );
  console.log("\nKlan kanallari:");
  for (const r of g) {
    console.log(`  ${r.tag}: klan-ici=${r.warChannelId} ally=${r.allyWarChannelId}`);
  }

  const w = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int c, "isAllyWar" FROM "wars" GROUP BY "isAllyWar";`
  );
  console.log("\nSavaslar:", JSON.stringify(w));
}

main()
  .catch((e) => { console.error("HATA:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
