export const dynamic = "force-dynamic";
export const maxDuration = 60;
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { aileKarakterleri, type ProfilKarakteri } from "@/lib/bdo-profil";

/**
 * Aile adı → karakterleri ve sınıfları (oyunun resmî profil sayfasından).
 *
 * Kayıt veritabanında tutuluyor: aynı aile için sayfa bir kez okunuyor,
 * sonraki isteklerde oradan dönülüyor. İstek başına en fazla birkaç yeni
 * aile okunuyor ve aralarında bekleniyor — kimsenin sayfasını yormayalım.
 *
 * Sorgular ham SQL: tablo eklemeli SQL ile açılıyor, şema istemcisi
 * yeniden üretilmeden de çalışsın.
 *
 * Hata yutulmuyor: okunamayan aileler sayısıyla ve ilk birkaç hatanın
 * mesajıyla dönüyor. Sunucu profil sayfasına hiç ulaşamıyorsa (engel,
 * zaman aşımı) arayüzde "bulunamadı" ile "ulaşılamadı" ayırt edilebilsin.
 */

/** Bu süreden eski kayıt yenileniyor (karakter eklenmiş olabilir) */
const TAZELIK_GUN = 21;
/**
 * Boş kayıt daha çabuk tazeleniyor: aile gizli olabilir ama sayfanın o an
 * cevap vermemiş olması da aynı boş kaydı yazıyor. Üç hafta boyunca boş
 * kalmasın.
 */
const BOS_TAZELIK_GUN = 2;
/** Tek istekte en fazla kaç yeni aile okunur */
const YENI_SINIR = 6;
const ARA_MS = 350;

type Satir = { aile: string; karakterler: unknown; alindi: Date };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const govde = await req.json().catch(() => ({}));
  const aileler = govde?.aileler;
  /** Boş kayıtları da yeniden oku — arayüzdeki "Karakterleri bul" düğmesi */
  const zorla = govde?.zorla === true;
  if (!Array.isArray(aileler) || aileler.length === 0 || aileler.length > 60) {
    return NextResponse.json({ error: "Aile listesi gerekli (en fazla 60)." }, { status: 400 });
  }
  const istenen = Array.from(new Set(
    aileler.filter((a): a is string => typeof a === "string" && !!a.trim() && a.length <= 30)
      .map((a) => a.normalize("NFC").trim()),
  ));

  let kayitli: Satir[] = [];
  try {
    kayitli = await prisma.$queryRaw<Satir[]>`
      SELECT "aile", "karakterler", "alindi" FROM "bdo_families"
      WHERE lower("aile") = ANY(${istenen.map((a) => a.toLowerCase())}::text[])`;
  } catch {
    return NextResponse.json({ error: "Profil önbelleği hazır değil." }, { status: 503 });
  }

  const sonuc = new Map<string, { karakterler: ProfilKarakteri[]; alindi: string }>();
  const simdi = Date.now();
  const tazelenecek: string[] = [];
  const bakilan = new Map(kayitli.map((k) => [k.aile.toLowerCase(), k]));

  for (const aile of istenen) {
    const k = bakilan.get(aile.toLowerCase());
    const liste = (k?.karakterler as ProfilKarakteri[] | undefined) ?? [];
    const gun = liste.length ? TAZELIK_GUN : BOS_TAZELIK_GUN;
    const taze = !!k && k.alindi.getTime() > simdi - gun * 86400_000 && !(zorla && liste.length === 0);
    if (taze) sonuc.set(aile, { karakterler: liste, alindi: k!.alindi.toISOString() });
    else tazelenecek.push(aile);
  }

  let okunan = 0, bulunan = 0, bos = 0;
  const hatalar: Array<{ aile: string; mesaj: string }> = [];
  for (const aile of tazelenecek) {
    if (okunan >= YENI_SINIR) break;
    okunan++;
    if (okunan > 1) await new Promise((r) => setTimeout(r, ARA_MS));
    let karakterler: ProfilKarakteri[] = [];
    try {
      karakterler = await aileKarakterleri(aile);
    } catch (e) {
      // Sayfa açılmadı: kayıt yazmıyoruz ki bir dahakine tekrar denensin
      if (hatalar.length < 3) hatalar.push({ aile, mesaj: (e as Error)?.message?.slice(0, 120) ?? "bilinmeyen" });
      continue;
    }
    if (karakterler.length) bulunan++; else bos++;
    // Bulunamayan aile de yazılıyor: her açılışta yeniden denenmesin
    await prisma.$executeRaw`
      INSERT INTO "bdo_families" ("aile", "karakterler", "alindi")
      VALUES (${aile}, ${JSON.stringify(karakterler)}::jsonb, NOW())
      ON CONFLICT ("aile") DO UPDATE SET "karakterler" = EXCLUDED."karakterler", "alindi" = NOW()`;
    sonuc.set(aile, { karakterler, alindi: new Date().toISOString() });
  }

  return NextResponse.json({
    aileler: Object.fromEntries(sonuc),
    kalan: Math.max(0, tazelenecek.length - okunan),
    /** Bu turda gerçekten sayfaya gidilen aile sayısı */
    denenen: okunan,
    bulunan,
    /** Sayfası açıldı ama karakter çıkmadı (gizli profil, ad değişikliği) */
    bos,
    /** Sayfaya hiç ulaşılamadı — engel, zaman aşımı, ağ */
    hataSayisi: tazelenecek.slice(0, okunan).length - bulunan - bos,
    hatalar,
  });
}

/**
 * Tanı: sunucu profil sayfasına ulaşabiliyor mu?
 *
 * Arayüzde "karakterler bulunamadı" görünce sorunun nerede olduğu
 * belirsiz kalıyordu — sayfa mı kapalı, sunucu mu engelli, aile mi yok.
 * `?aile=<ad>` ile tek aile deneniyor ve ham sonuç dönüyor.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const aile = (new URL(req.url).searchParams.get("aile") ?? "").trim().slice(0, 30);
  if (!aile) return NextResponse.json({ error: "?aile=<aile adı> gerekli" }, { status: 400 });

  const basladi = Date.now();
  try {
    const karakterler = await aileKarakterleri(aile);
    return NextResponse.json({ aile, karakterler, sayi: karakterler.length, ms: Date.now() - basladi });
  } catch (e) {
    return NextResponse.json(
      { aile, hata: (e as Error)?.message ?? "bilinmeyen", ms: Date.now() - basladi },
      { status: 502 },
    );
  }
}

/**
 * Önbelleği dışarıdan doldur (yalnızca yönetici).
 *
 * Sunucu profil sayfasına ulaşamadığında (bulut sağlayıcının adresi
 * engelliyse) aynı okuma bir ev bilgisayarından yapılıp sonuç buraya
 * yüklenebiliyor. Gövde: `{ "aileler": { "AileAdı": [{ "ad": "...",
 * "sinif": 31 }] } }`.
 */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.canManageWars) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const govde = await req.json().catch(() => ({}));
  const gelen = govde?.aileler;
  if (!gelen || typeof gelen !== "object" || Array.isArray(gelen)) {
    return NextResponse.json({ error: "aileler nesnesi gerekli" }, { status: 400 });
  }
  const girdiler = Object.entries(gelen as Record<string, unknown>).slice(0, 500);
  let yazilan = 0;
  for (const [aile, liste] of girdiler) {
    if (!aile.trim() || aile.length > 30 || !Array.isArray(liste)) continue;
    const temiz: ProfilKarakteri[] = liste
      .filter((k): k is ProfilKarakteri =>
        !!k && typeof (k as ProfilKarakteri).ad === "string" && Number.isInteger((k as ProfilKarakteri).sinif))
      .map((k) => ({ ad: k.ad.slice(0, 40), sinif: k.sinif }))
      .slice(0, 200);
    await prisma.$executeRaw`
      INSERT INTO "bdo_families" ("aile", "karakterler", "alindi")
      VALUES (${aile.normalize("NFC").trim()}, ${JSON.stringify(temiz)}::jsonb, NOW())
      ON CONFLICT ("aile") DO UPDATE SET "karakterler" = EXCLUDED."karakterler", "alindi" = NOW()`;
    yazilan++;
  }
  return NextResponse.json({ yazilan });
}
