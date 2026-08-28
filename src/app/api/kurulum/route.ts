export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  listCrystals, listArtifacts, listLightstoneCombos, lightstoneAliases,
  listSkillClasses, listSkills, listAddonEffects,
} from "@/lib/gamedata";

/**
 * Kurulum ekranlarinin verisi tek uctan geliyor.
 *
 * Hepsi kucuk ve nadiren degisen listeler (kristal 168, eser+tas 143,
 * kombinasyon 167, eklenti 96) — sayfa acilisinda bir kez cekilip
 * istemcide filtreleniyor, her tikta sunucuya gidilmiyor.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const what = new URL(req.url).searchParams.get("ne") ?? "";
  const classKey = Number(new URL(req.url).searchParams.get("sinif")) || undefined;

  try {
    if (what === "kristal") {
      return NextResponse.json({ crystals: await listCrystals() });
    }
    if (what === "eser") {
      const [{ artifacts, lightstones }, combos, aliases] = await Promise.all([
        listArtifacts(), listLightstoneCombos(), lightstoneAliases(),
      ]);
      return NextResponse.json({ artifacts, lightstones, combos, aliases });
    }
    if (what === "beceri") {
      const [classes, skills, addons] = await Promise.all([
        listSkillClasses(),
        listSkills(classKey),
        listAddonEffects(),
      ]);
      return NextResponse.json({ classes, skills, addons });
    }
    return NextResponse.json({ error: "Bilinmeyen istek." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    if (/relation .*gamedata/.test(message)) {
      return NextResponse.json(
        { error: "Oyun verisi henüz yüklenmemiş." },
        { status: 503 },
      );
    }
    console.error("[kurulum] hata:", message);
    return NextResponse.json({ error: "Veri getirilemedi." }, { status: 500 });
  }
}
