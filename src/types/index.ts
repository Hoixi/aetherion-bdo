import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      discordId: string;
      isAdmin: boolean;
      familyName: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
