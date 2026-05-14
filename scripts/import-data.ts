import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Map bot class names to our class IDs
const CLASS_MAP: Record<string, string> = {
  "sage": "sage",
  "witch": "cadi",
  "guardian": "guardian",
  "tamer": "avci",
  "sorceress": "sahire",
  "ranger": "okcu",
  "striker": "striker",
  "maegu": "maegu",
  "guard": "guardian",
  "berserker": "berserker",
  "dark": "kara_sovalye",
  "kuoichi": "kunoichi",
  "kunoichi": "kunoichi",
  "archer": "archer",
  "drakania": "drakania",
  "valkyrie": "valkyrie",
  "wukong": "wukong",
  "wizard": "buyucu",
  "vahşi": "vahsi",
  "ninja": "ninja",
  "dosa": "dosa",
  "seraph": "seraph",
  "lahn": "lahn",
  "woosa": "woosa",
  "cadı": "cadi",
  "nova": "nova",
  "musa": "musa",
  "darknight": "kara_sovalye",
  "dark knight": "kara_sovalye",
};

function mapClass(rawClass: string): string {
  const lower = rawClass.toLowerCase().trim();
  return CLASS_MAP[lower] || lower;
}

// Parse bot date format "DD.MM.YYYY HH:MM" or "DD.MM.YYYY HH.MM"
function parseDate(dateStr: string): Date {
  // Normalize separators
  const normalized = dateStr.replace(/\./g, (match, offset, str) => {
    // First two dots are date separators, rest might be time separator
    const parts = str.split(" ");
    if (parts.length >= 2) {
      const datePart = parts[0]; // DD.MM.YYYY
      const timePart = parts[1]; // HH:MM or HH.MM
      const [day, month, year] = datePart.split(".");
      const [hour, minute] = timePart.split(/[.:]/);
      return ""; // placeholder, we handle below
    }
    return match;
  });

  const parts = dateStr.trim().split(" ");
  const datePart = parts[0];
  const timePart = parts[1] || "21:00";

  const [day, month, year] = datePart.split(".");
  const [hour, minute] = timePart.split(/[.:]/);

  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour) || 21,
    parseInt(minute) || 0
  );
}

async function main() {
  const dataPath = path.join("C:\\Users\\furka\\Downloads\\data.json");
  const raw = fs.readFileSync(dataPath, "utf-8");
  const data = JSON.parse(raw);

  console.log(`📦 ${Object.keys(data.players).length} oyuncu bulundu`);
  console.log(`⚔️ ${Object.keys(data.wars).length} savaş bulundu`);

  // 1. Import players
  const userIdMap: Record<string, number> = {}; // discordId -> db userId

  for (const [discordId, info] of Object.entries(data.players) as [string, any][]) {
    const mappedClass = mapClass(info.class);

    const user = await prisma.user.upsert({
      where: { discordId },
      update: {
        familyName: info.family,
        ap: info.ap,
        dp: info.dp,
        class: mappedClass,
      },
      create: {
        discordId,
        familyName: info.family,
        ap: info.ap,
        dp: info.dp,
        class: mappedClass,
      },
    });

    userIdMap[discordId] = user.id;
    console.log(`  ✅ ${info.family} (${mappedClass}) — GS: ${info.ap + info.dp}`);
  }

  console.log(`\n👥 ${Object.keys(userIdMap).length} oyuncu aktarıldı\n`);

  // 2. Import wars and participation
  let warCount = 0;
  let participationCount = 0;

  for (const [warId, warData] of Object.entries(data.wars) as [string, any][]) {
    const warDate = parseDate(warData.date);

    const war = await prisma.war.create({
      data: {
        title: warData.name,
        type: "NODE_WAR",
        date: warDate,
        createdBy: userIdMap["133621017389170688"] || 1, // Hoixi as creator
      },
    });

    warCount++;
    console.log(`  ⚔️ ${warData.name} — ${warDate.toLocaleDateString("tr-TR")}`);

    // Import responses
    for (const [discordId, response] of Object.entries(warData.responses) as [string, string][]) {
      const userId = userIdMap[discordId];
      if (!userId) {
        // Player not in players list but responded to war — create minimal user
        const newUser = await prisma.user.upsert({
          where: { discordId },
          update: {},
          create: {
            discordId,
            familyName: "",
          },
        });
        userIdMap[discordId] = newUser.id;
      }

      const finalUserId = userIdMap[discordId];
      if (!finalUserId) continue;

      const status = response === "evet" ? "ATTENDING" : "DECLINED";

      await prisma.warParticipant.upsert({
        where: { warId_userId: { warId: war.id, userId: finalUserId } },
        update: { status },
        create: {
          warId: war.id,
          userId: finalUserId,
          status,
        },
      });
      participationCount++;
    }
  }

  console.log(`\n✅ Import tamamlandı!`);
  console.log(`   👥 ${Object.keys(userIdMap).length} oyuncu`);
  console.log(`   ⚔️ ${warCount} savaş`);
  console.log(`   📋 ${participationCount} katılım kaydı`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Hata:", e);
  prisma.$disconnect();
  process.exit(1);
});
