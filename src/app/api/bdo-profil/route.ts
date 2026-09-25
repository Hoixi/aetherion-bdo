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
 */

/** Bu süreden eski kayıt yenileniyor (karakter eklenmiş olabilir) */
const TAZELIK_GUN = 21;
/** Tek istekte en fazla kaç yeni aile okunur */
const YENI_SINIR = 6;
const ARA_MS = 350;

type Satir = { aile: string; karakterler: unknown; alindi: Date };

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

  const { aileler } = await req.json().catch(() => ({ aileler: null }));
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
  const eskiSinir = Date.now() - TAZELIK_GUN * 86400_000;
  const tazelenecek: string[] = [];
  const bakilan = new Map(kayitli.map((k) => [k.aile.toLowerCase(), k]));

  for (const aile of istenen) {
    const k = bakilan.get(aile.toLowerCase());
    if (k && k.alindi.getTime() > eskiSinir) {
      sonuc.set(aile, { karakterler: (k.karakterler as ProfilKarakteri[]) ?? [], alindi: k.alindi.toISOString() });
    } else {
      tazelenecek.push(aile);
    }
  }

  let okunan = 0;
  for (const aile of tazelenecek) {
    if (okunan >= YENI_SINIR) break;
    okunan++;
    if (okunan > 1) await new Promise((r) => setTimeout(r, ARA_MS));
    let karakterler: ProfilKarakteri[] = [];
    try {
      karakterler = await aileKarakterleri(aile);
    } catch {
      continue;   // sayfa açılmadıysa bir dahakine; boş kayıt yazmıyoruz
    }
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
  });
}
