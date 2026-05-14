export const BDO_CLASSES = [
  { id: "savasci", name: "Savaşçı", classType: 0, hasSuccession: true },
  { id: "hashashin", name: "Hashashin", classType: 1, hasSuccession: true },
  { id: "sage", name: "Sage", classType: 2, hasSuccession: true },
  { id: "wukong", name: "Wukong", classType: 3, hasSuccession: false },
  { id: "okcu", name: "Okçu", classType: 4, hasSuccession: true },
  { id: "guardian", name: "Guardian", classType: 5, hasSuccession: true },
  { id: "bilge", name: "Bilge", classType: 6, hasSuccession: false },
  { id: "drakania", name: "Drakania", classType: 7, hasSuccession: true },
  { id: "sahire", name: "Sahire", classType: 8, hasSuccession: true },
  { id: "nova", name: "Nova", classType: 9, hasSuccession: true },
  { id: "corsair", name: "Corsair", classType: 10, hasSuccession: true },
  { id: "lahn", name: "Lahn", classType: 11, hasSuccession: true },
  { id: "vahsi", name: "Vahşi", classType: 12, hasSuccession: true },
  { id: "maegu", name: "Maegu", classType: 15, hasSuccession: true },
  { id: "avci", name: "Avcı", classType: 16, hasSuccession: true },
  { id: "shai", name: "Shai", classType: 17, hasSuccession: false },
  { id: "musa", name: "Musa", classType: 20, hasSuccession: true },
  { id: "striker", name: "Striker", classType: 19, hasSuccession: true },
  { id: "maehwa", name: "Maehwa", classType: 21, hasSuccession: true },
  { id: "mistik", name: "Mistik", classType: 23, hasSuccession: true },
  { id: "valkyrie", name: "Valkyrie", classType: 24, hasSuccession: true },
  { id: "kunoichi", name: "Kunoichi", classType: 25, hasSuccession: true },
  { id: "ninja", name: "Ninja", classType: 26, hasSuccession: true },
  { id: "kara_sovalye", name: "Kara Şövalye", classType: 27, hasSuccession: true },
  { id: "buyucu", name: "Büyücü", classType: 28, hasSuccession: true },
  { id: "archer", name: "Archer", classType: 29, hasSuccession: false },
  { id: "cadi", name: "Cadı", classType: 31, hasSuccession: true },
  { id: "woosa", name: "Woosa", classType: 30, hasSuccession: true },
  { id: "seraph", name: "Seraph", classType: 32, hasSuccession: false },
  { id: "dosa", name: "Dosa", classType: 33, hasSuccession: true },
  { id: "deadeye", name: "Deadeye", classType: 34, hasSuccession: false },
] as const;

export type BdoClass = (typeof BDO_CLASSES)[number]["id"];

export function getClassByID(id: string) {
  return BDO_CLASSES.find((c) => c.id === id) ?? null;
}

export function getClassImageUrl(classType: number, spec: "awakening" | "succession"): string {
  return `https://static.pearlcdn.com/asset/portal/bdo_tr/contents/img/portal/gameinfo/${spec}_character_${classType}_char.jpg`;
}

export function getTypeName(type: string): string {
  switch (type) {
    case "NODE_WAR": return "Node War";
    case "SIEGE": return "Siege";
    case "KARA_TAPINAK": return "Kara Tapınak";
    case "OTHER": return "Diğer";
    default: return type;
  }
}
