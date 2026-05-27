import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Supabase PgBouncer (transaction mode) + Vercel serverless için önerilen ayar:
// pgbouncer=true → Prisma'nın prepared statement'ları devre dışı bırakır
// connection_limit=1 artık gerekmiyor — Supabase pooler hallediyor
// DATABASE_URL zaten ?pgbouncer=true içermeli (Supabase'den kopyalanan URL)
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient();

globalForPrisma.prisma = prisma;
