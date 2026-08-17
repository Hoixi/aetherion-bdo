export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { getGuildScope } from "@/lib/guild-scope";
import { getClassByID } from "@/lib/classes";
import { METRIC_WEIGHTS, METRIC_KEYS, ROLE_LABEL, type PlayerAnalysis } from "@/lib/war-analysis";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * Analiz sonucunu yorumlar.
 *
 * Serbest metin yerine şema dayatıyoruz — çıktı doğrudan arayüzde
 * kart olarak çizilebilsin diye. Sayılar da modele hesaplanmış halde
 * gidiyor; ondan istenen tek şey yorum, aritmetik değil.
 */
const schema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    headline: { type: SchemaType.STRING, description: "Tek cümlelik genel durum" },
    teamStrengths: {
      type: SchemaType.ARRAY, description: "Klanın güçlü olduğu 2-4 konu, kısa",
      items: { type: SchemaType.STRING },
    },
    teamWeaknesses: {
      type: SchemaType.ARRAY, description: "Klanın zayıf olduğu 2-4 konu, kısa",
      items: { type: SchemaType.STRING },
    },
    standouts: {
      type: SchemaType.ARRAY, description: "Öne çıkan 3-5 oyuncu",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING, description: "Tek cümle, neden öne çıkıyor" },
        },
        required: ["name", "reason"],
      },
    },
    concerns: {
      type: SchemaType.ARRAY, description: "Düşük performanslı oyuncular, en fazla 8",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          role: { type: SchemaType.STRING, description: "Oyuncunun rolü: Savunma, Main veya Flank" },
          issue: { type: SchemaType.STRING, description: "Kendi rolü içinde hangi metrikte geri kalıyor" },
          suggestion: { type: SchemaType.STRING, description: "Somut, çözüm odaklı öneri" },
          severity: { type: SchemaType.STRING, enum: ["high", "medium", "low"], format: "enum" },
          lowSample: { type: SchemaType.BOOLEAN, description: "Savaş sayısı 2 veya altıysa true" },
        },
        required: ["name", "issue", "suggestion", "severity", "lowSample"],
      },
    },
    classNotes: {
      type: SchemaType.ARRAY, description: "Class bazlı değerlendirme, en fazla 6",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          className: { type: SchemaType.STRING },
          verdict: { type: SchemaType.STRING, description: "Tek cümle değerlendirme" },
          roleExpected: {
            type: SchemaType.BOOLEAN,
            description: "Düşük puan class'ın doğasından kaynaklanıyorsa true, oyuncudan kaynaklanıyorsa false",
          },
        },
        required: ["className", "verdict", "roleExpected"],
      },
    },
    actions: {
      type: SchemaType.ARRAY, description: "3-5 uygulanabilir adım, önemli olan önce",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING, description: "Kısa başlık" },
          detail: { type: SchemaType.STRING, description: "Tek cümle açıklama" },
        },
        required: ["title", "detail"],
      },
    },
  },
  required: ["headline", "teamStrengths", "teamWeaknesses", "standouts", "concerns", "classNotes", "actions"],
};

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

  // Yalnızca gereken alanlar — bağlam şişmesin
  const table = players.slice(0, 60).map((p) => {
    const cls = getClassByID(p.class)?.name ?? p.class ?? "?";
    const dims = METRIC_KEYS.map((k) => `${METRIC_WEIGHTS[k].label}:${Math.round(p.metrics[k].pct)}`).join(" ");
    const rank = p.classRank ? ` [${cls} içinde ${p.classRank.rank}/${p.classRank.of}]` : "";
    return `${p.name} [${ROLE_LABEL[p.role]}] (${cls}${p.spec ? "/" + p.spec : ""}${p.guildTag ? ", " + p.guildTag : ""}) ` +
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
${focus ? `\nYöneticinin özel sorusu, cevabını headline ve actions içine yedir: ${focus}\n` : ""}
ROLLER — her oyuncunun adının yanında köşeli parantez içinde yazıyor. Dilimler zaten
KENDİ ROLÜ İÇİNDE hesaplandı, yani bir savunmacının hasar dilimi diğer savunmacılara
göredir, saldırıya göre değil. Buna rağmen yorum yaparken rolü mutlaka gözet:

- Savunma: Görevi bölgeyi tutmak. Az hasar ve az ölüm BEKLENEN durumdur, başarı değil.
  "Az hasar vermiş ama ölmemiş, iyi" DEME — savunmacı zaten öyle oynar. Savunmacıyı
  bölgeyi tutup tutmadığı, CC ve dayanıklılık üzerinden değerlendir. Kale hasarının
  sıfır olması savunmacı için tamamen normaldir, asla eksiklik sayma.

- Flank: Az kişiyle riskli hedefe gider. Ölümünün yüksek olması BEKLENENDİR, zayıflık
  değil. "Çok ölmüş" DEME. Flank'ı yarattığı baskı, kill ve CC üzerinden değerlendir.
  Toplam hasarının main'den düşük olması normaldir, sayıca az oldukları içindir.

- Main: Asıl vuruş gücü. Hasar, kale hasarı ve hayatta kalma dengesi burada anlamlıdır.

Bir oyuncuyu asla başka rolün ölçütüyle yargılama. Rolü gereği olan bir durumu
concerns içine koyma; oraya yalnızca kendi rolünün içinde geride kalanlar girsin.

Kurallar:
- Türkçe yaz, kısa ve net cümleler kur, gereksiz övgü yapma.
- Savaş sayısı 1-2 olan oyuncular için lowSample=true ver ve kesin yargı kurma.
- Destek ve kale hasarında sıfır her zaman kötü değildir; rol gereği olabilir, bunu ayırt et.
- Bir class'ın düşük puanı doğasından kaynaklanıyorsa (tank az hasar basar) roleExpected=true ver.
- Class değişikliği önerisini sadece güçlü gerekçe varsa yap.
- İsimleri listedeki haliyle yaz, uydurma.`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json", responseSchema: schema },
    });
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "bilinmeyen hata";
    return NextResponse.json({ error: "AI analizi başarısız: " + msg }, { status: 502 });
  }
}
