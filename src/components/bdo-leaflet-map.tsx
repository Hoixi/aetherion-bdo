"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";

// ── BDO World coordinate constants ──────────────────────────────────────────
// Tile URL: https://bdocodex.com/zonemap/main/{z}/{x}/{y}.webp
// At zoom 3 (scale = 2^3 = 8, tileSize = 256):
//   tile_x = floor(lng * 8 / 256)   → tiles x=1..5 → lng ∈ [32, 192)
//   tile_y = floor(-lat * 8 / 256)  → tiles y=3..6 → lat ∈ (-224, -96]
const SW_LAT = -(7 * 256) / 8;  // -224   (south / bottom)
const NE_LAT = -(3 * 256) / 8;  // -96    (north / top)
const SW_LNG =  (1 * 256) / 8;  //  32    (west  / left)
const NE_LNG =  (6 * 256) / 8;  //  192   (east  / right)
const LAT_RANGE = NE_LAT - SW_LAT; //  128
const LNG_RANGE = NE_LNG - SW_LNG; //  160

export const TILE_URL = "https://bdocodex.com/zonemap/main/{z}/{x}/{y}.webp";
export const BDO_CENTER: [number, number] = [-160, 112];
export const BDO_SW: [number, number] = [SW_LAT, SW_LNG];
export const BDO_NE: [number, number] = [NE_LAT, NE_LNG];

/** Our [0,1] space → Leaflet LatLng (CRS.Simple) */
export function normToLatLng(x: number, y: number): [number, number] {
  return [
    NE_LAT - y * LAT_RANGE,   // y=0 → north, y=1 → south
    SW_LNG + x * LNG_RANGE,   // x=0 → west,  x=1 → east
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
  /** Called with normalized [0,1] coords when user clicks the map */
  onPick?: (x: number, y: number) => void;
  /** Markers to display (e.g. guess + correct location) */
  markers?: MapMarker[];
  /** When true, clicks register as guesses/picks */
  interactive?: boolean;
  className?: string;
  initialZoom?: number;
}

export function BdoLeafletMap({
  onPick,
  markers = [],
  interactive = true,
  className = "",
  initialZoom = 3,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<LeafletMarker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Dynamic import to avoid SSR issues
    import("leaflet").then((L) => {
      // Inject leaflet CSS once
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const bounds = L.latLngBounds([SW_LAT, SW_LNG], [NE_LAT, NE_LNG]);

      const map = L.map(containerRef.current!, {
        crs: L.CRS.Simple,
        minZoom: 1,
        maxZoom: 5,
        zoomControl: true,
        attributionControl: false,
        maxBounds: bounds.pad(0.1),
        maxBoundsViscosity: 1.0,
      });

      L.tileLayer(TILE_URL, {
        tileSize: 256,
        noWrap: true,
        bounds,
      }).addTo(map);

      map.fitBounds(bounds);
      map.setZoom(initialZoom);

      // Click handler
      if (onPick) {
        map.on("click", (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          const norm = latLngToNorm(lat, lng);
          onPick(
            Math.max(0, Math.min(1, norm.x)),
            Math.max(0, Math.min(1, norm.y))
          );
        });
      }

      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers whenever they change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      // Remove old markers
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current = [];

      markers.forEach(({ x, y, color, label }) => {
        const [lat, lng] = normToLatLng(x, y);

        const COLORS: Record<string, string> = {
          blue: "#3b82f6",
          green: "#22c55e",
          red: "#ef4444",
        };

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width:16px; height:16px; border-radius:50%;
              background:${COLORS[color] ?? "#fff"};
              border:2px solid white;
              box-shadow:0 0 4px rgba(0,0,0,0.6);
            "></div>
            ${label ? `<div style="
              position:absolute; top:18px; left:50%; transform:translateX(-50%);
              background:rgba(0,0,0,0.7); color:white; font-size:10px;
              padding:1px 4px; border-radius:3px; white-space:nowrap;
            ">${label}</div>` : ""}
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);
        markerRefs.current.push(marker);
      });

      // Draw a line between the first two markers if both exist
      if (markers.length >= 2) {
        const [lat1, lng1] = normToLatLng(markers[0].x, markers[0].y);
        const [lat2, lng2] = normToLatLng(markers[1].x, markers[1].y);
        const line = L.polyline([[lat1, lng1], [lat2, lng2]], {
          color: "white",
          dashArray: "5 4",
          weight: 2,
          opacity: 0.7,
        }).addTo(map);
        markerRefs.current.push(line as unknown as LeafletMarker);
      }
    });
  }, [markers]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ background: "#1a1a2e" }}
    />
  );
}
