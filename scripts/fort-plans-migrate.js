/**
 * Kale kurulum planlari tablosu.
 *   fort_plans (fortKey benzersiz, shapes JSON metni, updatedBy -> users)
 *
 * Klana gore ayrilmiyor: node war'a muttefiklerle birlikte giriliyor,
 * kale kurulumu da ortak. Bir kalenin tek plani var.
 *
 * Calistirma (yerelden Supabase'e erisilemiyor, VPS uzerinden):
 *   scp scripts/fort-plans-migrate.js root@178.105.214.249:/tmp/
 *   ssh root@178.105.214.249 'docker cp /tmp/fort-plans-migrate.js \
 *     b9xi4os749zl5ki0ldgkc8kg-123649844397:/app/ && \
 *     docker exec -w /app b9xi4os749zl5ki0ldgkc8kg-123649844397 \
 *     node fort-plans-migrate.js && shred -u /tmp/fort-plans-migrate.js'
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const STATEMENTS = [
  ['fort_plans tablosu', `
    CREATE TABLE IF NOT EXISTS "fort_plans" (
      "id"        SERIAL PRIMARY KEY,
      "fortKey"   TEXT NOT NULL,
      "shapes"    TEXT NOT NULL DEFAULT '[]',
      "updatedBy" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`],

  ['fortKey benzersiz', `
    CREATE UNIQUE INDEX IF NOT EXISTS "fort_plans_fortKey_key"
      ON "fort_plans"("fortKey");`],

  // ADD CONSTRAINT'in IF NOT EXISTS'i yok, tekrar calistirilabilsin diye sarmalandi
  ['updatedBy -> users', `
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fort_plans_updatedBy_fkey'
      ) THEN
        ALTER TABLE "fort_plans"
          ADD CONSTRAINT "fort_plans_updatedBy_fkey"
          FOREIGN KEY ("updatedBy") REFERENCES "users"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$;`],
];

async function main() {
  for (const [label, sql] of STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
    console.log("OK  " + label);
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT "fortKey", length("shapes") AS bytes, "updatedAt"
       FROM "fort_plans" ORDER BY "fortKey";`
  );
  console.log("\nKayitli plan: " + rows.length);
  for (const r of rows) console.log(`  ${r.fortKey}  ${r.bytes}b  ${r.updatedAt}`);
}

main()
  .catch((e) => { console.error("HATA:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
