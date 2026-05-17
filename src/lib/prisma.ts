import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// connection_limit=3: shared hosting için yeterli, max_user_connections'a takılmaz
// pool_timeout=0: timeout fırlatmak yerine sonsuza kadar bekle (kuyrukta tut)
function buildUrl() {
  const base = process.env.DATABASE_URL ?? "";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}connection_limit=3&pool_timeout=0`;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: { db: { url: buildUrl() } },
  });

// Hem dev hem production'da singleton tut
globalForPrisma.prisma = prisma;
