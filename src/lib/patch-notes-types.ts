// Shared types for structured patch notes (used by both API route and client pages)

export interface StructuredChange {
  tr: string;
  en: string;
  type: "BUFF" | "NERF" | "FIX" | "NEW" | "CHANGE";
  skillName?: string;       // original skill/sub-heading name
  skillNameTr?: string;     // Turkish skill name
  skillImageUrl?: string;   // skill icon URL ([IMG:url] before the skill heading)
}

export interface StructuredSection {
  id: string;         // slug, e.g. "warrior"
  heading: string;    // English heading (class name or category)
  headingTr: string;  // Turkish heading
  emoji: string;
  changes: StructuredChange[];
}

export interface StructuredPatchNote {
  titleTr: string;
  summary: string;      // 1–2 sentence Turkish summary
  summaryEn: string;
  sections: StructuredSection[];
}
