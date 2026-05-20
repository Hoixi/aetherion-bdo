export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendWarToDiscord } from "@/lib/discord-bot";

const CRON_SECRET = process.env.CRON_SECRET;
// Bot user ID used as createdBy for auto-created wars (fallback: first admin)
const TR_OFFSET_HOURS = 3; // UTC+3

function addHours(date: Date, h: number) {
  return new Date(date.getTime() + h * 3_600_000);
}

export async function GET(req: NextRequest) {
  // Auth check
  const auth = req.headers.get("authorization");
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // "Now" in Turkish local time
  const nowUtc = new Date();
  const nowTr = addHours(nowUtc, TR_OFFSET_HOURS);

  // Day/month/year in TR
  const trYear  = nowTr.getUTCFullYear();
  const trMonth = nowTr.getUTCMonth();
  const trDate  = nowTr.getUTCDate();

  const schedules = await prisma.warSchedule.findMany({ where: { isActive: true } });

  const results: { id: number; name: string; action: string }[] = [];

  // Find a bot/system user to assign as creator
  const systemUser = await prisma.user.findFirst({
    where: { isAdmin: true, deletedAt: null },
    select: { id: true },
  });
  if (!systemUser) {
    return NextResponse.json({ error: "No admin user found to assign as creator" }, { status: 500 });
  }

  for (const schedule of schedules) {
    // Calculate the war date: find the next occurrence of schedule.dayOfWeek from today
    // relative to TR time — going createDaysBefore into the future from today
    const targetDateTr = new Date(Date.UTC(trYear, trMonth, trDate));
    // Advance until we hit the right weekday
    // dayOfWeek 0=Sun … 6=Sat (JS getUTCDay compatible)
    let daysAhead = schedule.dayOfWeek - nowTr.getUTCDay();
    if (daysAhead < 0) daysAhead += 7;
    if (daysAhead === 0) daysAhead = 7; // always future, not today
    targetDateTr.setUTCDate(targetDateTr.getUTCDate() + daysAhead);

    // How many days until the war?
    // We should create the war when daysAhead === createDaysBefore
    if (daysAhead !== schedule.createDaysBefore) {
      results.push({ id: schedule.id, name: schedule.name, action: `skip (${daysAhead}d away, create at ${schedule.createDaysBefore}d)` });
      continue;
    }

    // War datetime in UTC: TR date at schedule.hour:schedule.minute - TR_OFFSET
    const warUtc = new Date(Date.UTC(
      targetDateTr.getUTCFullYear(),
      targetDateTr.getUTCMonth(),
      targetDateTr.getUTCDate(),
      schedule.hour - TR_OFFSET_HOURS,
      schedule.minute,
    ));

    // Duplicate check: war with same title on same day already exists?
    const dayStart = new Date(Date.UTC(targetDateTr.getUTCFullYear(), targetDateTr.getUTCMonth(), targetDateTr.getUTCDate()));
    const dayEnd   = new Date(dayStart.getTime() + 86_400_000);
    const existing = await prisma.war.findFirst({
      where: { title: schedule.name, date: { gte: dayStart, lt: dayEnd } },
    });
    if (existing) {
      results.push({ id: schedule.id, name: schedule.name, action: "skip (already exists)" });
      continue;
    }

    // Build deadline
    const deadline = schedule.deadlineHours
      ? new Date(warUtc.getTime() - schedule.deadlineHours * 3_600_000)
      : null;

    // Create the war
    const war = await prisma.war.create({
      data: {
        title:           schedule.name,
        type:            schedule.type as "NODE_WAR" | "SIEGE" | "KARA_TAPINAK" | "OTHER",
        date:            warUtc,
        deadline,
        maxParticipants: schedule.maxParticipants ?? null,
        notes:           schedule.notes ?? null,
        createdBy:       systemUser.id,
      },
    });

    // Optionally send to Discord
    if (schedule.sendToDiscord) {
      const msgId = await sendWarToDiscord(war);
      if (msgId) {
        await prisma.war.update({ where: { id: war.id }, data: { discordMessageId: msgId } });
      }
    }

    results.push({ id: schedule.id, name: schedule.name, action: `created war #${war.id}` });
  }

  return NextResponse.json({ ok: true, processed: results });
}
