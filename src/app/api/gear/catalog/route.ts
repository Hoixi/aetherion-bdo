export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { iconUrl, urnId } from "@/lib/gamedata";
import {
  EXCLUDE, FAMILIES, WEAPON_SLOTS, ARMOR_SLOTS, ACC_SLOTS, STONE_SLOT,
  type GearItem,
} from "@/lib/gear";

/**
 * Kuşanım kataloğu: test ekranındaki ailelerin parçaları.
 *
 * `gamedata` salt okunur; sorgu `entity` üzerinden gidiyor çünkü
 * `equipInfo.slot` ve `classes` dar `v_item` görünümünde yok.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string; name: string; grade: number; icon: string | null;
      slot: number; max_enhance: number; classes: string[] | null;
    }>>`
      select e.entity_id                                   as id,
             n.name                                        as name,
             (e.data->>'grade')::int                       as grade,
             e.data->>'icon'                               as icon,
             (e.data->'equipInfo'->>'slot')::int           as slot,
             (e.data->>'maxEnhance')::int                  as max_enhance,
             case when jsonb_typeof(e.data->'classes')='array'
                  then array(select jsonb_array_elements_text(e.data->'classes'))
             end                                           as classes
      from gamedata.entity e
      join gamedata.entity_name n
        on n.dataset='items' and n.entity_id=e.entity_id and n.locale='tr'
      where e.dataset='items'
        and e.data->'equipInfo' is not null
        and (e.data->>'maxEnhance')::int >= 0
        and not (n.name like any (${EXCLUDE}))
        and (
          -- Her yuva grubu yalnizca kendi ailelerini gorsun: zirh
          -- yuvasinda KaraYildiz silahi cikmasin diye ayri ayri.
          ((e.data->'equipInfo'->>'slot')::int = any (${WEAPON_SLOTS})
             and (e.data->>'maxEnhance')::int > 0
             and n.name like any (${FAMILIES.weapon}))
          or ((e.data->'equipInfo'->>'slot')::int = any (${ARMOR_SLOTS})
             and (e.data->>'maxEnhance')::int > 0
             and n.name like any (${FAMILIES.armor}))
          or ((e.data->'equipInfo'->>'slot')::int = any (${ACC_SLOTS})
             and (e.data->>'maxEnhance')::int > 0
             and n.name like any (${FAMILIES.acc}))
          or ((e.data->'equipInfo'->>'slot')::int = ${STONE_SLOT}
             and (e.data->>'grade')::int >= 4)
        )
      order by n.name
    `;

    /**
     * Aynı ad birden çok kimlikle geliyor (ör. Ölen Tanrının Zırhı 719898
     * ve 930902). Ekranda tek satır dursun diye ad+yuva başına en küçük
     * kimlik tutuluyor.
     */
    const teklestir = new Map<string, GearItem>();
    for (const r of rows) {
      const anahtar = `${r.slot}|${r.name}`;
      const mevcut = teklestir.get(anahtar);
      const aday: GearItem = {
        id: r.id,
        itemId: urnId(r.id),
        name: r.name,
        grade: r.grade ?? 0,
        icon: iconUrl(r.icon),
        slot: r.slot,
        maxEnhance: r.max_enhance ?? 0,
        classes: r.classes && r.classes.length ? r.classes : null,
      };
      if (!mevcut || aday.itemId < mevcut.itemId) teklestir.set(anahtar, aday);
    }

    // Array.from: proje ES5 hedefliyor, Map/Set dogrudan yayilamiyor.
    const items = Array.from(teklestir.values());

    // Silahlardaki sinif etiketleri ekrandaki sinif secicisini besliyor
    const classes = Array.from(
      new Set(items.reduce<string[]>((a, i) => a.concat(i.classes ?? []), [])),
    ).sort();

    return NextResponse.json({ items, classes });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    if (/relation .*gamedata/.test(message)) {
      return NextResponse.json(
        { error: "Eşya veritabanı henüz yüklenmemiş (gamedata şeması yok)." },
        { status: 503 },
      );
    }
    console.error("[gear] katalog hatasi:", message);
    return NextResponse.json({ error: "Katalog getirilemedi." }, { status: 500 });
  }
}
