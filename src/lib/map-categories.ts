/** Edania harita kategorileri — renk ve etiketler tek yerden */
export const MAP_CATEGORIES = {
  relic: { label: "Tachyon Mirası",  color: "#ffd54a", countable: true  },
  trace: { label: "Tachyon İzi",     color: "#ff4d4d", countable: true  },
  klore: { label: "Bilgi",           color: "#7ad3ff", countable: true  },
  node:  { label: "Üs Yöneticisi",   color: "#2bca6e", countable: false },
  npc:   { label: "Köy NPC",         color: "#b98cff", countable: false },
} as const;

export type MapCategory = keyof typeof MAP_CATEGORIES;

export const CATEGORY_ORDER: MapCategory[] = ["relic", "trace", "klore", "node", "npc"];

export function categoryMeta(c: string) {
  return MAP_CATEGORIES[c as MapCategory] ?? { label: c, color: "#7a8ba3", countable: false };
}
