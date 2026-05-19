export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

export type AttendanceStatus =
  | "attending_not_selected"    // Katıl ✓ — seçilmedi         → 🟠 X
  | "attending_selected_absent" // Katıl ✓ — seçildi — gelmedi → 🔴 X
  | "attending_selected_came"   // Katıl ✓ — seçildi — geldi   → 🟢 ✓
  | "not_attending"             // Katılmıyor / cevap yok        → 🟠 O
  | "not_attending_came";       // Katılmıyor / cevap yok — geldi→ 🟠 ✓

export interface WarAttendanceSummary {
  warId: number;
  title: string;
  date: string;
  // userId → status
  statuses: Record<number, AttendanceStatus>;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Last 5 completed wars (past date)
  const wars = await db.war.findMany({
    orderBy: { date: "desc" },
    take: 5,
    where: { date: { lt: new Date() } },
    select: {
      id: true,
      title: true,
      date: true,
      participants: { select: { userId: true, status: true } },
      parties: { select: { members: { select: { userId: true } } } },
      performances: { select: { userId: true, inGameName: true } },
    },
  });

  // All active members for family-name → userId matching
  const members = await db.user.findMany({
    where: { deletedAt: null },
    select: { id: true, familyName: true },
  });
  const familyNameToId = new Map<string, number>(
    members.map((m: { id: number; familyName: string }) => [m.familyName.toLowerCase(), m.id])
  );

  const result: WarAttendanceSummary[] = wars.map((war: {
    id: number;
    title: string;
    date: Date;
    participants: { userId: number; status: string }[];
    parties: { members: { userId: number }[] }[];
    performances: { userId: number | null; inGameName: string }[];
  }) => {
    // userId → "ATTENDING" | "DECLINED"
    const participantStatus = new Map<number, string>(
      war.participants.map((p) => [p.userId, p.status])
    );

    // userIds in any party
    const inParty = new Set<number>(
      war.parties.flatMap((party) => party.members.map((m) => m.userId))
    );

    // userIds with performance (by userId first, then familyName fallback)
    const hasPerformance = new Set<number>();
    for (const perf of war.performances) {
      if (perf.userId) {
        hasPerformance.add(perf.userId);
      } else {
        const uid = familyNameToId.get(perf.inGameName.toLowerCase());
        if (uid) hasPerformance.add(uid);
      }
    }

    // Compute status for every member we know about
    const allUserIds = new Set<number>([
      ...participantStatus.keys(),
      ...inParty,
      ...hasPerformance,
    ]);

    const statuses: Record<number, AttendanceStatus> = {};
    for (const userId of allUserIds) {
      const pStatus = participantStatus.get(userId); // "ATTENDING" | "DECLINED" | undefined
      const selected = inParty.has(userId);
      const came = hasPerformance.has(userId);

      if (pStatus === "ATTENDING") {
        if (!selected) {
          statuses[userId] = "attending_not_selected";
        } else if (came) {
          statuses[userId] = "attending_selected_came";
        } else {
          statuses[userId] = "attending_selected_absent";
        }
      } else {
        // DECLINED or no response
        statuses[userId] = came ? "not_attending_came" : "not_attending";
      }
    }

    return {
      warId: war.id,
      title: war.title,
      date: war.date.toISOString(),
      statuses,
    };
  });

  return NextResponse.json(result);
}
