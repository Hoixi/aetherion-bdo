import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getClassByID, getClassIconUrl, getTypeName } from "@/lib/classes";

export const dynamic = "force-dynamic";
// Prisma Edge'de çalışmaz
export const runtime = "nodejs";

const SITE_URL = process.env.NEXTAUTH_URL || "https://aetheri.online";

/** Sıralanabilir metrikler — ?sort= ile seçilir */
const METRICS = {
  damageDealt:  { label: "HASAR",       short: "HASAR", fmt: "big", color: "#e0b040" },
  kills:        { label: "KILL",        short: "KILL",  fmt: "num", color: "#dce4f2" },
  deaths:       { label: "ÖLÜM",        short: "ÖLÜM",  fmt: "num", color: "#e05252" },
  castleDamage: { label: "KALE HASARI", short: "KALE",  fmt: "big", color: "#e09832" },
} as const;

type MetricKey = keyof typeof METRICS;

const METRIC_ORDER: MetricKey[] = ["damageDealt", "kills", "deaths", "castleDamage"];

function fmtBig(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.round(n / 1_000) + "K";
  return String(Math.round(n));
}

export async function GET(req: Request, { params }: { params: { warId: string } }) {
  const warId = Number(params.warId);
  if (isNaN(warId)) return new Response("Invalid ID", { status: 400 });

  const url = new URL(req.url);
  const sortParam = url.searchParams.get("sort") as MetricKey | null;
  const sortKey: MetricKey = sortParam && sortParam in METRICS ? sortParam : "damageDealt";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 15);
  const guildFilter = url.searchParams.get("guild");

  const war = await prisma.war.findUnique({
    where: { id: warId },
    select: { id: true, title: true, type: true, date: true, result: true },
  });
  if (!war) return new Response("Not found", { status: 404 });

  const performances = await prisma.warPerformance.findMany({
    where: {
      warId,
      ...(guildFilter ? { user: { guildId: Number(guildFilter) } } : {}),
    },
    include: {
      user: {
        select: {
          familyName: true, class: true,
          guild: { select: { tag: true, color: true } },
        },
      },
    },
  });

  if (performances.length === 0) return new Response("No data", { status: 404 });

  const rows = [...performances].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, limit);
  const metric = METRICS[sortKey];
  const topValue = rows[0]?.[sortKey] ?? 1;

  // Klan bazlı toplamlar — başlık şeridinde gösterilir
  const guildTotals = new Map<string, { tag: string; color: string; count: number; dmg: number }>();
  for (const p of performances) {
    const g = p.user?.guild;
    if (!g) continue;
    const cur = guildTotals.get(g.tag) ?? { tag: g.tag, color: g.color, count: 0, dmg: 0 };
    cur.count++;
    cur.dmg += p.damageDealt;
    guildTotals.set(g.tag, cur);
  }
  const guildList = Array.from(guildTotals.values()).sort((a, b) => b.dmg - a.dmg);

  const totalDamage = performances.reduce((s, p) => s + p.damageDealt, 0);
  const totalKills = performances.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = performances.reduce((s, p) => s + p.deaths, 0);
  const totalCastle = performances.reduce((s, p) => s + p.castleDamage, 0);

  const dateStr = new Date(war.date).toLocaleDateString("tr-TR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Istanbul",
  });

  const resultLabel = war.result === "WIN" ? "GALİBİYET"
    : war.result === "LOSS" ? "MAĞLUBİYET"
    : war.result === "DRAW" ? "BERABERE" : null;
  const resultColor = war.result === "WIN" ? "#2bca6e"
    : war.result === "LOSS" ? "#e05252" : "#7a8ba3";

  const rowH = 46;
  const height = 190 + rows.length * rowH + 56;

  return new ImageResponse(
    (
      <div
        style={{
          width: "900px",
          height: `${height}px`,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, #1a2233 0%, #131820 42%, #0c0f15 100%)",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Üst altın çizgi */}
        <div style={{
          display: "flex", height: "3px", width: "100%",
          background: "linear-gradient(90deg, #e0b040, #c29328 40%, transparent)",
        }} />

        {/* Başlık */}
        <div style={{ display: "flex", flexDirection: "column", padding: "22px 32px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", fontSize: "30px", fontWeight: 800, color: "#dce4f2" }}>
              {war.title}
            </div>
            {resultLabel && (
              <div style={{
                display: "flex", fontSize: "13px", fontWeight: 700, color: resultColor,
                border: `1px solid ${resultColor}55`, background: `${resultColor}18`,
                padding: "3px 10px", borderRadius: "6px", letterSpacing: "1px",
              }}>
                {resultLabel}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "6px" }}>
            <div style={{ display: "flex", fontSize: "15px", color: "#7a8ba3" }}>
              {getTypeName(war.type)} · {dateStr}
            </div>
            {guildList.map((g) => (
              <div key={g.tag} style={{
                display: "flex", alignItems: "center", gap: "5px",
                fontSize: "12px", fontWeight: 700, color: g.color,
                border: `1px solid ${g.color}45`, background: `${g.color}16`,
                padding: "2px 8px", borderRadius: "5px",
              }}>
                {g.tag}
                <span style={{ color: "#7a8ba3", fontWeight: 500 }}>{g.count}</span>
              </div>
            ))}
          </div>

          {/* Toplamlar */}
          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            {[
              { l: "TOPLAM HASAR", v: fmtBig(totalDamage), c: "#e0b040" },
              { l: "TOPLAM KILL", v: String(totalKills), c: "#dce4f2" },
              { l: "TOPLAM ÖLÜM", v: String(totalDeaths), c: "#e05252" },
              { l: "KALE HASARI", v: fmtBig(totalCastle), c: "#e09832" },
            ].map((s) => (
              <div key={s.l} style={{
                display: "flex", flexDirection: "column",
                background: "#10151d", border: "1px solid #1e2a3c",
                borderRadius: "9px", padding: "7px 14px", minWidth: "126px",
              }}>
                <div style={{ display: "flex", fontSize: "10px", color: "#4d5c73", letterSpacing: "1px" }}>
                  {s.l}
                </div>
                <div style={{ display: "flex", fontSize: "21px", fontWeight: 700, color: s.c, marginTop: "1px" }}>
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sıralama başlığı */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 32px 8px",
        }}>
          <div style={{ display: "flex", fontSize: "12px", color: "#4d5c73", letterSpacing: "1.5px", fontWeight: 700 }}>
            {metric.label} SIRALAMASI
          </div>
          <div style={{ display: "flex", fontSize: "12px", color: "#4d5c73" }}>
            İLK {rows.length}
          </div>
        </div>

        {/* Satırlar */}
        <div style={{ display: "flex", flexDirection: "column", padding: "0 32px" }}>
          {rows.map((p, i) => {
            const cls = getClassByID(p.class || p.user?.class || "");
            const iconPath = getClassIconUrl(p.class || p.user?.class || "");
            const iconUrl = iconPath ? `${SITE_URL}${iconPath}` : null;
            const value = p[sortKey];
            const pct = topValue > 0 ? Math.max(3, (value / topValue) * 100) : 0;
            const rank = i + 1;
            const rankColor = rank === 1 ? "#facc15" : rank === 2 ? "#cbd5e1" : rank === 3 ? "#d97706" : "#4d5c73";
            const g = p.user?.guild;

            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", height: `${rowH}px`,
                borderBottom: "1px solid #1a2030", position: "relative",
              }}>
                {/* Arka plan barı */}
                <div style={{
                  display: "flex", position: "absolute", left: 0, top: "5px", bottom: "5px",
                  width: `${pct}%`, background: `${metric.color}12`, borderRadius: "6px",
                }} />

                {/* Sıra */}
                <div style={{
                  display: "flex", width: "34px", fontSize: "17px", fontWeight: 800,
                  color: rankColor, justifyContent: "center",
                }}>
                  {rank}
                </div>

                {/* Class ikonu */}
                {iconUrl ? (
                  <img src={iconUrl} width={24} height={24} style={{ opacity: 0.75, marginRight: "10px" }} alt="" />
                ) : (
                  <div style={{ display: "flex", width: "24px", marginRight: "10px" }} />
                )}

                {/* İsim + class */}
                <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    <div style={{ display: "flex", fontSize: "17px", fontWeight: 600, color: "#dce4f2" }}>
                      {p.user?.familyName || p.inGameName}
                    </div>
                    {g && (
                      <div style={{
                        display: "flex", fontSize: "10px", fontWeight: 700, color: g.color,
                        border: `1px solid ${g.color}40`, background: `${g.color}14`,
                        padding: "1px 5px", borderRadius: "4px",
                      }}>
                        {g.tag}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", fontSize: "11px", color: "#4d5c73" }}>
                    {cls?.name ?? "—"}
                    {cls ? ` · ${p.spec === "succession" ? "SUC" : "AWK"}` : ""}
                  </div>
                </div>

                {/* Yan istatistikler */}
                <div style={{ display: "flex", gap: "20px", marginRight: "24px" }}>
                  {METRIC_ORDER.filter((k) => k !== sortKey).map((k) => {
                    const m = METRICS[k];
                    const v = p[k];
                    return (
                      <div key={k} style={{ display: "flex", alignItems: "baseline", gap: "5px" }}>
                        <div style={{ display: "flex", fontSize: "10px", color: "#3d4a5c" }}>{m.short}</div>
                        <div style={{ display: "flex", fontSize: "14px", fontWeight: 600, color: "#9fb0c9" }}>
                          {m.fmt === "big" ? fmtBig(v) : String(v)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ana metrik */}
                <div style={{
                  display: "flex", width: "104px", justifyContent: "flex-end",
                  fontSize: "20px", fontWeight: 800, color: metric.color,
                }}>
                  {metric.fmt === "big" ? fmtBig(value) : String(value)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Alt bilgi */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 32px", marginTop: "auto",
        }}>
          <div style={{ display: "flex", fontSize: "12px", color: "#4d5c73" }}>
            aetheri.online
          </div>
          <div style={{ display: "flex", fontSize: "12px", color: "#4d5c73" }}>
            Aetherion · Hasar Raporu
          </div>
        </div>
      </div>
    ),
    { width: 900, height },
  );
}
