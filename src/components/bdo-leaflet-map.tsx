"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, Polyline } from "leaflet";
// Static import → CSS bundled with the component, no async CDN load
import "leaflet/dist/leaflet.css";

// ── BDO World tile constants ─────────────────────────────────────────────────
// Tile URL: https://bdocodex.com/zonemap/main/{z}/{x}/{y}.webp
// Available zoom levels: 1–9
// At zoom 3 (scale = 2^3 = 8, tileSize = 256):
//   tile_x = ⌊lng × 8 / 256⌋  →  x=1..5  →  lng ∈ [32, 192)
//   tile_y = ⌊−lat × 8 / 256⌋ →  y=3..6  →  lat ∈ (−224, −96]
export const TILE_URL = "https://bdocodex.com/zonemap/main/{z}/{x}/{y}.webp";

// Main BDO world bounds in Leaflet CRS.Simple coordinates
const Z3 = Math.pow(2, 3); // 8
const T  = 256;             // tile size

export const SW_LAT = -(7 * T) / Z3; // −224  south edge of tile y=6
export const NE_LAT = -(3 * T) / Z3; // −96   north edge of tile y=3
export const SW_LNG =  (1 * T) / Z3; //  32   west  edge of tile x=1
export const NE_LNG =  (6 * T) / Z3; //  192  east  edge of tile x=5 (exclusive)

const LAT_RANGE = NE_LAT - SW_LAT; //  128
const LNG_RANGE = NE_LNG - SW_LNG; //  160

export const BDO_CENTER: [number, number] = [
  (SW_LAT + NE_LAT) / 2,  // −160
  (SW_LNG + NE_LNG) / 2,  //  112
];

/** Our [0,1] space → Leaflet LatLng (CRS.Simple) */
export function normToLatLng(x: number, y: number): [number, number] {
  return [
    NE_LAT - y * LAT_RANGE,  // y=0 → north (−96),  y=1 → south (−224)
    SW_LNG + x * LNG_RANGE,  // x=0 → west  (32),   x=1 → east  (192)
  ];
}

/** Leaflet LatLng (CRS.Simple) → our [0,1] space */
export function latLngToNorm(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng - SW_LNG) / LNG_RANGE,
    y: (NE_LAT - lat) / LAT_RANGE,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export interface MapMarker {
  x: number;
  y: number;
  color: "blue" | "green" | "red";
  label?: string;
}

interface Props {
  onPick?: (x: number, y: number) => void;
  markers?: MapMarker[];
  className?: string;
  initialZoom?: number;
}

export function BdoLeafletMap({
  onPick,
  markers = [],
  className = "",
  initialZoom = 3,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<LeafletMap | null>(null);
  const overlayRefs  = useRef<(LeafletMarker | Polyline)[]>([]);
  const resizeRef    = useRef<ResizeObserver | null>(null);

  // ── Init map (once) ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      const worldBounds = L.latLngBounds(
        [SW_LAT, SW_LNG],
        [NE_LAT, NE_LNG],
      );

      const map = L.map(containerRef.current!, {
        crs: L.CRS.Simple,
        minZoom: 1,
        maxZoom: 9,
        zoomControl: true,
        attributionControl: false,
        // Soft boundary — lets the user pan/zoom freely so edge tiles render
        // but snaps back when they release.
        maxBounds: worldBounds.pad(0.5),
        maxBoundsViscosity: 0.3,
      });

      // ── Tile layer — NO bounds param so all zoom levels load freely ────────
      L.tileLayer(TILE_URL, {
        tileSize: 256,
        noWrap: true,
        minZoom: 1,
        maxZoom: 9,
        // errorTileUrl: "" keeps failed tiles transparent instead of broken-img
      }).addTo(map);

      map.fitBounds(worldBounds);
      map.setZoom(initialZoom);

      // Click → pick
      if (onPick) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          const norm = latLngToNorm(e.latlng.lat, e.latlng.lng);
          onPick(
            Math.max(0, Math.min(1, norm.x)),
            Math.max(0, Math.min(1, norm.y)),
          );
        });
      }

      mapRef.current = map;

      // Leaflet reads container dimensions at init time. In a flex / fixed
      // layout the browser may not have finished painting, so we invalidate
      // the size at several points to guarantee correct click coordinates.
      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 100);
      setTimeout(() => map.invalidateSize(), 400);

      // Also re-invalidate on any container resize (window resize, etc.)
      resizeRef.current = new ResizeObserver(() => map.invalidateSize());
      if (containerRef.current) {
        resizeRef.current.observe(containerRef.current);
      }
    });

    return () => {
      resizeRef.current?.disconnect();
      resizeRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync markers whenever they change ─────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      // Remove previous overlays
      overlayRefs.current.forEach((o) => o.remove());
      overlayRefs.current = [];

      const COLORS: Record<string, string> = {
        blue:  "#3b82f6",
        green: "#22c55e",
        red:   "#ef4444",
      };

      markers.forEach(({ x, y, color, label }) => {
        const [lat, lng] = normToLatLng(x, y);

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              position:relative;
              width:16px; height:16px; border-radius:50%;
              background:${COLORS[color] ?? "#fff"};
              border:2.5px solid white;
              box-shadow:0 0 6px rgba(0,0,0,.7);
            "></div>
            ${label ? `<div style="
              position:absolute; top:18px; left:50%; transform:translateX(-50%);
              background:rgba(0,0,0,.75); color:#fff; font-size:10px; font-weight:600;
              padding:1px 5px; border-radius:3px; white-space:nowrap;
            ">${label}</div>` : ""}
          `,
          iconSize:   [16, 16],
          iconAnchor: [8,  8],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);
        overlayRefs.current.push(marker);
      });

      // Dashed line between first two markers
      if (markers.length >= 2) {
        const [lat1, lng1] = normToLatLng(markers[0].x, markers[0].y);
        const [lat2, lng2] = normToLatLng(markers[1].x, markers[1].y);
        const line = L.polyline([[lat1, lng1], [lat2, lng2]], {
          color: "white",
          dashArray: "5 4",
          weight: 2,
          opacity: 0.75,
        }).addTo(map);
        overlayRefs.current.push(line as unknown as LeafletMarker);
      }
    });
  }, [markers]);

  // The outer div establishes the flex / grid cell size (className controls this).
  // The inner div is absolute-filled so Leaflet always gets an exact, unambiguous
  // bounding rect — this prevents the offsetHeight vs. getBoundingClientRect
  // mismatch that causes click coordinates to be offset in the upper half.
  return (
    <div className={className} style={{ position: "relative", minHeight: 0 }}>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, background: "#1a1a2e" }}
      />
    </div>
  );
}
