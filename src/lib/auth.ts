import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { checkDiscordMembership } from "./discord";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "identify guilds.members.read",
        },
      },
    }),
    CredentialsProvider({
      id: "mobile-token",
      name: "Mobile Token",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.token) return null;

        const mobileToken = await prisma.mobileToken.findUnique({
          where: { token: credentials.token },
          include: { user: true },
        });

        if (!mobileToken) return null;
        if (mobileToken.used) return null;
        if (new Date() > mobileToken.expiresAt) return null;

        // Mark token as used
        await prisma.mobileToken.update({
          where: { id: mobileToken.id },
          data: { used: true },
        });

        // Return user with discordId as id (needed for session callback)
        return {
          id: mobileToken.user.discordId,
          name: mobileToken.user.familyName,
          image: mobileToken.user.avatarUrl,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      // Mobile token login - skip Discord checks (already verified on token creation)
      if (account?.provider === "mobile-token") {
        return true;
      }

      if (!account?.access_token) return false;

      const { hasRole, roles } = await checkDiscordMembership(account.access_token);
      if (!hasRole) return "/denied";

      // Find matching site role based on Discord role IDs
      const siteRoles = await prisma.siteRole.findMany();
      let matchedRole: typeof siteRoles[0] | null = null;

      // Priority: admin roles first, then non-admin
      const sortedRoles = [...siteRoles].sort((a, b) => (b.isAdmin ? 1 : 0) - (a.isAdmin ? 1 : 0));

      for (const siteRole of sortedRoles) {
        const discordIds: string[] = JSON.parse(siteRole.discordRoleIds || "[]");
        if (discordIds.length === 0) continue;
        if (discordIds.some((id) => roles.includes(id))) {
          matchedRole = siteRole;
          break;
        }
      }

      // Check if user already exists to preserve manual admin
      const existingUser = await prisma.user.findUnique({
        where: { discordId: user.id },
      });

      // isAdmin = true if role says admin OR user was already manually set as admin
      const newIsAdmin = matchedRole?.isAdmin || existingUser?.isAdmin || false;

      await prisma.user.upsert({
        where: { discordId: user.id },
        update: {
          avatarUrl: user.image ?? "",
          isAdmin: newIsAdmin,
          siteRoleId: matchedRole?.id ?? existingUser?.siteRoleId ?? null,
        },
        create: {
          discordId: user.id,
          avatarUrl: user.image ?? "",
          isAdmin: newIsAdmin,
          siteRoleId: matchedRole?.id ?? null,
        },
      });

      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { discordId: token.sub },
          include: { siteRole: true },
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.discordId = dbUser.discordId;
          session.user.isAdmin = dbUser.isAdmin;
          session.user.familyName = dbUser.familyName;
          session.user.role = dbUser.siteRole?.name ?? "Üye";
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/",
    error: "/denied",
  },
};
