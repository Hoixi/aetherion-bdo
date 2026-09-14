export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS } from "@/lib/app-gate";
import { aktifSpotlar } from "@/lib/grind";

/** Uygulamanın oturum açarken seçtiği spot listesi */
export async function GET(req: Request) {
  return withApp(req, async () =>
    NextResponse.json((await aktifSpotlar()).map((s) => ({ id: s.id, name: s.name, region: s.region })),
                      { headers: APP_HEADERS }));
}
