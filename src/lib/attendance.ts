/**
 * Savaş katılım durumu.
 *
 * Üç veri kaynağının kesişiminden türer — ayrı bir alan tutulmaz:
 *   katıldı mı  → WarParticipant.status
 *   seçildi mi  → PartyMember
 *   geldi mi    → WarPerformance
 */

export type AttendanceStatus =
  | "attending_not_selected"    // Katıl ✓ — seçilmedi
  | "attending_selected_absent" // Katıl ✓ — seçildi — gelmedi
  | "attending_selected_came"   // Katıl ✓ — seçildi — geldi
  | "not_attending"             // Katılmıyor / cevap yok
  | "not_attending_came";       // Katılmıyor / cevap yok — ama geldi

export function classifyAttendance(
  participantStatus: string | undefined,
  selected: boolean,
  came: boolean,
): AttendanceStatus {
  if (participantStatus === "ATTENDING") {
    if (!selected) return "attending_not_selected";
    return came ? "attending_selected_came" : "attending_selected_absent";
  }
  return came ? "not_attending_came" : "not_attending";
}

export const ATTENDANCE_META: Record<
  AttendanceStatus,
  { label: string; short: string; mark: string; color: string; bg: string }
> = {
  attending_not_selected: {
    label: "Başvurdu, seçilmedi", short: "Seçilmedi", mark: "✓",
    color: "#6b93ff", bg: "rgba(107,147,255,.12)",
  },
  attending_selected_absent: {
    label: "Seçildi, gelmedi", short: "Gelmedi", mark: "✕",
    color: "#e05252", bg: "rgba(224,82,82,.12)",
  },
  attending_selected_came: {
    label: "Savaşa geldi", short: "Geldi", mark: "✓",
    color: "#2bca6e", bg: "rgba(43,202,110,.12)",
  },
  not_attending: {
    label: "Katılmadı", short: "Katılmadı", mark: "○",
    color: "#7a8ba3", bg: "rgba(122,139,163,.10)",
  },
  not_attending_came: {
    label: "Katıl demedi ama geldi", short: "Habersiz geldi", mark: "✓",
    color: "#e09832", bg: "rgba(224,152,50,.12)",
  },
};

/**
 * Hasar raporu yüklenmeden "geldi/gelmedi" bilinemez — rapor yokken
 * herkes gelmemiş görünür. Bu yüzden çağıran taraf raporun varlığını
 * kontrol edip ona göre gösterim yapmalı.
 */
export function attendanceKnown(performanceCount: number): boolean {
  return performanceCount > 0;
}
