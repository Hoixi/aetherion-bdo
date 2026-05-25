import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";

export async function createMobileLoginLink(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await withDbRetry(() => prisma.mobileToken.updateMany({
    where: { userId, used: false },
    data: { used: true },
  }));

  await withDbRetry(() => prisma.mobileToken.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  }));

  const baseUrl = process.env.NEXTAUTH_URL || "https://aetherion-bdo.vercel.app";
  const loginUrl = `${baseUrl}/mobile-login?token=${token}`;

  return { token, loginUrl, expiresAt };
}
