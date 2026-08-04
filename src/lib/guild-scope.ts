import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export type GuildScope = {
  userId: number;
  guildId: number | null;
  isAdmin: boolean;
};

/**
 * Oturum sahibinin klanını döner. Tüm istatistik/liste endpoint'leri
 * bunu kullanarak kendi klanına filtreler — klanlar birbirinin verisini görmez.
 * Ortak (ally) veriler için `/api/ally/*` endpoint'leri kullanılır.
 *
 * null dönerse oturum yok demektir; çağıran 401 vermelidir.
 */
export async function getGuildScope(): Promise<GuildScope | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, guildId: true, isAdmin: true },
  });
  if (!user) return null;

  return { userId: user.id, guildId: user.guildId, isAdmin: user.isAdmin };
}

/**
 * Prisma `where` parçası — kullanıcının klanına kilitler.
 * Klansız kullanıcılar (guildId null) sadece kendi klansız gruplarını görür.
 */
export function guildFilter(guildId: number | null) {
  return { guildId };
}
