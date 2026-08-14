"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * Edania bölge haritası.
 *
 * Karolar kendi sunucumuzda: /map/edania/L{seviye}/{x}_{y}.webp
 * Seviyeler 16/32/64/128 — piksel/sektör oranı. Karo 512px, dünya 256 sektör
 * kare, yani seviye L'de ızgara 256/(512/L) = L/2 karo.
 *
 * Leaflet zoom'u ızgara boyutuna bağlı: zoom z'de 2^z karo.
 * L16 → 8 karo → zoom 3 ... L128 → 64 karo → zoom 6.
 */

const TILE = 512;
/** Dünya karesinin kenar uzunluğu, Leaflet CRS.Simple biriminde */
const WORLD = 512;

export const MIN_ZOOM = 3;
export const MAX_ZOOM = 6;

/** Edania karolarının kapladığı kutu — dünya karesinde 0–1 */
export const EDANIA_BOX = { x0: 45 / 64, x1: 60 / 64, y0: 17 / 64, y1: 29 / 64 };

/** Dünya-normalize (0–1) → Leaflet CRS.Simple */
export function normToLatLng(nx: number, ny: number): [number, number] {
  return [-ny * WORLD, nx * WORLD];
}

/** Leaflet CRS.Simple → dünya-normalize (0–1) */
export function latLngToNorm(lat: number, lng: number): { nx: number; ny: number } {
  return { nx: lng / WORLD, ny: -lat / WORLD };
}

export type EdaniaMarker = {
  id: number;
  nx: number;
  ny: number;
  color: string;
  label: string;
  done?: boolean;
};

type Props = {
  markers: EdaniaMarker[];
  onMarkerClick?: (id: number) => void;
  /** Haritaya tıklayınca konum döner — nokta eklerken kullanılır */
  onMapClick?: (nx: number, ny: number) => void;
  selectedId?: number | null;
  className?: string;
};

export default function EdaniaMap({
  markers, onMarkerClick, onMapClick, selectedId, className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<Map<number, LeafletMarker>>(new Map());
  // Kapanış (closure) tazeliği: olay işleyicileri ref üzerinden okur
  const clickRef = useRef(onMarkerClick);
  const mapClickRef = useRef(onMapClick);
  clickRef.current = onMarkerClick;
  mapClickRef.current = onMapClick;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const sw = normToLatLng(EDANIA_BOX.x0, EDANIA_BOX.y1);
      const ne = normToLatLng(EDANIA_BOX.x1, EDANIA_BOX.y0);
      const bounds = L.latLngBounds(sw, ne);

      const map = L.map(containerRef.current, {
        crs: L.CRS.Simple,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        zoomControl: true,
        attributionControl: false,
        maxBounds: bounds.pad(0.08),
        maxBoundsViscosity: 0.9,
      });
      map.fitBounds(bounds);

      // Seviye adı zoom'dan türer: zoom 3 → L16 ... zoom 6 → L128
      const EdaniaTiles = L.TileLayer.extend({
        getTileUrl(coords: { x: number; y: number; z: number }) {
          const level = 16 * Math.pow(2, coords.z - MIN_ZOOM);
          return `/map/edania/L${level}/${coords.x}_${coords.y}.webp`;
        },
      });

      new (EdaniaTiles as unknown as new (o: object) => ReturnType<typeof L.tileLayer>)({
        tileSize: TILE,
        noWrap: true,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        bounds,
        // Kutu dışındaki karolar yok — kırık görsel yerine şeffaf kalsınlar
        errorTileUrl:
          "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
      }).addTo(map);

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (!mapClickRef.current) return;
        const n = latLngToNorm(e.latlng.lat, e.latlng.lng);
        mapClickRef.current(n.nx, n.ny);
      });

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current.clear();
    };
  }, []);

  // İşaretçileri tazele
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    (async () => {
      const L = (await import("leaflet")).default;
      const live = layerRef.current;
      const seen = new Set<number>();

      for (const m of markers) {
        seen.add(m.id);
        const isSel = selectedId === m.id;
        const r = isSel ? 9 : m.done ? 5 : 7;
        const html =
          `<div style="width:${r * 2}px;height:${r * 2}px;border-radius:50%;` +
          `background:${m.done ? "transparent" : m.color};` +
          `border:2px solid ${m.color};opacity:${m.done ? 0.45 : 1};` +
          `box-shadow:0 0 0 1px rgba(0,0,0,.55)${isSel ? `,0 0 12px ${m.color}` : ""};"></div>`;

        const icon = L.divIcon({
          html, className: "", iconSize: [r * 2, r * 2], iconAnchor: [r, r],
        });

        const existing = live.get(m.id);
        if (existing) {
          existing.setLatLng(normToLatLng(m.nx, m.ny));
          existing.setIcon(icon);
        } else {
          const mk = L.marker(normToLatLng(m.nx, m.ny), { icon, title: m.label })
            .addTo(map)
            .on("click", () => clickRef.current?.(m.id));
          live.set(m.id, mk);
        }
      }

      live.forEach((mk, id) => {
        if (!seen.has(id)) { mk.remove(); live.delete(id); }
      });
    })();
  }, [markers, selectedId]);

  return <div ref={containerRef} className={className} />;
}
