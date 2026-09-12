export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { iconUrl, urnId } from "@/lib/gamedata";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";

/**
 * OCR metnini gerçek eşyaya yaklaştırma.
 *
 * Grind tracker ekrandan "Elion Takipgisinin Migferi" okuyor; Türkçe
 * harfler dokulu zeminde düşüyor. pg_trgm benzerliği ile en yakın gerçek
 * ada oturtuluyor (mv_item üzerinde trigram indeks zaten var). Ölçüldü:
 * beş bozuk varyantın beşi de doğru eşyaya gitti.
 *
 * İkinci aday da dönüyor: kardeş eşyalarda ("X - Hükümran" varyantları)
 * fark daralabiliyor (0,60'a karşı 0,56); uygulama farka bakıp emin
 * değilse 2 karelik teyit bekliyor.
 */

const MIN_SIM = 0.35;

export async function GET(req: Request) {
  return withApp(req, async () => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
    if (q.length < 3) return appError("q en az 3 karakter.", 400);

    const rows = await prisma.$queryRaw<Array<{
      id: string; name: string; grade: number; icon: string | null; sim: number;
    }>>`
      select id, name, grade, icon, similarity(name, ${q})::float as sim
      from gamedata.mv_item
      order by name <-> ${q}
      limit 2
    `;

    const ilk = rows[0];
    if (!ilk || ilk.sim < MIN_SIM) {
      return NextResponse.json({ match: null, second: null }, { headers: APP_HEADERS });
    }
    const ikinci = rows[1];
    return NextResponse.json({
      match: { id: ilk.id, itemId: urnId(ilk.id), name: ilk.name, grade: ilk.grade,
               icon: iconUrl(ilk.icon), sim: Number(ilk.sim.toFixed(3)) },
      second: ikinci ? { name: ikinci.name, sim: Number(ikinci.sim.toFixed(3)) } : null,
    }, { headers: APP_HEADERS });
  });
}
