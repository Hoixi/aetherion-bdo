export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/app-gate";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApp, APP_HEADERS, appError } from "@/lib/app-gate";
import { BDO_CLASSES } from "@/lib/classes";

/**
 * Skill numaralarından sınıf.
 *
 * Oyunun önbelleği (`UserCache/.../gamevariable.xml`) karakterlerin hızlı
 * yuva skill numaralarını içeriyor; skill'ler sınıfa özel. Uygulama
 * numaraları yollar, burada gamedata `class_skill_groups.ranks[].skillNo`
 * ile eşlenip çoğunluk sınıfı döner. Ortak skill'ler (birden çok sınıf)
 * oy vermez.
 *
 * Not: dosyaların değişme zamanı AKTİF karakteri göstermiyor (girişte
 * sunucudan gelen önbellek paketi açılırken yazılıyorlar); bu uç bir dosyanın
 * hangi sınıfa ait olduğunu söyler, "şu an hangi karakter" sorusunu değil.
 */
export async function GET(req: Request) {
  return withApp(req, async () => {
    const ham = (new URL(req.url).searchParams.get("skills") ?? "").split(",").map(Number)
      .filter((n) => Number.isInteger(n) && n > 0).slice(0, 64);
    if (ham.length === 0) return appError("skills gerekli.", 400);

    const rows = await prisma.$queryRaw<Array<{ classes: number[] }>>`
      select e.data -> 'classes' as classes
      from gamedata.entity e, jsonb_array_elements(e.data -> 'ranks') r
      where e.dataset = 'class_skill_groups' and e.removed_at_patch is null
        and (r ->> 'skillNo')::int = any(${ham}::int[])
    `;
    const oy = new Map<number, number>();
    for (const r of rows) {
      if (!Array.isArray(r.classes) || r.classes.length !== 1) continue;
      oy.set(r.classes[0], (oy.get(r.classes[0]) ?? 0) + 1);
    }
    const enIyi = Array.from(oy.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!enIyi) return NextResponse.json({ classKey: null, name: null, id: null }, { headers: APP_HEADERS });

    // `classes` dizisi BDO_CLASSES.classType numaralandırması (ölçüldü: 21 = Maehwa,
    // 34 = Deadeye) — character_classes.characterKey DEĞİL (orada 21 = Musa).
    const site = BDO_CLASSES.find((c) => c.classType === enIyi[0]) ?? null;
    return NextResponse.json({ classKey: enIyi[0], name: site?.name ?? null, id: site?.id ?? null, votes: enIyi[1] }, { headers: APP_HEADERS });
  });
}
