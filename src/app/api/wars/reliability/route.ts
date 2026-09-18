export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { guvenilirlikHesapla, GUVEN_PENCERE } from "@/lib/reliability";

/** Yalnızca yöneticiler — kimin gerçekten geldiğini üyeler görmesin */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ pencere: GUVEN_PENCERE, kisiler: await guvenilirlikHesapla() });
}
