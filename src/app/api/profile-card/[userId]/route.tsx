import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getClassByID, getPortraitUrl, getClassIconUrl } from "@/lib/classes";

export const dynamic = "force-dynamic";
// Node.js runtime — Prisma çalışır, Edge'de çalışmaz
export const runtime = "nodejs";

const SITE_URL = process.env.NEXTAUTH_URL || "https://aetherion-bdo.vercel.app";

export async function GET(_req: Request, { params }: { params: { userId: string } }) {
  const userId = Number(params.userId);
  if (isNaN(userId)) return new Response("Invalid ID", { status: 400 });

  // ── Kullanıcı verisi ──
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { siteRole: true },
  });
  if (!user || !user.familyName) return new Response("Not found", { status: 404 });

  // ── Katılım hesabı: ilk "ATTENDING" savaşından itibaren ──
  const firstAttend = await prisma.warParticipant.findFirst({
    where: { userId, status: "ATTENDING" },
    orderBy: { war: { date: "asc" } },
    include: { war: { select: { date: true } } },
  });

  const [attended, totalWars] = await Promise.all([
    prisma.warParticipant.count({ where: { userId, status: "ATTENDING" } }),
    firstAttend
      ? prisma.war.count({ where: { date: { gte: firstAttend.war.date } } })
      : Promise.resolve(0),
  ]);

  // Partiye alınıp gelmediyse çıkar
  const absenceCount = user.absenceCount ?? 0;
  const effectiveAttended = Math.max(0, attended - absenceCount);
  const attendanceRate = totalWars > 0 ? Math.round((effectiveAttended / totalWars) * 100) : 0;

  // ── Class / spec bilgisi ──
  const classData = getClassByID(user.class);
  const specKey   = user.spec === "succession" && classData?.hasSuccession ? "succession" : "awakening";
  const specLabel = specKey === "succession" ? "Succession" : "Awakening";
  const className = classData?.name ?? user.class;

  // ── Görsel URL'leri (mutlak) ──
  const portraitPath = getPortraitUrl(user.class, user.spec);
  const iconPath     = getClassIconUrl(user.class);
  const portraitUrl  = portraitPath ? `${SITE_URL}${portraitPath}` : null;
  const iconUrl      = iconPath ? `${SITE_URL}${iconPath}` : null;

  const gs = user.ap + user.dp;
  const rateColor = attendanceRate >= 70 ? "#4ade80" : attendanceRate >= 40 ? "#facc15" : "#f87171";
  const roleColor = user.siteRole?.color ?? "#a78bfa";
  const specBadge = specKey === "succession" ? "SUCC" : "AWK";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "400px",
          height: "500px",
          background: "#07080f",
          borderRadius: "20px",
          overflow: "hidden",
          fontFamily: "sans-serif",
          border: "1.5px solid rgba(212,168,83,0.55)",
          position: "relative",
        }}
      >
        {/* ── Portre: kartın tamamını doldurur ── */}
        {portraitUrl && (
          <img
            src={portraitUrl}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top center",
            }}
          />
        )}

        {/* ── Alt gradient: portre soluklaşarak istatistiklere geçer ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "320px",
            background:
              "linear-gradient(to top, #07080f 0%, #07080f 38%, rgba(7,8,15,0.92) 58%, rgba(7,8,15,0.55) 78%, transparent 100%)",
          }}
        />

        {/* ── Spec badge — sol üst ── */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            background: "rgba(0,0,0,0.65)",
            border: "1px solid rgba(212,168,83,0.5)",
            borderRadius: "6px",
            padding: "3px 10px",
            fontSize: "10px",
            fontWeight: 700,
            color: "#d4a853",
            letterSpacing: "1px",
            display: "flex",
          }}
        >
          {specBadge}
        </div>

        {/* ── Class icon — sağ üst ── */}
        {iconUrl && (
          <div
            style={{
              position: "absolute",
              top: "10px",
              right: "12px",
              width: "42px",
              height: "42px",
              background: "rgba(0,0,0,0.65)",
              border: "1px solid rgba(212,168,83,0.35)",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "7px",
            }}
          >
            <img src={iconUrl} style={{ width: "100%", height: "100%" }} />
          </div>
        )}

        {/* ── Alt içerik: isim + istatistikler ── */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* İsim + class */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              padding: "0 16px 10px",
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#d4a853", letterSpacing: "2px", display: "flex" }}>
              AETHERION GUILD
            </div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#ffffff", lineHeight: 1, display: "flex" }}>
              {user.familyName}
            </div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "flex" }}>
              {className} · {specLabel}
            </div>
          </div>

          {/* AP / DP / GS */}
          <div style={{ display: "flex", gap: "8px", padding: "0 16px 8px" }}>
            <div
              style={{
                flex: 1,
                textAlign: "center",
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.25)",
                borderRadius: "10px",
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <div style={{ fontSize: "9px", color: "#f87171", letterSpacing: "1px", display: "flex" }}>AP</div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff", display: "flex" }}>{user.ap}</div>
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "center",
                background: "rgba(96,165,250,0.08)",
                border: "1px solid rgba(96,165,250,0.25)",
                borderRadius: "10px",
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <div style={{ fontSize: "9px", color: "#60a5fa", letterSpacing: "1px", display: "flex" }}>DP</div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#fff", display: "flex" }}>{user.dp}</div>
            </div>
            <div
              style={{
                flex: 1,
                textAlign: "center",
                background: "rgba(212,168,83,0.08)",
                border: "1px solid rgba(212,168,83,0.3)",
                borderRadius: "10px",
                padding: "8px 6px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <div style={{ fontSize: "9px", color: "#d4a853", letterSpacing: "1px", display: "flex" }}>GS</div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#d4a853", display: "flex" }}>{gs}</div>
            </div>
          </div>

          {/* Katılım */}
          <div style={{ display: "flex", gap: "8px", padding: "0 16px 10px" }}>
            <div
              style={{
                flex: 1,
                background: "rgba(74,222,128,0.06)",
                border: "1px solid rgba(74,222,128,0.2)",
                borderRadius: "10px",
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "1px", display: "flex" }}>
                KATILIM ORANI
              </div>
              <div style={{ fontSize: "20px", fontWeight: 900, color: rateColor, display: "flex" }}>
                %{attendanceRate}
              </div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", display: "flex" }}>
                İlk savaştan beri
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(212,168,83,0.05)",
                border: "1px solid rgba(212,168,83,0.15)",
                borderRadius: "10px",
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "1px", display: "flex" }}>
                SAVAŞ
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#d4a853", display: "flex" }}>
                  {effectiveAttended}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", display: "flex" }}>
                  /{totalWars}
                </div>
              </div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", display: "flex" }}>katılım</div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 16px",
              background: "rgba(212,168,83,0.06)",
              borderTop: "1px solid rgba(212,168,83,0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <img src={`${SITE_URL}/icons/logo.png`} style={{ width: "20px", height: "20px" }} />
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#d4a853", letterSpacing: "1px", display: "flex" }}>
                AETHERION
              </div>
            </div>
            {user.siteRole && (
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: roleColor,
                  border: `1px solid ${roleColor}55`,
                  background: `${roleColor}18`,
                  padding: "2px 10px",
                  borderRadius: "99px",
                  display: "flex",
                }}
              >
                {user.siteRole.name}
              </div>
            )}
          </div>
        </div>
      </div>
    ),
    {
      width: 400,
      height: 500,
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}
