import { prisma } from "@/lib/prisma";
import { BDO_CLASSES } from "@/lib/classes";
import type { AppActor } from "@/lib/app-auth";
import { type DecodedReport, reportMergePlan } from "./bdo-report-decoder";

export async function canImportReports(me: AppActor) {
  if (!me.isAdmin && (!me.isGuildAdmin || me.guildId === null)) return false;
  return true;
}
export async function reportWarScope(me: AppActor) {
  if (me.isAdmin) return {};
  const guild = me.guildId ? await prisma.guild.findUnique({ where: { id: me.guildId }, select: { isPrimary: true } }) : null;
  return guild?.isPrimary ? {} : { isAllyWar: true as const };
}

export async function importReport(warId: number, report: DecodedReport, me: AppActor) {
  return prisma.$transaction(async tx => {
    // Serialize imports to this war: an ally upload and our upload cannot race
    // the identity lookup or produce duplicate case-variant rows.
    await tx.$queryRaw`SELECT id FROM wars WHERE id = ${warId} FOR UPDATE`;
    const [existing, users] = await Promise.all([
      tx.warPerformance.findMany({ where: { warId } }),
      tx.user.findMany({ select: { id: true, familyName: true, guildId: true } }),
    ]);
    const plan = reportMergePlan(report.rows, existing, users, me);
    let created = 0, updated = 0;
    for (const {row, previous, user} of plan) {
      const cls = BDO_CLASSES.find(c => c.classType === row.classKey);
      const spec = row.specKey === 1 ? "awakening" : row.specKey === 2 ? "succession" : undefined;
      const data = {
        ...row.stats,
        ...(cls ? { class: cls.id } : {}), ...(spec ? { spec } : {}),
        ...(user ? { userId: user.id } : {}),
        reportGuildId: me.guildId, reportUploadedBy: me.id, reportUpdatedAt: new Date(),
        reportData: { version: report.version, headerBase64: report.headerBase64,
          rawRecordBase64: row.rawRecordBase64, counters: row.counters,
          classKey: row.classKey, specKey: row.specKey,
          unresolvedFields: ["cannonHits", "cannonDestroys", "cannonMaxRange"] },
      };
      if (previous) {
        await tx.warPerformance.update({ where: { id: previous.id }, data }); updated++;
      } else {
        await tx.warPerformance.create({ data: { warId, inGameName: row.familyName, ...data } }); created++;
      }
    }
    return { total: plan.length, created, updated, preserved: existing.length - updated };
  }, { maxWait: 10000, timeout: 30000 });
}
