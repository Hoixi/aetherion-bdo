export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS } from "@/lib/app-gate";
import { raporuGetir } from "@/lib/performance-report";

/** En son oynanmış savaş (tarihi geçmiş en yeni) + hasar raporu */
export async function GET(req: Request) {
  return withApp(req, async () => {
    const w = await prisma.war.findFirst({ where: { date: { lte: new Date() } }, orderBy: { date: "desc" }, select: { id: true, title: true, date: true, result: true } });
    if (!w) return NextResponse.json({ war: null, report: null }, { headers: APP_HEADERS });
    return NextResponse.json({ war: w, report: await raporuGetir(w.id) }, { headers: APP_HEADERS });
  });
}
