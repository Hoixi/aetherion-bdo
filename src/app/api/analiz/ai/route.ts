export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getGuildScope } from "@/lib/guild-scope";
import { getClassByID } from "@/lib/classes";
import { METRIC_WEIGHTS, METRIC_KEYS, type PlayerAnalysis } from "@/lib/war-analysis";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Analiz sonucunu yorumlar.
 *
 * Sayıları modele yeniden hesaplatmıyoruz — dilimler ve puanlar zaten
 * hesaplanmış halde gidiyor, modelden istenen tek şey yorum. Böylece
 * aritmetik hatası yapamaz, sadece çıkarım üretir.
 */
export async function POST(req: NextRequest) {
  const scope = await getGuildScope();
  if (!scope?.canManageWars) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "AI anahtarı ayarlı değil." }, { status: 503 });
  }

  const { players, wars, focus } = (await req.json()) as {
    players: PlayerAnalysis[];
    wars: { title: string; date: string; result: string | null }[];
    focus?: string;
  };

  if (!players?.length) return NextResponse.json({ error: "Veri yok." }, { status: 400 });

  const metricLine = METRIC_KEYS
    .map((k) => `${METRIC_WEIGHTS[k].label} (ağırlık ${METRIC_WEIGHTS[k].weight})`)
    .join(", ");

  // Modele sadece gereken alanlar — bağlam şişmesin
  const table = players.slice(0, 60).map((p) => {
    const cls = getClassByID(p.class)?.name ?? p.class ?? "?";
    const dims = METRIC_KEYS.map((k) => `${METRIC_WEIGHTS[k].label}:${Math.round(p.metrics[k].pct)}`).join(" ");
    const rank = p.classRank ? ` [${cls} içinde ${p.classRank.rank}/${p.classRank.of}]` : "";
    return `${p.name} (${cls}${p.spec ? "/" + p.spec : ""}${p.guildTag ? ", " + p.guildTag : ""}) ` +
      `puan:${p.rating} savaş:${p.wars} ${dims}${rank}`;
  }).join("\n");

  const prompt = `Sen bir Black Desert Online klan yöneticisisin. Aşağıda ${wars.length} savaşın performans analizi var.

Sayılar SAVAŞ İÇİ YÜZDELİK DİLİM (0-100). 50 = o savaştaki medyan oyuncu. Mutlak değer değil, göreli sıralama.
Metrikler: ${metricLine}
Puan bu dilimlerin ağırlıklı ortalaması.

SAVAŞLAR:
${wars.map((w) => `- ${w.title} (${new Date(w.date).toLocaleDateString("tr-TR")})${w.result ? " — " + w.result : ""}`).join("\n")}

OYUNCULAR:
${table}

${focus ? `Yöneticinin özel sorusu: ${focus}\n` : ""}
Şunları yaz, Türkçe, madde madde, gereksiz övgü yok:

1. GENEL DURUM — 2-3 cümle. Klan neyde iyi, neyde zayıf.
2. ÖNE ÇIKANLAR — en iyi 3-5 oyuncu, neden.
3. DÜŞÜK PERFORMANS — dilimi düşük oyuncular. Her biri için hangi metrikte geri kaldığını ve olası sebebini yaz. Suçlayıcı değil, çözüm odaklı ol.
4. CLASS DEĞERLENDİRMESİ — hangi classlar beklenenin altında? Bir oyuncunun düşük puanı class'ın doğasından mı (tank az hasar basar) yoksa oyuncudan mı kaynaklanıyor, ayır. Class değişikliği önerecekssen sadece güçlü gerekçe varsa öner.
5. SOMUT ADIMLAR — 3-5 uygulanabilir madde.

ÖNEMLİ: Az savaşa katılmış oyuncular için (savaş sayısı 1-2) kesin yargı verme, örneklem küçük olduğunu belirt. Destek ve kale hasarı metriklerinde sıfır olması her zaman kötü değildir, rol gereği olabilir.`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    return NextResponse.json({ text: result.response.text() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bilinmeyen hata";
    return NextResponse.json({ error: "AI analizi başarısız: " + msg }, { status: 502 });
  }
}
