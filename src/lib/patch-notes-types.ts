// Shared types for structured patch notes (used by both API route and client pages)

export interface StructuredChange {
  tr: string;
  en: string;
  type: "BUFF" | "NERF" | "FIX" | "NEW" | "CHANGE";
  imageUrl?: string;
}

export interface StructuredSection {
  id: string;         // slug, e.g. "warrior"
  heading: string;    // English heading
  headingTr: string;  // Turkish heading
  emoji: string;
  imageUrl?: string;  // skill/section icon from patch note HTML
  changes: StructuredChange[];
}

export interface StructuredPatchNote {
  titleTr: string;
  summary: string;      // 1–2 sentence Turkish summary
  summaryEn: string;
  sections: StructuredSection[];
}
