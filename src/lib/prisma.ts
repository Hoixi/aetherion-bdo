import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes("?") ? "&" : "?") + "connection_limit=1&pool_timeout=10",
      },
    },
  });

// Singleton'ı hem dev hem production'da sakla
globalForPrisma.prisma = prisma;
