export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { prisma } from "@/lib/prisma";
import { canImportReports, reportWarScope } from "@/lib/bdo-report-import";

/** Capability check + paginated history for the report import wizard. */
export async function GET(req: Request) {
  return withApp(req, async me => {
    if (!await canImportReports(me)) return appError("Rapor yüklemek yöneticiye özel.", 403);
    const cursor = Number(new URL(req.url).searchParams.get("beforeId")) || undefined;
    const wars = await prisma.war.findMany({
      where: { ...await reportWarScope(me), date: { lte: new Date() }, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: "desc" }, take: 51,
      select: { id: true, title: true, date: true, type: true, isAllyWar: true },
    });
    return NextResponse.json({ wars: wars.slice(0,50), nextCursor: wars.length > 50 ? wars[49].id : null }, { headers: APP_HEADERS });
  });
}
