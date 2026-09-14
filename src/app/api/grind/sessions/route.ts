export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { sonOturumlar, spotIstatistigi, canliMi } from "@/lib/grind";

/** /grind sayfasının canlı yenilemesi: son oturumlar + spot istatistiği */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const spotParam = url.searchParams.get("spot");
  const spotId = spotParam && Number.isInteger(Number(spotParam)) ? Number(spotParam) : null;
  const simdi = Date.now();
  const [oturumlar, istatistik] = await Promise.all([
    sonOturumlar(spotId),
    spotId ? spotIstatistigi(spotId) : null,
  ]);
  return NextResponse.json({
    serverTime: new Date(simdi).toISOString(),
    sessions: oturumlar.map((o) => ({ ...o, live: canliMi(o, simdi) })),
    stats: istatistik,
  }, { headers: { "Cache-Control": "no-store" } });
}
