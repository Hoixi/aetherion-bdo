export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

interface GeminiRaw {
  familyName: string;
  kills: string | number;
  deaths: string | number;
  killStreak: string | number;
  damageDealt: string | number;
  damageTaken: string | number;
  ccCount: string | number;
  hpHeal: string | number;
  allyHpHeal: string | number;
  castleDamage: string | number;
  cannonHits: string | number;
  cannonDestroys: string | number;
  cannonMaxRange: string | number;
  trapExplosions: string | number;
  /** Kolon varsa gelir; Gemini'ye adla soruluyor, sıraya dokunmuyor */
  survivalTime?: string | number | null;
}

interface GeminiRow {
  familyName: string;
  kills: number;
  deaths: number;
  killStreak: number;
  damageDealt: number;
  damageTaken: number;
  ccCount: number;
  hpHeal: number;
  allyHpHeal: number;
  castleDamage: number;
  cannonHits: number;
  cannonDestroys: number;
  cannonMaxRange: number;
  trapExplosions: number;
  /** Saniye; ekran görüntüsünde kolon yoksa null */
  survivalSeconds: number | null;
}

// K=×10000, B=×1000, M/Mn=×1000000
function parseGameValue(v: string | number): number {
  if (typeof v === "number") return Math.round(v);
  const s = String(v).trim().replace(/,/g, "");
  const m = s.match(/^([0-9]+(?:\.[0-9]+)?)\s*(K|B|Mn|M)?$/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  const unit = (m[2] ?? "").toUpperCase();
  if (unit === "K") return Math.round(num * 10000);
  if (unit === "B") return Math.round(num * 1000);
  if (unit === "M" || unit === "MN") return Math.round(num * 1000000);
  return Math.round(num);
}

/**
 * Hayatta kalma süresini saniyeye çevirir.
 *
 * Oyun bu kolonu tek biçimde yazmıyor; "12:34", "12dk 34sn", "754sn" ya
 * da düz sayı gelebiliyor. Tanıyamadığında null dönüyor — uydurulmuş bir
 * süre, eksik süreden kötü.
 */
function parseSurvival(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return v > 0 ? Math.round(v) : null;

  const s = String(v).trim().toLowerCase();
  if (!s || s === "-" || s === "0") return null;

  // 12:34  ya da  1:02:03
  const saat = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (saat) {
    const [, h, m, sn] = saat;
    return (Number(h ?? 0) * 3600) + (Number(m) * 60) + Number(sn);
  }

  // 12dk 34sn / 12 dakika 34 saniye / 12m 34s
  const parcali = s.match(/^(?:(\d+)\s*(?:dk|dakika|m|min)\.?)?\s*(?:(\d+)\s*(?:sn|saniye|s|sec)\.?)?$/);
  if (parcali && (parcali[1] || parcali[2])) {
    return Number(parcali[1] ?? 0) * 60 + Number(parcali[2] ?? 0);
  }

  const duz = s.match(/^\d+$/);
  return duz ? Number(s) : null;
}

function toRow(r: GeminiRaw): GeminiRow {
  return {
    familyName: r.familyName,
    kills: parseGameValue(r.kills),
    deaths: parseGameValue(r.deaths),
    killStreak: parseGameValue(r.killStreak),
    damageDealt: parseGameValue(r.damageDealt),
    damageTaken: parseGameValue(r.damageTaken),
    ccCount: parseGameValue(r.ccCount),
    hpHeal: parseGameValue(r.hpHeal),
    allyHpHeal: parseGameValue(r.allyHpHeal),
    castleDamage: parseGameValue(r.castleDamage),
    cannonHits: parseGameValue(r.cannonHits),
    cannonDestroys: parseGameValue(r.cannonDestroys),
    cannonMaxRange: parseGameValue(r.cannonMaxRange),
    trapExplosions: parseGameValue(r.trapExplosions),
    survivalSeconds: parseSurvival(r.survivalTime),
  };
}

async function analyzeWithGemini(imageBase64: string, mimeType: string, siteNames: string[]): Promise<GeminiRow[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const nameList = siteNames.join(", ");
  const prompt = `BDO savaş istatistik tablosu. Her satır için JSON dizisi döndür. Sadece JSON, başka hiçbir şey yazma.

Kolonlar (soldan sağa): familyName, kills, deaths, killStreak, damageDealt, damageTaken, ccCount, hpHeal, allyHpHeal, castleDamage, cannonHits, cannonDestroys, cannonMaxRange, trapExplosions

Sayısal değerleri görselde NASIL YAZIYORSA ÖYLE yaz — dönüştürme yapma.
Örnekler: 557B → "557B", 8Mn → "8Mn", 390B → "390B", 34214 → 34214, 2.9K → "2.9K"

Ek olarak, tabloda hayatta kalma / ölüm süresi gösteren bir kolon varsa
(örn. "Hayatta Kalma Süresi", "Ölüm Süresi", "Survival Time") onu
survivalTime alanına görseldeki biçimiyle yaz. Böyle bir kolon yoksa
survivalTime alanını hiç ekleme — yukarıdaki kolon sırasını değiştirme.

Aile adı eşleştirme: Görseldeki adı aşağıdaki kayıtlı listesiyle karşılaştır. Yakın eşleşme varsa (büyük/küçük harf, Türkçe karakter farkı: â=a, î=i, ş=s, ğ=g, ç=c, ö=o, ü=u) listeden doğru yazılışı kullan.
Kayıtlı adlar: ${nameList}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        }],
        generationConfig: { temperature: 0, maxOutputTokens: 16384, thinkingConfig: { thinkingBudget: 0 } },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API hatası: ${err}`);
  }

  const result = await response.json();
  const text: string = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Gemini geçerli JSON döndürmedi. Ham yanıt: ${text.slice(0, 300)}`);
  }

  const raw = JSON.parse(text.slice(start, end + 1)) as GeminiRaw[];
  return raw.map(toRow);
}

function mergeRows(allRows: GeminiRow[]): GeminiRow[] {
  const map = new Map<string, GeminiRow>();
  for (const row of allRows) {
    const key = row.familyName.toLowerCase().trim();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...row });
    } else {
      map.set(key, {
        familyName: existing.familyName,
        kills: existing.kills + (row.kills ?? 0),
        deaths: existing.deaths + (row.deaths ?? 0),
        killStreak: Math.max(existing.killStreak, row.killStreak ?? 0),
        damageDealt: existing.damageDealt + (row.damageDealt ?? 0),
        damageTaken: existing.damageTaken + (row.damageTaken ?? 0),
        ccCount: existing.ccCount + (row.ccCount ?? 0),
        hpHeal: existing.hpHeal + (row.hpHeal ?? 0),
        allyHpHeal: existing.allyHpHeal + (row.allyHpHeal ?? 0),
        castleDamage: existing.castleDamage + (row.castleDamage ?? 0),
        cannonHits: existing.cannonHits + (row.cannonHits ?? 0),
        cannonDestroys: existing.cannonDestroys + (row.cannonDestroys ?? 0),
        cannonMaxRange: Math.max(existing.cannonMaxRange, row.cannonMaxRange ?? 0),
        trapExplosions: existing.trapExplosions + (row.trapExplosions ?? 0),
        // Süre toplanmaz: aynı savaşın birden fazla görüntüsünde aynı
        // değer tekrar eder, en uzun okunanı alıyoruz
        survivalSeconds:
          existing.survivalSeconds === null && row.survivalSeconds === null
            ? null
            : Math.max(existing.survivalSeconds ?? 0, row.survivalSeconds ?? 0),
      });
    }
  }
  return Array.from(map.values());
}

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

    const allUsers = await prisma.user.findMany({ select: { id: true, familyName: true, class: true, spec: true } });
    const siteNames = allUsers.map((u) => u.familyName).filter(Boolean);
    const nameMap = new Map(allUsers.map((u) => [u.familyName.toLowerCase().trim(), u.id]));
    const classMap = new Map(allUsers.map((u) => [u.id, { cls: u.class, spec: u.spec }]));

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = file.type || "image/png";
    const geminiRows = await analyzeWithGemini(base64, mimeType, siteNames);
    const rows = mergeRows(geminiRows);

    if (shouldClear) {
      await prisma.warPerformance.deleteMany({ where: { warId } });
    }

    const savedRows = [];
    for (const row of rows) {
      const userId = nameMap.get(row.familyName.toLowerCase().trim()) ?? null;
      // Rapor anındaki class'ı sabitle — üye sonradan değiştirse de savaş kaydı bozulmaz
      const snap = userId ? classMap.get(userId) : undefined;
      const record = await prisma.warPerformance.upsert({
        where: { warId_inGameName: { warId, inGameName: row.familyName } },
        update: {
          userId,
          class: snap?.cls ?? "",
          spec: snap?.spec ?? "",
          kills: row.kills,
          deaths: row.deaths,
          killStreak: row.killStreak,
          damageDealt: row.damageDealt,
          damageTaken: row.damageTaken,
          ccCount: row.ccCount,
          hpHeal: row.hpHeal,
          allyHpHeal: row.allyHpHeal,
          castleDamage: row.castleDamage,
          cannonHits: row.cannonHits,
          cannonDestroys: row.cannonDestroys,
          cannonMaxRange: row.cannonMaxRange,
          trapExplosions: row.trapExplosions,
          survivalSeconds: row.survivalSeconds,
        },
        create: {
          warId,
          userId,
          inGameName: row.familyName,
          class: snap?.cls ?? "",
          spec: snap?.spec ?? "",
          kills: row.kills,
          deaths: row.deaths,
          killStreak: row.killStreak,
          damageDealt: row.damageDealt,
          damageTaken: row.damageTaken,
          ccCount: row.ccCount,
          hpHeal: row.hpHeal,
          allyHpHeal: row.allyHpHeal,
          castleDamage: row.castleDamage,
          cannonHits: row.cannonHits,
          cannonDestroys: row.cannonDestroys,
          cannonMaxRange: row.cannonMaxRange,
          trapExplosions: row.trapExplosions,
          survivalSeconds: row.survivalSeconds,
        },
      });
      savedRows.push({ ...record, matched: userId !== null });
    }

    // Yalnızca "katıldı + partide seçildi + ekran analizinde görünmedi" durumunu say
    const perfNames = new Set(rows.map((r) => r.familyName.toLowerCase().trim()));
    const parties = await prisma.party.findMany({
      where: { warId },
      include: {
        members: {
          include: { user: true },
        },
      },
    });
    const attendingUsers = await prisma.warParticipant.findMany({
      where: { warId, status: "ATTENDING" },
      select: { userId: true },
    });
    const attendingUserIds = new Set(attendingUsers.map((p) => p.userId));

    const usersToIncrement: number[] = [];
    for (const party of parties) {
      for (const member of party.members) {
        const isAttending = attendingUserIds.has(member.userId);
        const absentFromScreenshot = !perfNames.has(member.user.familyName.toLowerCase().trim());

        if (isAttending && absentFromScreenshot) {
          usersToIncrement.push(member.userId);
        }
      }
    }

    // Sayaç değerlerini artır
    if (usersToIncrement.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: usersToIncrement } },
        data: { absenceCount: { increment: 1 } },
      });
    }

    return NextResponse.json({ rows: savedRows, total: savedRows.length });
  } catch (err: unknown) {
    console.error("Performance POST error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası oluştu" },
      { status: 500 }
    );
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Giriş yapılmadı" }, { status: 401 });

    const warId = parseInt(params.id);
    if (isNaN(warId)) return NextResponse.json({ error: "Geçersiz savaş ID" }, { status: 400 });

    const performances = await prisma.warPerformance.findMany({
      where: { warId },
      orderBy: { damageDealt: "desc" },
      include: { user: { select: { familyName: true, avatarUrl: true, class: true } } },
    });

    const war = await prisma.war.findUnique({
      where: { id: warId },
      select: {
        participants: {
          where: { status: "ATTENDING" },
          select: { user: { select: { id: true, familyName: true, avatarUrl: true } } },
        },
        parties: {
          select: {
            members: {
              select: { userId: true },
            },
          },
        },
      },
    });

    const selectedPartyUserIds = new Set(
      war?.parties.flatMap((party) => party.members.map((member) => member.userId)) ?? []
    );

    const perfNames = new Set(performances.map((p) => p.inGameName.toLowerCase().trim()));
    const absent = war?.participants
      .map((p) => p.user)
      .filter(
        (u) => selectedPartyUserIds.has(u.id) && !perfNames.has(u.familyName.toLowerCase().trim())
      ) ?? [];

    return NextResponse.json({ performances, absent });
  } catch (err: unknown) {
    console.error("Performance GET error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sunucu hatası oluştu" },
      { status: 500 }
    );
  }
}
