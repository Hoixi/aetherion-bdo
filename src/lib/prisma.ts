import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// connection_limit=1: Vercel'de her function instance ayrı process olduğundan
//   singleton pool'u paylaşamaz. 1'de tutmak N eşzamanlı invocation'ı
//   N bağlantıya indirger; shared hosting max_user_connections'ını aşmaz.
// pool_timeout=20: 20 sn içinde boş slot bulunamazsa hata ver
function buildUrl() {
  const base = process.env.DATABASE_URL ?? "";
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}connection_limit=1&pool_timeout=20`;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: { db: { url: buildUrl() } },
  });

// Hem dev hem production'da singleton tut
globalForPrisma.prisma = prisma;
