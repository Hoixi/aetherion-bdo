export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { islemeRapor, raporuGetir } from "@/lib/performance-report";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.canManageWars) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

    const warId = parseInt(params.id);
    if (isNaN(warId)) return NextResponse.json({ error: "Geçersiz savaş ID" }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get("image") as File | null;
    if (!file) return NextResponse.json({ error: "Resim bulunamadı" }, { status: 400 });
    const shouldClear = formData.get("clear") === "1";

    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const sonuc = await islemeRapor(warId, base64, file.type || "image/png", shouldClear);
    return NextResponse.json(sonuc);
  } catch (err: unknown) {
    console.error("Performance POST error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sunucu hatası oluştu" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.canManageWars) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

    const warId = parseInt(params.id);
    if (isNaN(warId)) return NextResponse.json({ error: "Geçersiz savaş ID" }, { status: 400 });

    const { count } = await prisma.warPerformance.deleteMany({ where: { warId } });
    return NextResponse.json({ success: true, deleted: count });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sunucu hatası" }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

    const warId = parseInt(params.id);
    if (isNaN(warId)) return NextResponse.json({ error: "Geçersiz savaş ID" }, { status: 400 });

    return NextResponse.json(await raporuGetir(warId));
  } catch (err: unknown) {
    console.error("Performance GET error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sunucu hatası oluştu" }, { status: 500 });
  }
}
