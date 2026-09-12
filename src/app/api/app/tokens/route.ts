export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { listAppTokens, revokeAppToken } from "@/lib/app-auth";

/** Profildeki cihaz listesi ve iptal — site oturumuyla, uygulama anahtarıyla değil. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await listAppTokens(session.user.id));
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = (await req.json().catch(() => ({}))) as { id?: number };
  if (!id) return NextResponse.json({ error: "id gerekli." }, { status: 400 });
  const ok = await revokeAppToken(session.user.id, Number(id));
  return NextResponse.json({ ok });
}
