import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const IMGBB_KEY = process.env.IMGBB_API_KEY;

// POST /api/geo/upload
// Body: FormData with field "image" (File)
// Returns: { url: string, deleteUrl: string }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!IMGBB_KEY) {
    return NextResponse.json({ error: "IMGBB_API_KEY env değişkeni eksik" }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("image") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });
  }

  // ImgBB expects base64 or binary via form-data
  const imgbbForm = new FormData();
  imgbbForm.append("key", IMGBB_KEY);
  imgbbForm.append("image", file);

  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: imgbbForm,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("ImgBB error:", err);
    return NextResponse.json({ error: "ImgBB yüklemesi başarısız" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({
    url: data.data.url as string,
    deleteUrl: data.data.delete_url as string,
  });
}
