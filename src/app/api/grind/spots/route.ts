export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { aktifSpotlar } from "@/lib/grind";

/** /grind sekmeleri */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json((await aktifSpotlar()).map((s) => ({ id: s.id, name: s.name, region: s.region })));
}
