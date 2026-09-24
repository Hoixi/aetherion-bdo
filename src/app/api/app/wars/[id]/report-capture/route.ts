export const dynamic = "force-dynamic";
export const maxDuration = 60;
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { prisma } from "@/lib/prisma";
import { decodeReport, ReportConflict } from "@/lib/bdo-report-decoder";
import { canImportReports, reportWarScope, importReport } from "@/lib/bdo-report-import";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApp(req, async me => {
    if (!await canImportReports(me)) return appError("Rapor yüklemek yöneticiye özel.", 403);
    const warId = Number(params.id);
    if (!Number.isSafeInteger(warId) || warId <= 0) return appError("Geçersiz savaş.", 400);
    const war = await prisma.war.findFirst({ where: { id: warId, ...await reportWarScope(me), date: { lte: new Date() } }, select: { id: true } });
    if (!war) return appError("Savaş bulunamadı veya bu savaş için yetkiniz yok.", 404);
    // Bound the body even when Content-Length is missing or forged.
    const reader = req.body?.getReader();
    if (!reader) return appError("Rapor gerekli.", 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const {done,value} = await reader.read(); if (done) break;
        size += value.length;
        if (size > 100_000) { await reader.cancel(); return appError("Rapor çok büyük.",413); }
        chunks.push(value);
      }
    } catch { return appError("Rapor okunamadı.",400); }
    let report;
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      report = decodeReport(body.frameBase64, body.parserVersion);
    } catch (e) { return appError(e instanceof Error ? e.message : "Geçersiz rapor.",400); }
    try {
      return NextResponse.json(await importReport(warId, report, me), { headers: APP_HEADERS });
    } catch (e) {
      if (e instanceof ReportConflict) return appError(e.message,409);
      console.error("BDO report import failed", e instanceof Error ? e.name : "unknown");
      return appError("Rapor kaydedilemedi. Hiçbir satır değiştirilmedi; yeniden deneyebilirsiniz.",500);
    }
  });
}
