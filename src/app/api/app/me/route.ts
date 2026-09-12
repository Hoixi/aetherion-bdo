export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { withApp, APP_HEADERS } from "@/lib/app-gate";

export async function GET(req: Request) {
  return withApp(req, async (me) =>
    NextResponse.json({
      id: me.id, familyName: me.familyName, class: me.class, spec: me.spec,
      guildId: me.guildId, isAdmin: me.isAdmin, isGuildAdmin: me.isGuildAdmin,
    }, { headers: APP_HEADERS }));
}
