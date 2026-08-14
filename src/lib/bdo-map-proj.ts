/**
 * BDO oyun koordinatı → harita koordinatı dönüşümü.
 *
 * Noktalar veritabanında ham oyun koordinatıyla (gameX/gameZ) saklanır.
 * Taban harita değişse bile ham koordinat değişmez; sadece buradaki
 * kalibrasyon güncellenir ve bütün noktalar yerli yerine oturur.
 *
 * Dünya geometrisi regionclientdata'dan geliyor: dünya tam 256 sektör
 * kare, sektör başına 12800 oyun birimi.
 */

export const SECTOR = 12800;
/** Dünya karesinin sol kenarı (sektör indeksi -136) */
export const WORLD_X0 = -136 * SECTOR;
/** Dünya karesinin üst kenarı (sektör indeksi 143, +1 = kenar) */
export const WORLD_Z1 = 144 * SECTOR;
/** Dünya karesinin sektör cinsinden genişliği — ikinin kuvveti, karo piramidiyle uyumlu */
export const WORLD_SPAN = 256;

/**
 * Taban harita kalibrasyonu.
 *
 * questlog karoları dünya karesini birebir kaplamıyor — kendi kırpması var.
 * Bu yüzden ham normalizasyonun üstüne bir afin düzeltme uygulanır.
 * Değerler admin kalibrasyon ekranından güncellenir: haritada yeri kesin
 * bilinen iki noktayı işaretlersin, katsayılar buradan çözülür.
 *
 * scale = 1, offset = 0 → düzeltme yok (ham dünya normalizasyonu).
 */
export type MapCalibration = {
  scaleX: number;
  offsetX: number;
  scaleY: number;
  offsetY: number;
};

export const IDENTITY_CALIBRATION: MapCalibration = {
  scaleX: 1, offsetX: 0, scaleY: 1, offsetY: 0,
};

/** Ham dünya normalizasyonu — kalibrasyon uygulanmamış hali */
export function gameToWorldNorm(gameX: number, gameZ: number): { nx: number; ny: number } {
  return {
    nx: (gameX - WORLD_X0) / SECTOR / WORLD_SPAN,
    // oyunda z kuzeye artar, haritada y güneye artar
    ny: (WORLD_Z1 - gameZ) / SECTOR / WORLD_SPAN,
  };
}

/** Oyun koordinatı → haritada çizilecek 0–1 konumu */
export function gameToMap(
  gameX: number,
  gameZ: number,
  cal: MapCalibration = IDENTITY_CALIBRATION,
): { x: number; y: number } {
  const { nx, ny } = gameToWorldNorm(gameX, gameZ);
  return {
    x: nx * cal.scaleX + cal.offsetX,
    y: ny * cal.scaleY + cal.offsetY,
  };
}

/** Haritada tıklanan 0–1 konumu → oyun koordinatı (nokta eklerken kullanılır) */
export function mapToGame(
  x: number,
  y: number,
  cal: MapCalibration = IDENTITY_CALIBRATION,
): { gameX: number; gameZ: number } {
  const nx = (x - cal.offsetX) / cal.scaleX;
  const ny = (y - cal.offsetY) / cal.scaleY;
  return {
    gameX: nx * WORLD_SPAN * SECTOR + WORLD_X0,
    gameZ: WORLD_Z1 - ny * WORLD_SPAN * SECTOR,
  };
}

/**
 * İki referans noktasından afin kalibrasyonu çözer.
 *
 * `ref` = yeri kesin bilinen noktanın ham oyun koordinatı,
 * `actual` = o noktanın haritada gerçekte durduğu 0–1 konumu.
 * İki nokta eksenler arası dönme olmadığı sürece yeterli.
 */
export function solveCalibration(
  a: { gameX: number; gameZ: number; mapX: number; mapY: number },
  b: { gameX: number; gameZ: number; mapX: number; mapY: number },
): MapCalibration {
  const na = gameToWorldNorm(a.gameX, a.gameZ);
  const nb = gameToWorldNorm(b.gameX, b.gameZ);

  const dnx = nb.nx - na.nx;
  const dny = nb.ny - na.ny;

  // Aynı eksende çakışan iki nokta o ekseni çözemez — mevcut ölçeği koru
  const scaleX = Math.abs(dnx) > 1e-9 ? (b.mapX - a.mapX) / dnx : 1;
  const scaleY = Math.abs(dny) > 1e-9 ? (b.mapY - a.mapY) / dny : 1;

  return {
    scaleX,
    offsetX: a.mapX - na.nx * scaleX,
    scaleY,
    offsetY: a.mapY - na.ny * scaleY,
  };
}
