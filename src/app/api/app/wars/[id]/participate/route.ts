export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS } from "@/lib/app-gate";
import { setParticipation } from "@/lib/war-participation";

/** Overlay'den tek tıkla katıl — siteyle birebir aynı kurallar. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return withApp(req, async (me) => {
    const body = await req.json().catch(() => ({}));
    const r = await setParticipation(me.id, Number(params.id), body);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json(r.participant, { headers: APP_HEADERS });
  });
}
