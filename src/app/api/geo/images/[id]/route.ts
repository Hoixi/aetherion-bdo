import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// DELETE /api/geo/images/[id] — remove an image (admin only)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(params.id);

  await prisma.geoImage.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

// PATCH /api/geo/images/[id] — update hint / coords (admin only)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = Number(params.id);
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.hint !== undefined) data.hint = body.hint || null;
  if (body.mapX !== undefined) data.mapX = Number(body.mapX);
  if (body.mapY !== undefined) data.mapY = Number(body.mapY);

  const image = await prisma.geoImage.update({ where: { id }, data });

  return NextResponse.json(image);
}
