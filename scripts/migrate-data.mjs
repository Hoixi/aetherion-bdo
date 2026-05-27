/**
 * MySQL → Supabase veri taşıma scripti
 * node scripts/migrate-data.mjs
 */

import mysql from "mysql2/promise";
import { config } from "dotenv";
config({ path: ".env.migration" });

const MYSQL_URL = process.env.MYSQL_URL   || "";
const SUPA_URL  = process.env.SUPA_URL    || "";
const SUPA_KEY  = process.env.SUPA_KEY    || "";

if (!MYSQL_URL || !SUPA_URL || !SUPA_KEY) {
  console.error("❌ .env.migration dosyasında MYSQL_URL, SUPA_URL, SUPA_KEY eksik");
  process.exit(1);
}

const headers = {
  "apikey": SUPA_KEY,
  "Authorization": `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "resolution=ignore-duplicates,return=minimal",
};

// MySQL bağlantısını parse et
const db = await mysql.createConnection(MYSQL_URL);
console.log("✅ MySQL bağlandı\n");

async function q(sql) {
  const [rows] = await db.execute(sql);
  return rows;
}

async function push(table, rows) {
  if (!rows.length) { console.log(`  ${table.padEnd(25)} — boş, atlandı`); return; }
  // Büyük tablolar için chunk'la (max 500/istek)
  const chunks = [];
  for (let i = 0; i < rows.length; i += 500) chunks.push(rows.slice(i, i + 500));

  let total = 0;
  for (const chunk of chunks) {
    const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST",
      headers,
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`  ❌ ${table}: ${res.status} ${err.slice(0,200)}`);
      return;
    }
    total += chunk.length;
  }
  console.log(`  ${table.padEnd(25)} ✅ ${total} kayıt`);
}

// ── Sıra önemli: FK bağımlılıklarına göre ──

await push("site_roles",         await q("SELECT * FROM site_roles"));
await push("users",              await q("SELECT * FROM users"));
await push("wars",               await q("SELECT * FROM wars"));
await push("war_schedules",      await q("SELECT * FROM war_schedules"));
await push("war_participants",   await q("SELECT * FROM war_participants"));
await push("parties",            await q("SELECT * FROM parties"));
await push("party_members",      await q("SELECT * FROM party_members"));
await push("announcements",      await q("SELECT * FROM announcements"));
await push("gs_history",         await q("SELECT * FROM gs_history"));
await push("notifications",      await q("SELECT * FROM notifications"));
await push("mobile_tokens",      await q("SELECT * FROM mobile_tokens"));
await push("geo_images",         await q("SELECT * FROM geo_images"));
await push("geo_games",          await q("SELECT * FROM geo_games"));
await push("geo_rounds",         await q("SELECT * FROM geo_rounds"));
await push("boss_parties",       await q("SELECT * FROM boss_parties"));
await push("boss_party_members", await q("SELECT * FROM boss_party_members"));
await push("war_performances",   await q("SELECT * FROM war_performances"));
await push("activities",         await q("SELECT * FROM activities"));
await push("activity_members",   await q("SELECT * FROM activity_members"));
await push("class_discord_roles",await q("SELECT * FROM class_discord_roles"));
await push("skill_translations", await q("SELECT * FROM skill_translations"));
await push("patch_notes",        await q("SELECT * FROM patch_notes"));
await push("forum_tags",         await q("SELECT * FROM forum_tags"));
await push("forum_posts",        await q("SELECT * FROM forum_posts"));
await push("forum_post_tags",    await q("SELECT * FROM forum_post_tags"));
await push("forum_comments",     await q("SELECT * FROM forum_comments"));
await push("forum_reactions",    await q("SELECT * FROM forum_reactions"));

// Sequence'leri düzelt (PostgreSQL auto-increment sonraki ID doğru başlasın)
console.log("\n🔧 Sequence'ler güncelleniyor...");
const seqTables = [
  "site_roles","users","wars","war_schedules","war_participants",
  "parties","party_members","announcements","gs_history","notifications",
  "mobile_tokens","geo_images","geo_games","geo_rounds","boss_parties",
  "boss_party_members","war_performances","activities","activity_members",
  "class_discord_roles","skill_translations","patch_notes",
  "forum_tags","forum_posts","forum_comments","forum_reactions",
];

const seqSQL = seqTables
  .map(t => `SELECT setval(pg_get_serial_sequence('"${t}"','id'), COALESCE((SELECT MAX(id) FROM "${t}"),1));`)
  .join("\n");

const seqRes = await fetch(`${SUPA_URL}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers,
  body: JSON.stringify({ query: seqSQL }),
});

// Sequence için SQL Editor'de çalıştırmak daha güvenli
console.log("⚠️  Sequence SQL'i Supabase SQL Editor'de çalıştır:");
console.log("──────────────────────────────────────────────────");
console.log(seqSQL);
console.log("──────────────────────────────────────────────────");

await db.end();
console.log("\n🎉 Veri taşıma tamamlandı!");
