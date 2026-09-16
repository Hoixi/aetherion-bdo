export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { anonsAnahtari, livekitAyar } from "@/lib/livekit";

/**
 * Anons odası anahtarı. Uygulama bir odaya girerken buna da bağlanır;
 * yöneticiler (admin / klan yöneticisi) "tüm odalara konuş" ile buradan
 * yayınlar, herkes dinler. Aynı odadakiler yayını iki kez duymasın diye
 * eşleme uygulama tarafında (ses.ts).
 */
export async function POST(req: Request) {
  return withApp(req, async (me) => {
    if (!livekitAyar()) return appError("Sesli sohbet sunucusu ayarlı değil.", 503);
    const t = await anonsAnahtari(me, me.isAdmin || me.isGuildAdmin);
    return NextResponse.json(t, { headers: APP_HEADERS });
  });
}
