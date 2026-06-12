export const dynamic = "force-dynamic";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

type ChatMessage = { role: "user" | "model"; parts: [{ text: string }] };

async function buildGuildContext() {
  const [members, wars] = await Promise.all([
    prisma.user.findMany({
      where: { familyName: { not: "" } },
      orderBy: [{ ap: "desc" }, { dp: "desc" }],
      select: {
        id: true, familyName: true, ap: true, dp: true, class: true, spec: true, createdAt: true,
        gsHistory: { orderBy: { createdAt: "desc" }, take: 5, select: { ap: true, dp: true, createdAt: true } },
      },
    }),
    prisma.war.findMany({
      orderBy: { date: "desc" },
      take: 20,
      select: {
        id: true, title: true, type: true, date: true, result: true,
        participants: {
          select: {
            status: true,
            user: { select: { familyName: true, ap: true, dp: true } },
          },
        },
        performances: {
          select: {
            inGameName: true, kills: true, deaths: true, damageDealt: true,
            damageTaken: true, killStreak: true, ccCount: true, hpHeal: true,
            allyHpHeal: true, castleDamage: true,
          },
        },
      },
    }),
  ]);

  const totalWars = await prisma.war.count({ where: { date: { lte: new Date() } } });

  const membersData = members.map((m) => {
    const gs = m.ap + m.dp;
    const history = m.gsHistory.map((h) => ({
      gs: h.ap + h.dp,
      tarih: h.createdAt.toLocaleDateString("tr-TR"),
    }));
    return {
      aile: m.familyName,
      class: m.class || "bilinmiyor",
      spec: m.spec || "awakening",
      ap: m.ap, dp: m.dp, gs,
      gsGecmisi: history,
      kayitTarihi: m.createdAt.toLocaleDateString("tr-TR"),
    };
  });

  const warsData = wars.map((w) => {
    const attending = w.participants.filter((p) => p.status === "ATTENDING").map((p) => ({
      aile: p.user.familyName, gs: p.user.ap + p.user.dp,
    }));
    const declined = w.participants.filter((p) => p.status === "DECLINED").map((p) => p.user.familyName);
    const noResponse = members
      .filter((m) => !w.participants.find((p) => p.user.familyName === m.familyName))
      .map((m) => m.familyName);

    return {
      baslik: w.title,
      tip: w.type,
      tarih: w.date.toLocaleDateString("tr-TR"),
      sonuc: w.result || "bilinmiyor",
      katildi: attending,
      katilmadi: declined,
      cevaplamadi: noResponse,
      performanslar: w.performances.map((p) => ({
        oyuncu: p.inGameName,
        kills: p.kills, deaths: p.deaths,
        hasar: Math.round(p.damageDealt),
        alinanHasar: Math.round(p.damageTaken),
        killStreak: p.killStreak, cc: p.ccCount,
        iyilestirme: Math.round(p.hpHeal + p.allyHpHeal),
      })),
    };
  });

  // Attendance stats per member
  const attended = await prisma.warParticipant.groupBy({
    by: ["userId"],
    where: { status: "ATTENDING" },
    _count: true,
  });
  const attendMap = new Map(attended.map((a) => [a.userId, a._count]));
  const memberAttendance = members.map((m) => ({
    aile: m.familyName,
    katilimSayisi: attendMap.get(m.id) ?? 0,
    toplamSavas: totalWars,
    oran: totalWars > 0 ? `%${Math.round(((attendMap.get(m.id) ?? 0) / totalWars) * 100)}` : "%0",
  }));

  // Pre-aggregate performance stats per player (case-insensitive name merge)
  const perfMap = new Map<string, { hasar: number; kills: number; deaths: number; cc: number; iyilestirme: number; savaslar: number }>();
  for (const w of wars) {
    for (const p of w.performances) {
      const key = p.inGameName.toLowerCase();
      const existing = perfMap.get(key) ?? { hasar: 0, kills: 0, deaths: 0, cc: 0, iyilestirme: 0, savaslar: 0 };
      perfMap.set(key, {
        hasar: existing.hasar + Math.round(p.damageDealt),
        kills: existing.kills + p.kills,
        deaths: existing.deaths + p.deaths,
        cc: existing.cc + p.ccCount,
        iyilestirme: existing.iyilestirme + Math.round(p.hpHeal + p.allyHpHeal),
        savaslar: existing.savaslar + 1,
      });
    }
  }

  // Last 5 wars performance aggregate
  const last5Wars = wars.slice(0, 5);
  const last5PerfMap = new Map<string, { hasar: number; kills: number; deaths: number; savaslar: number }>();
  for (const w of last5Wars) {
    for (const p of w.performances) {
      const key = p.inGameName.toLowerCase();
      const existing = last5PerfMap.get(key) ?? { hasar: 0, kills: 0, deaths: 0, savaslar: 0 };
      last5PerfMap.set(key, {
        hasar: existing.hasar + Math.round(p.damageDealt),
        kills: existing.kills + p.kills,
        deaths: existing.deaths + p.deaths,
        savaslar: existing.savaslar + 1,
      });
    }
  }

  const toplamPerfStats = Array.from(perfMap.entries())
    .map(([name, s]) => ({ oyuncu: name, ...s }))
    .sort((a, b) => b.hasar - a.hasar);

  const son5SavasPerfStats = Array.from(last5PerfMap.entries())
    .map(([name, s]) => ({ oyuncu: name, ...s }))
    .sort((a, b) => b.hasar - a.hasar);

  return {
    ozet: {
      toplamUye: members.length,
      toplamSavas: totalWars,
      ortalamaAP: Math.round(members.reduce((s, m) => s + m.ap, 0) / (members.length || 1)),
      ortalamaDp: Math.round(members.reduce((s, m) => s + m.dp, 0) / (members.length || 1)),
      ortalamaGs: Math.round(members.reduce((s, m) => s + m.ap + m.dp, 0) / (members.length || 1)),
    },
    uyeler: membersData,
    katilimIstatistikleri: memberAttendance,
    savaslar: warsData,
    toplamPerformansOzeti: toplamPerfStats,
    son5SavasPerformansOzeti: son5SavasPerfStats,
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message, history } = await req.json() as { message: string; history?: ChatMessage[] };
  if (!message?.trim()) return NextResponse.json({ error: "Mesaj boş olamaz" }, { status: 400 });

  const guildData = await buildGuildContext();

  const systemPrompt = `Sen Aetherion klanının yapay zeka asistanısın. Klan verilerine erişimin var ve üyeler sana soru sorabilir.

Güncel klan verisi (JSON formatında):
${JSON.stringify(guildData, null, 2)}

Kurallar:
- Türkçe cevap ver
- Markdown formatı kullan (kalın, liste, tablo vb.)
- Net, kısa ve faydalı ol
- Veri yoksa dürüstçe söyle
- Sayısal karşılaştırmalarda tabloları tercih et
- Hasar değerlerini güzel formatla: 1234567 → 1.23M, 500000 → 500K, 85000 → 85K
- Performans soruları için "son5SavasPerformansOzeti" veya "toplamPerformansOzeti" kullan — bunlar önceden toplanmış, aynı oyuncu birden fazla satırda görünmez
- Bireysel savaş detayları için "savaslar[].performanslar" kullan
- Sıralama/ranking soularında kesinlikle aggregate veriyi (ozet alanlarını) kullan, ham satırları toplamaya çalışma`;

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

  const chat = model.startChat({
    history: history ?? [],
  });

  const result = await chat.sendMessage(message);
  const text = result.response.text();

  return NextResponse.json({ response: text });
}
