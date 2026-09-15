export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS } from "@/lib/app-gate";

/** Üye arama — sese misafir çağırırken (ad ile, en çok 20) */
export async function GET(req: Request) {
  return withApp(req, async (me) => {
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 40);
    const rows = await prisma.user.findMany({
      where: { deletedAt: null, id: { not: me.id }, familyName: q ? { contains: q, mode: "insensitive" } : { not: "" } },
      select: { id: true, familyName: true, class: true, guild: { select: { tag: true } } },
      orderBy: { familyName: "asc" },
      take: 20,
    });
    return NextResponse.json(rows.map((r) => ({ id: r.id, familyName: r.familyName, class: r.class, guild: r.guild?.tag ?? null })),
                             { headers: APP_HEADERS });
  });
}
