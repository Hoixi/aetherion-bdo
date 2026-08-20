/**
 * BDO için CPU affinity hazır ayarları.
 *
 * Maskeler ACanadianDude'un "Ultimate BDO Performance Guide" belgesindeki
 * onaltılık değerlerin ondalık karşılığı. Mantık şu: 0. çekirdeği Windows'a
 * bırak, SMT kardeşlerini kapat, yalnızca fiziksel çekirdekleri aç.
 *
 * Hem eski `/optimizer` ekranı hem yeni `/test/optimizer` buradan okuyor.
 */

export type CpuPreset = {
  match: RegExp;
  label: string;
  mask: number;
  enabledThreads: number[];
  note: string;
};

export const BDO_CPU_PRESETS: CpuPreset[] = [
  {
    match: /Ryzen [35] (3500)/i,
    label: "Ryzen 5 3500(X)",
    mask: 0,  // no change needed (6c/6t, no SMT)
    enabledThreads: [],
    note: "Değişiklik gerekmiyor (SMT yok).",
  },
  {
    match: /Ryzen 5 (1[46]00|2[46]00|25[0-9]{2}X|3[46]00|5[56]00|7[56]00)/i,
    label: "Ryzen 5 6c/12t",
    mask: 0x555,   // 1365
    enabledThreads: [0, 2, 4, 6, 8, 10],
    note: "6 fiziksel çekirdek, SMT kapalı. Maske: 555",
  },
  {
    match: /Ryzen 5 (1[45]00X?|2[45]00[GX]?|3[45]00[GX]?)/i,
    label: "Ryzen 5 4c/8t",
    mask: 0x50,    // 80
    enabledThreads: [4, 6],
    note: "4c/8t için en iyi CCX'i izole et. Maske: 50",
  },
  {
    match: /Ryzen 3 (1[23]00X?|2200[GE]?|3200[GE]?)/i,
    label: "Ryzen 3 4c/4t",
    mask: 0xC,     // 12
    enabledThreads: [2, 3],
    note: "Çok az çekirdek, sonuç değişebilir. Maske: C",
  },
  {
    match: /Ryzen 7 (1[78]00X?|2700X?)/i,
    label: "Ryzen 7 8c/16t (Zen 1)",
    mask: 0x5500,  // 21760
    enabledThreads: [8, 10, 12, 14],
    note: "2 CCX, 4c her biri. Bir CCX'i izole et. Maske: 5500",
  },
  {
    match: /Ryzen 7 (3700X?|3800X)/i,
    label: "Ryzen 7 8c/16t (Zen 2)",
    mask: 0x5550,  // 21840
    enabledThreads: [4, 6, 8, 10, 12, 14],
    note: "6 fiziksel çekirdek, SMT kapalı. Maske: 5550",
  },
  {
    match: /Ryzen 7 (5800X3D?|7800X3D?)/i,
    label: "Ryzen 7 8c/16t (Zen 3/4, 1 CCX)",
    mask: 0x5554,  // 21844
    enabledThreads: [2, 4, 6, 8, 10, 12, 14],
    note: "Core 0 Windows'a ayrılır, SMT kapalı. Maske: 5554",
  },
  {
    match: /Ryzen 9 7900X3D/i,
    label: "Ryzen 9 7900X3D",
    mask: 0x555,   // 1365 — X3D CCD'yi izole et
    enabledThreads: [0, 2, 4, 6, 8, 10],
    note: "Sadece X3D CCD. SMT kapalı. Maske: 555",
  },
  {
    match: /Ryzen 9 (3900X?|5900X?|7900X?)/i,
    label: "Ryzen 9 12c/24t",
    mask: 0x555000, // 5591040 — tek chiplet izolasyonu
    enabledThreads: [12, 14, 16, 18, 20, 22],
    note: "Bir chiplet'e izole et. SMT kapalı. Maske: 555000",
  },
  {
    match: /Ryzen 9 7950X3D/i,
    label: "Ryzen 9 7950X3D",
    mask: 0x5555,  // 21845 — X3D CCD
    enabledThreads: [0, 2, 4, 6, 8, 10, 12, 14],
    note: "Sadece X3D CCD. SMT kapalı. Maske: 5555",
  },
  {
    match: /Ryzen 9 (3950X?|5950X?|7950X?)/i,
    label: "Ryzen 9 16c/32t",
    mask: 0x5550000, // bir chiplet, 6 core
    enabledThreads: [16, 18, 20, 22, 24, 26],
    note: "Bir chiplet'e izole et. SMT kapalı. Maske: 5550000",
  },
];

/** İşlemci adına uyan ilk hazır ayar; eşleşme yoksa null */
export function getBdoPreset(cpuName: string): CpuPreset | null {
  for (const preset of BDO_CPU_PRESETS) {
    if (preset.match.test(cpuName)) return preset;
  }
  return null;
}

export const PRIORITY_OPTIONS = [
  { value: "Normal", label: "Normal", color: "#9a9aa2" },
  { value: "AboveNormal", label: "Normalin Üstü", color: "#6b93ff" },
  { value: "High", label: "Yüksek (Önerilen)", color: "#e8b451" },
];
