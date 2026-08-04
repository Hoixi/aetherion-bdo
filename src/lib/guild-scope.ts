import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";

export type GuildScope = {
  userId: number;
  guildId: number | null;
  /** Site geneli tam yetki — tüm klanları görür ve yönetir */
  isAdmin: boolean;
  /** Klan yöneticisi — sadece kendi klanını yönetir, savaş/parti düzenleyebilir */
  isGuildAdmin: boolean;
  /** Savaş açma, düzenleme, parti kurma yetkisi */
  canManageWars: boolean;
};

/**
 * Oturum sahibinin klanını ve yetki seviyesini döner.
 *
 * Yetki seviyeleri:
 *   - isAdmin      → her şey, tüm klanlar
 *   - isGuildAdmin → savaş + parti yönetimi, kendi klanının üyeleri
 *   - (hiçbiri)    → sadece görüntüleme, kendi klanı
 *
 * null dönerse oturum yok; çağıran 401 vermelidir.
 */
export async function getGuildScope(): Promise<GuildScope | null> {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, guildId: true, isAdmin: true, isGuildAdmin: true },
  });
  if (!user) return null;

  return {
    userId: user.id,
    guildId: user.guildId,
    isAdmin: user.isAdmin,
    isGuildAdmin: user.isGuildAdmin,
    canManageWars: user.isAdmin || user.isGuildAdmin,
  };
}

/** Bu kullanıcı hedef klanın üyelerini yönetebilir mi? */
export function canManageGuild(scope: GuildScope, targetGuildId: number | null): boolean {
  if (scope.isAdmin) return true;
  return scope.isGuildAdmin && targetGuildId === scope.guildId;
}

/**
 * Prisma `where` parçası — kullanıcının klanına kilitler.
 * Klansız kullanıcılar (guildId null) sadece kendi klansız gruplarını görür.
 */
export function guildFilter(guildId: number | null) {
  return { guildId };
}
