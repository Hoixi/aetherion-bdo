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

  // ── Renk: spec badge ──
  const specBadge = specKey === "succession" ? "SUCC" : "AWK";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "400px",
          height: "500px",
          background: "#080810",
          borderRadius: "20px",
          overflow: "hidden",
          fontFamily: "sans-serif",
          border: "1.5px solid rgba(212,168,83,0.55)",
        }}
      >
        {/* ── Portrait area ── */}
        <div style={{ position: "relative", height: "295px", display: "flex", flexShrink: 0 }}>
          {/* Portrait image */}
          {portraitUrl && (
            <img
              src={portraitUrl}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "top center",
              }}
            />
          )}

          {/* Bottom gradient */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "160px",
              background: "linear-gradient(to bottom, transparent, #080810)",
            }}
          />

          {/* Spec badge — top left */}
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

          {/* Class icon — top right */}
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

          {/* Name overlay */}
          <div
            style={{
              position: "absolute",
              bottom: "8px",
              left: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {/* Guild label */}
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#d4a853", letterSpacing: "2px", display: "flex" }}>
              AETHERION GUILD
            </div>
            {/* Family name */}
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#ffffff", lineHeight: 1, display: "flex" }}>
              {user.familyName}
            </div>
            {/* Class · Spec */}
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", display: "flex" }}>
              {className} · {specLabel}
            </div>
          </div>
        </div>

        {/* ── AP / DP / GS row ── */}
        <div style={{ display: "flex", gap: "8px", padding: "12px 16px 10px", flexShrink: 0 }}>
          {/* AP */}
          <div
            style={{
              flex: 1,
              textAlign: "center",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.25)",
              borderRadius: "10px",
              padding: "10px 6px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <div style={{ fontSize: "9px", color: "#f87171", letterSpacing: "1px", display: "flex" }}>AP</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#fff", display: "flex" }}>{user.ap}</div>
          </div>
          {/* DP */}
          <div
            style={{
              flex: 1,
              textAlign: "center",
              background: "rgba(96,165,250,0.08)",
              border: "1px solid rgba(96,165,250,0.25)",
              borderRadius: "10px",
              padding: "10px 6px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <div style={{ fontSize: "9px", color: "#60a5fa", letterSpacing: "1px", display: "flex" }}>DP</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#fff", display: "flex" }}>{user.dp}</div>
          </div>
          {/* GS */}
          <div
            style={{
              flex: 1,
              textAlign: "center",
              background: "rgba(212,168,83,0.08)",
              border: "1px solid rgba(212,168,83,0.3)",
              borderRadius: "10px",
              padding: "10px 6px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <div style={{ fontSize: "9px", color: "#d4a853", letterSpacing: "1px", display: "flex" }}>GS</div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#d4a853", display: "flex" }}>{gs}</div>
          </div>
        </div>

        {/* ── Attendance row ── */}
        <div style={{ display: "flex", gap: "8px", padding: "0 16px", flexShrink: 0 }}>
          {/* Rate */}
          <div
            style={{
              flex: 1,
              background: "rgba(74,222,128,0.06)",
              border: "1px solid rgba(74,222,128,0.2)",
              borderRadius: "10px",
              padding: "9px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "1px", display: "flex" }}>
              KATILIM ORANI
            </div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: rateColor, display: "flex" }}>
              %{attendanceRate}
            </div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", display: "flex" }}>
              İlk savaştan beri
            </div>
          </div>
          {/* Wars */}
          <div
            style={{
              flex: 1,
              background: "rgba(212,168,83,0.05)",
              border: "1px solid rgba(212,168,83,0.15)",
              borderRadius: "10px",
              padding: "9px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "1px", display: "flex" }}>
              SAVAŞ
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#d4a853", display: "flex" }}>
                {effectiveAttended}
              </div>
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.35)", display: "flex" }}>
                /{totalWars}
              </div>
            </div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", display: "flex" }}>katılım</div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "9px 16px",
            background: "rgba(212,168,83,0.06)",
            borderTop: "1px solid rgba(212,168,83,0.15)",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: 700, color: "#d4a853", letterSpacing: "1px", display: "flex" }}>
            ⚔ AETHERION
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
    ),
    {
      width: 400,
      height: 500,
    }
  );
}
