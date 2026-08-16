"use client";

/**
 * Karo tabanlı mini harita.
 *
 * Leaflet PiP penceresinde global window/document'e bağlandığı için
 * güvenilmez; burada sadece görünür karoları konumlandırıyoruz.
 * Aynı piramidi kullanır: L{seviye}/{x}_{y}.webp, ızgara = seviye / 2.
 */

type Marker = { nx: number; ny: number; color: string; ring?: boolean; label?: string };

type Props = {
  /** Merkeze alınacak konum, 0–1 dünya normalizasyonu */
  nx: number;
  ny: number;
  markers?: Marker[];
  width?: number;
  height?: number;
  /** 16 / 32 / 64 / 128 — büyüdükçe yakınlaşır */
  level?: 16 | 32 | 64 | 128;
  tilePx?: number;
};

export function MiniMap({
  nx, ny, markers = [], width = 320, height = 190, level = 64, tilePx = 150,
}: Props) {
  const grid = level / 2;
  const mapPx = grid * tilePx;

  // Hedefi tam ortaya alacak kaydırma
  const offsetX = width / 2 - nx * mapPx;
  const offsetY = height / 2 - ny * mapPx;

  // Yalnızca görünür aralıktaki karolar çizilir
  const x0 = Math.max(0, Math.floor(-offsetX / tilePx));
  const x1 = Math.min(grid - 1, Math.floor((-offsetX + width) / tilePx));
  const y0 = Math.max(0, Math.floor(-offsetY / tilePx));
  const y1 = Math.min(grid - 1, Math.floor((-offsetY + height) / tilePx));

  const tiles: { x: number; y: number }[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) tiles.push({ x, y });
  }

  return (
    <div style={{
      position: "relative", width, height, overflow: "hidden",
      background: "#183435", borderRadius: 6,
    }}>
      {tiles.map((t) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={t.x + "_" + t.y}
          src={`/map/edania/L${level}/${t.x}_${t.y}.webp`}
          alt=""
          style={{
            position: "absolute",
            left: t.x * tilePx + offsetX,
            top: t.y * tilePx + offsetY,
            width: tilePx, height: tilePx,
            // Kutu dışındaki karolar yok — kırık görsel görünmesin
            display: "block",
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
        />
      ))}

      {markers.map((m, i) => {
        const left = m.nx * mapPx + offsetX;
        const top = m.ny * mapPx + offsetY;
        if (left < -20 || top < -20 || left > width + 20 || top > height + 20) return null;
        const size = m.ring ? 14 : 9;
        return (
          <div
            key={i}
            title={m.label}
            style={{
              position: "absolute", left: left - size / 2, top: top - size / 2,
              width: size, height: size, borderRadius: "50%",
              background: m.ring ? "transparent" : m.color,
              border: `2px solid ${m.color}`,
              boxShadow: m.ring ? `0 0 10px ${m.color}` : "0 0 0 1px rgba(0,0,0,.6)",
            }}
          />
        );
      })}
    </div>
  );
}
