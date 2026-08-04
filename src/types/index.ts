import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      discordId: string;
      isAdmin: boolean;
      isGuildAdmin: boolean;
      /** Savaş açma / parti düzenleme yetkisi (isAdmin || isGuildAdmin) */
      canManageWars: boolean;
      guild: { id: number; name: string; tag: string; color: string } | null;
      familyName: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
