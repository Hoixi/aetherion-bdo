export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createMobileLoginLink } from "@/lib/mobile-login-token";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, loginUrl, expiresAt } = await createMobileLoginLink(session.user.id);

  return NextResponse.json({ token, loginUrl, expiresAt: expiresAt.toISOString() });
}
