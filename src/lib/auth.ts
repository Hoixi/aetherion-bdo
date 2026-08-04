import { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { checkDiscordMembership } from "./discord";

const useSecure = process.env.NEXTAUTH_URL?.startsWith("https") ?? true;

export const authOptions: NextAuthOptions = {
  useSecureCookies: useSecure,
  cookies: {
    state: {
      name: "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecure,
        maxAge: 900,
      },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: useSecure,
        maxAge: 900,
      },
    },
  },
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
    maxAge: 30 * 24 * 60 * 60, // 30 gün
    updateAge: 7 * 24 * 60 * 60, // 7 günde bir yenile (her istekte değil)
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 gün
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
      // Sort: admin first, then by priority descending (higher = more specific role wins)
      const siteRoles = await prisma.siteRole.findMany({
        orderBy: [{ isAdmin: "desc" }, { priority: "desc" }],
      });
      let matchedRole: typeof siteRoles[0] | null = null;

      for (const siteRole of siteRoles) {
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

      // Discord rollerine göre klan tespiti — eşleşme yoksa ana klana düş
      const guilds = await prisma.guild.findMany({
        orderBy: { isPrimary: "asc" }, // ally'ler önce denenir, ana klan fallback kalır
      });
      let matchedGuildId: number | null = null;
      for (const g of guilds) {
        let ids: string[] = [];
        try {
          ids = JSON.parse(g.discordRoleIds || "[]");
        } catch {
          continue;
        }
        if (ids.length > 0 && ids.some((id) => roles.includes(id))) {
          matchedGuildId = g.id;
          break;
        }
      }
      const primaryGuild = guilds.find((g) => g.isPrimary);
      const guildId = matchedGuildId ?? existingUser?.guildId ?? primaryGuild?.id ?? null;

      await prisma.user.upsert({
        where: { discordId: user.id },
        update: {
          avatarUrl: user.image ?? "",
          isAdmin: newIsAdmin,
          siteRoleId: matchedRole?.id ?? existingUser?.siteRoleId ?? null,
          guildId,
        },
        create: {
          discordId: user.id,
          avatarUrl: user.image ?? "",
          isAdmin: newIsAdmin,
          siteRoleId: matchedRole?.id ?? null,
          guildId,
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
