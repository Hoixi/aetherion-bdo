export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { issuePairCode } from "@/lib/app-auth";

/** Sitede oturum açmış kullanıcı için eşleştirme kodu (5 dk, tek kullanım). */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await issuePairCode(session.user.id);
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}
