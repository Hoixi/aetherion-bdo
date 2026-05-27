/**
 * MySQL → Supabase (PostgreSQL) veri taşıma scripti
 *
 * Kullanım:
 *   1. .env.migration dosyasını oluştur (aşağıya bak)
 *   2. npx ts-node scripts/migrate-to-supabase.ts
 *
 * .env.migration içeriği:
 *   MYSQL_URL="mysql://kullanici:sifre@host:3306/dbname"
 *   SUPABASE_URL="postgresql://postgres.xxxx:sifre@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
 *   SUPABASE_DIRECT="postgresql://postgres.xxxx:sifre@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
 */

import { PrismaClient as MysqlClient } from "@prisma/client";
import { PrismaClient as PgClient }    from "@prisma/client";
import * as dotenv from "dotenv";
import * as fs from "fs";

// .env.migration varsa yükle, yoksa normal .env
if (fs.existsSync(".env.migration")) {
  dotenv.config({ path: ".env.migration" });
} else {
  dotenv.config();
}

const mysql = new MysqlClient({
  datasources: { db: { url: process.env.MYSQL_URL } },
});

const pg = new PgClient({
  datasources: { db: { url: process.env.SUPABASE_DIRECT } },
});

async function run() {
  console.log("🔌 Bağlanıyor...");
  await mysql.$connect();
  await pg.$connect();
  console.log("✅ Her iki DB'ye bağlandı\n");

  // ── Sıra önemli: foreign key bağımlılıklarına göre ──

  await migrateTable("SiteRole",      () => mysql.siteRole.findMany(),      (rows) => pg.siteRole.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("User",          () => mysql.user.findMany(),           (rows) => pg.user.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("War",           () => mysql.war.findMany(),            (rows) => pg.war.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("WarSchedule",   () => mysql.warSchedule.findMany(),    (rows) => pg.warSchedule.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("WarParticipant",() => mysql.warParticipant.findMany(),(rows) => pg.warParticipant.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("Party",         () => mysql.party.findMany(),          (rows) => pg.party.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("PartyMember",   () => mysql.partyMember.findMany(),    (rows) => pg.partyMember.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("Announcement",  () => mysql.announcement.findMany(),   (rows) => pg.announcement.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("GsHistory",     () => mysql.gsHistory.findMany(),      (rows) => pg.gsHistory.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("Notification",  () => mysql.notification.findMany(),   (rows) => pg.notification.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("MobileToken",   () => mysql.mobileToken.findMany(),    (rows) => pg.mobileToken.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("GeoImage",      () => mysql.geoImage.findMany(),       (rows) => pg.geoImage.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("GeoGame",       () => mysql.geoGame.findMany(),        (rows) => pg.geoGame.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("GeoRound",      () => mysql.geoRound.findMany(),       (rows) => pg.geoRound.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("WarPerformance",() => mysql.warPerformance.findMany(),(rows) => pg.warPerformance.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("Activity",      () => mysql.activity.findMany(),       (rows) => pg.activity.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("ActivityMember",() => mysql.activityMember.findMany(),(rows) => pg.activityMember.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("ForumPost",     () => mysql.forumPost.findMany(),      (rows) => pg.forumPost.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("ForumComment",  () => mysql.forumComment.findMany(),   (rows) => pg.forumComment.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("ForumReaction", () => mysql.forumReaction.findMany(),  (rows) => pg.forumReaction.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("PatchNote",     () => mysql.patchNote.findMany(),      (rows) => pg.patchNote.createMany({ data: rows, skipDuplicates: true }));
  await migrateTable("Skill",         () => mysql.skill.findMany(),          (rows) => pg.skill.createMany({ data: rows, skipDuplicates: true }));

  // PostgreSQL sequence'lerini düzelt (auto-increment sonraki ID doğru başlasın)
  console.log("\n🔧 Sequence'ler sıfırlanıyor...");
  const tables = [
    "users","site_roles","wars","war_schedules","war_participants",
    "parties","party_members","announcements","gs_history","notifications",
    "mobile_tokens","geo_images","geo_games","geo_rounds","war_performances",
    "activities","activity_members","forum_posts","forum_comments",
    "forum_reactions","patch_notes","skills",
  ];
  for (const t of tables) {
    await pg.$executeRawUnsafe(
      `SELECT setval(pg_get_serial_sequence('"${t}"','id'), COALESCE(MAX(id),1)) FROM "${t}"`
    );
  }
  console.log("✅ Sequence'ler düzeltildi");

  await mysql.$disconnect();
  await pg.$disconnect();
  console.log("\n🎉 Taşıma tamamlandı!");
}

async function migrateTable(
  name: string,
  read: () => Promise<any[]>,
  write: (rows: any[]) => Promise<any>
) {
  process.stdout.write(`  ${name.padEnd(20)}`);
  const rows = await read();
  if (rows.length === 0) {
    console.log("— boş, atlandı");
    return;
  }
  await write(rows);
  console.log(`✅ ${rows.length} kayıt`);
}

run().catch((e) => {
  console.error("❌ Hata:", e);
  process.exit(1);
});
