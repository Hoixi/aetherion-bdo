export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Parti kurarken: katılan her üye için hangi karakterle gelebileceği.
 *  ana          → profildeki class/spec
 *  bildirdi     → katıl derken seçtiği (yoksa ana)
 *  alternatifler→ profilde tanımladığı diğer karakterler; pickable=false olanı
 *                 yönetici seçemez, sadece görür
 */
export interface KarakterBilgi {
  ana: { class: string; spec: string };
  bildirdi: { class: string; spec: string } | null;
  alternatifler: Array<{ class: string; spec: string; pickable: boolean }>;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const rows = await prisma.warParticipant.findMany({
    where: { warId: Number(params.id), status: "ATTENDING" },
    select: {
      userId: true, asClass: true, asSpec: true,
      user: { select: { class: true, spec: true, characters: { orderBy: { order: "asc" }, select: { class: true, spec: true, pickable: true } } } },
    },
  });
  const out: Record<number, KarakterBilgi> = {};
  for (const r of rows) {
    out[r.userId] = {
      ana: { class: r.user.class, spec: r.user.spec || "awakening" },
      bildirdi: r.asClass ? { class: r.asClass, spec: r.asSpec || "awakening" } : null,
      alternatifler: r.user.characters,
    };
  }
  return NextResponse.json(out);
}
