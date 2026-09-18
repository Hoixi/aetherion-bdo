export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { guvenilirlikHesapla } from "@/lib/reliability";

/**
 * Üye aktivitesi (yönetici): siteye son geliş, uygulamada son görülme, son
 * savaş, son grind, forum/sohbet; hepsinin en yenisi "son görülme". Kick
 * kararında "14 gündür yok" listesi için.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [uyeler, guven] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true, familyName: true, class: true, ap: true, dp: true, lastSeenAt: true, createdAt: true,
        guild: { select: { tag: true, color: true } },
        siteRole: { select: { name: true, color: true } },
        appTokens: { select: { lastSeenAt: true }, orderBy: { lastSeenAt: "desc" }, take: 1 },
        grindSessions: { select: { lastSeenAt: true }, orderBy: { lastSeenAt: "desc" }, take: 1 },
        participations: { where: { status: "ATTENDING" }, select: { war: { select: { date: true } } }, orderBy: { war: { date: "desc" } }, take: 1 },
        warPerformances: { select: { war: { select: { date: true } } }, orderBy: { war: { date: "desc" } }, take: 1 },
        forumPosts: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        forumComments: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        chatMessages: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { familyName: "asc" },
    }),
    guvenilirlikHesapla(),
  ]);

  const simdi = Date.now();
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
  const enYeni = (...ds: Array<Date | null | undefined>) =>
    ds.filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const liste = uyeler.map((u) => {
    const site = u.lastSeenAt;
    const uygulama = u.appTokens[0]?.lastSeenAt ?? null;
    const grind = u.grindSessions[0]?.lastSeenAt ?? null;
    const savasGeldi = u.warPerformances[0]?.war.date ?? null;
    const savasDedi = u.participations[0]?.war.date ?? null;
    const forum = enYeni(u.forumPosts[0]?.createdAt, u.forumComments[0]?.createdAt, u.chatMessages[0]?.createdAt);
    // "Katıl" demek de bir işaret ama ileri tarihli savaşa katıl demek bugünü göstermez; geçmişse sayılır
    const son = enYeni(site, uygulama, grind, savasGeldi, forum, savasDedi && savasDedi.getTime() < simdi ? savasDedi : null);
    return {
      id: u.id, familyName: u.familyName, class: u.class, gs: u.ap + u.dp,
      guild: u.guild, siteRole: u.siteRole, uyelik: iso(u.createdAt),
      site: iso(site), uygulama: iso(uygulama), grind: iso(grind), savas: iso(enYeni(savasGeldi, savasDedi)), forum: iso(forum),
      son: iso(son), gun: son ? Math.floor((simdi - son.getTime()) / 86400_000) : null,
      guven: guven[u.id] ?? null,
    };
  });
  return NextResponse.json({ uyeler: liste });
}
