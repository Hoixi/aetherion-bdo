import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getClassByID, getTypeName } from "@/lib/classes";

export const dynamic = "force-dynamic";
// Prisma Edge'de çalışmaz
export const runtime = "nodejs";

/**
 * Parti listesi kartı.
 *
 * Discord'a düz metin gömü yerine görsel gidiyor: 8 partilik bir liste
 * embed'de okunmaz hâle geliyordu, kart hâlinde tek bakışta okunuyor.
 *
 * Satori grid desteklemiyor, her şey flex. Yükseklik satır sayısından
 * hesaplanıyor çünkü ImageResponse sabit bir tuval istiyor.
 */

const ROLE_META: Record<string, { label: string; color: string }> = {
  MAIN:    { label: "MAIN",    color: "#e0b040" },
  DEFENSE: { label: "SAVUNMA", color: "#6b93ff" },
  FLANK:   { label: "FLANK",   color: "#b98cff" },
};

const TIER_COLOR: Record<string, string> = {
  T1: "#e0b040", T2: "#7a8ba3", T3: "#b87333",
};

/**
 * Uzun aile adını kutuya sığdır.
 *
 * Satori'de `overflow: hidden` ve `text-overflow: ellipsis` tek başına
 * kırpmıyor, metni alt satıra sarıyor; sarınca kutu yükseliyor ve
 * yanındaki yazının üstüne biniyor. Bu yüzden kırpmayı burada yapıyoruz.
 */
const kisalt = (ad: string, enFazla: number) =>
  ad.length > enFazla ? `${ad.slice(0, enFazla - 1)}…` : ad;

/**
 * Saate Türkçe ayrılma eki: "20:40'tan", "21:10'dan", "19:00'dan".
 *
 * Ek, saatin okunuşundaki son sözcüğe göre değişiyor. Savaşlar 21:00
 * olduğu için pratikte hep "kırk"tan geliyor ama saat değişirse yazının
 * da düzgün kalması gerekiyor.
 */
const SAAT_EKI: Record<number, string> = {
  0: "'dan", 1: "'den", 2: "'den", 3: "'ten", 4: "'ten", 5: "'ten",
  6: "'dan", 7: "'den", 8: "'den", 9: "'dan",
  10: "'dan", 20: "'den", 30: "'dan", 40: "'tan", 50: "'den",
};
function saatEki(hhmm: string): string {
  const [sa, dk] = hhmm.split(":").map(Number);
  // Dakika sıfırsa okunan sözcük saatin kendisi
  const n = dk > 0 ? dk : sa;
  return SAAT_EKI[n % 10 === 0 ? n : n % 10] ?? "'tan";
}

/** Sütun başına parti — 3'ten fazlası kartı okunmaz genişlikte yapıyor */
const COLS = 3;
const CARD_W = 1080;

export async function GET(_req: Request, { params }: { params: { warId: string } }) {
  const warId = Number(params.warId);
  if (isNaN(warId)) return new Response("Geçersiz ID", { status: 400 });

  const war = await prisma.war.findUnique({
    where: { id: warId },
    select: {
      id: true, title: true, type: true, date: true, tier: true, maxParticipants: true,
      participants: {
        where: { status: "ATTENDING" },
        select: {
          userId: true, asClass: true,
          user: {
            select: {
              familyName: true, class: true, ap: true, dp: true,
              guild: { select: { tag: true, color: true } },
            },
          },
        },
      },
      parties: {
        orderBy: { id: "asc" },
        select: {
          id: true, name: true, role: true, isDefense: true,
          members: {
            orderBy: { id: "asc" },
            select: {
              userId: true, asClass: true,
              user: {
                select: {
                  familyName: true, class: true, ap: true, dp: true,
                  guild: { select: { tag: true, color: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!war) return new Response("Savaş bulunamadı", { status: 404 });

  const parties = war.parties.filter((p) => p.members.length > 0);
  const total = parties.reduce((s, p) => s + p.members.length, 0);

  /*
    Partisi olmayan katılımcılar.

    Bunlar listeden düşmüş değil: savaş başlamadan kısa süre önce yer
    açılırsa onlara katıl atılıyor. Kartta görünmezlerse kimin yedekte
    beklediği Discord'da kayboluyordu.
  */
  const inParty = new Set(war.parties.flatMap((p) => p.members.map((m) => m.userId)));
  const yedek = war.participants
    .filter((p) => !inParty.has(p.userId))
    .sort((a, b) => (b.user.ap + b.user.dp) - (a.user.ap + a.user.dp));
  /** Yedek satırı: sabit genişlikli kutular, yükseklik hesabı tutsun */
  const YEDEK_SUTUN = 5;
  const yedekSatir = Math.ceil(yedek.length / YEDEK_SUTUN);

  // Yükseklik satır satır hesaplanıyor. Tek bir "en kalabalık parti"
  // ölçüsünü bütün satırlara uygulamak, son satırda az kişi varsa kartın
  // altında koca bir boşluk bırakıyordu — flex-wrap satır içinde zaten
  // eşitliyor, satırlar arasında değil.
  let height = 118 + 52;
  for (let i = 0; i < parties.length; i += COLS) {
    const rowMax = Math.max(1, ...parties.slice(i, i + COLS).map((p) => p.members.length));
    height += 52 + rowMax * 26 + 14 + 16;
  }
  if (parties.length === 0) height += 90;
  if (yedek.length) height += 16 + 30 + yedekSatir * 28 + 6;

  const tier = war.tier ?? "T1";
  const when = new Date(war.date).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", weekday: "long",
  });
  const at = new Date(war.date).toLocaleTimeString("tr-TR", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul",
  });
  // Yedeklere yer açma saati: savaş saatinden 20 dakika önce
  const katilSaati = new Date(new Date(war.date).getTime() - 20 * 60_000)
    .toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

  return new ImageResponse(
    (
      <div style={{
        width: `${CARD_W}px`, height: `${height}px`, display: "flex",
        flexDirection: "column", background: "#0b0b0c", color: "#f4f4f5",
        fontFamily: "sans-serif",
      }}>
        {/* Üst altın çizgi */}
        <div style={{
          display: "flex", height: "3px", width: "100%",
          background: "linear-gradient(90deg, #e8b451, #f07a3c)",
        }} />

        {/* Başlık */}
        <div style={{
          display: "flex", alignItems: "center", padding: "20px 30px 14px",
        }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                {war.title}
              </div>
              <div style={{
                display: "flex", marginLeft: "12px", padding: "3px 10px", borderRadius: "6px",
                fontSize: "15px", fontWeight: 800,
                background: `${TIER_COLOR[tier] ?? "#7a8ba3"}22`,
                color: TIER_COLOR[tier] ?? "#7a8ba3",
              }}>
                {tier}
              </div>
            </div>
            <div style={{ display: "flex", fontSize: "14px", color: "#9a9aa2", marginTop: "5px" }}>
              {getTypeName(war.type)} · {when} · {at}
            </div>
          </div>

          <div style={{ display: "flex", marginLeft: "auto", alignItems: "flex-end", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: "30px", fontWeight: 800, color: "#e8b451" }}>
              {total}{war.maxParticipants ? ` / ${war.maxParticipants}` : ""}
            </div>
            <div style={{ display: "flex", fontSize: "12px", color: "#5e5e66", letterSpacing: "1px" }}>
              KİŞİ · {parties.length} PARTİ
            </div>
          </div>
        </div>

        {/* Partiler */}
        <div style={{
          display: "flex", flexWrap: "wrap", padding: "0 22px", gap: "16px",
        }}>
          {parties.map((party) => {
            const role = party.role ?? (party.isDefense ? "DEFENSE" : "MAIN");
            const meta = ROLE_META[role] ?? ROLE_META.MAIN;
            const avgGs = Math.round(
              party.members.reduce((s, m) => s + m.user.ap + m.user.dp, 0) / party.members.length);

            return (
              <div key={party.id} style={{
                display: "flex", flexDirection: "column",
                width: `${(CARD_W - 44 - (COLS - 1) * 16) / COLS}px`,
                background: "#141416", borderRadius: "12px",
                border: `1px solid ${meta.color}33`, overflow: "hidden",
              }}>
                {/* Parti başlığı */}
                <div style={{
                  display: "flex", alignItems: "center", padding: "10px 12px",
                  borderBottom: "1px solid #ffffff10",
                }}>
                  <div style={{
                    display: "flex", width: "7px", height: "7px", borderRadius: "4px",
                    background: meta.color, marginRight: "8px",
                  }} />
                  <div style={{ display: "flex", fontSize: "15px", fontWeight: 700 }}>
                    {party.name}
                  </div>
                  <div style={{
                    display: "flex", marginLeft: "7px", fontSize: "10px", fontWeight: 800,
                    color: meta.color, letterSpacing: "0.5px",
                  }}>
                    {meta.label}
                  </div>
                  <div style={{
                    display: "flex", marginLeft: "auto", fontSize: "12px", color: "#9a9aa2",
                  }}>
                    {party.members.length} · {avgGs}
                  </div>
                </div>

                {/* Üyeler */}
                <div style={{ display: "flex", flexDirection: "column", padding: "6px 0" }}>
                  {party.members.map((m, i) => {
                    const shown = m.asClass || m.user.class;
                    const cls = getClassByID(shown);
                    const gs = m.user.ap + m.user.dp;
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", height: "26px", padding: "0 12px",
                      }}>
                        <div style={{
                          display: "flex", width: "18px", fontSize: "11px", color: "#5e5e66",
                        }}>
                          {i + 1}
                        </div>
                        <div style={{
                          display: "flex", fontSize: "13px", fontWeight: 600,
                          maxWidth: "128px", overflow: "hidden",
                        }}>
                          {m.user.familyName}
                        </div>
                        {m.user.guild && (
                          <div style={{
                            display: "flex", marginLeft: "5px", fontSize: "9px", fontWeight: 800,
                            color: m.user.guild.color,
                          }}>
                            {m.user.guild.tag}
                          </div>
                        )}
                        <div style={{
                          display: "flex", marginLeft: "auto", alignItems: "center",
                        }}>
                          <div style={{ display: "flex", fontSize: "10px", color: "#5e5e66", marginRight: "7px" }}>
                            {cls?.name ?? ""}
                          </div>
                          <div style={{ display: "flex", fontSize: "12px", fontWeight: 700, color: "#e8b451" }}>
                            {gs}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Partisiz katılımcılar — yer açılırsa katıl atılacaklar */}
        {yedek.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", padding: "16px 22px 6px" }}>
            <div style={{ display: "flex", alignItems: "center", height: "30px" }}>
              <div style={{
                display: "flex", fontSize: "13px", fontWeight: 800, color: "#e8b451", letterSpacing: "1px",
              }}>
                {`${katilSaati}${saatEki(katilSaati)} SONRA KATIL ATILABİLECEKLER`}
              </div>
              <div style={{
                display: "flex", marginLeft: "8px", padding: "2px 8px", borderRadius: "5px",
                fontSize: "12px", fontWeight: 800, background: "#ffffff0d", color: "#f4f4f5",
              }}>
                {yedek.length}
              </div>
              <div style={{ display: "flex", marginLeft: "auto", fontSize: "12px", color: "#5e5e66" }}>
                yer açılırsa
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {yedek.map((p) => {
                const cls = getClassByID(p.asClass || p.user.class);
                return (
                  <div key={p.userId} style={{
                    display: "flex", alignItems: "center", width: "200px", height: "26px",
                    padding: "0 9px", borderRadius: "7px",
                    background: "#141416", border: "1px solid #ffffff0f",
                  }}>
                    {/* Uzun aile adı sarmasın: sarınca kutu iki satıra çıkıp
                        yanındaki class yazısının üstüne biniyordu */}
                    <div style={{
                      display: "flex", fontSize: "12.5px", fontWeight: 600,
                      maxWidth: "104px", overflow: "hidden",
                      whiteSpace: "nowrap", textOverflow: "ellipsis",
                    }}>
                      {kisalt(p.user.familyName, 15)}
                    </div>
                    {p.user.guild && (
                      <div style={{
                        display: "flex", marginLeft: "4px", fontSize: "9px", fontWeight: 800,
                        flexShrink: 0, color: p.user.guild.color,
                      }}>
                        {p.user.guild.tag}
                      </div>
                    )}
                    <div style={{ display: "flex", marginLeft: "auto", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ display: "flex", fontSize: "9.5px", color: "#5e5e66", marginRight: "6px" }}>
                        {cls?.name ?? ""}
                      </div>
                      <div style={{ display: "flex", fontSize: "11.5px", fontWeight: 700, color: "#9a9aa2" }}>
                        {p.user.ap + p.user.dp}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Alt bilgi */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 30px", marginTop: "auto",
        }}>
          <div style={{ display: "flex", fontSize: "12px", color: "#5e5e66" }}>aetheri.online</div>
          <div style={{ display: "flex", fontSize: "12px", color: "#5e5e66" }}>
            Aetherion · Parti Listesi
          </div>
        </div>
      </div>
    ),
    { width: CARD_W, height },
  );
}
