export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Tek seferlik: forum_posts.content kolonunu TEXT → LONGTEXT olarak yükseltir
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE forum_posts MODIFY COLUMN content LONGTEXT NOT NULL"
    );
    return NextResponse.json({ ok: true, message: "forum_posts.content başarıyla LONGTEXT olarak güncellendi." });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Zaten LONGTEXT ise hata vermez, sadece bilgi döner
    if (msg.includes("doesn't exist") || msg.includes("LONGTEXT")) {
      return NextResponse.json({ ok: true, message: "Zaten güncel." });
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
