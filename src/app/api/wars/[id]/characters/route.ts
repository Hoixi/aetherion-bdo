export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BDO_CLASSES, hasClassVariants } from "@/lib/classes";

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

/**
 * Henüz partide olmayan üye için karakter seçimi (yönetici).
 *
 * Partideki üyenin seçimi PartyMember'da tutuluyor; havuzdaki üyenin partisi
 * olmadığı için seçim katılım kaydına (WarParticipant.asClass/asSpec)
 * yazılıyor. Partiye alınınca kart zaten bunu gösteriyor.
 *  PUT { userId, asClass, asSpec }  ·  asClass: null → üyenin kendi bildirimine dön
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const warId = Number(params.id);
  const b = (await req.json().catch(() => ({}))) as { userId?: number; asClass?: string | null; asSpec?: string | null };
  const userId = Number(b.userId);
  if (!Number.isInteger(userId)) return NextResponse.json({ error: "userId gerekli." }, { status: 400 });

  const [u, p] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { class: true, spec: true, characters: { select: { class: true, spec: true, pickable: true } } } }),
    prisma.warParticipant.findUnique({ where: { warId_userId: { warId, userId } }, select: { id: true } }),
  ]);
  if (!u || !p) return NextResponse.json({ error: "Üye bu savaşa katılmıyor." }, { status: 404 });

  let asClass: string | null = null, asSpec: string | null = null;
  if (b.asClass) {
    const cls = String(b.asClass);
    if (!BDO_CLASSES.some((c) => c.id === cls)) return NextResponse.json({ error: "Geçersiz class." }, { status: 400 });
    const spec = hasClassVariants(cls) && b.asSpec === "succession" ? "succession" : "awakening";
    const uygun = (u.class === cls && (u.spec || "awakening") === spec)
      || u.characters.some((c) => c.class === cls && c.spec === spec && c.pickable);
    if (!uygun) return NextResponse.json({ error: "Üye bu karakter için izin vermemiş." }, { status: 400 });
    asClass = cls; asSpec = spec;
  } else {
    // Seçim kaldırıldı: profilindeki karaktere dön
    asClass = u.class || null; asSpec = u.spec || "awakening";
  }
  await prisma.warParticipant.update({ where: { id: p.id }, data: { asClass, asSpec } });
  return NextResponse.json({ ok: true, asClass, asSpec });
}
