import { prisma } from "@/lib/prisma";

/**
 * Oyun verisi sorgu katmani.
 *
 * Veri `gamedata` semasinda duruyor ve PAZ boru hatti tarafindan yaziliyor
 * (bkz. Documents/PAZ). Site burayi SADECE OKUR.
 *
 * Neden Prisma modeli degil de $queryRaw: gamedata ayri bir sema ve Prisma'da
 * multiSchema'yi acmak mevcut 36 modelin hepsine @@schema eklemeyi zorunlu
 * kiliyor. Ham SQL, mevcut semaya hic dokunmadan ayni baglantiyi kullaniyor.
 *
 * Govde `jsonb` cunku extractor her surumde alan degistiriyor; buradaki
 * yardimcilar alan eksikligine dayanikli yazildi.
 */

// Ikonlar uygulamanin kendi public/ klasorunde duruyor (PAZ boru hattindaki
// scripts/tools/copy-icons.mjs koyuyor). Degisken sadece ileride bir CDN'e
// tasinirsa gerekir; bos birakilirsa uygulama kendi yolunu kullanir.
const ICON_BASE = process.env.NEXT_PUBLIC_ITEM_ICON_BASE ?? "/item-icons";

export type Locale = "tr" | "en";

export interface ItemSummary {
  id: string;            // urn::item:10010
  itemId: number;        // 10010
  name: string;
  nameEn: string | null;
  grade: number;
  icon: string | null;
  slot: string | null;
  marketCategory: string | null;
}

export interface ItemLink {
  id: string;
  name: string;
  grade: number;
  icon: string | null;
  count?: number;        // recipe girdilerinde adet
  note?: string;         // "Kuşatma Silah Atölyesi" gibi baglam
}

export interface ItemGroup {
  key: string;
  title: string;
  hint?: string;
  items: ItemLink[];
}

/** "New_Icon/00000001_Special.dds" -> "<base>/new_icon/00000001_special.webp" */
export function iconUrl(icon: string | null | undefined): string | null {
  if (!icon) return null;
  const path = icon.replace(/\.dds$/i, ".webp").toLowerCase().replace(/\\/g, "/");
  return `${ICON_BASE.replace(/\/$/, "")}/${path}`;
}

/** urn::item:10010 -> 10010 */
export const urnId = (urn: string): number => Number(urn.split(":").pop() ?? 0);

const db = prisma;

// ── Liste / arama ───────────────────────────────────────────────────────────

export interface SearchParams {
  q?: string;
  grade?: number;
  slot?: string;
  marketCategory?: string;
  locale?: Locale;
  limit?: number;
  offset?: number;
  /** Varyant ve hayalet kopyalari da getir (varsayilan: hayir) */
  includeVariants?: boolean;
}

export async function searchItems(p: SearchParams) {
  const locale = p.locale ?? "tr";
  const limit = Math.min(p.limit ?? 60, 200);
  const offset = Math.max(p.offset ?? 0, 0);
  const q = p.q?.trim() || null;

  // Sorgu dar `mv_item` gorunumune gidiyor, `entity` tablosuna degil: oradaki
  // satirlar 955 bayt (jsonb govde) ve filtresiz liste 512 ms suruyordu.
  // Gorunum her yuklemeden sonra boru hatti tarafindan yeniden kuruluyor.
  const rows = await db.$queryRaw<Array<{
    id: string; name: string; name_tr: string | null; name_en: string | null; grade: number;
    icon: string | null; slot: string | null; market_category: string | null; total: bigint;
  }>>`
    select m.id, m.name, m.name_tr, m.name_en, m.grade, m.icon, m.slot,
           m.market_category, count(*) over () as total
    from gamedata.mv_item m
    where (${q}::text is null
           or m.name ilike '%' || ${q}::text || '%'
           or m.name_en ilike '%' || ${q}::text || '%')
      and (${p.grade ?? null}::int is null or m.grade = ${p.grade ?? null}::int)
      and (${p.slot ?? null}::text is null or m.slot = ${p.slot ?? null}::text)
      and (${p.marketCategory ?? null}::text is null
           or m.market_category = ${p.marketCategory ?? null}::text)
    order by
      -- Aramada alaka onde: "kzarka" arayan Kzarka Asa'yi bekler, "Baskin Benlik
      -- Kzarka Cagirma Parsomeni"ni degil.
      case
        when ${q}::text is null then 0
        when lower(m.name) = lower(${q}::text) then 0
        when m.name ilike ${q}::text || '%' then 1
        when m.name ilike '% ' || ${q}::text || '%' then 2
        else 3
      end,
      -- Uzunluk siralamasi SADECE aramada anlamli ("Kara Tas" < "Kara Tas Paketi").
      -- Aramasiz listede uygulaninca ilk sayfa "Ag, Ok, Ot, Bal, Tuz" oluyordu;
      -- bos listede dogru siralama alfabetik.
      case when ${q}::text is null then 0 else length(m.name) end,
      m.name
    limit ${limit} offset ${offset}
  `;

  const total = rows.length > 0 ? Number(rows[0].total) : 0;
  return {
    total,
    items: rows.map<ItemSummary>((r) => ({
      id: r.id,
      itemId: urnId(r.id),
      // Istenen dil yoksa gorunumdeki birlesik ada duser.
      name: (locale === "en" ? r.name_en : r.name_tr) ?? r.name,
      nameEn: r.name_en,
      grade: r.grade ?? 0,
      icon: iconUrl(r.icon),
      slot: r.slot,
      marketCategory: r.market_category,
    })),
  };
}

/** Filtre acilirlarini gercek veriden uretir - elle liste tutmaya gerek yok. */
export async function itemFacets(locale: Locale = "tr") {
  void locale;
  const [categories, slots] = await Promise.all([
    db.$queryRaw<Array<{ value: string; n: bigint }>>`
      select market_category as value, count(*) as n from gamedata.mv_item
      where market_category is not null group by 1 order by n desc limit 40
    `,
    db.$queryRaw<Array<{ value: string; n: bigint }>>`
      select slot as value, count(*) as n from gamedata.mv_item
      where slot is not null group by 1 order by n desc limit 40
    `,
  ]);
  return {
    marketCategories: categories.map((c) => ({ value: c.value, count: Number(c.n) })),
    slots: slots.map((s2) => ({ value: s2.value, count: Number(s2.n) })),
  };
}

// ── Tek item ────────────────────────────────────────────────────────────────

export interface ItemDetail extends ItemSummary {
  description: string | null;
  descriptionEn: string | null;
  data: Record<string, unknown>;
  groups: ItemGroup[];
}

/** Bir grup urn icin isim + grade + ikon toplar; sirali dondurur. */
async function hydrate(urns: string[], locale: Locale): Promise<Map<string, ItemLink>> {
  const map = new Map<string, ItemLink>();
  if (urns.length === 0) return map;

  const rows = await db.$queryRaw<Array<{
    id: string; name: string | null; grade: number; icon: string | null;
  }>>`
    select e.entity_id as id,
           coalesce(n.name, en.name)   as name,
           (e.data ->> 'grade')::int   as grade,
           e.data ->> 'icon'           as icon
    from gamedata.entity e
    left join gamedata.entity_name n
      on n.dataset = 'items' and n.entity_id = e.entity_id and n.locale = ${locale}
    left join gamedata.entity_name en
      on en.dataset = 'items' and en.entity_id = e.entity_id and en.locale = 'en'
    where e.dataset = 'items' and e.entity_id = any(${urns}::text[])
  `;
  for (const r of rows) {
    map.set(r.id, {
      id: r.id,
      name: r.name ?? r.id,
      grade: r.grade ?? 0,
      icon: iconUrl(r.icon),
    });
  }
  return map;
}

interface RecipeRow { entity_id: string; data: Record<string, unknown> }

/**
 * Bir item'in tum bagli item'lerini toplar.
 * Iliskiler iki yonlu: "neyden yapilir" kadar "nerede kullanilir" da onemli -
 * ikincisi jsonb containment ile GIN index'ten geliyor (olculdu: ~3 ms).
 */
export async function itemRelations(urn: string, locale: Locale = "tr"): Promise<ItemGroup[]> {
  const item = await db.$queryRaw<Array<{ data: Record<string, unknown> }>>`
    select data from gamedata.entity where dataset = 'items' and entity_id = ${urn}
  `;
  if (item.length === 0) return [];
  const data = item[0].data;

  const [madeFrom, usedIn, variants] = await Promise.all([
    db.$queryRaw<RecipeRow[]>`
      select entity_id, data from gamedata.entity
      where dataset = 'recipes' and data ->> 'output' = ${urn} limit 30
    `,
    db.$queryRaw<RecipeRow[]>`
      select entity_id, data from gamedata.entity
      where dataset = 'recipes'
        and data @> ${JSON.stringify({ inputs: [{ item: urn }] })}::jsonb
      limit 60
    `,
    db.$queryRaw<Array<{ entity_id: string }>>`
      select entity_id from gamedata.entity
      where dataset = 'items' and data ->> 'variantOf' = ${urn} limit 40
    `,
  ]);

  // Hidrasyon icin gereken tum urn'leri tek seferde topla.
  const wanted = new Set<string>();
  const inputsOf = (r: RecipeRow) =>
    (r.data.inputs as Array<{ item: string; count?: number }> | undefined) ?? [];

  for (const r of madeFrom) for (const i of inputsOf(r)) wanted.add(i.item);
  for (const r of usedIn) wanted.add(String(r.data.output ?? ""));
  for (const v of variants) wanted.add(v.entity_id);
  for (const key of ["variantOf", "reformsFrom", "reformsInto"]) {
    const v = data[key];
    if (typeof v === "string") wanted.add(v);
  }
  wanted.delete("");
  wanted.delete(urn);

  const names = await hydrate(Array.from(wanted), locale);
  const link = (id: string, extra?: Partial<ItemLink>): ItemLink =>
    ({ ...(names.get(id) ?? { id, name: id, grade: 0, icon: null }), ...extra });

  const groups: ItemGroup[] = [];

  if (madeFrom.length) {
    // Ayni item birden fazla tarifle uretilebiliyor; her tarif kendi grubu.
    for (const r of madeFrom) {
      const station = (r.data.station as string) ?? (r.data.type as string) ?? "Üretim";
      groups.push({
        key: `made:${r.entity_id}`,
        title: "Yapımı",
        hint: station,
        items: inputsOf(r).map((i) => link(i.item, { count: i.count })),
      });
    }
  }

  if (usedIn.length) {
    const seen = new Set<string>();
    const items: ItemLink[] = [];
    for (const r of usedIn) {
      const out = String(r.data.output ?? "");
      if (!out || seen.has(out)) continue;
      seen.add(out);
      items.push(link(out, { note: (r.data.station as string) ?? undefined }));
    }
    groups.push({ key: "used", title: "Nerede kullanılır", hint: `${items.length} tarif`, items });
  }

  const chain: ItemLink[] = [];
  for (const [key, label] of [["reformsFrom", "dönüşür ←"], ["reformsInto", "dönüşür →"]] as const) {
    const v = data[key];
    if (typeof v === "string") chain.push(link(v, { note: label }));
  }
  if (chain.length) groups.push({ key: "reform", title: "Dönüşüm", items: chain });

  if (typeof data.variantOf === "string") {
    groups.push({ key: "canonical", title: "Ana kayıt", items: [link(data.variantOf as string)] });
  }
  if (variants.length) {
    groups.push({
      key: "variants",
      title: "Varyantlar",
      hint: `${variants.length} kopya`,
      items: variants.map((v) => link(v.entity_id)),
    });
  }

  return groups.filter((g) => g.items.length > 0);
}

export async function getItem(urn: string, locale: Locale = "tr"): Promise<ItemDetail | null> {
  const rows = await db.$queryRaw<Array<{
    id: string; data: Record<string, unknown>;
    name: string | null; description: string | null;
    name_en: string | null; description_en: string | null;
  }>>`
    select e.entity_id as id, e.data,
           n.name, n.description,
           en.name as name_en, en.description as description_en
    from gamedata.entity e
    left join gamedata.entity_name n
      on n.dataset = 'items' and n.entity_id = e.entity_id and n.locale = ${locale}
    left join gamedata.entity_name en
      on en.dataset = 'items' and en.entity_id = e.entity_id and en.locale = 'en'
    where e.dataset = 'items' and e.entity_id = ${urn}
  `;
  if (rows.length === 0) return null;

  const r = rows[0];
  const d = r.data;
  const groups = await itemRelations(urn, locale);

  return {
    id: r.id,
    itemId: urnId(r.id),
    name: r.name ?? r.name_en ?? r.id,
    nameEn: r.name_en,
    grade: Number(d.grade ?? 0),
    icon: iconUrl(d.icon as string),
    slot: (d.category as string) ?? null,
    marketCategory: (d.marketCategory as string) ?? null,
    description: r.description,
    descriptionEn: r.description_en,
    data: d,
    groups,
  };
}

// ── Kristal / Eser / Beceri ekranlari ───────────────────────────────────────

export interface StatRow { stat: string; value?: number; unit?: string; op?: string }

export interface EquipItem {
  id: string;
  itemId: number;
  name: string;
  grade: number;
  icon: string | null;
  subCategory: string | null;
  stats: StatRow[];
  group?: { key: number; name: string; max: number };
}

const statsOf = (data: Record<string, unknown>): StatRow[] => {
  const node = (data?.effects as { stats?: { stats?: StatRow[] } } | undefined)?.stats?.stats;
  return Array.isArray(node) ? node : [];
};

const toEquip = (r: {
  id: string; name: string; grade: number; icon: string | null;
  sub: string | null; data: Record<string, unknown>;
}): EquipItem => ({
  id: r.id,
  itemId: urnId(r.id),
  name: r.name,
  grade: r.grade ?? 0,
  icon: iconUrl(r.icon),
  subCategory: r.sub,
  stats: statsOf(r.data),
  group: r.data?.crystalGroup as EquipItem["group"],
});

/** Sihirli kristaller — stat'lari ve grup limitleriyle. */
export async function listCrystals(): Promise<EquipItem[]> {
  const rows = await db.$queryRaw<Array<{
    id: string; name: string; grade: number; icon: string | null;
    sub: string | null; data: Record<string, unknown>;
  }>>`
    select m.id, m.name, m.grade, m.icon, m.market_sub_category as sub, e.data
    from gamedata.mv_item m
    join gamedata.entity e on e.entity_id = m.id and e.dataset = 'items'
    where m.market_category = 'Sihirli Kristal'
    order by m.grade desc, m.name
  `;
  return rows.map(toEquip);
}

/** Eserler (50) ve isik taslari (93) - ikisi de ayni kategoride duruyor. */
export async function listArtifacts(): Promise<{ artifacts: EquipItem[]; lightstones: EquipItem[] }> {
  const rows = await db.$queryRaw<Array<{
    id: string; name: string; grade: number; icon: string | null;
    sub: string | null; data: Record<string, unknown>;
  }>>`
    select m.id, m.name, m.grade, m.icon, m.market_sub_category as sub, e.data
    from gamedata.mv_item m
    join gamedata.entity e on e.entity_id = m.id and e.dataset = 'items'
    where m.market_category = 'Eser/Işık Taşı'
    order by m.market_sub_category, m.grade desc, m.name
  `;
  const all = rows.map(toEquip);
  return {
    artifacts: all.filter((i) => i.subCategory === "Eser"),
    lightstones: all.filter((i) => i.subCategory !== "Eser"),
  };
}

export interface LightstoneCombo {
  id: string;
  name: string;
  required: string[];
  stats: StatRow[];
}

/**
 * Isik tasi kombinasyonlari. Eserlerin kendi etkisi YOK — etki buradan geliyor:
 * dogru 3 ya da 4 tasi takinca kombinasyon aciliyor.
 */
export async function listLightstoneCombos(): Promise<LightstoneCombo[]> {
  const rows = await db.$queryRaw<Array<{ id: string; data: Record<string, unknown> }>>`
    select entity_id as id, data from gamedata.entity
    where dataset = 'lightstone_combinations' and removed_at_patch is null
  `;
  return rows
    .map((r) => ({
      id: r.id,
      name: plain(r.data.name),
      required: ((r.data.required as { urns?: string[] })?.urns ?? []).filter(Boolean),
      stats: statsOf(r.data),
    }))
    .filter((c) => c.required.length > 0)
    .sort((a, b) => a.required.length - b.required.length || a.name.localeCompare(b.name, "tr"));
}

/**
 * Guclendirilmis isik taslarinin temel karsiliklari.
 *
 * Kombinasyonlar temel tasin urn'unu istiyor ama oyunda guclendirilmis surum
 * de sayiliyor: "Guclendirilmis Atesin Isik Tasi: Hiddet" takiliyken
 * kombinasyon yine aciliyor. Extractor bu esdegerligi ayri bir alias
 * tablosunda veriyor; eslesme yapilirken once buradan gecirilmeli, yoksa
 * guclendirilmis tas takan hicbir kombinasyon acamaz.
 */
export async function lightstoneAliases(): Promise<Record<string, string>> {
  // Alias listesi kombinasyon kayitlarinin icinde degil, ayni dosyada ayri bir
  // dizi olarak geliyor; boru hatti onu `lightstone_aliases` dataset'ine
  // yaziyor. Tablo bos ise eslesme yalnizca temel taslarla calisir.
  const alias = await db.$queryRaw<Array<{ from_urn: string; to_urn: string }>>`
    select data ->> 'item' as from_urn, data ->> 'countsAs' as to_urn
    from gamedata.entity
    where dataset = 'lightstone_aliases' and removed_at_patch is null
  `;
  const map: Record<string, string> = {};
  for (const a of alias) if (a.from_urn && a.to_urn) map[a.from_urn] = a.to_urn;
  return map;
}

/**
 * Beceri ve kombinasyon adlari oyunun renk etiketlerini tasiyor
 * ("<PAColor0xffeb9261>Elvia: Carpik Otorite<PAOldColor>"). Ad olarak
 * kullanilacaklari icin burada temizleniyor - her ekranda ayri ayri
 * temizlemek yerine tek yerde.
 */
const plain = (s: unknown): string =>
  String(s ?? "").replace(/<PAColor0x[0-9a-fA-F]{8}>|<PAOldColor>/g, "").replace(/\s+/g, " ").trim();

export interface SkillClass { key: number; name: string }
export interface SkillRank { rank: number; name: string; description: string | null; skillLevel?: number }
export interface SkillGroup { id: string; name: string; classes: number[]; ranks: SkillRank[] }

export async function listSkillClasses(): Promise<SkillClass[]> {
  const rows = await db.$queryRaw<Array<{ data: Record<string, unknown> }>>`
    select data from gamedata.entity where dataset = 'character_classes'
  `;
  return rows
    .map((r) => ({ key: Number(r.data.characterKey), name: String(r.data.name ?? "") }))
    .filter((c) => Number.isFinite(c.key) && c.name)
    .sort((a, b) => a.key - b.key);
}

export async function listSkills(classKey?: number, q?: string): Promise<SkillGroup[]> {
  const rows = await db.$queryRaw<Array<{ id: string; data: Record<string, unknown> }>>`
    select entity_id as id, data from gamedata.entity
    where dataset = 'class_skill_groups' and removed_at_patch is null
      and (${classKey ?? null}::int is null
           or data -> 'classes' @> to_jsonb(${classKey ?? 0}::int))
      and (${q ?? null}::text is null or data ->> 'name' ilike '%' || ${q ?? null}::text || '%')
    order by data ->> 'name'
    limit 400
  `;
  return rows.map((r) => ({
    id: r.id,
    name: plain(r.data.name),
    classes: (r.data.classes as number[]) ?? [],
    ranks: ((r.data.ranks as SkillRank[]) ?? []).map((k) => ({
      rank: k.rank,
      name: plain(k.name),
      description: k.description ? plain(k.description) : null,
      skillLevel: k.skillLevel,
    })),
  }));
}

/**
 * Beceri eklentisi ("Etki Sec") katalogu — 96 etki.
 * Bu liste extractor'in build ciktisinda yok, loc tablosu 33'ten aliniyor
 * (bkz. PAZ: scripts/tools/import-loc-table.mjs).
 */
export async function listAddonEffects(): Promise<Array<{ id: number; text: string }>> {
  const rows = await db.$queryRaw<Array<{ id: string; text: string }>>`
    select entity_id as id, data ->> 'text' as text
    from gamedata.entity where dataset = 'skill_addon_effects' and removed_at_patch is null
    order by (entity_id)::int
  `;
  return rows.map((r) => ({ id: Number(r.id), text: r.text }));
}
