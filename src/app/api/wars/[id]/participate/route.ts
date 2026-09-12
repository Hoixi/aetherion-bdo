export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { setParticipation } from "@/lib/war-participation";

/**
 * Katılım mantığı `lib/war-participation.ts`e taşındı: masaüstü uygulaması
 * da aynı kuralları kullanıyor, burada yalnızca oturum kapısı kaldı.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const r = await setParticipation(session.user.id, Number(params.id), body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r.participant);
}
