export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a random 64-char hex token
  const token = crypto.randomBytes(32).toString("hex");

  // Token expires in 5 minutes
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Invalidate any existing unused tokens for this user
  await prisma.mobileToken.updateMany({
    where: { userId: session.user.id, used: false },
    data: { used: true },
  });

  // Create new token
  await prisma.mobileToken.create({
    data: {
      userId: session.user.id,
      token,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "https://aetherion.vercel.app";
  const loginUrl = `${baseUrl}/mobile-login?token=${token}`;

  return NextResponse.json({ token, loginUrl, expiresAt: expiresAt.toISOString() });
}
