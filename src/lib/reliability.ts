import { prisma } from "@/lib/prisma";

/**
 * Katılım güvenilirliği — "katıl attı, seçildi, geldi mi?"
 *
 * Yalnızca hasar raporu yüklenmiş son N savaş sayılır; rapor yoksa kimin
 * geldiği bilinemez. Kişi başına: kaç savaşa katıl dedi, kaçında partiye
 * seçildi, seçildiklerinin kaçına geldi, kaçına gelmedi, kaç kez habersiz
 * geldi. Yüzde = geldi / seçildi. Parti kurarken ve aktivite listesinde
 * yalnızca yöneticilere gösterilir.
 */

export interface Guvenilirlik {
  /** hesaba giren savaş sayısı */
  savas: number;
  dedi: number;      // katıl attı
  secildi: number;   // partiye alındı
  geldi: number;     // seçildi ve raporda var
  gelmedi: number;   // seçildi, raporda yok
  habersiz: number;  // katıl demedi ama raporda var
  /** geldi/seçildi, 0–100; seçilme yoksa null */
  yuzde: number | null;
  /** en son geldiği savaşın tarihi */
  sonGeldi: string | null;
}

export const GUVEN_PENCERE = 10;

export async function guvenilirlikHesapla(pencere = GUVEN_PENCERE): Promise<Record<number, Guvenilirlik>> {
  const wars = await prisma.war.findMany({
    where: { date: { lt: new Date() }, performances: { some: {} } },
    orderBy: { date: "desc" },
    take: pencere,
    select: {
      id: true, date: true,
      participants: { select: { userId: true, status: true } },
      parties: { select: { members: { select: { userId: true } } } },
      performances: { select: { userId: true, inGameName: true } },
    },
  });
  const uyeler = await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, familyName: true } });
  const adIle = new Map(uyeler.map((u) => [u.familyName.toLocaleLowerCase("tr"), u.id]));

  const out: Record<number, Guvenilirlik> = {};
  const al = (id: number) => (out[id] ??= { savas: wars.length, dedi: 0, secildi: 0, geldi: 0, gelmedi: 0, habersiz: 0, yuzde: null, sonGeldi: null });

  for (const w of wars) {
    const dedi = new Set(w.participants.filter((p) => p.status === "ATTENDING").map((p) => p.userId));
    const secildi = new Set(w.parties.flatMap((p) => p.members.map((m) => m.userId)));
    const geldi = new Set<number>();
    for (const perf of w.performances) {
      const id = perf.userId ?? adIle.get(perf.inGameName.toLocaleLowerCase("tr"));
      if (id) geldi.add(id);
    }
    const herkes = new Set<number>([...Array.from(dedi), ...Array.from(secildi), ...Array.from(geldi)]);
    for (const id of Array.from(herkes)) {
      const g = al(id);
      if (dedi.has(id)) g.dedi++;
      if (secildi.has(id)) { g.secildi++; if (geldi.has(id)) g.geldi++; else g.gelmedi++; }
      else if (geldi.has(id) && !dedi.has(id)) g.habersiz++;
      if (geldi.has(id) && (!g.sonGeldi || w.date.toISOString() > g.sonGeldi)) g.sonGeldi = w.date.toISOString();
    }
  }
  for (const g of Object.values(out)) g.yuzde = g.secildi > 0 ? Math.round((g.geldi / g.secildi) * 100) : null;
  return out;
}
