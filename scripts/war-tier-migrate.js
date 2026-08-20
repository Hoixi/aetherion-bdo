/**
 * Node war kademesi (T1 / T2 / T3).
 *   wars.tier
 *   war_schedules.tier
 *
 * Mevcut savaslarin hepsi T1 kabul ediliyor — bugune kadar acilanlar
 * zaten T1'di, varsayilan da o.
 *
 * Calistirma (yerelden Supabase'e erisilemiyor, VPS uzerinden).
 * Konteyner adinin sonundaki sayi her deploy'da degisiyor:
 *
 *   scp scripts/war-tier-migrate.js root@178.105.214.249:/tmp/
 *   ssh root@178.105.214.249 'C=$(docker ps --format "{{.Names}}" \
 *     | grep "^b9xi4os749zl5ki0ldgkc8kg-" | head -1); \
 *     docker cp /tmp/war-tier-migrate.js "$C":/app/ && \
 *     docker exec -w /app "$C" node war-tier-migrate.js; \
 *     docker exec "$C" rm -f /app/war-tier-migrate.js; \
 *     shred -u /tmp/war-tier-migrate.js'
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const STATEMENTS = [
  ['wars.tier',
   `ALTER TABLE "wars" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'T1';`],
  ['war_schedules.tier',
   `ALTER TABLE "war_schedules" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'T1';`],
];

async function main() {
  for (const [label, sql] of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("OK  " + label);
  }

  const w = await prisma.$queryRawUnsafe(
    `SELECT tier, COUNT(*)::int c FROM "wars" GROUP BY tier ORDER BY tier;`);
  console.log("\nSavaslar: " + w.map((r) => r.tier + "=" + r.c).join("  "));

  const s = await prisma.$queryRawUnsafe(
    `SELECT name, tier FROM "war_schedules" ORDER BY "dayOfWeek";`);
  console.log("Programlar:");
  for (const r of s) console.log("  " + r.name + " -> " + r.tier);
}

main()
  .catch((e) => { console.error("HATA:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
