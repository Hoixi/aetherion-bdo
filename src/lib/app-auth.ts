import crypto from "crypto";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

/**
 * Masaüstü uygulamasının kimliği.
 *
 * Akış, TV uygulamalarındaki gibi:
 *  1. Kullanıcı sitede oturum açmışken 6 haneli bir kod alır (5 dk, tek kullanım)
 *  2. Kodu uygulamaya yazar; uygulama kodu kalıcı anahtara çevirir
 *  3. Uygulama her istekte `Authorization: Bearer <anahtar>` gönderir
 *
 * Ham anahtar veritabanına yazılmıyor; SHA-256 özeti tutuluyor. Mevcut
 * `MobileToken` bunun için uygun değildi: o, telefondan siteye girmek için
 * 5 dakikalık tek seferlik bir bağlantı, her istekte sunulacak bir anahtar
 * değil.
 */

const KOD_OMRU_MS = 5 * 60 * 1000;
/** Karisan karakterler yok (0/O, 1/I): telefondan bakip yazan sasirmasin */
const KOD_ALFABE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

function rastgeleKod(): string {
  const bayt = crypto.randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += KOD_ALFABE[bayt[i] % KOD_ALFABE.length];
  return s;
}

/** Sitede oturum açmış kullanıcı için yeni eşleştirme kodu */
export async function issuePairCode(userId: number) {
  // Eski bekleyen kodlar gecersiz olsun: ayni anda iki kod dolasmasin
  await prisma.appPairCode.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  // Benzersizlik carpismasi olasi ama nadir; birkac deneme yeter
  for (let deneme = 0; deneme < 5; deneme++) {
    const code = rastgeleKod();
    try {
      const row = await prisma.appPairCode.create({
        data: { userId, code, expiresAt: new Date(Date.now() + KOD_OMRU_MS) },
      });
      return { code: row.code, expiresAt: row.expiresAt };
    } catch {
      /* unique carpismasi -> yeniden dene */
    }
  }
  throw new Error("Eşleştirme kodu üretilemedi.");
}

/**
 * Uygulama kodu sunar, karşılığında kalıcı anahtar alır.
 * Ham anahtar yalnızca burada, bir kez dönüyor.
 */
export async function redeemPairCode(code: string, label: string) {
  const temiz = code.trim().toUpperCase();
  const row = await prisma.appPairCode.findUnique({ where: { code: temiz } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;

  const raw = crypto.randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.appPairCode.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.appToken.create({
      data: { userId: row.userId, tokenHash: hashToken(raw), label: label.slice(0, 60) },
    }),
  ]);
  return { token: raw, userId: row.userId };
}

export interface AppActor {
  id: number;
  familyName: string;
  class: string;
  spec: string;
  guildId: number | null;
  isAdmin: boolean;
  isGuildAdmin: boolean;
  tokenId: number;
}

/**
 * `Authorization: Bearer <anahtar>` başlığından kullanıcıyı çözer.
 * Anahtar yoksa / iptal edildiyse / kullanıcı silindiyse null.
 */
export async function authenticateApp(req: Request): Promise<AppActor | null> {
  const baslik = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+([a-f0-9]{64})$/i.exec(baslik);
  // Anahtar yoksa site oturumu: tarayıcıdaki sesli sohbet (/ses) aynı uçları
  // çerezle kullanıyor. Yazma uçları için CSRF'i NextAuth'un SameSite=Lax
  // çerezi karşılıyor; kökene bağlı kalmak için Bearer'sız istekte tokenId 0.
  if (!m) return oturumdanAktor();

  const row = await prisma.appToken.findUnique({
    where: { tokenHash: hashToken(m[1]) },
    include: {
      user: {
        select: {
          id: true, familyName: true, class: true, spec: true, guildId: true,
          isAdmin: true, isGuildAdmin: true, deletedAt: true,
        },
      },
    },
  });
  if (!row || row.revokedAt || row.user.deletedAt) return null;

  // "Son görülme" — profildeki cihaz listesi için; her istekte yazmak
  // pahalı degil ama gereksiz, dakikada bir yeter.
  if (!row.lastSeenAt || Date.now() - row.lastSeenAt.getTime() > 60_000) {
    prisma.appToken.update({ where: { id: row.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  const u = row.user;
  return {
    id: u.id, familyName: u.familyName, class: u.class, spec: u.spec,
    guildId: u.guildId, isAdmin: u.isAdmin, isGuildAdmin: u.isGuildAdmin,
    tokenId: row.id,
  };
}

async function oturumdanAktor(): Promise<AppActor | null> {
  const session = await getServerSession(authOptions).catch(() => null);
  if (!session?.user?.id) return null;
  const u = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, familyName: true, class: true, spec: true, guildId: true, isAdmin: true, isGuildAdmin: true, deletedAt: true },
  });
  if (!u || u.deletedAt) return null;
  return { id: u.id, familyName: u.familyName, class: u.class, spec: u.spec, guildId: u.guildId, isAdmin: u.isAdmin, isGuildAdmin: u.isGuildAdmin, tokenId: 0 };
}

export async function revokeAppToken(userId: number, tokenId: number) {
  // Yalnizca kendi anahtarini iptal edebilsin
  const r = await prisma.appToken.updateMany({
    where: { id: tokenId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r.count > 0;
}

export async function listAppTokens(userId: number) {
  return prisma.appToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, label: true, lastSeenAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}
